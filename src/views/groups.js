import { app, esc, state } from '../store.js'
import { shell, wireLayout } from './layout.js'
import { getMyGroups, createGroup, joinGroup } from '../api.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

export async function renderGroups() {
  app().innerHTML = shell(`<p class="muted">Chargement…</p>`)
  wireLayout(app())

  let groups = []
  try {
    groups = await getMyGroups()
  } catch (err) {
    app().innerHTML = shell(`<div class="error">${esc(err.message)}</div>`)
    wireLayout(app())
    return
  }

  const groupsHtml = groups.length
    ? `<div class="group-grid">${groups
        .map(
          (g) => `
        <button class="tile" data-open="${esc(g.id)}">
          <span class="tile__title">${esc(g.name)}</span>
          <span class="tile__code">Code <b>${esc(g.invite_code)}</b></span>
          <span class="tile__cta">Ouvrir →</span>
        </button>`
        )
        .join('')}</div>`
    : `<div class="empty">Tu n'as pas encore de groupe.<br/>Crée-en un ou rejoins ta famille avec les blocs ci-dessous.</div>`

  app().innerHTML = shell(`
    <div class="card">
      <div class="row--between" style="margin-bottom:14px">
        <h2 style="margin:0">Mes groupes</h2>
        ${groups.length ? `<span class="badge badge--admin">${icons.users} ${groups.length}</span>` : ''}
      </div>
      ${groupsHtml}
    </div>

    <div class="duo">
      <div class="card">
        <h3>${icons.plus} Créer un groupe</h3>
        <div id="create-err"></div>
        <form id="create-form">
          <label for="gname">Nom du groupe</label>
          <input id="gname" type="text" required placeholder="Ex. Famille Martin" />
          <button class="btn btn--block" type="submit">Créer le groupe</button>
        </form>
      </div>

      <div class="card">
        <h3>${icons.users} Rejoindre un groupe</h3>
        <div id="join-err"></div>
        <form id="join-form">
          <label for="code">Code d'invitation</label>
          <input id="code" type="text" required placeholder="Ex. K7P2QX" style="text-transform:uppercase" />
          <button class="btn btn--block btn--ghost" type="submit">Rejoindre</button>
        </form>
      </div>
    </div>

    ${
      state.profile?.is_admin
        ? `<div class="card">
             <h3>${icons.shield} Administration</h3>
             <p class="muted">Gérer les comptes utilisateurs.</p>
             <button class="btn btn--block btn--ghost" id="admin-link">Ouvrir l'administration</button>
           </div>`
        : ''
    }
  `)
  wireLayout(app())

  app().querySelector('#admin-link')?.addEventListener('click', () => navigate('/admin'))

  app().querySelectorAll('[data-open]').forEach((btn) =>
    btn.addEventListener('click', () => navigate('/group/' + btn.getAttribute('data-open')))
  )

  app().querySelector('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = e.target.querySelector('button')
    btn.disabled = true
    try {
      const g = await createGroup(app().querySelector('#gname').value.trim())
      navigate('/group/' + g.id)
    } catch (err) {
      app().querySelector('#create-err').innerHTML = `<div class="error">${esc(err.message)}</div>`
      btn.disabled = false
    }
  })

  app().querySelector('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = e.target.querySelector('button')
    btn.disabled = true
    try {
      const gid = await joinGroup(app().querySelector('#code').value.trim())
      navigate('/group/' + gid)
    } catch (err) {
      app().querySelector('#join-err').innerHTML = `<div class="error">${esc(err.message)}</div>`
      btn.disabled = false
    }
  })
}
