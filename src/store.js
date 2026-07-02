// État applicatif minimal partagé entre les vues.
export const state = {
  user: null, // utilisateur Auth courant
  profile: null, // profil applicatif (display_name, is_admin)
}

export const app = () => document.getElementById('app')

// Petit helper d'échappement pour éviter l'injection HTML quand on rend
// des données venant de la base (titres de cadeaux, noms, etc.).
export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  )
}

// N'autorise que les URLs http(s) avant de les rendre dans un href/src.
// Bloque les schémas dangereux (javascript:, data:, etc.) qu'un membre aurait
// pu glisser dans le lien ou l'image d'un cadeau. Renvoie '' si l'URL n'est pas sûre.
export function safeUrl(value) {
  const s = String(value ?? '').trim()
  return /^https?:\/\//i.test(s) ? s : ''
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
