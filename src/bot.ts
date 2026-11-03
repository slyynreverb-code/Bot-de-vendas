import { Client, Events, GatewayIntentBits, REST } from 'discord.js';
import { pathToFileURL } from 'node:url';
import { readState } from './modules/server-setup/storage.js';
import type { Transport } from './modules/server-setup/engine.js';
import { createAuthorizer } from './modules/discord-update/access.js';
import { createUpdateController } from './modules/discord-update/controller.js';
import { readBotEnvironment } from './modules/discord-update/environment.js';
import { safeErrorCode } from './modules/discord-update/messages.js';
import { RemoteUpdateService } from './modules/discord-update/remote.js';

export async function startBot(): Promise<Client> {
  const env = readBotEnvironment();
  const rest = new REST({ version: '10', retries: 3 }).setToken(env.token);
  const api: Transport = {
    get: path => rest.get(path as `/${string}`),
    post: (path, body) => rest.post(path as `/${string}`, { body, reason: 'KAMUI: lote aprovado por /servidor atualizar' }),
    patch: (path, body) => rest.patch(path as `/${string}`, { body, reason: 'KAMUI: lote aprovado por /servidor atualizar' }),
  };
  const service = new RemoteUpdateService(api, env.guildId, { stateDir: env.stateDir, reportsDir: env.reportsDir });
  const authorize = createAuthorizer(api, env.guildId, {
    ownerRoleId: env.ownerRoleId, readState: () => readState(env.guildId, env.stateDir),
  });
  const handler = createUpdateController({ guildId: env.guildId, authorize, service,
    logError: code => console.error(JSON.stringify({ event: 'update-error', code })) });
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const pending = new Set<Promise<void>>();
  let stopping = false;
  client.on(Events.InteractionCreate, interaction => {
    if (stopping) return;
    const task = handler(interaction).catch(error => {
      console.error(JSON.stringify({ event: 'interaction-error', code: safeErrorCode(error) }));
    });
    pending.add(task);
    void task.finally(() => pending.delete(task));
  });
  client.once(Events.ClientReady, () => console.log('KAMUI online. Comando: /servidor atualizar.'));
  client.on(Events.Error, error => console.error(JSON.stringify({ event: 'gateway-error', code: safeErrorCode(error) })));
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log('Encerrando: aguardando as operações em andamento.');
    await Promise.allSettled([...pending]);
    client.destroy();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try { await client.login(env.token); }
  catch (error) { client.destroy(); throw error; }
  return client;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startBot().catch(error => {
    console.error(JSON.stringify({ event: 'startup-error', code: safeErrorCode(error),
      detail: 'Não foi possível iniciar. Confira os secrets, o ID do servidor e a conexão com o Discord.' }));
    process.exitCode = 1;
  });
}
