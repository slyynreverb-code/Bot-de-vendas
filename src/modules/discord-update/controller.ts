import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, escapeMarkdown, MessageFlags, type Interaction } from 'discord.js';
import type { AccessRequest } from './access.js';
import { safeErrorCode, safeErrorMessage } from './messages.js';
import type { UpdatePlan, UpdateResult } from './service.js';

export interface UpdateService {
  preview(): Promise<UpdatePlan>;
  apply(expectedFingerprint: string, actorId: string): Promise<UpdateResult>;
}

export interface ControllerOptions {
  guildId: string;
  authorize: (request: AccessRequest) => Promise<boolean>;
  service: UpdateService;
  now?: () => number;
  newId?: () => string;
  ttlMs?: number;
  logError?: (code: string | number | null) => void;
}

interface Session {
  userId: string;
  guildId: string;
  expiresAt: number;
  plan: UpdatePlan;
}

const prefix = 'server-update:';
const mentions = { parse: [] as never[] };
const denied = 'Este comando é restrito ao dono do servidor, ao cargo Owner autorizado ou a quem possui a permissão Administrador.';

function label(value: unknown): string {
  return escapeMarkdown(String(value ?? '').replace(/[\r\n]/g, ' ').slice(0, 110));
}

function previewContent(plan: UpdatePlan, ttlMs: number): string {
  const creations = plan.actions.filter(action => action.operation === 'criar').length;
  const lines: string[] = [];
  let length = 0;
  for (const action of plan.actions.slice(0, 9)) {
    const line = `• **${label(action.operation).slice(0, 32)}:** ${label(action.label)}`;
    if (length + line.length > 1_100) break;
    lines.push(line);
    length += line.length;
  }
  const remaining = plan.actions.length - lines.length;
  return ['**Prévia da atualização**',
    `Criações: **${creations}** · Ajustes/ordenação: **${plan.actions.length - creations}**`,
    '', ...lines, ...(remaining > 0 ? [`… e mais ${remaining} operações no plano anexado.`] : []),
    '', `Confira o plano anexado. A confirmação vale por **${Math.ceil(ttlMs / 60_000)} minutos** e só você pode usá-la.`,
    'Clique em **Aplicar alterações** para executar este lote.'].join('\n');
}

function resultContent(result: UpdateResult): string {
  const lines = result.issues.slice(0, 8).map(issue => '• ' + label(issue));
  const title = result.issues.length ? '**Atualização aplicada com pendências**' : '**Atualização concluída**';
  return [title, `Operações com alterações: **${result.changed}**.`, ...lines,
    ...(result.issues.length > lines.length ? ['Consulte as demais pendências no relatório anexado.'] : [])].join('\n');
}

/** Interactions are acknowledged before REST reads; all replies remain private. */
export function createUpdateController(options: ControllerOptions): (interaction: Interaction) => Promise<void> {
  const sessions = new Map<string, Session>();
  const now = options.now ?? Date.now;
  const newId = options.newId ?? randomUUID;
  const ttl = options.ttlMs ?? 5 * 60_000;
  let applying = false;
  const cleanup = () => {
    for (const [id, session] of sessions) if (session.expiresAt <= now()) sessions.delete(id);
  };
  const authorized = (interaction: Interaction) => options.authorize({
    guildId: interaction.guildId, userId: interaction.user.id, bot: interaction.user.bot,
  });

  return async interaction => {
    const command = interaction.isChatInputCommand() && interaction.commandName === 'servidor' &&
      interaction.options.getSubcommand(false) === 'atualizar';
    const button = interaction.isButton() && interaction.customId.startsWith(prefix);
    if (!command && !button) return;
    cleanup();
    if (interaction.guildId !== options.guildId || interaction.user.bot) {
      if (interaction.isRepliable()) await interaction.reply({ content: 'Este comando só pode ser usado por pessoas no servidor configurado.', flags: MessageFlags.Ephemeral, allowedMentions: mentions });
      return;
    }
    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
    let acknowledged = false;
    let applyingThisSession = false;
    try {
      if (interaction.isChatInputCommand()) await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      else await interaction.deferUpdate();
      acknowledged = true;
      if (!await authorized(interaction)) {
        if (interaction.isButton()) await interaction.followUp({ content: denied, flags: MessageFlags.Ephemeral, allowedMentions: mentions });
        else await interaction.editReply({ content: denied, allowedMentions: mentions });
        return;
      }
      if (interaction.isChatInputCommand()) {
        const plan = await options.service.preview();
        if (plan.guildId !== options.guildId) throw new Error('Unexpected preview guild');
        if (!plan.actions.length) {
          await interaction.editReply({ content: 'O lote aprovado já está atualizado. Nenhuma alteração é necessária.', components: [], allowedMentions: mentions });
          return;
        }
        for (const [id, session] of sessions) if (session.userId === interaction.user.id) sessions.delete(id);
        const id = newId();
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid session token');
        const session: Session = { userId: interaction.user.id, guildId: options.guildId, expiresAt: now() + ttl, plan };
        const attachment = Buffer.from(JSON.stringify({ guildId: plan.guildId, scope: plan.scope, actions: plan.actions }, null, 2));
        if (attachment.length > 7 * 1024 * 1024) throw new Error('Preview attachment too large');
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(prefix + 'apply:' + id).setLabel('Aplicar alterações').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(prefix + 'cancel:' + id).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
        );
        await interaction.editReply({ content: previewContent(plan, ttl), components: [buttons],
          files: [new AttachmentBuilder(attachment, { name: 'plano-atualizacao.json' })], allowedMentions: mentions });
        // Store only after the preview was actually delivered to the requester.
        if (sessions.size >= 200) sessions.delete(sessions.keys().next().value!);
        sessions.set(id, session);
        return;
      }
      const match = /^server-update:(apply|cancel):([a-zA-Z0-9_-]{1,64})$/.exec(interaction.customId);
      const session = match ? sessions.get(match[2]) : undefined;
      if (!match || !session || session.expiresAt <= now()) {
        await interaction.followUp({ content: 'Esta prévia expirou ou já foi utilizada. Execute /servidor atualizar novamente.', flags: MessageFlags.Ephemeral, allowedMentions: mentions });
        return;
      }
      if (session.userId !== interaction.user.id || session.guildId !== interaction.guildId) {
        await interaction.followUp({ content: 'Somente quem abriu esta prévia pode confirmá-la ou cancelá-la.', flags: MessageFlags.Ephemeral, allowedMentions: mentions });
        return;
      }
      if (match[1] === 'cancel') {
        sessions.delete(match[2]);
        await interaction.editReply({ content: 'Atualização cancelada. Nenhuma alteração foi aplicada.', components: [], attachments: [], allowedMentions: mentions });
        return;
      }
      if (applying) {
        await interaction.followUp({ content: 'Já existe uma atualização em andamento. Aguarde e gere uma nova prévia.', flags: MessageFlags.Ephemeral, allowedMentions: mentions });
        return;
      }
      applying = true;
      applyingThisSession = true;
      sessions.delete(match[2]);
      try {
        await interaction.editReply({ content: 'Aplicando o lote aprovado. Aguarde a conclusão.', components: [], attachments: [], allowedMentions: mentions });
        const result = await options.service.apply(session.plan.fingerprint, interaction.user.id);
        const report = Buffer.from(JSON.stringify({ issues: result.issues, operations: result.operations, changed: result.changed }, null, 2));
        const files = report.length <= 7 * 1024 * 1024 ? [new AttachmentBuilder(report, { name: 'resultado-atualizacao.json' })] : [];
        await interaction.editReply({ content: resultContent(result), components: [], files, allowedMentions: mentions });
      } finally { applying = false; }
    } catch (error) {
      options.logError?.(safeErrorCode(error));
      const content = safeErrorMessage(error);
      try {
        if (acknowledged) {
          if (interaction.isButton() && applyingThisSession)
            await interaction.editReply({ content: '**Atualização não concluída**\n' + content, components: [], attachments: [], allowedMentions: mentions });
          else if (interaction.isButton()) await interaction.followUp({ content, flags: MessageFlags.Ephemeral, allowedMentions: mentions });
          else await interaction.editReply({ content, components: [], allowedMentions: mentions });
        } else await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: mentions });
      } catch { /* Discord can invalidate an interaction during disconnect; do not leak request data. */ }
    }
  };
}
