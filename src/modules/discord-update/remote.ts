import { createHash } from 'node:crypto';
import { config } from '../../config/destny-store.config.js';
import { withConfiguration } from '../../config/runtime-config.js';
import type { Transport } from '../server-setup/engine.js';
import { ServerUpdateService, UpdateError, type UpdateServiceOptions } from './service.js';

export const manifestUrl = 'https://raw.githubusercontent.com/slyynreverb-code/Bot-de-vendas/destny/estrutura-v16/server-update.json';
const fail = () => new UpdateError('INVALID_CONFIG', 'A configuração publicada no GitHub está inválida ou pertence a outro servidor.');
const record = (value: any) => value && typeof value === 'object' && !Array.isArray(value);
function keys(value: any, allowed: string[]) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) throw fail();
}
function text(value: any, max: number) { return typeof value === 'string' && value.length > 0 && value.length <= max; }

export function validateManifest(value: any, guildId: string): typeof config {
  keys(value, ['schemaVersion', 'guildId', 'categories', 'categoryBatch']);
  if (value.schemaVersion !== 1 || value.guildId !== guildId || !Array.isArray(value.categories) ||
      value.categories.length < 1 || value.categories.length > 50 || !Array.isArray(value.categoryBatch) ||
      !value.categoryBatch.length) throw fail();
  const identities = new Set<string>();
  const identity = (key: any) => {
    if (!text(key, 80) || !/^[a-z0-9-]+$/.test(key) || identities.has(key) || config.roles.some(role => role.key === key) || key === 'status') throw fail();
    identities.add(key);
  };
  let total = 0;
  for (const category of value.categories) {
    keys(category, ['key', 'name', 'channels', 'position', 'access', 'staff', 'ownerOnly']);
    identity(category.key);
    if (!text(category.name, 100) || !Number.isInteger(category.position) || category.position < 0 ||
        !['read', 'publish', 'hidden'].includes(category.access) || !Array.isArray(category.channels) ||
        category.channels.length > 50 || (category.ownerOnly !== undefined && typeof category.ownerOnly !== 'boolean')) throw fail();
    keys(category.staff, ['admin', 'moderator', 'attendant']);
    if (!['admin', 'moderator', 'attendant'].every(key => ['read', 'publish', 'hidden', 'inherit'].includes(category.staff[key]))) throw fail();
    for (const channel of category.channels) {
      keys(channel, ['key', 'name', 'type', 'position', 'rate_limit_per_user', 'bitrate', 'user_limit', 'rtc_region', 'polls']);
      identity(channel.key);
      if (!text(channel.name, 100) || ![0, 2].includes(channel.type) || !Number.isInteger(channel.position) || channel.position < 0) throw fail();
      for (const [key, max] of [['rate_limit_per_user', 21600], ['bitrate', 384000], ['user_limit', 99]] as const)
        if (channel[key] !== undefined && (!Number.isInteger(channel[key]) || channel[key] < 0 || channel[key] > max)) throw fail();
      if (channel.polls !== undefined && typeof channel.polls !== 'boolean') throw fail();
      if (channel.rtc_region !== undefined && channel.rtc_region !== null && !text(channel.rtc_region, 50)) throw fail();
    }
    total += category.channels.length;
  }
  if (total > 450 || new Set(value.categoryBatch).size !== value.categoryBatch.length ||
      value.categoryBatch.some((key: any) => !value.categories.some((category: any) => category.key === key))) throw fail();
  // Remote data cannot replace the bot token, server settings, roles or AutoMod.
  return structuredClone({ ...config, categories: value.categories, categoryBatch: value.categoryBatch });
}

export async function loadManifest(guildId: string, request: typeof fetch = fetch) {
  try {
    const response = await request(manifestUrl + '?fresh=' + Date.now(), {
      signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok || !response.body) throw fail();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 1024 * 1024) { await reader.cancel(); throw fail(); }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return { configuration: validateManifest(JSON.parse(body), guildId), revision: createHash('sha256').update(body).digest('hex') };
  } catch (error) {
    if (error instanceof UpdateError) throw error;
    throw new UpdateError('REMOTE_UNAVAILABLE', 'Não foi possível consultar a configuração no GitHub. Nenhuma alteração foi iniciada; tente novamente.');
  }
}

export class RemoteUpdateService {
  constructor(private api: Transport, private guildId: string, private options: UpdateServiceOptions = {}, private request: typeof fetch = fetch) {}
  private async run<T>(task: (service: ServerUpdateService) => Promise<T>) {
    const remote = await loadManifest(this.guildId, this.request);
    return withConfiguration(remote.configuration, () => task(new ServerUpdateService(this.api, this.guildId,
      { ...this.options, configurationRevision: remote.revision })));
  }
  preview() { return this.run(service => service.preview()); }
  apply(fingerprint: string, actorId: string) { return this.run(service => service.apply(fingerprint, actorId)); }
}
