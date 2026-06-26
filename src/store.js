// État applicatif minimal partagé entre les vues.
export const state = {
  user: null, // utilisateur Auth courant
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

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
