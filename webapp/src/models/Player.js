export class Player {
  constructor(data = {}) {
    this.id = data.id || ''
    this.username = data.username || ''
    this.pawketpoints = data.pawketpoints || 0
    this.login_streak = data.login_streak || 0
    this.tutorial_completed = data.tutorial_completed || false

    // Everything below is read off `AppState.player` somewhere in the app but
    // was NOT carried here, so it evaluated to `undefined` at runtime. The
    // query is `select('*')`, so the column was always present on the row —
    // this model was the bottleneck. Same root cause as `OwnedPet` dropping
    // base_attack/current_hp/current_variant: a model that omits columns is how
    // a feature disappears without anyone noticing.
    //
    // discord_id — MyProfilePage decides the Discord link panel from this. With
    //   it undefined the panel ALWAYS read "Not linked yet" and always offered
    //   the Generate Link Code button, even to a player who had already linked.
    // bosses_killed — MelonService's `first_boss` milestone. It has a
    //   localStorage fallback, so the milestone could still fire, but only from
    //   kills made in that same browser; the server-side counter never counted.
    // bio / equipped_cosmetics — ProfileService writes both back onto
    //   AppState.player after a save. Declaring them keeps that cache update
    //   consistent instead of grafting properties onto the instance.
    this.discord_id = data.discord_id || null
    this.bosses_killed = data.bosses_killed || 0
    this.bio = data.bio || ''
    this.equipped_cosmetics = data.equipped_cosmetics || null
  }
}
