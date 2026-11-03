export interface BotEnvironment {
  token: string;
  guildId: string;
  ownerRoleId?: string;
  stateDir: string;
  reportsDir: string;
}

export function readBotEnvironment(env: NodeJS.ProcessEnv = process.env): BotEnvironment {
  const token = env.DISCORD_TOKEN?.trim();
  const guildId = env.DISCORD_GUILD_ID?.trim() || env.GUILD_ID?.trim();
  const ownerRoleId = env.DISCORD_OWNER_ROLE_ID?.trim() || undefined;
  if (!token || !guildId || !/^\d{17,20}$/.test(guildId))
    throw new Error('Configure DISCORD_TOKEN e DISCORD_GUILD_ID (ou GUILD_ID) no ambiente.');
  if (env.GUILD_ID?.trim() && env.DISCORD_GUILD_ID?.trim() && env.GUILD_ID.trim() !== env.DISCORD_GUILD_ID.trim())
    throw new Error('GUILD_ID e DISCORD_GUILD_ID são diferentes. Corrija antes de iniciar.');
  if (ownerRoleId && !/^\d{17,20}$/.test(ownerRoleId))
    throw new Error('DISCORD_OWNER_ROLE_ID deve conter o ID do cargo Owner.');
  return { token, guildId, ownerRoleId, stateDir: '.state', reportsDir: 'reports' };
}
