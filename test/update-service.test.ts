import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { config } from '../src/config/destny-store.config.js';
import { ServerUpdateService } from '../src/modules/discord-update/service.js';
import { channelBody, roleBody, type Snapshot, type Transport } from '../src/modules/server-setup/engine.js';
import { access, bits, overwrites, type Json } from '../src/modules/server-setup/policy.js';

const guildId = '1566968913449848984';
const botId = '1566929759571673229';
const botRoleId = '1700000000000000001';
const actorId = '1700000000000000002';
const externalBotRoleId = '1700000000000000003';
const existingTicketId = '1700000000000000004';
const customerId = '1700000000000000005';
const clone = <T>(value: T): T => structuredClone(value);

interface Call { method: 'GET' | 'POST' | 'PATCH'; path: string; body?: Json | Json[] }

function fixture(missingBatch: boolean | 'children' = false) {
  const ids: Record<string, string> = { status: '1700000000000000100' };
  config.roles.forEach((role, index) => { ids[role.key] = String(1700000000000000200n + BigInt(index)); });
  let nextChannel = 1700000000000001000n;
  for (const category of config.categories) {
    ids[category.key] = String(nextChannel++);
    for (const channel of category.channels) ids[channel.key] = String(nextChannel++);
  }
  const s: Snapshot = {
    guild: { id: guildId, name: 'KAMUI', owner_id: actorId, verification_level: 3, features: ['COMMUNITY'] },
    roles: [
      { id: guildId, name: '@everyone', permissions: bits([...config.everyone, 'EmbedLinks']), position: 0 },
      { id: botRoleId, name: 'KAMUI bot', managed: true, permissions: bits(['Administrator']), position: 28 },
      ...config.roles.map((role, index) => ({ id: ids[role.key], ...roleBody(role), position: 27 - index })),
    ],
    channels: [],
    rules: [{ id: '1700000000000003000', name: 'Proteção personalizada externa', enabled: true }],
    user: { id: botId, bot: true },
    member: { roles: [botRoleId] },
  };
  s.channels = [
    { id: ids.status, ...channelBody(config.status, undefined, ids, guildId), position: 0 },
    ...config.categories.flatMap((category, index) => [
      { id: ids[category.key], name: category.name, type: 4, position: index,
        permission_overwrites: overwrites(category, ids, guildId) },
      ...category.channels.map((channel, position) => ({ id: ids[channel.key],
        ...channelBody(channel, category, ids, guildId), position: channel.type === 2 ? 0 : position })),
    ]),
  ];
  // Existing integrations and per-customer overwrites are outside the approved batch.
  s.channels.find(channel => channel.id === ids['category-tickets'])!.permission_overwrites
    .push(access(externalBotRoleId, 'publish'));
  s.channels.find(channel => channel.id === ids['channel-03-1'])!.permission_overwrites
    .push(access(externalBotRoleId, 'publish'));
  if (!config.categoryBatch.includes('category-robux')) {
    s.channels.find(channel => channel.id === ids['category-robux'])!.permission_overwrites
      .push(access(externalBotRoleId, 'publish'));
    s.channels.find(channel => channel.id === ids['channel-robux-gamepass'])!.permission_overwrites
      .push(access(externalBotRoleId, 'publish'));
  }
  s.channels.push({ id: existingTicketId, name: 'atendimento-em-andamento', type: 0, position: 0,
    parent_id: ids['category-tickets'],
    permission_overwrites: [{ id: customerId, type: 1, allow: bits(['ViewChannel']), deny: '0' }] });

  if (missingBatch) {
    const removed = new Set(config.categories.filter(category => config.categoryBatch.includes(category.key))
      .flatMap(category => [
        ...(missingBatch === true ? [ids[category.key]] : []),
        ...category.channels.map(channel => ids[channel.key]),
      ]));
    s.channels = s.channels.filter(channel => !removed.has(channel.id));
    s.channels.filter(channel => channel.type === 4).forEach((channel, index) => { channel.position = index; });
  }
  return { s, ids };
}

function fakeTransport(s: Snapshot, ids: Record<string, string>) {
  const calls: Call[] = [];
  const created: Json[] = [];
  const selectedIds = new Set(config.categories.filter(category => config.categoryBatch.includes(category.key))
    .flatMap(category => [ids[category.key], ...category.channels.map(channel => ids[channel.key])]));
  const plannedCategoryIds = new Set(config.categories.map(category => ids[category.key]));
  let postCount = 0;
  let failOnPost: number | undefined;
  let beforePost: (() => Promise<void>) | undefined;
  let pendingReadFailure: { path: string; error: Error } | undefined;
  const api: Transport = {
    get: async path => {
      calls.push({ method: 'GET', path });
      if (pendingReadFailure?.path === path) {
        const { error } = pendingReadFailure;
        pendingReadFailure = undefined;
        throw error;
      }
      if (path === '/guilds/' + guildId) return clone(s.guild);
      if (path === '/guilds/' + guildId + '/roles') return clone(s.roles);
      if (path === '/guilds/' + guildId + '/channels') return clone(s.channels);
      if (path === '/guilds/' + guildId + '/auto-moderation/rules') return clone(s.rules);
      if (path === '/users/@me') return clone(s.user);
      if (path === '/guilds/' + guildId + '/members/' + botId) return clone(s.member);
      assert.fail('Consulta não prevista pelo serviço: ' + path);
    },
    post: async (path, body) => {
      calls.push({ method: 'POST', path, body: clone(body) });
      postCount++;
      assert.equal(path, '/guilds/' + guildId + '/channels');
      const selected = config.categories.filter(category => config.categoryBatch.includes(category.key));
      const category = body.type === 4
        ? selected.find(entry => entry.name === body.name)
        : selected.find(entry => ids[entry.key] === body.parent_id);
      assert.ok(category, 'Nenhum elemento fora do lote pode ser criado');
      const entry = body.type === 4 ? category
        : category.channels.find(channel => channel.name === body.name && channel.type === body.type);
      assert.ok(entry, 'Canal filho precisa pertencer à categoria aprovada');
      if (body.type !== 4) assert.ok(s.channels.some(channel => channel.id === body.parent_id && channel.type === 4));
      if (beforePost) await beforePost();
      if (postCount === failOnPost) throw new Error('Falha simulada antes da criação remota');
      assert.equal(s.channels.some(channel => channel.id === ids[entry.key]), false, 'Não duplicar categoria ou canal');
      const position = body.type === 4 ? s.channels.filter(channel => channel.type === 4).length
        : s.channels.filter(channel => channel.parent_id === body.parent_id && channel.type === body.type).length;
      const value = { id: ids[entry.key], ...clone(body), position };
      s.channels.push(value);
      created.push(clone(value));
      return clone(value);
    },
    patch: async (path, body) => {
      calls.push({ method: 'PATCH', path, body: clone(body) });
      if (path === '/guilds/' + guildId + '/channels') {
        assert.ok(Array.isArray(body));
        for (const item of body) {
          assert.deepEqual(Object.keys(item).sort(), ['id', 'position']);
          assert.ok(plannedCategoryIds.has(item.id) || selectedIds.has(item.id),
            'Ordenação não pode alterar tickets ou canais fora do lote');
          const channel = s.channels.find(entry => entry.id === item.id);
          assert.ok(channel);
          channel.position = item.position;
        }
      } else {
        const id = path.replace('/channels/', '');
        assert.equal(path, '/channels/' + id);
        assert.ok(selectedIds.has(id), 'Propriedades só podem mudar em elementos do lote');
        assert.equal(Array.isArray(body), false);
        const channel = s.channels.find(entry => entry.id === id);
        assert.ok(channel);
        Object.assign(channel, clone(body));
      }
      return {};
    },
  };
  return {
    api, calls, created,
    mutations: () => calls.filter(call => call.method !== 'GET'),
    failPost: (number?: number) => { failOnPost = number; },
    setBeforePost: (callback?: () => Promise<void>) => { beforePost = callback; },
    failNextGet: (path: string, error: Error) => { pendingReadFailure = { path, error }; },
  };
}

async function environment(t: TestContext, missingBatch: boolean | 'children' = false) {
  const directory = await mkdtemp(join(tmpdir(), 'kamui-update-service-'));
  t.after(async () => { await rm(directory, { recursive: true, force: true }); });
  const options = { stateDir: join(directory, '.state'), reportsDir: join(directory, 'reports') };
  const { s, ids } = fixture(missingBatch);
  const transport = fakeTransport(s, ids);
  const service = new ServerUpdateService(transport.api, guildId, options);
  return { directory, options, s, ids, ...transport, service };
}

function preservedSettings(s: Snapshot, ids: Record<string, string>) {
  const scoped = new Set(config.categories.filter(category => config.categoryBatch.includes(category.key))
    .flatMap(category => [ids[category.key], ...category.channels.map(channel => ids[channel.key])]));
  return clone({ guild: s.guild, roles: s.roles, rules: s.rules,
    channels: s.channels.filter(channel => !scoped.has(channel.id))
      .map(channel => { const retained = { ...channel }; if (channel.type === 4) delete retained.position; return retained; }) });
}

test('prévia do comando lê o lote aprovado sem escrever no Discord ou no disco', async t => {
  const env = await environment(t, 'children');
  const before = clone(env.s);
  const plan = await env.service.preview();
  assert.equal(plan.guildId, guildId);
  assert.deepEqual(plan.scope, config.categoryBatch);
  const creations = plan.actions.filter(action => action.operation === 'criar');
  assert.deepEqual(creations.map(action => action.label),
    config.categories.filter(category => config.categoryBatch.includes(category.key)).flatMap(category => category.channels.map(channel => channel.name)));
  assert.equal(creations.length, 3);
  assert.ok(creations.every(action => action.changes.type === 0 && action.changes.parent_id === env.ids['category-combos']));
  assert.equal(typeof plan.fingerprint, 'string');
  assert.ok(plan.fingerprint.length > 0);
  assert.deepEqual(env.s, before);
  assert.deepEqual(env.mutations(), []);
  await assert.rejects(stat(env.options.stateDir), { code: 'ENOENT' });
  await assert.rejects(stat(env.options.reportsDir), { code: 'ENOENT' });
});

test('lote Combos cria três canais e ordena Robux → Combos → Contas preservando Gamepass e tickets', async t => {
  const env = await environment(t, 'children');
  assert.deepEqual(config.categoryBatch, ['category-combos']);
  const oldOrder = config.categories.filter(category => !['category-combos', 'category-robux'].includes(category.key));
  const loja = oldOrder.findIndex(category => category.key === 'category-04');
  oldOrder.splice(loja + 1, 0,
    config.categories.find(category => category.key === 'category-combos')!,
    config.categories.find(category => category.key === 'category-robux')!);
  oldOrder.forEach((category, index) => { env.s.channels.find(channel => channel.id === env.ids[category.key])!.position = index; });
  const retained = preservedSettings(env.s, env.ids);
  const originalGamepass = clone(env.s.channels.find(channel => channel.id === env.ids['channel-robux-gamepass'])!);
  const originalComboId = env.ids['category-combos'];
  const plan = await env.service.preview();
  assert.equal(plan.actions.filter(action => action.operation === 'criar').length, 3);
  assert.ok(plan.actions.some(action => action.operation === 'ordenar'));
  const result = await env.service.apply(plan.fingerprint, actorId);
  assert.deepEqual(result.issues, []);
  assert.equal(env.created.length, 3);
  assert.deepEqual(env.created.map(channel => channel.name), [
    '「📈」ᴇᴠᴏʟᴜᴄᴀᴏ', '「⚔️」ᴇqᴜɪᴘᴀᴍᴇɴᴛᴏꜱ', '「👹」ꜰᴀʀᴍ',
  ]);
  assert.ok(env.created.every(channel => channel.type === 0 && channel.parent_id === originalComboId));
  assert.equal(env.s.channels.filter(channel => channel.id === originalComboId).length, 1);
  const productOrder = ['category-robux', 'category-combos', 'category-07'].map(key =>
    env.s.channels.find(channel => channel.id === env.ids[key])!.position);
  assert.equal(productOrder[1], productOrder[0] + 1);
  assert.equal(productOrder[2], productOrder[1] + 1);
  assert.deepEqual(env.s.channels.find(channel => channel.id === env.ids['channel-robux-gamepass']), originalGamepass);
  assert.deepEqual(preservedSettings(env.s, env.ids), retained);
  const saved = JSON.parse(await readFile(join(env.options.stateDir, guildId + '.json'), 'utf8'));
  for (const key of config.categoryBatch) assert.equal(saved[key], env.ids[key]);
  for (const channel of config.categories.find(category => category.key === 'category-combos')!.channels)
    assert.equal(saved[channel.key], env.ids[channel.key]);
  const second = await env.service.preview();
  assert.deepEqual(second.actions, [], 'Tudo já atualizado deve produzir uma prévia vazia');
  const beforeRepeat = env.mutations().length;
  const repeated = await env.service.apply(second.fingerprint, actorId);
  assert.equal(repeated.changed, 0);
  assert.equal(env.mutations().length, beforeRepeat, 'Uma repetição sem drift não faz POST/PATCH');
});

test('mudança no servidor após a prévia exige nova confirmação antes de qualquer escrita', async t => {
  const env = await environment(t, true);
  const plan = await env.service.preview();
  const destination = config.categories.find(category => category.key === config.categoryBatch[0])!;
  env.s.channels.push({ id: env.ids[destination.key], name: destination.name, type: 4, position: 7,
    permission_overwrites: overwrites(destination, env.ids, guildId) });
  await assert.rejects(env.service.apply(plan.fingerprint, actorId), { code: 'PLAN_CHANGED' });
  assert.deepEqual(env.mutations(), []);
});

test('prévia expõe ordenação global e aplicação só ajusta posições fora do lote', async t => {
  const env = await environment(t);
  const retained = preservedSettings(env.s, env.ids);
  const first = env.s.channels.find(channel => channel.id === env.ids[config.categories[0].key])!;
  const second = env.s.channels.find(channel => channel.id === env.ids[config.categories[1].key])!;
  [first.position, second.position] = [second.position, first.position];
  const plan = await env.service.preview();
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].operation, 'ordenar');
  const desired = plan.actions[0].changes as Json[];
  assert.equal(desired.length, config.categories.length);
  assert.equal(desired[0].name, config.categories[0].name);
  assert.equal(desired[1].name, config.categories[1].name);
  const result = await env.service.apply(plan.fingerprint, actorId);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(preservedSettings(env.s, env.ids), retained);
  assert.equal(env.created.length, 0);
  assert.equal(env.mutations().length, 1);
  assert.equal(env.mutations()[0].path, '/guilds/' + guildId + '/channels');
  assert.equal(first.position, 0);
  assert.equal(second.position, 1);
});

test('categoria recriada com o mesmo nome invalida a confirmação pelo ID', async t => {
  const env = await environment(t);
  const plan = await env.service.preview();
  assert.deepEqual(plan.actions, []);
  env.s.channels.find(channel => channel.id === env.ids[config.categoryBatch[0]])!.id = '1800000000000000000';
  await assert.rejects(env.service.apply(plan.fingerprint, actorId), { code: 'PLAN_CHANGED' });
  assert.deepEqual(env.mutations(), []);
});

test('trava compartilhada com o terminal bloqueia a aplicação sem alterar o servidor', async t => {
  const env = await environment(t, true);
  const plan = await env.service.preview();
  await mkdir(env.options.stateDir, { recursive: true });
  const lockPath = join(env.options.stateDir, guildId + '.lock');
  await writeFile(lockPath, '987654321', { flag: 'wx' });
  const otherProcess = new ServerUpdateService(env.api, guildId, env.options);
  await assert.rejects(otherProcess.apply(plan.fingerprint, actorId), { code: 'UPDATE_BUSY' });
  assert.equal(await readFile(lockPath, 'utf8'), '987654321', 'Não remover a trava que pertence a outro processo');
  assert.deepEqual(env.mutations(), []);
});

test('duas instâncias não aplicam ao mesmo tempo e a trava é liberada ao concluir', async t => {
  const env = await environment(t, true);
  const plan = await env.service.preview();
  let enter!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let firstPost = true;
  env.setBeforePost(async () => {
    if (!firstPost) return;
    firstPost = false;
    enter();
    await gate;
  });
  const applying = env.service.apply(plan.fingerprint, actorId);
  await Promise.race([entered, applying.then(() => { assert.fail('Esperava aguardar a primeira escrita'); })]);
  const second = new ServerUpdateService(env.api, guildId, env.options);
  try {
    await assert.rejects(second.apply(plan.fingerprint, actorId), { code: 'UPDATE_BUSY' });
    assert.equal(env.mutations().length, 1, 'A segunda aplicação não pode iniciar outra escrita');
  } finally { release(); }
  await applying;
  await assert.rejects(stat(join(env.options.stateDir, guildId + '.lock')), { code: 'ENOENT' });
});

test('falha parcial preserva IDs de categoria e canal e retoma sem duplicar elementos renomeados', async t => {
  const env = await environment(t, true);
  env.failPost(3);
  const plan = await env.service.preview();
  await assert.rejects(env.service.apply(plan.fingerprint, actorId));
  assert.equal(env.created.length, 2);
  const firstKey = config.categoryBatch[0];
  const firstChannel = config.categories.find(category => category.key === firstKey)!.channels[0];
  const saved = JSON.parse(await readFile(join(env.options.stateDir, guildId + '.json'), 'utf8'));
  assert.equal(saved[firstKey], env.ids[firstKey]);
  assert.equal(saved[firstChannel.key], env.ids[firstChannel.key]);
  await assert.rejects(stat(join(env.options.stateDir, guildId + '.lock')), { code: 'ENOENT' });
  env.s.channels.find(channel => channel.id === env.ids[firstKey])!.name = 'Categoria parcial renomeada';
  env.s.channels.find(channel => channel.id === env.ids[firstChannel.key])!.name = 'Canal parcial renomeado';
  env.failPost(undefined);
  const restarted = new ServerUpdateService(env.api, guildId, env.options);
  const remaining = await restarted.preview();
  assert.equal(remaining.actions.filter(action => action.operation === 'criar').length, 2);
  const result = await restarted.apply(remaining.fingerprint, actorId);
  assert.deepEqual(result.issues, []);
  assert.equal(env.created.length, 4);
  assert.equal(new Set(env.created.map(channel => channel.id)).size, 4);
  assert.equal(env.s.channels.find(channel => channel.id === env.ids[firstKey])!.name,
    config.categories.find(category => category.key === firstKey)!.name);
  assert.equal(env.s.channels.find(channel => channel.id === env.ids[firstChannel.key])!.name, firstChannel.name);
});

test('sobrescrita desconhecida dentro do lote bloqueia a prévia, sem tocar a integração', async t => {
  const env = await environment(t);
  const destination = env.s.channels.find(channel => channel.id === env.ids[config.categoryBatch[0]])!;
  destination.permission_overwrites.push(access(externalBotRoleId, 'publish'));
  const before = clone(env.s);
  await assert.rejects(env.service.preview(), /Sobrescrita/);
  assert.deepEqual(env.s, before);
  assert.deepEqual(env.mutations(), []);
});

test('estado inválido é preservado e bloqueia a prévia antes de consultar ou escrever na API', async t => {
  const env = await environment(t, true);
  await mkdir(env.options.stateDir, { recursive: true });
  const statePath = join(env.options.stateDir, guildId + '.json');
  const invalid = JSON.stringify({ 'role-1': 'ID-corrompido' });
  await writeFile(statePath, invalid);
  await assert.rejects(env.service.preview(), { code: 'INVALID_STATE' });
  assert.deepEqual(env.calls, []);
  assert.equal(await readFile(statePath, 'utf8'), invalid);
});

test('falha ao verificar após aplicar substitui sucesso antigo por relatório sanitizado e libera a trava', async t => {
  const env = await environment(t, true);
  await mkdir(env.options.reportsDir, { recursive: true });
  const reportPath = join(env.options.reportsDir, 'discord-update-' + guildId + '.json');
  await writeFile(reportPath, JSON.stringify({ complete: true, marker: 'relatório anterior' }));
  const plan = await env.service.preview();
  const sensitive = 'SYNTHETIC_AUTHORIZATION_TOKEN_DO_NOT_RECORD';
  const verificationFailure = Object.assign(new Error('Authorization: Bot ' + sensitive), {
    code: 50013,
    requestBody: { headers: { Authorization: sensitive } },
  });
  env.setBeforePost(async () => {
    // No more reads occur between category/channel creation and the final snapshot.
    env.failNextGet('/guilds/' + guildId, verificationFailure);
  });
  await assert.rejects(env.service.apply(plan.fingerprint, actorId));
  assert.equal(env.created.length, 4, 'A verificação falhou depois das criações da categoria e seus três canais');
  assert.ok(env.mutations().some(call => call.method === 'PATCH' && call.path === '/guilds/' + guildId + '/channels'));
  const reportText = await readFile(reportPath, 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(report.complete, false);
  assert.ok(report.failure);
  assert.equal(report.marker, undefined);
  assert.equal(reportText.includes(sensitive), false);
  assert.equal(reportText.includes('Authorization'), false);
  assert.equal(reportText.includes('requestBody'), false);
  const state = JSON.parse(await readFile(join(env.options.stateDir, guildId + '.json'), 'utf8'));
  for (const key of config.categoryBatch) assert.equal(state[key], env.ids[key]);
  await assert.rejects(stat(join(env.options.stateDir, guildId + '.lock')), { code: 'ENOENT' });
});

test('mudança somente na posição de um canal do lote é contabilizada como atualização', async t => {
  const previousScope = [...config.categoryBatch];
  config.categoryBatch.splice(0, config.categoryBatch.length, 'category-robux');
  try {
    const env = await environment(t);
    const gamepass = env.s.channels.find(channel => channel.id === env.ids['channel-robux-gamepass'])!;
    gamepass.position = 7;
    const plan = await env.service.preview();
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0].operation, 'atualizar');
    assert.equal(plan.actions[0].label, gamepass.name);
    assert.equal(plan.actions[0].changes.position, 0);
    const result = await env.service.apply(plan.fingerprint, actorId);
    assert.deepEqual(result.issues, []);
    assert.ok(result.changed > 0, 'O resultado deve reconhecer a alteração de posição realizada');
    assert.equal(gamepass.position, 0);
    assert.equal(env.created.length, 0);
    assert.equal(env.mutations().length, 1);
    assert.equal(env.mutations()[0].path, '/guilds/' + guildId + '/channels');
  } finally {
    config.categoryBatch.splice(0, config.categoryBatch.length, ...previousScope);
  }
});
