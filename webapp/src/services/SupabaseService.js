import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseAnonKey } from '../env.js'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
