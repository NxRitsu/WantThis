// Génère les icônes PNG de l'app (sans dépendance externe) à partir du logo
// « étiquette cadeau » (docs/logos/6-etiquette.svg), rastérisé à la main avec
// suréchantillonnage 4×4 pour l'anticrénelage.
// Usage : node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// ---------- PNG ----------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtre "none"
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ---------- Géométrie du logo (repère 120×120, identique au SVG) ----------
const INDIGO = [99, 102, 241]
const WHITE = [255, 255, 255]
const AMBER = [251, 191, 36]
const ANGLE = (12 * Math.PI) / 180 // rotate(-12) dans le SVG → on applique l'inverse

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
function distToPolyline(px, py, pts) {
  let d = Infinity
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(px, py, ...pts[i], ...pts[i + 1]))
  return d
}

// Ficelle : courbe de Bézier M60 35 C63 20 82 16 96 26, échantillonnée.
const STRING = Array.from({ length: 41 }, (_, i) => {
  const t = i / 40
  const m = 1 - t
  const b = (a, c1, c2, d) => m * m * m * a + 3 * m * m * t * c1 + 3 * m * t * t * c2 + t * t * t * d
  return [b(60, 63, 82, 96), b(35, 20, 16, 26)]
})
const W = [[44, 62], [51, 84], [60, 68], [69, 84], [76, 62]]

// Étiquette : pointe en haut (60,22)→(84,42), corps 36..84 × 42..98, coins bas arrondis r=6.
function inTag(x, y) {
  if (y >= 22 && y < 42) return Math.abs(x - 60) <= ((y - 22) * 24) / 20
  if (y < 42 || y > 98 || x < 36 || x > 84) return false
  if (y > 92 && (x < 42 || x > 78)) return Math.hypot(x - (x < 42 ? 42 : 78), y - 92) <= 6
  return true
}

// Couleur d'un point (x,y) du repère 120 ; null = transparent.
// opts.bleed : fond carré plein (maskable / iOS) ; opts.scale : réduction du motif.
function sample(x, y, { bleed, scale }) {
  if (!bleed) {
    const r = 27
    const cx = Math.max(r, Math.min(120 - r, x))
    const cy = Math.max(r, Math.min(120 - r, y))
    if (Math.hypot(x - cx, y - cy) > r) return null
  }
  // Repère local du motif : on annule l'échelle puis la rotation autour du centre.
  let lx = (x - 60) / scale
  let ly = (y - 60) / scale
  ;[lx, ly] = [lx * Math.cos(ANGLE) - ly * Math.sin(ANGLE), lx * Math.sin(ANGLE) + ly * Math.cos(ANGLE)]
  lx += 60
  ly += 60

  let color = INDIGO
  if (distToPolyline(lx, ly, STRING) <= 1.75) color = AMBER
  if (inTag(lx, ly)) color = WHITE
  if (Math.hypot(lx - 60, ly - 40) <= 5) color = INDIGO
  if (distToPolyline(lx, ly, W) <= 3) color = INDIGO
  return color
}

function render(size, opts) {
  const SS = 4
  const buf = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(((px + (sx + 0.5) / SS) / size) * 120, ((py + (sy + 0.5) / SS) / size) * 120, opts)
          if (!c) continue
          r += c[0]; g += c[1]; b += c[2]; a++
        }
      }
      const i = (py * size + px) * 4
      if (a) {
        buf[i] = Math.round(r / a)
        buf[i + 1] = Math.round(g / a)
        buf[i + 2] = Math.round(b / a)
      }
      buf[i + 3] = Math.round((a / (SS * SS)) * 255)
    }
  }
  return encodePng(size, buf)
}

for (const [name, size, opts] of [
  ['icon-192.png', 192, { bleed: false, scale: 1 }],
  ['icon-512.png', 512, { bleed: false, scale: 1 }],
  // Maskable : fond plein + motif réduit pour rester dans la zone de sécurité (cercle 80 %).
  ['icon-maskable-512.png', 512, { bleed: true, scale: 0.78 }],
  // iOS arrondit lui-même les coins : fond plein.
  ['apple-touch-icon.png', 180, { bleed: true, scale: 0.9 }],
]) {
  writeFileSync(join(OUT, name), render(size, opts))
  console.log('écrit', name)
}
