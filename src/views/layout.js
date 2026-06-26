import { esc } from '../store.js'
import { signOut } from '../auth.js'
import { navigate } from '../router.js'

// Construit le markup de l'écran avec une barre supérieure.
// options: { title, back } — back = chemin de retour (ou null).
export function shell(bodyHtml, { title = 'WantThis', back = null } = {}) {
  return `
    <header class="topbar">
      <div class="row">
        ${
          back
            ? `<button class="link-btn" style="color:#fff" data-back="${esc(back)}">‹ Retour</button>`
            : `<span class="brand">🎁 WantThis</span>`
        }
      </div>
      <div class="row">
        ${back ? `<span class="brand">${esc(title)}</span>` : ''}
        <button class="link-btn" style="color:#fff" data-logout>Déconnexion</button>
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
