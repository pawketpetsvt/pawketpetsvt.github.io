// Static pet personality/preference content, ported verbatim from
// game.js's petFoodPreferences (game.js:7836-7956). Placeholder data per the
// original's own "PLACEHOLDER_PET_DATA" comments — not something this
// migration is meant to change.
export const JOURNAL_PET_TYPES = ['Ember', 'Pyxie', 'Steve', 'Kleat', 'Blushimia', 'Aria', 'Gnarly', 'Jess', 'Cypurr']

export const PET_IMAGE_MAP = {
  Ember: 'ember.png',
  Pyxie: 'pyxie.png',
  Steve: 'cowbee.png',
  Kleat: 'kelta.png',
  Blushimia: 'blushimia.png',
  Aria: 'aria.png',
  Jess: 'jess.png',
  Gnarly: 'gnarly.png',
  Cypurr: 'cy.png'
}

export const PET_FOOD_PREFERENCES = {
  Ember: {
    loved_item: 'Spicy Ramen', liked_item: 'Hot Wings', disliked_item: 'Rainbow Cake', hated_item: 'Sushi Roll',
    hobby: 'Competitive dueling', fun_fact: 'Once won a spoon dueling championship!',
    sleep_habit: 'night owl', weather_preference: 'loves sun',
    catchphrase: 'Fire solves everything, obviously! 🔥', secret_talent: 'Can light a campfire with a single wink'
  },
  Pyxie: {
    loved_item: 'Rainbow Cake', liked_item: 'Honey Cookies', disliked_item: 'Grilled Salmon', hated_item: 'Spicy Burrito',
    hobby: 'Professional napping', fun_fact: 'Can sleep for 16 hours straight!',
    sleep_habit: 'heavy sleeper', weather_preference: 'loves fog',
    catchphrase: 'I have a plan. It involves napping. ✨', secret_talent: 'Can nap in any position, including upside down'
  },
  Steve: {
    loved_item: 'Fresh Bread', liked_item: 'Garden Salad', disliked_item: 'Hot Wings', hated_item: 'Curry Feast',
    hobby: 'Being a menace', fun_fact: 'As chill as a fire in hell, controlled like the beasts of Australia!',
    sleep_habit: 'power napper', weather_preference: 'hates weather',
    catchphrase: 'Cluck, bawk, buck... you know the rest. 🐔', secret_talent: 'Somehow always the last one standing in any situation'
  },
  Kleat: {
    loved_item: 'Garden Salad', liked_item: 'Fresh Bread', disliked_item: 'Shrimp Tempura', hated_item: 'Grilled Steak',
    hobby: 'Studying void and galaxy magic', fun_fact: 'A grand mage who can open portals to other worlds!',
    sleep_habit: 'night owl', weather_preference: 'loves fog',
    catchphrase: 'Yip, yap, teehee, I opened a portal! ✨', secret_talent: 'Can sense when someone is about to say something stupid'
  },
  Blushimia: {
    loved_item: 'Sushi Roll', liked_item: 'Grilled Salmon', disliked_item: 'Banana Bread', hated_item: 'Honey Cookies',
    hobby: 'Breaking out of video games', fun_fact: 'Escaped her video game after gaining sentience!',
    sleep_habit: 'early bird', weather_preference: 'loves sun',
    catchphrase: "What the glob?! I'm free!! 👑", secret_talent: 'Can find the hidden exit in literally any room'
  },
  Aria: {
    loved_item: 'Grilled Steak', liked_item: 'Beef Jerky', disliked_item: 'Apple Pie', hated_item: 'Grape Juice',
    hobby: 'Collecting bones and writing stories', fun_fact: 'A fae rosy maple moth who uses bones as currency!',
    sleep_habit: 'night owl', weather_preference: 'loves rain',
    catchphrase: 'Do you want to see my bones? 🦋', secret_talent: 'Can identify any creature by its skeleton alone'
  },
  Gnarly: {
    loved_item: 'Apple Pie', liked_item: 'Mango Delight', disliked_item: 'Roasted Chicken', hated_item: 'Seafood Soup',
    hobby: 'Playing arcade games and collecting Furbies', fun_fact: 'Runs the PaleoPlex arcade! Loves nachos!',
    sleep_habit: 'power napper', weather_preference: 'loves sun',
    catchphrase: 'High score? Watch me. 🎮', secret_talent: 'Has never lost a game of Pac-Man. Not once.'
  },
  Cypurr: {
    loved_item: 'Grilled Salmon', liked_item: 'Honey Cookies', disliked_item: 'Spicy Burrito', hated_item: 'Fresh Bread',
    hobby: 'Digital art and gaming from the internet', fun_fact: 'Her consciousness was uploaded to cyberspace as part of a medical experiment!',
    sleep_habit: 'night owl', weather_preference: 'loves rain',
    catchphrase: 'OwO and ^o^ are my whole personality. 💜', secret_talent: 'Can block and report anyone in under three seconds flat'
  },
  Jess: {
    loved_item: 'Mango Delight', liked_item: 'Strawberry Parfait', disliked_item: 'Cheese Platter', hated_item: 'Veggie Noodles',
    hobby: 'Potion brewing and fossil collecting', fun_fact: 'A paleoart Parasaur who makes potions!',
    sleep_habit: 'early bird', weather_preference: 'loves rain',
    catchphrase: 'This fossil is 65 million years cuter than you. 🦕', secret_talent: 'Can brew a potion that tastes terrible but works perfectly'
  }
}

export const JOURNAL_ENTRY_HINTS = {
  loved: 'Feed this pet various foods to discover what they love!',
  liked: 'Keep feeding different foods to find what they like.',
  disliked: 'Some foods get a bad reaction -- that unlocks this.',
  hated: 'A very bad reaction to food unlocks this entry.',
  hobby: 'Play with this pet to learn their hobby.',
  fun_fact: 'Win battles with this pet to unlock a fun fact.',
  sleep_habit: 'Send this pet on an expedition to discover their sleep habits.',
  weather_preference: 'Battle in different weather conditions to learn their preferences.',
  catchphrase: 'Level this pet up to hear their catchphrase.',
  secret_talent: 'Reach Level 10 with this pet to unlock their secret talent.'
}

export const JOURNAL_ENTRIES = [
  { icon: '💖', label: 'LOVED Food', key: 'loved', valueField: 'loved_item' },
  { icon: '😊', label: 'LIKED Food', key: 'liked', valueField: 'liked_item' },
  { icon: '😐', label: 'DISLIKED Food', key: 'disliked', valueField: 'disliked_item' },
  { icon: '😠', label: 'HATED Food', key: 'hated', valueField: 'hated_item' },
  { icon: '🎨', label: 'Hobby', key: 'hobby', valueField: 'hobby' },
  { icon: '✨', label: 'Fun Fact', key: 'fun_fact', valueField: 'fun_fact' },
  { icon: '😴', label: 'Sleep Habit', key: 'sleep_habit', valueField: 'sleep_habit' },
  { icon: '🌤️', label: 'Weather Preference', key: 'weather_preference', valueField: 'weather_preference' },
  { icon: '💬', label: 'Catchphrase', key: 'catchphrase', valueField: 'catchphrase' },
  { icon: '🎭', label: 'Secret Talent', key: 'secret_talent', valueField: 'secret_talent' }
]
