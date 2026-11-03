import { config } from '../../config/destny-store.config.js';
import { access, bits, delta, equal, overwrites, type Json } from './policy.js';

export interface Transport {
  get(path: string): Promise<any>;
  post(path: string, body: Json): Promise<any>;
  patch(path: string, body: Json | Json[]): Promise<any>;
}
export interface Snapshot { guild: Json; roles: Json[]; channels: Json[]; rules: Json[]; member: Json; user: Json }
export async function snapshot(api: Transport, guildId: string): Promise<Snapshot> {
  const guild = await api.get('/guilds/' + guildId);
  const roles = await api.get('/guilds/' + guildId + '/roles');
  const channels = await api.get('/guilds/' + guildId + '/channels');
  const rules = await api.get('/guilds/' + guildId + '/auto-moderation/rules');
  const user = await api.get('/users/@me');
  const member = await api.get('/guilds/' + guildId + '/members/' + user.id);
  return { guild, roles, channels, rules, user, member };
}
export function resolve(s: Snapshot, state: Record<string, string>): Record<string, string> {
  const ids: Record<string, string> = {};
  function one(key: string, name: string, source: Json[], type?: number, parent?: string) {
    let entity = state[key] ? source.find(x => x.id === state[key]) : undefined;
    if (entity && type !== undefined && entity.type !== type) throw new Error('Tipo em conflito: ' + name);
    if (!entity) {
      const sameName = source.filter(x => x.name === name && (parent === undefined || x.parent_id === parent));
      if (type !== undefined && sameName.some(x => x.type !== type)) throw new Error('Tipo em conflito: ' + name);
      let matches = sameName.filter(x => type === undefined || x.type === type);
      if (parent !== undefined) matches = matches.filter(x => x.parent_id === parent);
      if (matches.length > 1) throw new Error('Nome ambíguo; nenhuma alteração aplicada: ' + name);
      entity = matches[0];
    }
    if (entity) ids[key] = entity.id;
  }
  config.roles.forEach(r => one(r.key, r.name, s.roles));
  config.categories.forEach(c => one(c.key, c.name, s.channels, 4));
  one(config.status.key, config.status.name, s.channels, 0);
  for (const c of config.categories) for (const ch of c.channels) {
    // Parent identity is essential: Base/Nightfall/Firstlight occur in multiple categories.
    if (ids[c.key]) one(ch.key, ch.name, s.channels, ch.type, ids[c.key]);
    else if (state[ch.key]) one(ch.key, ch.name, s.channels.filter(x => x.id === state[ch.key]), ch.type);
  }
  return ids;
}
// Discord resolves equal raw positions using snowflakes: the older role is higher.
// Match RoleManager.comparePositions; never convert IDs to Number (precision loss).
export function compareRoles(a: Json, b: Json): number {
  if (a.position !== b.position) return a.position - b.position;
  if (a.id === b.id) return 0;
  return BigInt(a.id) < BigInt(b.id) ? 1 : -1;
}
export function rolePositionPlan(roles: Json[], memberRoleIds: string[], ids: Record<string, string>, guildId: string): Json[] {
  const sorted = [...roles].sort(compareRoles);
  const highest = sorted.filter(r => memberRoleIds.includes(r.id)).at(-1);
  if (!highest) throw new Error('Cargo técnico do bot não encontrado na hierarquia.');
  const managed = config.roles.map(r => roles.find(role => role.id === ids[r.key]));
  if (managed.some(r => !r || r.managed || compareRoles(r, highest) >= 0))
    throw new Error('Mova o cargo técnico do bot acima dos cargos da loja.');
  const managedIds = new Set(managed.map(r => r!.id));
  const retained = sorted.filter(r => !managedIds.has(r.id));
  const insertion = retained.findIndex(r => r.id === highest.id);
  // Preserve all external roles relative to each other and the bot; insert the V16 block below it.
  const desired = [...retained.slice(0, insertion), ...(managed.slice().reverse() as Json[]), ...retained.slice(insertion)];
  if (desired[0]?.id !== guildId) throw new Error('@everyone deve permanecer na base.');
  if (desired.every((r, i) => r.id === sorted[i].id)) return [];
  // Same complete-list normalization used by discord.js setPosition.
  return desired.map((r, position) => ({ id: r.id, position }));
}

export function preflight(s: Snapshot, ids: Record<string, string>): void {
  if (!s.user.bot) throw new Error('Somente token de bot é permitido.');
  const memberRoles = s.roles.filter(r => s.member.roles.includes(r.id));
  const highest = [...memberRoles].sort(compareRoles).at(-1);
  const mask = memberRoles.concat(s.roles.filter(r => r.id === s.guild.id))
    .reduce((m, r) => m | BigInt(r.permissions), 0n);
  // Administrator is required to grant Administrator to the two approved roles.
  if ((mask & BigInt(bits(['Administrator']))) === 0n)
    throw new Error('O bot precisa de Administrator para configurar os cargos Owner/Cofundador.');
  if (!highest) throw new Error('Cargo técnico do bot não encontrado na hierarquia.');
  for (const r of config.roles) {
    const current = s.roles.find(x => x.id === ids[r.key]);
    if (current && (current.managed || compareRoles(current, highest) >= 0))
      throw new Error('Mova o cargo técnico do bot acima de ' + r.name + '. Cargos gerenciados não podem ser adotados.');
  }
  const approved = new Set([s.guild.id, ...Object.values(ids)]);
  for (const c of s.channels.filter(c => Object.values(ids).includes(c.id))) {
    if ((c.permission_overwrites ?? []).some((o: Json) => !approved.has(o.id)))
      throw new Error('Sobrescrita preexistente fora do planejamento em ' + c.name + '; preserve e revise antes de aplicar.');
  }
}
export function roleBody(r: Json): Json {
  return { name: r.name, color: r.color, hoist: r.hoist, mentionable: false, permissions: bits(r.permissions) };
}
export function channelBody(c: Json, category: Json | undefined, ids: Record<string, string>, guildId: string): Json {
  const body: Json = { name: c.name, type: c.type, parent_id: category ? ids[category.key] : null,
    permission_overwrites: overwrites(category, ids, guildId, c.polls === true) };
  for (const key of ['rate_limit_per_user', 'bitrate', 'user_limit', 'rtc_region'])
    if (key in c) body[key] = c[key];
  return body;
}
export function guildBody(s: Snapshot, ids: Record<string, string>): Json {
  return { name: config.name, ...config.guild,
    // Keep unrelated platform features intact.
    features: [...new Set([...(s.guild.features ?? []), 'COMMUNITY'])],
    rules_channel_id: ids['channel-01-2'], public_updates_channel_id: ids['channel-13-1'],
    safety_alerts_channel_id: ids['channel-13-1'] };
}
export function ruleBodies(ids: Record<string, string>): Json[] {
  const alert = { type: 2, metadata: { channel_id: ids['channel-13-1'] } };
  return [
    { name: 'Destny V16 - spam', event_type: 1, trigger_type: 3, enabled: true,
      actions: [{ type: 1, metadata: {} }, alert], exempt_roles: [], exempt_channels: [] },
    { name: 'Destny V16 - menções', event_type: 1, trigger_type: 5, enabled: true,
      trigger_metadata: { mention_total_limit: config.security.mentionLimit, mention_raid_protection_enabled: true },
      actions: [{ type: 1, metadata: {} }, alert], exempt_roles: [], exempt_channels: [] },
    ...(config.security.keywords.length || config.security.domains.length ? [{
      name: 'Destny V16 - palavras e domínios', event_type: 1, trigger_type: 1, enabled: true,
      trigger_metadata: { keyword_filter: [...config.security.keywords, ...config.security.domains.map(d => '*' + d + '*')] },
      actions: [{ type: 1, metadata: {} }, alert], exempt_roles: [], exempt_channels: [],
    }] : [])
  ];
}
export function ruleDelta(current: Json, wanted: Json): Json {
  // trigger_type is immutable; compare only fields managed by the project.
  const body = { ...wanted }; delete body.trigger_type;
  const compare = { ...current };
  if (body.trigger_metadata) compare.trigger_metadata = Object.fromEntries(
    Object.keys(body.trigger_metadata).map(k => [k, current.trigger_metadata?.[k]]));
  return delta(compare, body);
}
export function inspect(s: Snapshot, ids: Record<string, string>): string[] {
  const issues: string[] = [];
  const check = (label: string, current: Json | undefined, wanted: Json) => {
    if (!current) issues.push('Ausente: ' + label);
    else { const d = delta(current, wanted); if (Object.keys(d).length) issues.push('Divergência: ' + label + ' ' + JSON.stringify(d)); }
  };
  config.roles.forEach(r => check(r.name, s.roles.find(x => x.id === ids[r.key]), roleBody(r)));
  check('@everyone', s.roles.find(x => x.id === s.guild.id), { permissions: bits(config.everyone) });
  config.categories.forEach((c, i) => {
    check(c.name, s.channels.find(x => x.id === ids[c.key]), { name: c.name, type: 4, position: i,
      permission_overwrites: overwrites(c, ids, s.guild.id) });
    c.channels.forEach((ch, j) => check(ch.name, s.channels.find(x => x.id === ids[ch.key]),
      { ...channelBody(ch, c, ids, s.guild.id), position: ch.type === 2 ? 0 : j }));
  });
  check(config.status.name, s.channels.find(x => x.id === ids.status),
    { ...channelBody(config.status, undefined, ids, s.guild.id), position: 0 });
  check('Servidor', s.guild, guildBody(s, ids));
  const ordered = config.roles.map(r => s.roles.find(x => x.id === ids[r.key]));
  if (ordered.some((r, i) => !r || i > 0 && compareRoles(ordered[i - 1]!, r) <= 0)) issues.push('Hierarquia dos cargos divergente.');
  for (const body of ruleBodies(ids)) {
    const rules = s.rules.filter(r => r.name === body.name);
    if (rules.length !== 1 || rules[0].trigger_type !== body.trigger_type || Object.keys(ruleDelta(rules[0], body)).length)
      issues.push('AutoMod pendente/divergente: ' + body.name);
  }
  const extras = s.channels.filter(c => !Object.values(ids).includes(c.id));
  if (extras.length) issues.push('Elementos extras preservados: ' + extras.map(c => c.name).join(', '));
  const extraRoles = s.roles.filter(r => r.id !== s.guild.id && !r.managed && !Object.values(ids).includes(r.id));
  if (extraRoles.length) issues.push('Cargos extras preservados (podem conceder privilégios): ' + extraRoles.map(r => r.name).join(', '));
  return issues;
}
export function preview(s: Snapshot, ids: Record<string, string>): Json[] {
  const actions: Json[] = [];
  const add = (label: string, current: Json | undefined, body: Json) => {
    const changes = current ? delta(current, body) : body;
    if (!current || Object.keys(changes).length) actions.push({ operation: current ? 'atualizar' : 'criar', label, changes });
  };
  const symbolic = { ...ids };
  for (const r of config.roles) symbolic[r.key] ??= '<' + r.key + '>';
  for (const c of config.categories) symbolic[c.key] ??= '<' + c.key + '>';
  for (const c of config.categories) for (const ch of c.channels) symbolic[ch.key] ??= '<' + ch.key + '>';
  config.roles.forEach(r => add(r.name, s.roles.find(x => x.id === ids[r.key]), roleBody(r)));
  add('@everyone', s.roles.find(x => x.id === s.guild.id), { permissions: bits(config.everyone) });
  config.categories.forEach((c, i) => {
    add(c.name, s.channels.find(x => x.id === ids[c.key]), { name: c.name, type: 4, position: i,
      permission_overwrites: overwrites(c, symbolic, s.guild.id) });
    c.channels.forEach((ch, j) => add(ch.name, s.channels.find(x => x.id === ids[ch.key]),
      { ...channelBody(ch, c, symbolic, s.guild.id), position: ch.type === 2 ? 0 : j }));
  });
  add(config.status.name, s.channels.find(x => x.id === ids.status),
    { ...channelBody(config.status, undefined, symbolic, s.guild.id), position: 0 });
  add('Servidor', s.guild, guildBody(s, symbolic));
  for (const body of ruleBodies(symbolic)) {
    const current = s.rules.find(r => r.name === body.name);
    if (!current || Object.keys(ruleDelta(current, body)).length) actions.push({ operation: current ? 'atualizar' : 'criar', label: body.name, changes: body });
  }
  actions.push({ operation: 'verificar/ordenar', label: 'Hierarquia e posições exatas V16; elementos extras serão preservados.' });
  return actions;
}
export async function apply(api: Transport, guildId: string, s: Snapshot, ids: Record<string, string>,
  persist: () => Promise<void>, log: (x: Json) => void): Promise<void> {
  async function upsert(key: string, label: string, collection: string, item: string, source: Json[], body: Json) {
    const current = source.find(x => x.id === ids[key]);
    if (current) {
      const changes = delta(current, body);
      if (Object.keys(changes).length) { await api.patch(item + current.id, changes); log({ updated: label, fields: Object.keys(changes) }); }
      else log({ existing: label });
    } else {
      const result = await api.post(collection, body);
      ids[key] = result.id;
      await persist(); // Durable identity before the next operation: safe reruns after interruption.
      log({ created: label });
    }
  }
  const base = '/guilds/' + guildId;
  for (const r of config.roles) await upsert(r.key, r.name, base + '/roles', base + '/roles/', s.roles, roleBody(r));
  const everyone = s.roles.find(r => r.id === guildId)!;
  const changes = delta(everyone, { permissions: bits(config.everyone) });
  if (Object.keys(changes).length) await api.patch(base + '/roles/' + guildId, changes);
  // Re-fetch after creations; raw positions may all be 1.
  const currentRoles = await api.get(base + '/roles') as Json[];
  const positions = rolePositionPlan(currentRoles, s.member.roles, ids, guildId);
  if (positions.length) {
    await api.patch(base + '/roles', positions);
    const actual = await api.get(base + '/roles') as Json[];
    const ordered = config.roles.map(r => actual.find(role => role.id === ids[r.key]));
    if (ordered.some((r, i) => !r || i > 0 && compareRoles(ordered[i - 1]!, r) <= 0))
      throw new Error('Discord não confirmou a ordem dos cargos; nenhuma categoria foi criada nesta tentativa.');
    // Confirm the bot remains above the planned block too.
    rolePositionPlan(actual, s.member.roles, ids, guildId);
    log({ updated: 'Hierarquia dos cargos', tiedPositionsSupported: true });
  }
  for (const c of config.categories) await upsert(c.key, c.name, base + '/channels', '/channels/', s.channels,
    { name: c.name, type: 4, permission_overwrites: overwrites(c, ids, guildId) });
  await upsert('status', config.status.name, base + '/channels', '/channels/', s.channels,
    channelBody(config.status, undefined, ids, guildId));
  for (const c of config.categories) for (const ch of c.channels)
    await upsert(ch.key, ch.name, base + '/channels', '/channels/', s.channels, channelBody(ch, c, ids, guildId));
  // Parent changes were applied individually by upsert. Discord rejects multiple
  // parent_id fields in a bulk reorder (40009), even when their values are unchanged.
  const channelPositions = [
    { id: ids.status, position: 0 },
    ...config.categories.flatMap((c, i) => [
      { id: ids[c.key], position: i },
      ...c.channels.map((ch, j) => ({ id: ids[ch.key], position: ch.type === 2 ? 0 : j }))
    ])
  ];
  await api.patch(base + '/channels', channelPositions);
  try {
    const body = guildBody(s, ids);
    const d = delta(s.guild, body);
    if (Object.keys(d).length) await api.patch(base, d);
  } catch (e) {
    log({ pending: 'Comunidade/idioma/alertas; verifique requisitos no painel Discord.', code: (e as Json).code ?? 'API' });
    // Independent native settings can still be applied if Community activation is refused.
    const d = delta(s.guild, { name: config.name, verification_level: 1, explicit_content_filter: 2, default_message_notifications: 1 });
    if (Object.keys(d).length) await api.patch(base, d);
  }
  for (const body of ruleBodies(ids)) {
    try {
      const matches = s.rules.filter(r => r.name === body.name);
      if (matches.length > 1) throw new Error('Regra AutoMod ambígua');
      const current = matches[0];
      if (current && current.trigger_type !== body.trigger_type) throw new Error('Tipo AutoMod em conflito');
      if (current) {
        const d = ruleDelta(current, body);
        if (Object.keys(d).length) await api.patch(base + '/auto-moderation/rules/' + current.id, d);
      } else await api.post(base + '/auto-moderation/rules', body);
      log({ automod: body.name });
    } catch (e) { log({ pending: body.name, code: (e as Json).code ?? 'conflito/API' }); }
  }
}
