// The per-streamer landing page's member table, extracted verbatim from
// TEAM_MEMBERS (game.js:3854-3936).
//
// This is NOT the same data as TeamPage.vue's MEMBERS list: the bios differ,
// and only this one carries the fields the landing hero needs — petName,
// accentColor, bgGradient and login. Legacy kept them as two separate tables
// too, so they are not merged here.
export const STREAMER_LANDING_MEMBERS = [
  {
    name: 'Embertail', login: 'embertail', twitchUrl: 'https://twitch.tv/Embertail',
    petName: 'Ember', twitchId: '91821604',
    bio: 'Co-founder of PawketPetsVT and the developer behind the game itself. Ember streams variety content and is the reason any of this exists.',
    accentColor: '#ff6eb4', bgGradient: 'linear-gradient(135deg,#2d0a1a 0%,#1a0a2e 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/Embertail', icon: '🎮' }]
  },
  {
    name: 'Pyxshuul', login: 'pyxshuul', twitchUrl: 'https://twitch.tv/Pyxshuul',
    petName: 'Pyxie', twitchId: '1459912293',
    bio: 'Co-founder of PawketPetsVT. Pyxshuul is chaotic good energy in streamer form.',
    accentColor: '#9966ff', bgGradient: 'linear-gradient(135deg,#1a0a2e 0%,#0a0a1a 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/Pyxshuul', icon: '🎮' }]
  },
  {
    name: 'Aria', login: 'ariadoestwitch', twitchUrl: 'https://twitch.tv/ariadoestwitch',
    petName: 'Aria', twitchId: '1445288832',
    bio: 'A gothic moth VTuber with impeccable taste and a love of bones. Aria streams a mix of games and just vibes.',
    accentColor: '#8844cc', bgGradient: 'linear-gradient(135deg,#0d0d1a 0%,#1a0d2e 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/ariadoestwitch', icon: '🎮' }]
  },
  {
    name: 'Blushimia', login: 'realblushimia', twitchUrl: 'https://twitch.tv/realblushimia',
    petName: 'Blushimia', twitchId: '659500662',
    bio: 'A puppy VTuber with big energy and even bigger heart. Blushimia streams games, art, and wholesome chaos.',
    accentColor: '#ff99cc', bgGradient: 'linear-gradient(135deg,#2d0a1a 0%,#1a1a2e 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/realblushimia', icon: '🎮' }]
  },
  {
    name: 'Cowbee', login: 'cowbeevt', twitchUrl: 'https://twitch.tv/cowbeevt',
    petName: 'Steve', twitchId: '203845195',
    bio: 'A chaotic cowbee hybrid who has been streaming since before Twitch was cool. Steve (the pet) is just as unhinged.',
    accentColor: '#f0c040', bgGradient: 'linear-gradient(135deg,#1a1200 0%,#1a0a00 100%)',
    socialLinks: [
      { label: 'Twitch', url: 'https://twitch.tv/cowbeevt', icon: '🎮' },
      { label: 'Bluesky', url: 'https://bsky.app/profile/cowbeevt.vtubers.social', icon: '🦋' }
    ]
  },
  {
    name: 'Kelta', login: 'keltathepomeranian', twitchUrl: 'https://twitch.tv/keltathepomeranian',
    petName: 'Kleat', twitchId: '121490227',
    bio: 'A grand mage Pomeranian who studies void, space, and galaxy magic. Streams adventure games and explores new worlds, sometimes literally.',
    accentColor: '#44aaff', bgGradient: 'linear-gradient(135deg,#000d1a 0%,#0d0d2e 100%)',
    socialLinks: [
      { label: 'Twitch', url: 'https://twitch.tv/keltathepomeranian', icon: '🎮' },
      { label: 'Bluesky', url: 'https://bsky.app/profile/keltathepomeranian.bsky.social', icon: '🦋' },
      { label: 'X / Twitter', url: 'https://x.com/AilkaKelta', icon: '🐦' }
    ]
  },
  {
    name: 'Jess', login: 'teatimejess', twitchUrl: 'https://twitch.tv/teatimejess',
    petName: 'Jess', twitchId: '88727356',
    bio: 'A parasaur VTuber who brings prehistoric energy to everything she touches. Cozy streams, big personality.',
    accentColor: '#44cc88', bgGradient: 'linear-gradient(135deg,#001a0d 0%,#0a1a00 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/teatimejess', icon: '🎮' }]
  },
  {
    name: 'Gnarly', login: 'gnarly_neon_smilodon', twitchUrl: 'https://twitch.tv/gnarly_neon_smilodon',
    petName: 'Gnarly', twitchId: '531222973',
    bio: 'A neon Smilodon with retro arcade energy. Gnarly streams games with big personality and zero chill, in the best way.',
    accentColor: '#ff4488', bgGradient: 'linear-gradient(135deg,#1a0d00 0%,#1a001a 100%)',
    socialLinks: [{ label: 'Twitch', url: 'https://twitch.tv/gnarly_neon_smilodon', icon: '🎮' }]
  },
  {
    name: 'CypurrActive', login: 'cypurractive', twitchUrl: 'https://twitch.tv/cypurractive',
    petName: 'Cypurr', twitchId: '755193792',
    bio: 'Cybergoth Vtuber, Gamer, and Artist! Her consciousness was uploaded to the internet — she streams from cyberspace while her body rests in stasis.',
    accentColor: '#a855d7', bgGradient: 'linear-gradient(135deg,#1a0033 0%,#0d0020 100%)',
    socialLinks: [
      { label: 'Twitch',   url: 'https://www.twitch.tv/cypurractive',         icon: '🎮' },
      { label: 'YouTube',  url: 'https://www.youtube.com/@cypurractive',       icon: '▶️' },
      { label: 'TikTok',   url: 'https://www.tiktok.com/@cypurractive',        icon: '🎵' }
    ]
  }
]
