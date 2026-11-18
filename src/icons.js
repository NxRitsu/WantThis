// Jeu d'icônes SVG (trait 1.75, currentColor) — cohérent dans toute l'app.
// Style « line » façon Lucide. Pas d'emoji utilisé comme icône.

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

// Logo de l'app (étiquette cadeau « W ») — couleurs fixes de la marque.
// Source : docs/logos/6-etiquette.svg (PNG générés par scripts/gen-icons.mjs).
export const logo = `<svg class="logo-mark" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="27" fill="#6366f1"/><g transform="rotate(-12 60 60)"><path d="M60 35C63 20 82 16 96 26" fill="none" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/><path d="M60 22L84 42V92Q84 98 78 98H42Q36 98 36 92V42Z" fill="#fff"/><circle cx="60" cy="40" r="5" fill="#6366f1"/><polyline points="44,62 51,84 60,68 69,84 76,62" fill="none" stroke="#6366f1" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`

export const icons = {
  gift: svg(
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/><path d="M12 8S10.5 3.5 8 3.5 5 7 8 8M12 8s1.5-4.5 4-4.5 3 3.5 0 4.5"/>'
  ),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11.5 5.43"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L12.5 18.5"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'),
  shield: svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
}
