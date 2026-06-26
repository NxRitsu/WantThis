// WantThis — Edge Function "admin"
// Exécutée côté Supabase (Deno). Détient la clé service_role (jamais exposée au
// frontend). Vérifie que l'appelant est administrateur avant toute action.
//
// Actions (JSON body) :
//   { "action": "list" }                       -> liste les comptes
//   { "action": "delete", "userId": "<uuid>" } -> supprime un compte (cascade)
//
// Déploiement : voir README (Supabase CLI ou éditeur de fonctions du dashboard).

import { createClient } from 'jsr:@supabase/supabase-js@2'

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '*'
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }

  // Préflight CORS.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1) Identifier l'appelant à partir de son JWT.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Non authentifié.' })

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json(401, { error: 'Session invalide.' })

    // 2) Client admin (service_role, ignore le RLS).
    const admin = createClient(url, serviceKey)

    // 3) Vérifier que l'appelant est bien administrateur.
    const { data: prof } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (!prof?.is_admin) {
      return json(403, { error: 'Accès réservé aux administrateurs.' })
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action

    // --- Lister les comptes ---
    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      if (error) throw error

      const { data: profiles } = await admin
        .from('profiles')
        .select('id, display_name, is_admin')
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        display_name: byId.get(u.id)?.display_name ?? '',
        is_admin: byId.get(u.id)?.is_admin ?? false,
      }))
      return json(200, { users })
    }

    // --- Supprimer un compte ---
    if (action === 'delete') {
      const targetId = body?.userId
      if (!targetId) return json(400, { error: 'userId manquant.' })
      if (targetId === user.id) {
        return json(400, {
          error: 'Vous ne pouvez pas supprimer votre propre compte ici.',
        })
      }
      const { error } = await admin.auth.admin.deleteUser(targetId)
      if (error) throw error
      return json(200, { ok: true })
    }

    return json(400, { error: 'Action inconnue.' })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
