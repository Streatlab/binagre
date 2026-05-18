import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eryauogxcpbgdryeimdq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyeWF1b2d4Y3BiZ2RyeWVpbWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjc4NjksImV4cCI6MjA5MTg0Mzg2OX0.HpbtG_ejP4nR7oE6u9NALOaKiOsoQS85ImY5A-Uhqzg'

export const supabase = createClient(supabaseUrl, supabaseKey)
