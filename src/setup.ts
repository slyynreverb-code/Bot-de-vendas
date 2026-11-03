import { REST } from 'discord.js';
import { mkdir, open, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from './config/destny-store.config.js';
import { validateConfig, type Json } from './modules/server-setup/policy.js';
import { apply, inspect, preflight, preview, resolve, snapshot, type Transport } from './modules/server-setup/engine.js';
import { persistState, readState, UpdateError } from './modules/server-setup/storage.js';

const logs: Json[] = [];
const log = (event: Json) => { logs.push(event); console.log(JSON.stringify(event, null, 2)); };
let lockPath = '';
async function main() {
  validateConfig();
  const args = process.argv.slice(2);
  if (!['--dry-run', '--apply', '--verify'].includes(args[0]) || args.length > 2 ||
      (args.length === 2 && args[1] !== '--categories-only'))
    throw new Error('Use npm run setup:dry-run, setup:apply ou setup:verify.');
  const mode = args[0];
  const categoryKeys = args[1] === '--categories-only' ? config.categoryBatch : undefined;
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID ?? process.env.GUILD_ID;
  if (!token || !guildId || !/^\d{17,20}$/.test(guildId))
    throw new Error('Secrets DISCORD_TOKEN e DISCORD_GUILD_ID (ou GUILD_ID) ausentes/inválidos.');
  if (process.env.GUILD_ID && process.env.DISCORD_GUILD_ID && process.env.GUILD_ID !== process.env.DISCORD_GUILD_ID)
    throw new Error('GUILD_ID e DISCORD_GUILD_ID são diferentes. Corrija antes de prosseguir.');
  const rest = new REST({ version: '10', retries: 3 }).setToken(token);
  const api: Transport = {
    get: path => rest.get(path as `/${string}`),
    post: (path, body) => rest.post(path as `/${string}`, { body, reason: 'Destny Store V16: estrutura aprovada' }),
    patch: (path, body) => rest.patch(path as `/${string}`, { body, reason: 'Destny Store V16: estrutura aprovada' }),
  };
  const state = await readState(guildId);
  const before = await snapshot(api, guildId);
  const ids = resolve(before, state);
  preflight(before, ids, categoryKeys);
  const plan = preview(before, ids, categoryKeys);
  log({ mode, guild: guildId, plan });
  if (mode === '--apply') {
    if (!stdin.isTTY) throw new Error('Aplicação exige terminal interativo do operador.');
    const terminal = createInterface({ input: stdin, output: stdout });
    let confirmation: string;
    try {
      confirmation = await terminal.question('Revise a prévia. Para aplicar ao servidor ' + guildId + ', digite APLICAR ' + guildId + ': ');
    } finally { terminal.close(); }
    if (confirmation !== 'APLICAR ' + guildId) { log({ cancelled: true }); return; }
    await mkdir('.state', { recursive: true });
    const candidate = '.state/' + guildId + '.lock';
    const lock = await open(candidate, 'wx');
    lockPath = candidate;
    await lock.writeFile(String(process.pid));
    await lock.close();
    // Check again after confirmation to avoid applying against stale Discord data.
    const fresh = await snapshot(api, guildId);
    // A Discord update may have persisted new identities while the terminal
    // operator was reading the preview. Reload only after taking the same lock.
    const freshIds = resolve(fresh, await readState(guildId));
    preflight(fresh, freshIds, categoryKeys);
    for (const key of Object.keys(ids)) delete ids[key];
    Object.assign(ids, freshIds);
    const persist = () => persistState(guildId, ids);
    await persist();
    await apply(api, guildId, fresh, ids, persist, log, categoryKeys);
  }
  const after = mode === '--apply' ? await snapshot(api, guildId) : before;
  const issues = inspect(after, ids, categoryKeys);
  const report = {
    version: config.version, mode, scope: categoryKeys ?? 'full', guildId, date: new Date().toISOString(),
    counts: {
      categories: config.categories.filter(c => after.channels.some(x => x.id === ids[c.key])).length,
      channels: [config.status, ...config.categories.flatMap(c => c.channels)].filter(c => after.channels.some(x => x.id === ids[c.key])).length,
      roles: config.roles.filter(r => after.roles.some(x => x.id === ids[r.key])).length,
    },
    issues,
    pending: categoryKeys ? (categoryKeys.some(key => ['category-ticket-purchases', 'category-ticket-services', 'category-ticket-support'].includes(key))
      ? ['No Ticket King, associe Compras, Serviços e Suporte às opções correspondentes e configure o acesso individual do cliente.'] : []) : [
      ...(!config.security.keywords.length && !config.security.domains.length ? ['Lista de palavras/domínios ainda não fornecida; filtro personalizado não está ativo.'] : []),
      'Revisar proteções adicionais de raids e alertas no painel Segurança do Discord; não foram presumidas ativas.',
      'Stream habilita vídeo/compartilhamento. Não existe um bit separado chamado Video na API.',
      'Permissões somam cargos: Moderador + Atendente pode ter acesso ao Monitoramento pelo cargo Atendente. Administrator e proprietário real ignoram sobrescritas.',
      'Membros com sobrescritas individuais ou outros cargos preexistentes precisam de auditoria antes de certificar acesso efetivo.',
    ],
    operations: logs,
    projectSentMessages: false, imagesChanged: false, webhooksCreated: false,
    commercialModulesImplemented: false,
    architecture: 'Configuração isolada em src/modules/server-setup; mesmo aplicativo/token para futuras etapas.',
    complete: mode !== '--dry-run' && issues.length === 0,
  };
  await mkdir('reports', { recursive: true });
  const reportPath = categoryKeys ? 'reports/category-additions.json' : 'reports/latest.json';
  await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log('Relatório local: ' + reportPath);
  console.log(JSON.stringify({ counts: report.counts, issues, pending: report.pending, complete: report.complete }, null, 2));
  if (mode !== '--dry-run' && issues.length) process.exitCode = 1;
}
main().catch(async e => {
  // Never print raw REST errors: request data may include sensitive headers.
  const error = e as Json;
  const safe = { error: error.name ?? 'Error', code: error.code ?? null,
    detail: e instanceof UpdateError ? e.publicMessage : error.name === 'Error' ? String(error.message).replaceAll(process.env.DISCORD_TOKEN ?? '\0', '[REDACTED]') : 'Falha na API. Consulte o código e as permissões do bot.' };
  console.error(JSON.stringify(safe));
  await mkdir('reports', { recursive: true });
  await writeFile('reports/failure.json', JSON.stringify({ ...safe, operations: logs, complete: false }, null, 2), { mode: 0o600 });
  process.exitCode = 1;
}).finally(async () => { if (lockPath) await rm(lockPath, { force: true }); });
