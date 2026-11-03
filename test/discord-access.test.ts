import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { createAuthorizer, type AccessRequest } from '../src/modules/discord-update/access.js';
import type { Transport } from '../src/modules/server-setup/engine.js';

const guildId = '1566968913449848984';
const userId = '1567254294783201311';
const ownerUserId = '1567254332238340297';
const ownerRoleId = '1567254367634067577';
const otherRoleId = '1567254399900844032';
const adminRoleId = '1567254486274023444';
const request: AccessRequest = { guildId, userId, bot: false };

function fixture() {
  const live = {
    guild: { id: guildId, owner_id: ownerUserId },
    member: { user: { id: userId, bot: false }, roles: [] as string[] },
    roles: [
      { id: guildId, name: '@everyone', managed: false, permissions: '0' },
      { id: ownerRoleId, name: '👑 Owner', managed: false, permissions: '0' },
      { id: otherRoleId, name: 'Moderador', managed: false, permissions: String(PermissionFlagsBits.ManageGuild) },
      { id: adminRoleId, name: 'Equipe', managed: false, permissions: String(PermissionFlagsBits.Administrator) },
    ],
  };
  const calls: string[] = [];
  let memberError: unknown;
  const api: Transport = {
    get: async path => {
      calls.push(path);
      if (path === '/guilds/' + guildId) return structuredClone(live.guild);
      if (path === '/guilds/' + guildId + '/members/' + userId) {
        if (memberError) throw memberError;
        return structuredClone(live.member);
      }
      if (path === '/guilds/' + guildId + '/roles') return structuredClone(live.roles);
      assert.fail('Chamada inesperada: ' + path);
    },
    post: async () => assert.fail('Autorização não pode escrever no Discord'),
    patch: async () => assert.fail('Autorização não pode escrever no Discord'),
  };
  return { live, calls, api, failMember: (error: unknown) => { memberError = error; } };
}

test('autoriza dono real, Administrator e o ID aprovado de Owner', async () => {
  const f = fixture();
  const authorize = createAuthorizer(f.api, guildId, { ownerRoleId });
  assert.equal(await authorize(request), false);
  f.live.guild.owner_id = userId;
  assert.equal(await authorize(request), true);
  f.live.guild.owner_id = ownerUserId;
  f.live.member.roles = [adminRoleId];
  assert.equal(await authorize(request), true);
  f.live.member.roles = [ownerRoleId];
  assert.equal(await authorize(request), true);
  assert.equal(f.calls.length, 12);
});

test('resolve Owner pelo ID salvo e aceita renomeação legítima sem confiar no nome', async () => {
  const f = fixture();
  f.live.roles.find(role => role.id === ownerRoleId)!.name = 'Fundador';
  f.live.member.roles = [ownerRoleId];
  const authorize = createAuthorizer(f.api, guildId, { readState: async () => ({ 'role-1': ownerRoleId }) });
  assert.equal(await authorize(request), true);
  f.live.member.roles = [otherRoleId];
  f.live.roles.find(role => role.id === otherRoleId)!.name = '👑 Owner';
  assert.equal(await authorize(request), false);
});

test('nome Owner e ManageGuild sozinhos não autorizam', async () => {
  const f = fixture();
  const authorize = createAuthorizer(f.api, guildId);
  f.live.member.roles = [ownerRoleId];
  assert.equal(await authorize(request), false);
  f.live.member.roles = [otherRoleId];
  assert.equal(await authorize(request), false);
});

test('reconsulta cargos e vínculo Owner a cada clique e bloqueia revogações', async () => {
  const f = fixture();
  f.live.member.roles = [adminRoleId];
  let storedOwner = ownerRoleId;
  const authorize = createAuthorizer(f.api, guildId, { readState: async () => ({ 'role-1': storedOwner }) });
  assert.equal(await authorize(request), true);
  f.live.roles.find(role => role.id === adminRoleId)!.permissions = '0';
  assert.equal(await authorize(request), false);
  f.live.member.roles = [ownerRoleId];
  assert.equal(await authorize(request), true);
  storedOwner = otherRoleId;
  assert.equal(await authorize(request), false);
});

test('nega DM, servidor diferente, bots e usuário inválido antes de consultar a API', async () => {
  const f = fixture();
  const authorize = createAuthorizer(f.api, guildId, { ownerRoleId });
  assert.equal(await authorize({ ...request, guildId: null }), false);
  assert.equal(await authorize({ ...request, guildId: '1567254522215268445' }), false);
  assert.equal(await authorize({ ...request, bot: true }), false);
  assert.equal(await authorize({ ...request, userId: '../users' }), false);
  assert.deepEqual(f.calls, []);
});

test('membro removido é negado e erros inesperados continuam para tratamento seguro', async () => {
  const f = fixture();
  const authorize = createAuthorizer(f.api, guildId);
  f.failMember({ status: 404, code: 10007 });
  assert.equal(await authorize(request), false);
  f.failMember({ code: 10007 });
  assert.equal(await authorize(request), false);
  const error = Object.assign(new Error('erro REST privado'), { status: 403 });
  f.failMember(error);
  await assert.rejects(authorize(request), value => value === error);
});

test('Owner inexistente, gerenciado ou salvo com ID inválido não concede acesso', async () => {
  const f = fixture();
  f.live.member.roles = [ownerRoleId];
  const authorize = createAuthorizer(f.api, guildId, { ownerRoleId });
  f.live.roles.find(role => role.id === ownerRoleId)!.managed = true;
  assert.equal(await authorize(request), false);
  f.live.roles = f.live.roles.filter(role => role.id !== ownerRoleId);
  assert.equal(await authorize(request), false);
  const invalidSaved = createAuthorizer(f.api, guildId, { readState: async () => ({ 'role-1': 'Owner' }) });
  assert.equal(await invalidSaved(request), false);
});

test('ID explícito de Owner substitui o antigo ID salvo', async () => {
  const f = fixture();
  f.live.member.roles = [ownerRoleId];
  const authorize = createAuthorizer(f.api, guildId, {
    ownerRoleId: otherRoleId,
    readState: async () => ({ 'role-1': ownerRoleId }),
  });
  assert.equal(await authorize(request), false);
  f.live.member.roles = [otherRoleId];
  assert.equal(await authorize(request), true);
});

test('configuração inválida é rejeitada e resposta de bot não autoriza', async () => {
  const f = fixture();
  assert.throws(() => createAuthorizer(f.api, '../servidor'), /ID do servidor/);
  assert.throws(() => createAuthorizer(f.api, guildId, { ownerRoleId: 'Owner' }), /OWNER_ROLE_ID/);
  f.live.member.roles = [adminRoleId];
  f.live.member.user.bot = true;
  assert.equal(await createAuthorizer(f.api, guildId)(request), false);
});

test('permissões de Administrator concedidas a everyone também são respeitadas', async () => {
  const f = fixture();
  f.live.roles[0].permissions = String(PermissionFlagsBits.Administrator);
  assert.equal(await createAuthorizer(f.api, guildId)(request), true);
});
