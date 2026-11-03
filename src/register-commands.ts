import { REST } from 'discord.js';
import { pathToFileURL } from 'node:url';
import type { Transport } from './modules/server-setup/engine.js';
import { CommandRegistrationError, registerUpdateCommand } from './modules/discord-update/command.js';
import { readBotEnvironment } from './modules/discord-update/environment.js';
import { safeErrorCode } from './modules/discord-update/messages.js';

export async function registerCommands(): Promise<void> {
  const env = readBotEnvironment();
  const rest = new REST({ version: '10', retries: 3 }).setToken(env.token);
  const api: Transport = {
    get: path => rest.get(path as `/${string}`),
    post: (path, body) => rest.post(path as `/${string}`, { body }),
    patch: (path, body) => rest.patch(path as `/${string}`, { body }),
  };
  const result = await registerUpdateCommand(api, env.guildId);
  console.log(result.created ? 'Comando /servidor atualizar registrado neste servidor.' : 'Comando /servidor atualizar atualizado neste servidor.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  registerCommands().catch(error => {
    console.error(JSON.stringify({ event: 'command-registration-error', code: safeErrorCode(error),
      detail: error instanceof CommandRegistrationError ? error.message : 'Confira os secrets, as permissões e o acesso do bot ao servidor.' }));
    process.exitCode = 1;
  });
}
