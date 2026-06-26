// WantThis — Edge Function "unfurl"
// Récupère côté serveur (Deno) les métadonnées d'une page produit : image
// (Open Graph), titre et prix. Indispensable car un frontend statique ne peut
// pas lire le HTML d'un autre domaine (CORS).
//
// Body JSON : { "url": "https://…" }
// Réponse   : { "title": string|null, "image": string|null,
//               "price": number|null, "currency": string|null }
//
// Réservée aux utilisateurs authentifiés (évite un proxy ouvert).
// Déploiement : voir README (Supabase CLI ou éditeur de fonctions du dashboard).

import { createClient } from 'jsr:@supabase/supabase-js@2'

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Récupère la valeur d'un attribut dans une balise (ordre des attributs libre).
function attr(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`${name}\\s*=\\s*"([^"]*)"|${name}\\s*=\\s*'([^']*)'`, 'i')
  )
  return m ? (m[1] ?? m[2] ?? null) : null
}

// Construit un dictionnaire des balises <meta> (clé = property/name/itemprop).
function parseMetas(html: string): Record<string, string> {
  const metas: Record<string, string> = {}
  const re = /<meta\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const tag = m[0]
    const key = (attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop'))?.toLowerCase()
    const content = attr(tag, 'content')
    if (key && content && !(key in metas)) metas[key] = content
  }
  return metas
}

// Normalise une chaîne de prix ("€1 299,90", "$12.99", "12.99") en nombre.
function parsePrice(raw?: string | null): number | null {
  if (!raw) return null
  let s = String(raw).replace(/[^\d.,]/g, '').trim()
  if (!s) return null
  // Si virgule ET point : le dernier séparateur est le décimal.
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (s.includes(',')) {
    // Virgule seule : décimale si 1-2 chiffres après, sinon séparateur de milliers.
    s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

// Cherche un prix dans d'éventuels blocs JSON-LD (schema.org).
function priceFromJsonLd(html: string): { price: number | null; currency: string | null } {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim())
      const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] ?? [])]
      for (const node of nodes) {
        const offers = node?.offers
        const offer = Array.isArray(offers) ? offers[0] : offers
        if (offer?.price != null) {
          return { price: parsePrice(String(offer.price)), currency: offer.priceCurrency ?? null }
        }
        if (node?.price != null) {
          return { price: parsePrice(String(node.price)), currency: node.priceCurrency ?? null }
        }
      }
    } catch {
      /* JSON-LD invalide : on ignore */
    }
  }
  return { price: null, currency: null }
}

// Bloque les hôtes internes/privés (réduit le risque de SSRF).
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h === '0.0.0.0' ||
    h === '::1' ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  )
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '*'
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers })

  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Authentification : tout utilisateur connecté est autorisé.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(401, { error: 'Non authentifié.' })
    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json(401, { error: 'Session invalide.' })

    const body = await req.json().catch(() => ({}))
    const target = String(body?.url ?? '').trim()
    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return json(400, { error: 'URL invalide.' })
    }
    if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      return json(400, { error: 'URL non autorisée.' })
    }

    // Récupération de la page (timeout 8 s, User-Agent navigateur).
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let html = ''
    try {
      const res = await fetch(parsed.toString(), {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      })
      html = (await res.text()).slice(0, 600_000) // les métadonnées sont dans le <head>
    } finally {
      clearTimeout(timer)
    }

    const metas = parseMetas(html)
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()

    let image =
      metas['og:image'] ||
      metas['og:image:url'] ||
      metas['og:image:secure_url'] ||
      metas['twitter:image'] ||
      metas['twitter:image:src'] ||
      null
    if (image) {
      try {
        image = new URL(image, parsed.toString()).toString() // résout les chemins relatifs
      } catch {
        image = null
      }
    }

    const ld = priceFromJsonLd(html)
    const price =
      parsePrice(metas['product:price:amount']) ??
      parsePrice(metas['og:price:amount']) ??
      parsePrice(metas['price']) ??
      ld.price
    const currency =
      metas['product:price:currency'] || metas['og:price:currency'] || ld.currency || null

    const title = metas['og:title'] || metas['twitter:title'] || titleTag || null

    return json(200, { title, image, price, currency })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(502, { error: `Impossible de lire la page : ${msg}` })
  }
})
