import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../../config/destny-store.config.js';
import { apply, inspect, preflight, preview, resolve, snapshot, type Snapshot, type Transport } from '../server-setup/engine.js';
import { type Json, validateConfig } from '../server-setup/policy.js';
import { persistState, readState, UpdateError, withGuildLock } from '../server-setup/storage.js';

export { UpdateError } from '../server-setup/storage.js';

export interface UpdatePlan {
  guildId: string;
  scope: string[];
  actions: Json[];
  fingerprint: string;
}
export interface UpdateResult {
  issues: string[];
  operations: Json[];
  reportPath: string;
  changed: number;
}
export interface UpdateServiceOptions {
  stateDir?: string;
  reportsDir?: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

/** Reuses the approved category batch, never the full server reset path. */
export class ServerUpdateService {
  private readonly stateDir: string;
  private readonly reportsDir: string;

  constructor(private readonly api: Transport, private readonly guildId: string, options: UpdateServiceOptions = {}) {
    if (!/^\d{17,20}$/.test(guildId)) throw new UpdateError('INVALID_CONFIG', 'O ID do servidor está inválido.');
    this.stateDir = options.stateDir ?? '.state';
    this.reportsDir = options.reportsDir ?? 'reports';
  }

  private scope(): string[] {
    try { validateConfig(); }
    catch { throw new UpdateError('INVALID_CONFIG', 'A configuração do projeto está inválida. Revise a versão publicada do bot.'); }
    const scope = [...config.categoryBatch];
    if (!scope.length || new Set(scope).size !== scope.length || scope.some(key => !config.categories.some(c => c.key === key))) {
      throw new UpdateError('INVALID_BATCH', 'Nenhum lote válido de alterações foi definido nesta versão do bot.');
    }
    return scope;
  }

  private async prepare(): Promise<{ plan: UpdatePlan; before: Snapshot; ids: Record<string, string> }> {
    const scope = this.scope();
    const saved = await readState(this.guildId, this.stateDir);
    const before = await snapshot(this.api, this.guildId);
    if (before.guild.id !== this.guildId) throw new UpdateError('INVALID_CONFIG', 'A API retornou um servidor diferente do configurado.');
    let ids: Record<string, string>;
    try {
      ids = resolve(before, saved);
      preflight(before, ids, scope);
    } catch (error) {
      // These synchronous engine checks contain only controlled validation text.
      throw new UpdateError('NOT_READY', error instanceof Error ? error.message : 'Revise a estrutura e as permissões do bot.');
    }
    const actions = preview(before, ids, scope).filter(action => action.operation !== 'verificar/ordenar');
    const ordered = config.categories.filter(category => ids[category.key] || scope.includes(category.key));
    const positions = ordered.map((category, position) => ({
      key: category.key,
      id: ids[category.key] ?? '<' + category.key + '>',
      name: category.name,
      position,
    }));
    // engine.apply orders all planned categories that exist, even outside the
    // batch. Explicitly show those changes instead of hiding them in a footnote.
    const reordered = positions.filter(category => {
      const existing = before.channels.find(channel => channel.id === ids[category.key]);
      return existing && existing.position !== category.position;
    });
    if (reordered.length) {
      actions.push({
        operation: 'ordenar', label: 'Ordem das categorias',
        changes: positions.map(({ name, position }) => ({ name, position: position + 1 })),
      });
    }
    const fingerprint = createHash('sha256').update(canonical({
      guildId: this.guildId, scope, actions, positions,
      // Bind identities too: replacing an entity with the same name must still
      // invalidate the old confirmation, even if the visible delta is equal.
      ids,
    })).digest('hex');
    return { plan: { guildId: this.guildId, scope, actions, fingerprint }, before, ids };
  }

  async preview(): Promise<UpdatePlan> {
    return (await this.prepare()).plan;
  }

  async apply(expectedFingerprint: string, actorId: string): Promise<UpdateResult> {
    if (!/^\d{17,20}$/.test(actorId)) throw new UpdateError('INVALID_CONFIG', 'O usuário responsável pela atualização está inválido.');
    return withGuildLock(this.guildId, this.stateDir, async () => {
      const { plan, before, ids } = await this.prepare();
      if (plan.fingerprint !== expectedFingerprint) {
        throw new UpdateError('PLAN_CHANGED', 'A estrutura do servidor mudou desde a prévia. Execute /servidor atualizar novamente antes de aplicar.');
      }
      const operations: Json[] = [];
      const log = (event: Json) => { operations.push(event); };
      const persist = () => persistState(this.guildId, ids, this.stateDir);
      let failure: unknown;
      let issues: string[] = [];
      try {
        if (plan.actions.length) {
          await persist();
          await apply(this.api, this.guildId, before, ids, persist, log, plan.scope);
        }
        const after = plan.actions.length ? await snapshot(this.api, this.guildId) : before;
        issues = inspect(after, ids, plan.scope);
      } catch (error) {
        failure = error;
      }
      const reportPath = join(this.reportsDir, 'discord-update-' + this.guildId + '.json');
      // Positions are applied by the engine's bulk PATCH, without upsert logs.
      // On success report the applied plan steps, including positional changes.
      const changed = failure ? operations.filter(operation => operation.created || operation.updated).length : plan.actions.length;
      // Never store raw Discord errors, authorization headers or interaction
      // tokens. Persisted IDs let a subsequent run resume after partial failure.
      const safeFailure = failure ? {
        code: typeof (failure as Json)?.code === 'number' ? (failure as Json).code : null,
        message: 'Não foi possível concluir a atualização e sua verificação. Gere uma nova prévia para continuar.',
      } : undefined;
      await mkdir(this.reportsDir, { recursive: true, mode: 0o700 });
      await writeFile(reportPath, JSON.stringify({
        guildId: this.guildId, actorId, date: new Date().toISOString(), source: 'discord',
        scope: plan.scope, fingerprint: plan.fingerprint, operations, issues, failure: safeFailure,
        complete: !failure && issues.length === 0,
      }, null, 2), { mode: 0o600 });
      if (failure) throw failure;
      return { issues, operations, reportPath, changed };
    });
  }
}
