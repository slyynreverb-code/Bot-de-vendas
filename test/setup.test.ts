import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits as P } from 'discord.js';
import { config } from '../src/config/destny-store.config.js';
import { access, bits, overwrites, validateConfig } from '../src/modules/server-setup/policy.js';
import { apply, inspect, preview, resolve } from '../src/modules/server-setup/engine.js';

import type { Snapshot, Transport } from '../src/modules/server-setup/engine.js';
import { channelBody, guildBody, roleBody, ruleBodies, preflight, compareRoles, rolePositionPlan } from '../src/modules/server-setup/engine.js';

const ids: Record<string, string> = {};
for (const r of config.roles) ids[r.key] = r.key;
for (const c of config.categories) {
  ids[c.key] = c.key;
  c.channels.forEach(ch => ids[ch.key] = ch.key);
}
ids.status = 'status';
function fixture(): Snapshot {
  const guild = { id: 'guild', features: ['COMMUNITY'] };
  const roles = [
    { id: 'guild', name: '@everyone', permissions: bits(config.everyone), position: 0 },
    { id: 'bot', managed: true, permissions: bits(['Administrator']), position: 28 },
    ...config.roles.map((r, i) => ({ id: ids[r.key], ...roleBody(r), position: 27 - i })),
  ];
  const s: Snapshot = { guild, roles, channels: [], rules: [], user: { id: 'user', bot: true }, member: { roles: ['bot'] } };
  s.guild = { ...guild, ...guildBody(s, ids) };
  s.channels = [
    { id: 'status', ...channelBody(config.status, undefined, ids, 'guild'), position: 0 },
    ...config.categories.flatMap((c, i) => [
      { id: ids[c.key], name: c.name, type: 4, position: i, permission_overwrites: overwrites(c, ids, 'guild') },
      ...c.channels.map((ch, j) => ({ id: ids[ch.key], ...channelBody(ch, c, ids, 'guild'), position: ch.type === 2 ? 0 : j })),
    ]),
  ];
  s.rules = ruleBodies(ids).map((body, i) => ({ id: 'rule-' + i, ...body }));
  return s;
}
function allowed(overrides: Record<string, any>[], roleId: string, bit: bigint): boolean {
  const everyone = overrides.find(o => o.id === 'guild')!;
  const role = overrides.find(o => o.id === roleId);
  let mask = BigInt(bits(config.everyone));
  mask = (mask & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  if (role) mask = (mask & ~BigInt(role.deny)) | BigInt(role.allow);
  return (mask & bit) === bit;
}
test('V16 quantidades, Unicode e restrições administrativas', () => {
  validateConfig();
  assert.equal(config.categories.flatMap(c => c.channels).length + 1, 47);
  assert.equal(config.categories[2].channels[4].name, '「🗳️」ᴇɴQᴜᴇᴛᴇꜱ');
  assert.equal(config.categories[14].channels.length, 1);
  assert.equal(config.roles[2].permissions.includes('Administrator'), false);
  assert.equal(config.roles[3].permissions.includes('BanMembers'), false);
});
test('Registros e Monitoramento aplicam políticas distintas', () => {
  const records = overwrites(config.categories[13], ids, 'guild');
  const monitoring = overwrites(config.categories[14], ids, 'guild');
  assert.equal(allowed(records, ids['role-4'], P.ViewChannel), true);
  assert.equal(allowed(records, ids['role-4'], P.SendMessages), false);
  assert.equal(allowed(records, ids['role-5'], P.ViewChannel), false);
  assert.equal(allowed(monitoring, ids['role-4'], P.ViewChannel), false);
  assert.equal(allowed(monitoring, ids['role-5'], P.ViewChannel), true);
  assert.equal(allowed(monitoring, ids['role-5'], P.SendMessages), false);
});
test('Enquetes bloqueia publicações e tópicos para Moderador e Atendente', () => {
  const ow = overwrites(config.categories[2], ids, 'guild', true);
  for (const role of ['role-4', 'role-5', 'role-20']) {
    for (const bit of [P.SendMessages, P.SendPolls, P.CreatePublicThreads, P.CreatePrivateThreads])
      assert.equal(allowed(ow, ids[role], bit), false);
    assert.equal(allowed(ow, ids[role], P.ViewChannel), true);
  }
  assert.equal(allowed(ow, ids['role-3'], P.SendMessages), true);
  assert.equal(allowed(ow, ids['role-3'], P.SendPolls), true);
});
test('identificação diferencia nomes repetidos pelas categorias', () => {
  const s = fixture();
  assert.deepEqual(resolve(s, {}), ids);
  s.channels.push({ ...s.channels.find(c => c.id === ids['channel-09-1'])!, id: 'duplicate' });
  assert.throws(() => resolve(s, {}), /ambíguo/);
});
test('hierarquia e sobrescritas externas bloqueiam antes de alterar', () => {
  const s = fixture();
  preflight(s, ids);
  s.roles.find(r => r.id === 'bot')!.position = 2;
  assert.throws(() => preflight(s, ids), /cargo técnico/);
  s.roles.find(r => r.id === 'bot')!.position = 28;
  s.channels[0].permission_overwrites.push(access('unknown', 'publish'));
  assert.throws(() => preflight(s, ids), /Sobrescrita/);
});
test('validação lê todas as propriedades e detecta divergências', () => {
  const s = fixture();
  assert.deepEqual(inspect(s, ids), []);
  s.roles.find(r => r.id === ids['role-3'])!.permissions = bits(['Administrator']);
  s.channels.find(c => c.id === ids['channel-03-1'])!.rate_limit_per_user = 0;
  const issues = inspect(s, ids).join('\n');
  assert.match(issues, /Administrador/);
  assert.match(issues, /ʜᴀᴛ/);
});
test('dry-run é puro e rerun não cria entidades nem escreve mensagens', async () => {
  const s = fixture();
  const before = JSON.stringify(s);
  assert.equal(preview(s, ids).some(a => a.operation === 'criar'), false);
  assert.equal(JSON.stringify(s), before);
  const calls: string[] = [];
  const api: Transport = {
    get: async path => { assert.equal(path, '/guilds/guild/roles'); return s.roles; },
    post: async () => { assert.fail('Nenhuma criação esperada em servidor configurado'); },
    patch: async (path, body) => {
      calls.push(path);
      assert.equal(path, '/guilds/guild/channels');
      assert.ok(Array.isArray(body));
      // Discord 40009: bulk reordering must never resubmit parent changes.
      for (const item of body) {
        assert.deepEqual(Object.keys(item).sort(), ['id', 'position']);
        assert.equal(Object.hasOwn(item, 'parent_id'), false);
      }
      return {};
    },
  };
  for (let i = 0; i < 2; i++) await apply(api, 'guild', s, { ...ids }, async () => {}, () => {});
  assert.deepEqual(calls, ['/guilds/guild/channels', '/guilds/guild/channels']);
});

test('posições brutas empatadas usam snowflake; bot mais antigo continua acima', () => {
  const s = fixture();
  const remapped: Record<string, string> = {};
  const botId = '100000000000000001';
  s.roles = [
    { ...s.roles[0], id: '100000000000000000' },
    { ...s.roles[1], id: botId, position: 1 },
    ...config.roles.map((r, i) => {
      const id = (100000000000000200n - BigInt(i)).toString();
      remapped[r.key] = id;
      return { id, ...roleBody(r), position: 1, managed: false };
    }),
  ];
  // Reverse the API order: array order is not the hierarchy.
  s.roles.reverse();
  s.guild.id = '100000000000000000';
  s.member.roles = [botId];
  s.channels = [];
  preflight(s, remapped);
  assert.equal(compareRoles({ id: botId, position: 1 }, { id: remapped['role-1'], position: 1 }), 1);
  const plan = rolePositionPlan(s.roles, s.member.roles, remapped, s.guild.id);
  assert.equal(plan.length, 28);
  assert.deepEqual(plan.find(r => r.id === botId), { id: botId, position: 27 });
  assert.equal(plan.find(r => r.id === remapped['role-1'])!.position, 26);
  assert.equal(plan.find(r => r.id === remapped['role-26'])!.position, 1);
  const updated = s.roles.map(r => ({ ...r, position: plan.find(p => p.id === r.id)!.position }));
  assert.deepEqual(rolePositionPlan(updated, s.member.roles, remapped, s.guild.id), []);
  preflight({ ...s, roles: updated }, remapped);
});
test('empate não autoriza cargo mais antigo que o maior cargo do bot', () => {
  const s = fixture();
  s.roles.find(r => r.id === ids['role-1'])!.id = '100000000000000001';
  s.roles.find(r => r.id === 'bot')!.id = '100000000000000002';
  s.member.roles = ['100000000000000002'];
  s.roles.forEach(r => { if (r.id !== 'guild') r.position = 1; });
  s.channels = [];
  assert.throws(() => preflight(s, { ...ids, 'role-1': '100000000000000001' }), /cargo técnico/);
});
