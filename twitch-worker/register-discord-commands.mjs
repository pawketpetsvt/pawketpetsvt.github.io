// Registers the bot's slash commands with Discord. Only needed for a NEW
// Discord application (or after changing the commands) — Discord remembers
// them, so this is run once, from your own machine, never deployed.
//
//   DISCORD_APP_ID=… DISCORD_BOT_TOKEN=… node register-discord-commands.mjs
//   (PowerShell: $env:DISCORD_APP_ID='…'; $env:DISCORD_BOT_TOKEN='…'; node register-discord-commands.mjs)
//
// The commands are the four worker.js answers (handleDiscordInteraction). The
// original registration script wasn't in the worker, so the descriptions here
// are new; the names and the /link `code` option are what the worker reads.

const appId = process.env.DISCORD_APP_ID
const token = process.env.DISCORD_BOT_TOKEN
if (!appId || !token) {
  console.error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN first.')
  process.exit(1)
}

const commands = [
  { name: 'mypet', description: 'Show your PawketPets companion card' },
  { name: 'corruption', description: 'Check the current world corruption level' },
  { name: 'leaderboard', description: 'Top 10 trainers by total pet level' },
  {
    name: 'link',
    description: 'Link your Discord to your PawketPets account',
    options: [{ type: 3, name: 'code', description: 'The code from your PawketPets profile settings', required: true }]
  }
]

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bot ' + token },
  body: JSON.stringify(commands)
})
console.log(res.status, await res.text())
