import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Transport } from '../server-setup/engine.js';

export const commandDefinition = new SlashCommandBuilder()
  .setName('servidor')
  .setDescription('Gerenciar as atualizações aprovadas da estrutura do servidor.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(command => command.setName('atualizar')
    .setDescription('Revisar e aplicar o lote de alterações aprovado no projeto.'))
  .toJSON();

export class CommandRegistrationError extends Error {}

/** Register only this guild command; never replace the bot's command collection. */
export async function registerUpdateCommand(api: Transport, guildId: string): Promise<{ created: boolean; id: string }> {
  if (!/^\d{17,20}$/.test(guildId))
    throw new CommandRegistrationError('O ID do servidor configurado está inválido.');
  const user = await api.get('/users/@me');
  if (!user.bot || !/^\d{17,20}$/.test(user.id))
    throw new CommandRegistrationError('O token configurado precisa pertencer a um bot.');
  const guild = await api.get('/guilds/' + guildId);
  if (guild.id !== guildId) throw new CommandRegistrationError('A API retornou outro servidor. Nenhum comando foi registrado.');
  const route = `/applications/${user.id}/guilds/${guildId}/commands`;
  const commands = await api.get(route);
  if (!Array.isArray(commands)) throw new CommandRegistrationError('Resposta inválida ao consultar os comandos.');
  const matches = commands.filter(command => command.name === 'servidor' && (command.type ?? 1) === 1);
  if (matches.length > 1) throw new CommandRegistrationError('Há mais de um comando servidor; revise antes de registrar.');
  const current = matches[0];
  if (!current) {
    const created = await api.post(route, commandDefinition);
    return { created: true, id: created.id };
  }
  const options = current.options ?? [];
  if (!Array.isArray(options) || options.some(option => ![1, 2].includes(option.type)))
    throw new CommandRegistrationError('O comando servidor existente usa outro formato. Ele foi preservado; revise a integração.');
  const existing = options.find(option => option.name === 'atualizar');
  if (existing && (existing.type !== 1 || (existing.options?.length ?? 0) !== 0))
    throw new CommandRegistrationError('Já existe um subcomando atualizar incompatível. Ele foi preservado; revise a integração.');
  const ownOption = commandDefinition.options![0];
  const merged = existing ? options.map(option => option.name === 'atualizar' ? ownOption : option) : [...options, ownOption];
  if (merged.length > 25) throw new CommandRegistrationError('O comando servidor já atingiu o limite de subcomandos.');
  // Other modules may have different visibility needs. Preserve their command-level
  // permissions; the updater always performs its own live authorization checks.
  const body = options.some(option => option.name !== 'atualizar')
    ? { options: merged }
    : { ...commandDefinition, options: merged };
  const updated = await api.patch(route + '/' + current.id, body);
  return { created: false, id: updated.id ?? current.id };
}
