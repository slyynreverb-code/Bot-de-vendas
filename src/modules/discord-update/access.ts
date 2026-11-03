import { PermissionFlagsBits } from 'discord.js';
import type { Transport } from '../server-setup/engine.js';

export interface AccessRequest {
  guildId: string | null;
  userId: string;
  bot?: boolean;
}

export interface AuthorizerOptions {
  ownerRoleId?: string;
  readState?: () => Promise<Record<string, string>>;
}

const snowflake = /^\d{17,20}$/;

function missingMember(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { status?: number; code?: number };
  return value.status === 404 || value.code === 10007;
}

/** Check live guild membership and roles every time, including button presses. */
export function createAuthorizer(
  api: Transport,
  configuredGuildId: string,
  options: AuthorizerOptions = {},
): (request: AccessRequest) => Promise<boolean> {
  if (!snowflake.test(configuredGuildId)) throw new Error('ID do servidor inválido.');
  if (options.ownerRoleId !== undefined && !snowflake.test(options.ownerRoleId))
    throw new Error('DISCORD_OWNER_ROLE_ID inválido.');

  return async request => {
    if (request.guildId !== configuredGuildId || request.bot || !snowflake.test(request.userId))
      return false;

    const base = '/guilds/' + configuredGuildId;
    const guild = await api.get(base);
    let member;
    try { member = await api.get(base + '/members/' + request.userId); }
    catch (error) {
      if (missingMember(error)) return false;
      throw error;
    }
    const roles = await api.get(base + '/roles');
    if (guild.id !== configuredGuildId || member.user?.id !== request.userId || member.user?.bot ||
        !Array.isArray(member.roles) || !member.roles.every((id: unknown) => typeof id === 'string') ||
        !Array.isArray(roles)) return false;

    if (guild.owner_id === request.userId) return true;

    const ownedRoleIds = new Set<string>(member.roles);
    const ownedRoles = roles.filter(role => role.id === configuredGuildId || ownedRoleIds.has(role.id));
    for (const role of ownedRoles) {
      if (typeof role.permissions !== 'string' || !/^\d+$/.test(role.permissions))
        throw new Error('Permissões recebidas do Discord são inválidas.');
      if ((BigInt(role.permissions) & PermissionFlagsBits.Administrator) !== 0n) return true;
    }

    // A role's editable name is never proof that it is the approved Owner role.
    // An explicit ID overrides the saved identity, allowing the grant to be moved.
    const state = options.ownerRoleId === undefined ? await options.readState?.() : undefined;
    const ownerRoleId = options.ownerRoleId ?? state?.['role-1'];
    if (!ownerRoleId || !snowflake.test(ownerRoleId) || !ownedRoleIds.has(ownerRoleId)) return false;
    return roles.some(role => role.id === ownerRoleId && role.id !== configuredGuildId && !role.managed);
  };
}
