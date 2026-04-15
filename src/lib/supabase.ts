import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eryauogxcpbgdryeimdq.supabase.co'
const supabaseKey = 'sb_publishable_AFgDpMDqJMC-_w4E8VuMIw_Ng5KztPT'

export const supabase = createClient(supabaseUrl, supabaseKey)
