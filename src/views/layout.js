import { esc } from '../store.js'
import { signOut } from '../auth.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

// Construit le markup de l'écran avec une barre supérieure translucide.
// options: { title, back } — back = chemin de retour (ou null).
export function shell(bodyHtml, { title = 'WantThis', back = null } = {}) {
  return `
    <header class="topbar">
      <div class="topbar__left">
        ${
          back
            ? `<button class="icon-btn" data-back="${esc(back)}" aria-label="Retour">${icons.back}<span>Retour</span></button>`
            : `<span class="brand">${icons.gift}WantThis</span>`
        }
      </div>
      <div class="topbar__center">${back ? esc(title) : ''}</div>
      <div class="topbar__right">
        <button class="icon-btn" data-logout aria-label="Déconnexion">${icons.logout}</button>
      </div>
    </header>
    <main class="container">${bodyHtml}</main>
  `
}

// Branche les actions communes (retour, déconnexion) après injection du HTML.
export function wireLayout(root) {
  root.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await signOut()
    navigate('/login')
  })
  root.querySelector('[data-back]')?.addEventListener('click', (e) => {
    navigate(e.currentTarget.getAttribute('data-back'))
  })
}
