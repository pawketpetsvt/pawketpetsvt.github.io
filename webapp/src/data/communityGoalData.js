// Ports COMMUNITY_GOAL_NARRATIVES / COMMUNITY_GENERIC_NARRATIVE
// (game.js:36430-36456) — the story beats a community goal tells as the whole
// player base pushes it toward its target.
//
// Keyed by the goal's `goal_key`. Any goal without its own arc falls back to
// the generic one, which is why a new goal can be added as a database row alone.
export const COMMUNITY_GOAL_NARRATIVES = {
  corrupted_kills_e1: [
    { threshold: 0, text: "Reports are trickling in. Pets returning from the forest with strange, twisted markings. Piper's tune echoes a little differently these days..." },
    { threshold: 25, text: "The corruption is spreading faster than anyone expected. Trainers are banding together to fight back." },
    { threshold: 50, text: "Halfway there. The corrupted are thinning out, but Piper's presence still lingers at the edges of the forest." },
    { threshold: 75, text: "Almost clear! Just a little more effort and the corruption will retreat... for now." },
    { threshold: 100, text: "The corruption has been pushed back! Piper's tune returns to something more familiar. But everyone knows it never really goes away completely..." }
  ]
}

export const COMMUNITY_GENERIC_NARRATIVE = [
    { threshold: 0, text: "The community has just begun working toward \"{title}.\"" },
    { threshold: 25, text: "Progress is building. \"{title}\" is starting to take shape." },
    { threshold: 50, text: "Halfway there! The whole server is feeling the momentum on \"{title}.\"" },
    { threshold: 75, text: "Almost there! One final push and \"{title}\" will be complete!" },
    { threshold: 100, text: "\"{title}\" is complete! Thank you to everyone who contributed." }
]

// The four celebration tiers, checked as a goal crosses each one.
export const COMMUNITY_MILESTONE_TIERS = [25, 50, 75, 100]
