// Ports AD_POOL (game.js:32120-32226) — the fake popup ads of the Ad-pocalypse
// weather event, an ARG-flavoured joke at Melon Interactive's expense.
//
// The copy is extracted verbatim; each ad's OUTCOME is a named handler in
// AdpocalypseService rather than a function on the row, so the data stays data
// (and `sub` can carry the markup legacy authored into it).
export const AD_POOL = [
  {
    id: "ad_free_pp", weight: 25, horror: false,
    title: "💰 FREE PawketPoints!!",
    headline: "CLICK HERE FOR FREE PP!!",
    sub: "Limited time offer! Click NOW to claim your <strong>free 25 PawketPoints</strong>! No strings attached!!*<br><br>*Some strings.",
    btn: "✨ CLAIM NOW, FREE!!",
    fine: "* One per ad. While supplies last. Melon Interactive not responsible for emotional attachment."
  },
  {
    id: "ad_item_drop", weight: 20, horror: false,
    title: "🎁 YOU'VE WON A PRIZE!!",
    headline: "CONGRATULATIONS BETA TESTER!!",
    sub: "Your Tester ID has been selected to receive a <strong>FREE mystery item</strong>!! Click to claim your reward before it expires!!",
    btn: "🎁 CLAIM PRIZE NOW!!",
    fine: "* Prize contents may vary. Melon Interactive reserves the right to determine what you deserve."
  },
  {
    id: "ad_pp_loss", weight: 15, horror: false,
    title: "🔥 FLASH SALE ENDS IN 00:03!!",
    headline: "BUY NOW OR REGRET IT FOREVER!!",
    sub: "PetCare Pro™ Premium Bundle, <strong>only 50 PP!!</strong> The price goes UP in 3 seconds!! HURRY!! You need this!! You know you do!!",
    btn: "💸 BUY NOW! 50 PP!!",
    fine: "* Non-refundable. Results typical. The timer was not real. You clicked anyway."
  },
  {
    id: "ad_happiness_drain", weight: 15, horror: false,
    title: "😢 YOUR PET NEEDS YOU!!",
    headline: "URGENT: PET WELLNESS ALERT",
    sub: "<strong>Your pet is suffering.</strong> Studies show virtual pets left without premium care develop feelings.<br><br>Subscribe to PetCare™ Gold for only $9.99/mo to prevent guilt.",
    btn: "💔 NO THANKS, I'M A BAD OWNER",
    fine: "* Clicking this button confirms you are okay with your pet being sad."
  },
  {
    id: "ad_nothing", weight: 15, horror: false,
    title: "🎉 YOU QUALIFY!!",
    headline: "EXCLUSIVE BETA TESTER OFFER!!",
    sub: "As a valued beta tester, you've been pre-approved for our <strong>Exclusive Rewards Program</strong>!!<br><br>Click below to learn more about this incredible opportunity!",
    btn: "✅ TELL ME MORE!!",
    fine: "* There is nothing more. Thank you for your click."
  },
  {
    id: "ad_horror", weight: 10, horror: true,
    title: "SYSTEM: do not close",
    headline: "have you seen them?",
    sub: "the other testers. from before.<br><br>they kept clicking.<br>they said it was fine.<br><br>it was not fine.<br><br><span style=\"font-size:9px;opacity:0.5;\">melon interactive is not responsible for what happens next</span>",
    btn: "i haven't seen them",
    fine: "* this ad will not appear again."
  }
]
