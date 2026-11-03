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
  assert.equal(config.categories.flatMap(c => c.channels).length + 1, 50);
  assert.equal(config.categories[2].channels[4].name, '「🗳️」ᴇɴQᴜᴇᴛᴇꜱ');
  assert.equal(config.categories.find(c => c.key === 'category-15')!.channels.length, 1);
  assert.equal(config.roles[2].permissions.includes('Administrator'), false);
  assert.equal(config.roles[3].permissions.includes('BanMembers'), false);
});
test('Registros e Monitoramento aplicam políticas distintas', () => {
  const records = overwrites(config.categories.find(c => c.key === 'category-14')!, ids, 'guild');
  const monitoring = overwrites(config.categories.find(c => c.key === 'category-15')!, ids, 'guild');
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

test('Arquivos fica antes de Equipe e concede acesso explícito apenas a Owner', () => {
  const index = config.categories.findIndex(c => c.key === 'category-archives');
  assert.equal(config.categories[index + 1].key, 'category-13');
  assert.equal(config.categories.at(-1)!.key, 'category-15');
  assert.equal(config.categories[index].channels.length, 2);
  const ow = overwrites(config.categories[index], ids, 'guild');
  for (const role of ['role-3', 'role-4', 'role-5', 'role-20']) {
    assert.equal(allowed(ow, ids[role], P.ViewChannel), false);
  }
  assert.equal(allowed(ow, ids['role-1'], P.ViewChannel), true);
  assert.equal(allowed(ow, ids['role-1'], P.SendMessages), true);
  assert.deepEqual(ow.map(o => o.id).sort(), ['guild', ids['role-1']].sort());
  // Cofundador still has Administrator: a channel overwrite cannot hide it from that role.
  assert.ok(config.roles[1].permissions.includes('Administrator'));
});

test('Combos e Robux ficam após Loja, com Gamepass e leitura pública', () => {
  const loja = config.categories.findIndex(c => c.key === 'category-04');
  const combos = config.categories[loja + 1];
  const robux = config.categories[loja + 2];
  assert.equal(combos.name, '🔥 • 𝗖𝗢𝗠𝗕𝗢𝗦');
  assert.equal(combos.channels.length, 0);
  assert.equal(robux.name, '💸 • 𝗥𝗢𝗕𝗨𝗫');
  assert.equal(robux.channels.length, 1);
  assert.equal(robux.channels[0].name, '「🎮」ɢᴀᴍᴇᴘᴀꜱꜱ');
  assert.equal(robux.channels[0].type, 0);
  for (const category of [combos, robux]) {
    const ow = overwrites(category, ids, 'guild');
    assert.equal(allowed(ow, ids['role-20'], P.ViewChannel), true);
    assert.equal(allowed(ow, ids['role-20'], P.SendMessages), false);
    assert.equal(allowed(ow, ids['role-4'], P.SendMessages), false);
    assert.equal(allowed(ow, ids['role-3'], P.SendMessages), true);
    assert.equal(allowed(ow, ids['role-5'], P.SendMessages), true);
  }
});

test('Tickets fica após Atendimento, vazio e privado para a equipe', () => {
  const atendimento = config.categories.findIndex(c => c.key === 'category-05');
  const tickets = config.categories[atendimento + 1];
  assert.equal(tickets.name, '🎫 • 𝗧𝗜𝗖𝗞𝗘𝗧𝗦');
  assert.equal(tickets.channels.length, 0);
  const ow = overwrites(tickets, ids, 'guild');
  for (const role of ['role-6', 'role-20', 'role-21', 'role-23'])
    assert.equal(allowed(ow, ids[role], P.ViewChannel), false);
  for (const role of ['role-3', 'role-4', 'role-5']) {
    assert.equal(allowed(ow, ids[role], P.ViewChannel), true);
    assert.equal(allowed(ow, ids[role], P.SendMessages), true);
  }
  assert.equal(config.categories.at(-1)!.key, 'category-15');
});

test('lote adiciona somente as três categorias e Gamepass, preserva o restante e pode ser repetido', async () => {
  const s = fixture();
  const batch = config.categoryBatch;
  const batchCategories = config.categories.filter(c => batch.includes(c.key));
  const entries = batchCategories.flatMap(c => [c, ...c.channels]);
  const removedIds = new Set(entries.map(e => ids[e.key]));
  const liveIds = { ...ids };
  entries.forEach(e => delete liveIds[e.key]);
  s.channels = s.channels.filter(c => !removedIds.has(c.id));
  s.channels.filter(c => c.type === 4).forEach((c, i) => { c.position = i; });
  // Settings previously customized by the operator must stay intact.
  s.guild.name = 'KAMUI';
  s.guild.verification_level = 2;
  s.rules = [];
  s.roles.find(r => r.id === 'guild')!.permissions = bits([...config.everyone, 'EmbedLinks']);
  const chat = s.channels.find(c => c.id === ids['channel-03-1'])!;
  chat.permission_overwrites.push(access('other-bot', 'publish'));
  const untouched = JSON.stringify({ guild: s.guild, roles: s.roles, rules: s.rules, chat });
  preflight(s, liveIds, batch);
  const plan = preview(s, liveIds, batch);
  assert.deepEqual(plan.filter(a => a.operation === 'criar').map(a => a.label).sort(), entries.map(e => e.name).sort());
  const created: string[] = [];
  const api: Transport = {
    get: async () => { assert.fail('Lote não consulta nem altera cargos'); },
    post: async (path, body) => {
      assert.equal(path, '/guilds/guild/channels');
      const entry = entries.find(e => e.name === body.name)!;
      assert.ok(entry);
      const value = { id: ids[entry.key], ...body };
      s.channels.push(value);
      created.push(body.name);
      return value;
    },
    patch: async (path, body) => {
      assert.equal(path, '/guilds/guild/channels');
      assert.ok(Array.isArray(body));
      for (const value of body) {
        assert.deepEqual(Object.keys(value).sort(), ['id', 'position']);
        const channel = s.channels.find(c => c.id === value.id)!;
        assert.ok(channel);
        channel.position = value.position;
      }
      return {};
    },
  };
  let saved = 0;
  await apply(api, 'guild', s, liveIds, async () => { saved++; }, () => {}, batch);
  assert.equal(saved, 4);
  assert.equal(created.length, 4);
  assert.deepEqual(inspect(s, liveIds, batch), []);
  assert.equal(JSON.stringify({ guild: s.guild, roles: s.roles, rules: s.rules, chat }), untouched);
  assert.deepEqual(s.channels.find(c => c.id === ids['channel-robux-gamepass'])!.permission_overwrites,
    overwrites(batchCategories.find(c => c.key === 'category-robux')!, liveIds, 'guild'));
  preflight(s, liveIds, batch);
  await apply(api, 'guild', s, liveIds, async () => { saved++; }, () => {}, batch);
  assert.equal(created.length, 4);
  assert.equal(saved, 4);
  assert.deepEqual(inspect(s, liveIds, batch), []);
  assert.equal(JSON.stringify({ guild: s.guild, roles: s.roles, rules: s.rules, chat }), untouched);
});

test('lote exige estrutura anterior e cargos necessários antes de aplicar', () => {
  const s = fixture();
  assert.throws(() => preflight(s, ids, ['unknown']), /Lote/);
  const missingRole = { ...ids };
  delete missingRole['role-3'];
  assert.throws(() => preflight(s, missingRole, config.categoryBatch), /cargos da equipe/);
  const missingCategory = { ...ids };
  delete missingCategory['category-04'];
  assert.throws(() => preflight(s, missingCategory, config.categoryBatch), /categorias anteriores/);
});
