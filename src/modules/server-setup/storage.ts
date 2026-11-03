import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class UpdateError extends Error {
  constructor(public readonly code: string, public readonly publicMessage: string) {
    super(publicMessage);
    this.name = 'UpdateError';
  }
}

export async function readState(guildId: string, stateDir = '.state'): Promise<Record<string, string>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(join(stateDir, guildId + '.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new UpdateError('INVALID_STATE', 'O estado salvo da configuração está inválido. Preserve o arquivo e revise antes de atualizar.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.entries(parsed).some(([key, value]) =>
        ['__proto__', 'constructor', 'prototype'].includes(key) || typeof value !== 'string' || !/^\d{17,20}$/.test(value))) {
    throw new UpdateError('INVALID_STATE', 'O estado salvo da configuração está inválido. Preserve o arquivo e revise antes de atualizar.');
  }
  return { ...parsed } as Record<string, string>;
}

export async function persistState(guildId: string, ids: Record<string, string>, stateDir = '.state'): Promise<void> {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const target = join(stateDir, guildId + '.json');
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify(ids, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Same filename/exclusive creation used by the terminal configurator. */
export async function withGuildLock<T>(guildId: string, stateDir: string, task: () => Promise<T>): Promise<T> {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, guildId + '.lock');
  const owner = JSON.stringify({ pid: process.pid, nonce: randomUUID(), startedAt: new Date().toISOString() });
  let handle;
  try {
    handle = await open(path, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new UpdateError('UPDATE_BUSY', 'Já existe uma atualização em andamento neste servidor. Aguarde a conclusão.');
    }
    throw error;
  }
  try {
    await handle.writeFile(owner);
    await handle.sync();
    return await task();
  } finally {
    await handle.close();
    // Never remove a replacement lock if the operator changed it meanwhile.
    try {
      if (await readFile(path, 'utf8') === owner) await rm(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
