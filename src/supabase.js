import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Message explicite si le .env n'est pas configuré.
  console.error(
    'Configuration Supabase manquante. Crée un fichier .env à partir de .env.example ' +
      '(VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
