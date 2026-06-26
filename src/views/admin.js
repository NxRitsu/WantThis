import { app, esc, state } from '../store.js'
import { shell, wireLayout } from './layout.js'
import { adminListUsers, adminDeleteUser } from '../api.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR')
  } catch {
    return ''
  }
}

export async function renderAdmin() {
  // Garde : réservé aux administrateurs.
  if (!state.profile?.is_admin) {
    navigate('/groups')
    return
  }

  app().innerHTML = shell(`<p class="muted">Chargement des comptes…</p>`, {
    title: 'Admin',
    back: '/groups',
  })
  wireLayout(app())

  let users = []
  try {
    users = await adminListUsers()
  } catch (err) {
    app().innerHTML = shell(
      `<div class="error">${esc(err.message)}</div>
       <p class="muted">Si l'Edge Function n'est pas encore déployée, vois le README (section Administration).</p>`,
      { title: 'Admin', back: '/groups' }
    )
    wireLayout(app())
    return
  }

  const me = state.user.id
  const rows = users
    .map((u) => {
      const isMe = u.id === me
      return `
      <li class="list-item" data-user="${esc(u.id)}">
        <div class="list-item__main">
          <div class="list-item__title">
            ${esc(u.display_name || '(sans nom)')}
            ${u.is_admin ? `<span class="badge badge--admin">${icons.shield} admin</span>` : ''}
            ${isMe ? '<span class="badge badge--mine">vous</span>' : ''}
          </div>
          <div class="list-item__sub">${esc(u.email || '')} · inscrit le ${esc(fmtDate(u.created_at))}</div>
        </div>
        ${
          isMe
            ? '<button class="btn btn--sm" disabled>—</button>'
            : `<button class="btn btn--sm btn--danger" data-del="${esc(u.id)}">Supprimer</button>`
        }
      </li>`
    })
    .join('')

  app().innerHTML = shell(
    `
    <div class="card">
      <h2>Administration</h2>
      <p class="muted">${users.length} compte(s). La suppression efface aussi les groupes,
      cadeaux et réservations du compte. Action <b>irréversible</b>.</p>
      <ul class="list">${rows}</ul>
    </div>
  `,
    { title: 'Admin', back: '/groups' }
  )
  wireLayout(app())

  app().querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', () => confirmDelete(btn))
  )
}

// Confirmation inline (pas de popup bloquante) avant suppression.
function confirmDelete(btn) {
  const id = btn.getAttribute('data-del')
  const li = app().querySelector(`[data-user="${id}"]`)
  const original = li.lastElementChild
  const box = document.createElement('div')
  box.className = 'row'
  box.innerHTML = `
    <span class="muted" style="font-size:.8rem">Confirmer ?</span>
    <button class="btn btn--sm btn--danger" data-confirm>Oui, supprimer</button>
    <button class="btn btn--sm btn--ghost" data-cancel>Annuler</button>`
  li.replaceChild(box, original)

  box.querySelector('[data-cancel]').addEventListener('click', () => renderAdmin())
  box.querySelector('[data-confirm]').addEventListener('click', async () => {
    box.querySelectorAll('button').forEach((b) => (b.disabled = true))
    try {
      await adminDeleteUser(id)
      renderAdmin()
    } catch (err) {
      box.innerHTML = `<span class="error" style="margin:0">${esc(err.message)}</span>`
    }
  })
}
