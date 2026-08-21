const actionCooldowns = {}

export function canPerformAction(actionKey, cooldownMs) {
  const now = Date.now()
  if (actionCooldowns[actionKey] && now - actionCooldowns[actionKey] < cooldownMs) {
    return false
  }
  actionCooldowns[actionKey] = now
  return true
}
