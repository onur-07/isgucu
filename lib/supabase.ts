import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("SUPABASE ERROR: Environment variables are missing! URL length:", supabaseUrl.length);
}

// 406 (Not Acceptable) Hatasını Çözmek İçin Gelişmiş Yapılandırma
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'X-Client-Info': 'isgucu-web'
        }
    }
})
