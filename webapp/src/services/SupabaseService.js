import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../env.js'

// Two different OAuth redirects land on this site with `#access_token=…`:
//   • Supabase's own (Log In With Twitch, linking Twitch, password-reset and
//     email-confirm links) — always carries a `refresh_token`;
//   • Twitch's direct implicit grant (TwitchService's "Reconnect Twitch", which
//     fetches a long-lived token for follow checks and streamers' worker config)
//     — never does.
// Supabase would otherwise try to read the second kind as a login, fail, and
// leave its error lying around; this hands it to TwitchService untouched.
// Errors (`#error=…`) are still Supabase's to report, whichever flow sent them.
function isSupabaseCallback(url, params) {
  if (params.access_token && !params.refresh_token) return false
  return Boolean(params.access_token || params.error || params.error_description || params.error_code)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: isSupabaseCallback }
})
