import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags, type Interaction } from 'discord.js';
import { createUpdateController, type ControllerOptions, type UpdateService } from '../src/modules/discord-update/controller.js';
import { commandDefinition, CommandRegistrationError, registerUpdateCommand } from '../src/modules/discord-update/command.js';
import { readBotEnvironment } from '../src/modules/discord-update/environment.js';
import { UpdateError } from '../src/modules/server-setup/storage.js';
import type { UpdatePlan, UpdateResult } from '../src/modules/discord-update/service.js';
import type { Transport } from '../src/modules/server-setup/engine.js';

const guildId = '1566968913449848984';
const userId = '100000000000000001';
const otherId = '100000000000000002';
const result: UpdateResult = { issues: [], operations: [{ created: 'Categoria de teste' }], reportPath: 'reports/test.json', changed: 1 };
const plan: UpdatePlan = { guildId, scope: ['category-ticket-purchases'], actions: [{ operation: 'criar', label: 'Categoria de teste', changes: {} }], fingerprint: 'approved-plan' };

class FakeInteraction {
  guildId: string | null = guildId;
  user = { id: userId, bot: false };
  commandName = 'servidor';
  options = { getSubcommand: (_required = true) => 'atualizar' };
  customId = '';
  kind: 'command' | 'button' | 'other' = 'command';
  acknowledged = false;
  events: Array<{ method: string; body?: any }> = [];
  isChatInputCommand() { return this.kind === 'command'; }
  isButton() { return this.kind === 'button'; }
  isRepliable() { return true; }
  async deferReply(body: any) { this.acknowledged = true; this.events.push({ method: 'deferReply', body }); }
  async deferUpdate() { this.acknowledged = true; this.events.push({ method: 'deferUpdate' }); }
  async reply(body: any) { this.events.push({ method: 'reply', body }); }
  async editReply(body: any) { this.events.push({ method: 'editReply', body }); }
  async followUp(body: any) { this.events.push({ method: 'followUp', body }); }
  asInteraction() { return this as unknown as Interaction; }
}

function fixture(overrides: Partial<ControllerOptions> = {}) {
  const calls = { preview: 0, apply: [] as Array<[string, string]>, authorize: 0 };
  const service: UpdateService = {
    preview: async () => { calls.preview++; return structuredClone(plan); },
    apply: async (fingerprint, actorId) => { calls.apply.push([fingerprint, actorId]); return structuredClone(result); },
  };
  let sequence = 0;
  const handle = createUpdateController({ guildId, service, authorize: async () => { calls.authorize++; return true; },
    newId: () => 'session_' + ++sequence, ...overrides });
  return { calls, handle, service };
}

function buttons(interaction: FakeInteraction) {
  const reply = interaction.events.find(event => event.body?.components?.length)!;
  const components = reply.body.components[0].toJSON().components;
  return { apply: components[0].custom_id as string, cancel: components[1].custom_id as string };
}

function click(customId: string, id = userId) {
  const interaction = new FakeInteraction();
  interaction.kind = 'button';
  interaction.customId = customId;
  interaction.user.id = id;
  return interaction;
}

test('prévia é privada, reconhecida antes da consulta e não aplica alterações', async () => {
  const command = new FakeInteraction();
  const { handle, calls } = fixture({ authorize: async () => { assert.ok(command.acknowledged); return true; } });
  await handle(command.asInteraction());
  assert.equal(command.events[0].method, 'deferReply');
  assert.equal(command.events[0].body.flags, MessageFlags.Ephemeral);
  assert.equal(calls.preview, 1);
  assert.equal(calls.apply.length, 0);
  const reply = command.events.at(-1)!.body;
  assert.match(reply.content, /Prévia/);
  assert.ok(reply.files.length);
  assert.deepEqual(reply.allowedMentions, { parse: [] });
  assert.ok(buttons(command).apply.startsWith('server-update:apply:'));
});

test('nega usuário não autorizado sem consultar o plano ou aplicar', async () => {
  const { handle, calls } = fixture({ authorize: async () => false });
  const command = new FakeInteraction();
  await handle(command.asInteraction());
  assert.match(command.events.at(-1)!.body.content, /restrito/);
  assert.equal(calls.preview, 0);
  assert.equal(calls.apply.length, 0);
});

test('confirmação aplica somente o fingerprint aprovado e não pode ser repetida', async () => {
  const { handle, calls } = fixture();
  const command = new FakeInteraction();
  await handle(command.asInteraction());
  const button = click(buttons(command).apply);
  await handle(button.asInteraction());
  assert.deepEqual(calls.apply, [['approved-plan', userId]]);
  assert.equal(calls.authorize, 2);
  assert.equal(button.events[0].method, 'deferUpdate');
  assert.match(button.events.at(-1)!.body.content, /concluída/);
  assert.deepEqual(button.events.at(-1)!.body.components, []);
  const replay = click(button.customId);
  await handle(replay.asInteraction());
  assert.equal(calls.apply.length, 1);
  assert.match(replay.events.at(-1)!.body.content, /expirou ou já foi utilizada/);
});

test('perda de permissão após a prévia bloqueia a confirmação', async () => {
  let allowed = true;
  const { handle, calls } = fixture({ authorize: async () => allowed });
  const command = new FakeInteraction();
  await handle(command.asInteraction());
  allowed = false;
  const button = click(buttons(command).apply);
  await handle(button.asInteraction());
  assert.equal(calls.apply.length, 0);
  assert.match(button.events.at(-1)!.body.content, /restrito/);
  assert.equal(button.events.at(-1)!.body.flags, MessageFlags.Ephemeral);
});

test('outro administrador não pode usar a confirmação de quem abriu a prévia', async () => {
  const { handle, calls } = fixture();
  const command = new FakeInteraction();
  await handle(command.asInteraction());
  const button = click(buttons(command).apply, otherId);
  await handle(button.asInteraction());
  assert.equal(calls.apply.length, 0);
  assert.match(button.events.at(-1)!.body.content, /Somente quem abriu/);
});

test('expiração e nova prévia invalidam os botões antigos', async () => {
  let time = 0;
  const { handle, calls } = fixture({ now: () => time, ttlMs: 1_000 });
  const first = new FakeInteraction();
  await handle(first.asInteraction());
  time = 1_001;
  const expired = click(buttons(first).apply);
  await handle(expired.asInteraction());
  assert.match(expired.events.at(-1)!.body.content, /expirou/);
  const second = new FakeInteraction();
  await handle(second.asInteraction());
  const third = new FakeInteraction();
  await handle(third.asInteraction());
  const replaced = click(buttons(second).apply);
  await handle(replaced.asInteraction());
  assert.match(replaced.events.at(-1)!.body.content, /expirou/);
  assert.equal(calls.apply.length, 0);
});

test('cancelamento não aplica e remove os botões', async () => {
  const { handle, calls } = fixture();
  const command = new FakeInteraction();
  await handle(command.asInteraction());
  const button = click(buttons(command).cancel);
  await handle(button.asInteraction());
  assert.match(button.events.at(-1)!.body.content, /cancelada/);
  assert.deepEqual(button.events.at(-1)!.body.components, []);
  assert.equal(calls.apply.length, 0);
});

test('DM, servidor diferente e usuário bot nunca chegam ao serviço', async () => {
  const { handle, calls } = fixture();
  for (const mutate of [
    (i: FakeInteraction) => { i.guildId = null; },
    (i: FakeInteraction) => { i.guildId = '100000000000000999'; },
    (i: FakeInteraction) => { i.user.bot = true; },
  ]) {
    const command = new FakeInteraction(); mutate(command);
    await handle(command.asInteraction());
    assert.equal(command.events[0].method, 'reply');
    assert.equal(command.events[0].body.flags, MessageFlags.Ephemeral);
  }
  assert.equal(calls.authorize, 0);
  assert.equal(calls.preview, 0);
});

test('duas confirmações simultâneas não executam dois lotes', async () => {
  let release!: (value: UpdateResult) => void;
  let started!: () => void;
  const reached = new Promise<void>(resolve => { started = resolve; });
  const { handle, calls, service } = fixture();
  service.apply = async (fingerprint, actor) => {
    calls.apply.push([fingerprint, actor]); started();
    return new Promise(resolve => { release = resolve; });
  };
  const first = new FakeInteraction();
  const second = new FakeInteraction(); second.user.id = otherId;
  await handle(first.asInteraction()); await handle(second.asInteraction());
  const pending = handle(click(buttons(first).apply).asInteraction());
  await reached;
  const blocked = click(buttons(second).apply, otherId);
  await handle(blocked.asInteraction());
  assert.match(blocked.events.at(-1)!.body.content, /em andamento/);
  assert.equal(calls.apply.length, 1);
  release(result); await pending;
});

test('erro de plano alterado é amigável; erro REST bruto não expõe segredo', async () => {
  for (const error of [new UpdateError('PLAN_CHANGED', 'A prévia mudou. Gere outra prévia.'),
    Object.assign(new Error('authorization Bot SECRET_TOKEN https://invalid.test?token=SECRET_TOKEN'), { code: 50013 })]) {
    const { handle, service } = fixture();
    service.apply = async () => { throw error; };
    const command = new FakeInteraction(); await handle(command.asInteraction());
    const button = click(buttons(command).apply); await handle(button.asInteraction());
    const sent = JSON.stringify(button.events);
    assert.doesNotMatch(sent, /SECRET_TOKEN|authorization|invalid\.test/);
    assert.match(button.events.at(-1)!.body.content, error instanceof UpdateError ? /prévia mudou/ : /50013/);
    assert.equal(button.events.at(-1)!.method, 'editReply');
    assert.deepEqual(button.events.at(-1)!.body.components, []);
    assert.deepEqual(button.events.at(-1)!.body.attachments, []);
    service.apply = async () => result;
    const retry = new FakeInteraction(); await handle(retry.asInteraction());
    const next = click(buttons(retry).apply); await handle(next.asInteraction());
    assert.match(next.events.at(-1)!.body.content, /concluída/);
  }
});

test('nenhuma divergência não oferece botão e planos longos ficam dentro do limite', async () => {
  const { handle, service, calls } = fixture();
  service.preview = async () => ({ ...plan, actions: [] });
  const current = new FakeInteraction(); await handle(current.asInteraction());
  assert.match(current.events.at(-1)!.body.content, /já está atualizado/);
  assert.deepEqual(current.events.at(-1)!.body.components, []);
  assert.equal(calls.apply.length, 0);
  service.preview = async () => ({ ...plan, actions: Array.from({ length: 1_000 }, () => ({ operation: 'atualizar', label: '_'.repeat(200) })) });
  const large = new FakeInteraction(); await handle(large.asInteraction());
  assert.ok(large.events.at(-1)!.body.content.length < 2_000);
  assert.ok(large.events.at(-1)!.body.files.length);
});

test('ignora comandos e botões de outros módulos', async () => {
  const { handle, calls } = fixture();
  const command = new FakeInteraction(); command.commandName = 'outro';
  const button = click('ticket:close:123');
  await handle(command.asInteraction()); await handle(button.asInteraction());
  assert.equal(command.events.length, 0); assert.equal(button.events.length, 0);
  assert.equal(calls.authorize, 0);
});

function registrationFixture(existing: any[] = []) {
  const writes: Array<{ path: string; body: any; kind: string }> = [];
  const api: Transport = {
    get: async path => path === '/users/@me' ? { id: '100000000000000010', bot: true }
      : path === '/guilds/' + guildId ? { id: guildId } : existing,
    post: async (path, body) => { writes.push({ path, body, kind: 'post' }); return { id: 'new-command' }; },
    patch: async (path, body) => { writes.push({ path, body, kind: 'patch' }); return { id: 'existing-command' }; },
  };
  return { api, writes };
}

test('registra um comando de guild sem substituir a coleção de comandos', async () => {
  const { api, writes } = registrationFixture([{ id: 'other', name: 'ticket', type: 1 }]);
  assert.equal(commandDefinition.default_member_permissions, '8');
  await registerUpdateCommand(api, guildId);
  assert.equal(writes.length, 1); assert.equal(writes[0].kind, 'post');
  assert.equal(writes[0].body.name, 'servidor');
  assert.equal(writes[0].body.options[0].name, 'atualizar');
});

test('mescla atualizar preservando outros subcomandos e suas permissões', async () => {
  const other = { type: 1, name: 'status', description: 'Status público' };
  const { api, writes } = registrationFixture([{ id: 'existing-command', name: 'servidor', type: 1, options: [other], default_member_permissions: null }]);
  await registerUpdateCommand(api, guildId);
  assert.equal(writes[0].kind, 'patch');
  assert.deepEqual(writes[0].body.options[0], other);
  assert.equal(writes[0].body.options[1].name, 'atualizar');
  assert.equal(Object.hasOwn(writes[0].body, 'default_member_permissions'), false);
});

test('conflitos de comandos não são sobrescritos', async () => {
  for (const options of [[{ type: 3, name: 'texto' }], [{ type: 2, name: 'atualizar', options: [] }],
    [{ type: 1, name: 'atualizar', options: [{ type: 3, name: 'argumento' }] }]]) {
    const { api, writes } = registrationFixture([{ id: 'existing-command', name: 'servidor', type: 1, options }]);
    await assert.rejects(() => registerUpdateCommand(api, guildId), CommandRegistrationError);
    assert.equal(writes.length, 0);
  }
});

test('registro recusa ID inválido antes de consultar a API', async () => {
  const { api, writes } = registrationFixture();
  api.get = async () => assert.fail('ID inválido não pode chegar à API');
  await assert.rejects(() => registerUpdateCommand(api, 'outro-servidor'), CommandRegistrationError);
  assert.equal(writes.length, 0);
});

test('configuração de ambiente valida IDs sem imprimir os valores secretos', () => {
  const env = readBotEnvironment({ DISCORD_TOKEN: 'secret', DISCORD_GUILD_ID: guildId });
  assert.equal(env.guildId, guildId); assert.equal(env.stateDir, '.state');
  assert.equal(env.reportsDir, 'reports');
  assert.equal(readBotEnvironment({ DISCORD_TOKEN: 'secret', GUILD_ID: guildId }).guildId, guildId);
  assert.throws(() => readBotEnvironment({ DISCORD_TOKEN: 'secret', DISCORD_GUILD_ID: guildId, GUILD_ID: otherId }), /diferentes/);
  assert.throws(() => readBotEnvironment({ DISCORD_TOKEN: 'secret', DISCORD_GUILD_ID: guildId, DISCORD_OWNER_ROLE_ID: 'Owner' }), /OWNER_ROLE_ID/);
  assert.throws(() => readBotEnvironment({ DISCORD_TOKEN: 'secret' }), error => !String(error).includes('secret'));
});
