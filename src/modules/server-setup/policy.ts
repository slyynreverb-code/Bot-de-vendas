import { PermissionFlagsBits as P } from 'discord.js';
import { activeConfig as config } from '../../config/runtime-config.js';

export type Json = Record<string, any>;
export function bits(names: string[]): string {
  return names.reduce((mask, name) => {
    const value = (P as Record<string, bigint>)[name];
    if (value === undefined) throw new Error('Permissão não suportada: ' + name);
    return mask | value;
  }, 0n).toString();
}
const read = ['ViewChannel', 'ReadMessageHistory', 'AddReactions'];
const blocked = ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendPolls'];
export function access(id: string, mode: string): Json {
  const allow = mode === 'hidden' ? [] : mode === 'publish' ? [...read, 'SendMessages'] : read;
  const deny = mode === 'hidden' ? ['ViewChannel', ...blocked] : mode === 'read' ? blocked : [];
  return { id, type: 0, allow: bits(allow), deny: bits(deny) };
}
export function overwrites(category: Json | undefined, ids: Record<string, string>, guildId: string, polls = false): Json[] {
  const result = [access(guildId, polls ? 'read' : category?.access ?? 'read')];
  if (category?.ownerOnly) {
    // Administrator and the actual server owner always bypass overwrites in Discord.
    result.push(access(ids['role-1'], 'publish'));
    return result;
  }
  if (category) {
    for (const [name, key] of [['admin', 'role-3'], ['moderator', 'role-4'], ['attendant', 'role-5']]) {
      const mode = polls ? name === 'admin' ? 'publish' : 'read' : category.staff[name];
      if (mode !== 'inherit') result.push(access(ids[key], mode));
    }
    if (polls) {
      const admin = result.find(o => o.id === ids['role-3'])!;
      admin.allow = bits([...read, 'SendMessages', 'SendPolls']);
    }
  }
  return result;
}
export function equal(a: any, b: any): boolean {
  const normal = (v: any): any => {
    if (Array.isArray(v)) return v.map(normal).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, normal(v[k])]));
    return v;
  };
  return JSON.stringify(normal(a)) === JSON.stringify(normal(b));
}
export function delta(current: Json, wanted: Json): Json {
  return Object.fromEntries(Object.entries(wanted).filter(([k, v]) => !equal(current[k], v)));
}
export function validateConfig(): void {
  const channels = config.categories.flatMap(c => c.channels);
  if (config.categories.length < 1 || config.categories.length > 50 || channels.length > 450 || config.roles.length !== 26 ||
      config.roles.filter(r => r.hoist).length !== 21 || config.fidelity.length !== 14) throw new Error('Contagens V16 inválidas.');
  for (const group of [config.roles, config.categories, channels]) {
    if (new Set(group.map(x => x.key)).size !== group.length) throw new Error('Chaves duplicadas.');
  }
  if (config.roles[2].permissions.includes('Administrator')) throw new Error('Administrador não pode ter Administrator.');
  bits(config.everyone);
  config.roles.forEach(r => bits(r.permissions));
}
