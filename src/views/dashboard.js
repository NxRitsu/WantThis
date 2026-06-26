import { app, esc, state, initials } from '../store.js'
import { shell, wireLayout } from './layout.js'
import { getMyGroups, getGroupMembers, leaveGroup, deleteGroup } from '../api.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

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
  const isCreator = group.created_by === me

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
      <p class="muted" style="margin-bottom:0">Partage ce code pour inviter ta famille :</p>
      <div class="invite">
        <span class="invite-code">${esc(group.invite_code)}</span>
        <button class="btn btn--sm btn--ghost" data-copy="${esc(group.invite_code)}">Copier</button>
      </div>
    </div>

    <div class="card">
      <h3>Membres (${members.length})</h3>
      <ul class="list">${membersHtml}</ul>
    </div>

    <div class="card">
      <h3>Zone sensible</h3>
      ${
        isCreator
          ? `<p class="muted">Tu es le créateur de ce groupe. Le supprimer efface définitivement
             ses cadeaux et réservations pour <b>tous</b> les membres.</p>
             <button class="btn btn--danger" data-delete>Supprimer le groupe</button>`
          : `<p class="muted">Tu peux quitter ce groupe à tout moment. Ta liste et tes
             réservations dans ce groupe seront retirées.</p>
             <button class="btn btn--danger" data-leave>Quitter le groupe</button>`
      }
      <div id="dz-msg" style="margin-top:12px"></div>
    </div>
  `,
    { title: group.name, back: '/groups' }
  )
  wireLayout(app())

  wireDangerZone(group, me, isCreator)

  app().querySelector('[data-copy]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    try {
      await navigator.clipboard.writeText(btn.getAttribute('data-copy'))
      const prev = btn.textContent
      btn.textContent = 'Copié ✓'
      setTimeout(() => (btn.textContent = prev), 1500)
    } catch {
      /* clipboard indisponible : on ignore silencieusement */
    }
  })

  app().querySelectorAll('[data-list]').forEach((btn) => {
    const ownerId = btn.getAttribute('data-list')
    btn.addEventListener('click', () => {
      if (ownerId === me) navigate(`/group/${groupId}/me`)
      else navigate(`/group/${groupId}/member/${ownerId}`)
    })
  })
}

// Quitter / supprimer le groupe, avec confirmation inline (pas de popup bloquante).
function wireDangerZone(group, me, isCreator) {
  const trigger = app().querySelector(isCreator ? '[data-delete]' : '[data-leave]')
  if (!trigger) return

  trigger.addEventListener('click', () => {
    const msg = app().querySelector('#dz-msg')
    const label = isCreator ? 'Oui, supprimer définitivement' : 'Oui, quitter'
    msg.innerHTML = `
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <span class="muted" style="font-size:.88rem">Cette action est irréversible.</span>
        <button class="btn btn--sm btn--danger" data-confirm>${label}</button>
        <button class="btn btn--sm btn--ghost" data-cancel>Annuler</button>
      </div>`
    trigger.disabled = true

    msg.querySelector('[data-cancel]').addEventListener('click', () => {
      msg.innerHTML = ''
      trigger.disabled = false
    })

    msg.querySelector('[data-confirm]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true
      try {
        if (isCreator) await deleteGroup(group.id)
        else await leaveGroup(group.id, me)
        navigate('/groups')
      } catch (err) {
        msg.innerHTML = `<div class="error">${icons.alert} ${esc(err.message)}</div>`
        trigger.disabled = false
      }
    })
  })
}
