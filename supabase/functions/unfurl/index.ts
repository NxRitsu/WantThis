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

// Normalise une valeur "image" de schema.org (string | string[] | {url}).
function pickImage(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.length ? pickImage(v[0]) : null
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return (typeof o.url === 'string' && o.url) || (typeof o['@id'] === 'string' && o['@id']) || null
  }
  return null
}

// Cherche prix / devise / image dans d'éventuels blocs JSON-LD (schema.org).
function fromJsonLd(html: string): { price: number | null; currency: string | null; image: string | null } {
  let price: number | null = null
  let currency: string | null = null
  let image: string | null = null
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim())
      const nodes = Array.isArray(data) ? data : [data, ...(data['@graph'] ?? [])]
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue
        if (image == null && node.image != null) image = pickImage(node.image)
        if (price == null) {
          const offers = node.offers
          const offer = Array.isArray(offers) ? offers[0] : offers
          if (offer?.price != null) {
            price = parsePrice(String(offer.price))
            currency = offer.priceCurrency ?? currency
          } else if (node.price != null) {
            price = parsePrice(String(node.price))
            currency = node.priceCurrency ?? currency
          }
        }
      }
    } catch {
      /* JSON-LD invalide : on ignore */
    }
  }
  return { price, currency, image }
}

// Décode les entités HTML les plus courantes (&amp;, &#233;, &#xE9;, &quot;…).
function decodeEntities(s: string | null): string | null {
  if (!s) return s
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&') // en dernier pour ne pas ré-introduire d'entités
    .trim()
}

// --- Amazon : photo sans scraping (déduite de l'ASIN présent dans l'URL) ------

function isAmazonHost(host: string): boolean {
  return /(^|\.)amazon\.[a-z.]+$/i.test(host) || /(^|\.)amzn\./i.test(host)
}

// Extrait l'ASIN (identifiant produit Amazon, 10 caractères) de l'URL.
function asinFromUrl(u: URL): string | null {
  const m = u.pathname.match(
    /\/(?:dp|gp\/product|gp\/aw\/d|product|ASIN)\/([A-Z0-9]{10})(?:[/?]|$)/i
  )
  if (m) return m[1].toUpperCase()
  const q = u.searchParams.get('asin')
  return q && /^[A-Z0-9]{10}$/i.test(q) ? q.toUpperCase() : null
}

// URL d'image déterministe servie par le CDN Amazon à partir de l'ASIN.
function amazonImageFromAsin(asin: string): string {
  return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`
}

// --- Détection de page anti-bot / blocage --------------------------------------

function looksBlocked(status: number, html: string): boolean {
  if (status === 503 || status === 403 || status === 429) return true
  if (html.length < 1500) return true
  return /not a robot|captcha|enter the characters you see|api-services-support@amazon|automated access|to discuss automated access/i.test(
    html.slice(0, 20_000)
  )
}

// Récupère le HTML via un service proxy (ScraperAPI) si une clé est configurée.
// Le tiers contourne le filtrage IP ; le parsing reste fait par notre fonction.
// NB : pas de country_code (géo-ciblage réservé aux plans payants → 400 sinon).
// Options (coût croissant en crédits, d'où l'escalade progressive) :
//   premium  → proxies premium, requis par les "domaines protégés" (Fnac…).
//   ultra    → proxies ultra premium, pour les protections les plus dures.
//   render   → exécute le JS (sites SPA) ; lent.
type ProxyOpts = { premium?: boolean; ultra?: boolean; render?: boolean }
type ProxyResult = { html: string | null; outOfCredits: boolean }
async function fetchViaProxy(target: string, opts: ProxyOpts, timeoutMs: number): Promise<ProxyResult> {
  const key = Deno.env.get('SCRAPER_API_KEY')
  if (!key) {
    console.error('[unfurl] SCRAPER_API_KEY absent — pas de fallback proxy')
    return { html: null, outOfCredits: false }
  }
  let proxyUrl =
    `https://api.scraperapi.com/?api_key=${encodeURIComponent(key)}&url=${encodeURIComponent(target)}`
  if (opts.ultra) proxyUrl += '&ultra_premium=true'
  else if (opts.premium) proxyUrl += '&premium=true'
  if (opts.render) proxyUrl += '&render=true'

  const tag = `${opts.ultra ? 'ultra' : opts.premium ? 'premium' : 'std'}${opts.render ? '+render' : ''}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(proxyUrl, { signal: ctrl.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // ScraperAPI : 401 = clé invalide, 403 + "credit" = quota épuisé.
      const outOfCredits = res.status === 401 || (res.status === 403 && /credit/i.test(body))
      console.error('[unfurl] proxy HTTP', res.status, tag, outOfCredits ? '(crédits/clé)' : '', body.slice(0, 200))
      return { html: null, outOfCredits }
    }
    const text = (await res.text()).slice(0, 800_000)
    console.log('[unfurl] proxy OK', text.length, 'octets', tag, 'pour', target)
    return { html: text, outOfCredits: false }
  } catch (e) {
    console.error('[unfurl] proxy erreur', tag, e instanceof Error ? e.message : String(e))
    return { html: null, outOfCredits: false }
  } finally {
    clearTimeout(timer)
  }
}

// Image produit Amazon depuis le HTML (Amazon n'expose pas og:image fiable :
// la vraie photo est dans data-a-dynamic-image / data-old-hires / le bloc JS).
function amazonImageFromHtml(html: string): string | null {
  // data-old-hires="https://…jpg"
  let m = html.match(/data-old-hires=["'](https:\/\/[^"']+)["']/i)
  if (m) return m[1]
  // data-a-dynamic-image="{&quot;https://…&quot;:[500,500],…}" (clés = URLs)
  m =
    html.match(/data-a-dynamic-image\s*=\s*"([^"]+)"/i) ||
    html.match(/data-a-dynamic-image\s*=\s*'([^']+)'/i)
  if (m) {
    try {
      const map = JSON.parse(m[1].replace(/&quot;/g, '"'))
      const urls = Object.keys(map)
      if (urls.length) return urls[0]
    } catch {
      /* JSON invalide : on continue */
    }
  }
  // Bloc JS d'images : "hiRes":"https://…jpg" puis "large":"https://…jpg"
  m = html.match(/"hiRes":"(https:\/\/[^"]+\.jpg)"/i) || html.match(/"large":"(https:\/\/[^"]+\.jpg)"/i)
  if (m) return m[1]
  // <img id="landingImage" … src="https://…">
  m = html.match(/id=["']landingImage["'][^>]*\bsrc=["'](https:\/\/[^"']+)["']/i)
  if (m) return m[1]
  return null
}

// Cherche un prix directement dans le DOM (dernier recours), pour les sites qui
// n'exposent ni meta ni JSON-LD : Amazon (<span class="a-offscreen">), microdata
// itemprop="price", ou attribut content/data-price proche d'un libellé de prix.
function priceFromHtml(html: string): number | null {
  // Amazon : le prix affiché est dans un span "a-offscreen".
  const amz = html.match(/class="[^"]*\ba-offscreen\b[^"]*"[^>]*>\s*([^<]{1,24})</i)
  if (amz) {
    const p = parsePrice(amz[1])
    if (p != null) return p
  }
  // Microdata : <... itemprop="price" content="12.99"> (ordre d'attributs libre).
  const ip =
    html.match(/itemprop=["']price["'][^>]*\bcontent=["']([^"']+)["']/i) ||
    html.match(/\bcontent=["']([^"']+)["'][^>]*itemprop=["']price["']/i)
  if (ip) {
    const p = parsePrice(ip[1])
    if (p != null) return p
  }
  return null
}

// Extrait titre / image / prix / devise d'un HTML (réutilisable : page directe
// ou page rendue par le proxy).
type Meta = { title: string | null; image: string | null; price: number | null; currency: string | null }

// Fusionne deux résultats : la valeur déjà trouvée prime sur la nouvelle.
function mergeMeta(a: Meta, b: Meta): Meta {
  return {
    title: a.title || b.title,
    image: a.image || b.image,
    price: a.price ?? b.price,
    currency: a.currency || b.currency,
  }
}
function extract(html: string, base: URL): Meta {
  const metas = parseMetas(html)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
  const ld = fromJsonLd(html)

  let image =
    metas['og:image'] ||
    metas['og:image:url'] ||
    metas['og:image:secure_url'] ||
    metas['twitter:image'] ||
    metas['twitter:image:src'] ||
    ld.image || // certains sites (Fnac…) ne mettent l'image que dans le JSON-LD
    amazonImageFromHtml(html) || // Amazon : vraie photo dans data-a-dynamic-image…
    null
  if (image) {
    image = decodeEntities(image) // les URLs OG ont souvent des &amp;
    try {
      image = new URL(image!, base.toString()).toString() // résout les chemins relatifs
    } catch {
      image = null
    }
  }

  const price =
    parsePrice(metas['product:price:amount']) ??
    parsePrice(metas['og:price:amount']) ??
    parsePrice(metas['price']) ??
    ld.price ??
    priceFromHtml(html)
  const currency =
    metas['product:price:currency'] || metas['og:price:currency'] || ld.currency || null

  const title = decodeEntities(metas['og:title'] || metas['twitter:title'] || titleTag || null)
  return { title, image, price, currency }
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

    // Récupération directe de la page (timeout 8 s, User-Agent navigateur).
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    let html = ''
    let status = 0
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
      status = res.status
      html = (await res.text()).slice(0, 600_000) // les métadonnées sont dans le <head>
    } catch {
      /* échec direct : on tentera le proxy ci-dessous */
    } finally {
      clearTimeout(timer)
    }

    // Extraction directe.
    let data = extract(html, parsed)

    // On retente via le proxy (si SCRAPER_API_KEY configuré) dès que c'est utile :
    // page bloquée (anti-bot) OU résultat incomplet (image ou prix manquant, ex.
    // sites rendus en JavaScript). render=true exécute le JS et débloque l'IP.
    // Le tiers ne fait que livrer le HTML — l'extraction reste assurée ici.
    const blocked = looksBlocked(status, html)
    const need = () => !data.image || data.price == null
    let outOfCredits = false
    console.log('[unfurl] direct', parsed.hostname, 'status', status, 'blocked', blocked, 'incomplete', need())
    if (blocked || need()) {
      // 1) Proxy PREMIUM sans rendu JS (~10 crédits) : rapide, et requis par les
      //    « domaines protégés » (Fnac…). Couvre la plupart des e-commerces, qui
      //    servent prix/OG dans le HTML serveur.
      const r1 = await fetchViaProxy(parsed.toString(), { premium: true }, 35_000)
      outOfCredits = outOfCredits || r1.outOfCredits
      if (r1.html) data = mergeMeta(data, extract(r1.html, parsed))

      // 2) Dernier recours : on a bien reçu du HTML mais il manque encore image
      //    ou prix → page rendue en JS (SPA). On exécute le JS (lent, ~25 crédits).
      if (r1.html && need()) {
        const r2 = await fetchViaProxy(parsed.toString(), { premium: true, render: true }, 45_000)
        outOfCredits = outOfCredits || r2.outOfCredits
        if (r2.html) data = mergeMeta(data, extract(r2.html, parsed))
      }
    }

    // Amazon : à défaut d'image, on déduit la photo de l'ASIN (sans scraping).
    if (!data.image && isAmazonHost(parsed.hostname)) {
      const asin = asinFromUrl(parsed)
      if (asin) data.image = amazonImageFromAsin(asin)
    }

    // Message informatif si le service d'import est à court de crédits (la saisie
    // manuelle reste possible : on renvoie quand même ce qu'on a pu trouver).
    // Message neutre côté utilisateur (le motif technique reste dans les logs).
    const note =
      outOfCredits && need()
        ? 'Import automatique indisponible pour le moment — ajoute la photo et le prix à la main.'
        : null

    console.log('[unfurl] résultat', JSON.stringify(data), 'outOfCredits', outOfCredits)
    return json(200, { ...data, note })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(502, { error: `Impossible de lire la page : ${msg}` })
  }
})
