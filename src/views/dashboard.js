import { app, esc, state, initials } from '../store.js'
import { shell, wireLayout } from './layout.js'
import { getMyGroups, getGroupMembers } from '../api.js'
import { navigate } from '../router.js'

export async function renderDashboard({ id: groupId }) {
  app().innerHTML = shell(`<p class="muted">Chargement…</p>`, { back: '/groups' })
  wireLayout(app())

  let group, members
  try {
    const groups = await getMyGroups()
    group = groups.find((g) => g.id === groupId)
    if (!group) {
      navigate('/groups')
      return
    }
    members = await getGroupMembers(groupId)
  } catch (err) {
    app().innerHTML = shell(`<div class="error">${esc(err.message)}</div>`, { back: '/groups' })
    wireLayout(app())
    return
  }

  const me = state.user?.id

  const membersHtml = members
    .map((m) => {
      const isMe = m.id === me
      return `
      <li class="list-item">
        <div class="row" style="min-width:0">
          <div class="avatar">${esc(initials(m.display_name))}</div>
          <div class="list-item__main">
            <div class="list-item__title">${esc(m.display_name)}${isMe ? ' (moi)' : ''}</div>
          </div>
        </div>
        <button class="btn btn--sm ${isMe ? 'btn--ghost' : ''}"
                data-list="${esc(m.id)}">
          ${isMe ? 'Ma liste' : 'Voir la liste'}
        </button>
      </li>`
    })
    .join('')

  app().innerHTML = shell(
    `
    <div class="card">
      <h2>${esc(group.name)}</h2>
      <p class="muted" style="margin-bottom:6px">Code d'invitation à partager :</p>
      <div class="invite-code">${esc(group.invite_code)}</div>
    </div>

    <div class="card">
      <h3>Membres</h3>
      <ul class="list">${membersHtml}</ul>
    </div>
  `,
    { title: group.name, back: '/groups' }
  )
  wireLayout(app())

  app().querySelectorAll('[data-list]').forEach((btn) => {
    const ownerId = btn.getAttribute('data-list')
    btn.addEventListener('click', () => {
      if (ownerId === me) navigate(`/group/${groupId}/me`)
      else navigate(`/group/${groupId}/member/${ownerId}`)
    })
  })
}
