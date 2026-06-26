import { app, esc, state } from '../store.js'
import { shell, wireLayout } from './layout.js'
import {
  getGifts,
  getGroupMembers,
  getReservations,
  reserveGift,
  cancelReservation,
  subscribeToGroup,
} from '../api.js'
import { navigate, currentPath } from '../router.js'
import { icons } from '../icons.js'

function priceLabel(p) {
  return p == null ? '' : `${Number(p).toFixed(2)} €`
}

// Désabonnement realtime de la vue précédente.
let unsubscribe = null

export async function renderMemberList({ id: groupId, userId: ownerId }) {
  const back = `/group/${groupId}`
  const path = currentPath()

  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }

  app().innerHTML = shell(`<p class="muted">Chargement…</p>`, { title: 'Liste', back })
  wireLayout(app())

  const me = state.user.id
  if (ownerId === me) {
    // Sécurité : on ne consulte pas sa propre liste ici (affichage neutre ailleurs).
    navigate(`/group/${groupId}/me`)
    return
  }

  let owner, gifts, reservations
  try {
    const members = await getGroupMembers(groupId)
    owner = members.find((m) => m.id === ownerId)
    gifts = await getGifts(groupId, ownerId)
    reservations = await getReservations(gifts.map((g) => g.id))
  } catch (err) {
    app().innerHTML = shell(`<div class="error">${esc(err.message)}</div>`, { title: 'Liste', back })
    wireLayout(app())
    return
  }

  // index gift_id -> reservation
  const byGift = new Map(reservations.map((r) => [r.gift_id, r]))

  const listHtml = gifts.length
    ? `<ul class="list">${gifts
        .map((g) => {
          const r = byGift.get(g.id)
          const sub = [
            g.url ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">Voir le lien</a>` : '',
            g.price != null ? esc(priceLabel(g.price)) : '',
          ]
            .filter(Boolean)
            .join(' · ')

          let action, badge = ''
          if (!r) {
            action = `<button class="btn btn--sm" data-reserve="${esc(g.id)}">Réserver</button>`
          } else if (r.reserved_by === me) {
            badge = `<span class="badge badge--mine">${icons.check} Réservé par toi</span>`
            action = `<button class="btn btn--sm btn--danger" data-cancel="${esc(g.id)}">Annuler</button>`
          } else {
            badge = `<span class="badge badge--reserved">${icons.lock} Déjà réservé</span>`
            action = `<button class="btn btn--sm" disabled>Réserver</button>`
          }

          return `
          <li class="list-item">
            <div class="row" style="min-width:0">
              ${
                g.image_url
                  ? `<img class="thumb" src="${esc(g.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
                  : ''
              }
              <div class="list-item__main">
                <div class="list-item__title">${esc(g.title)} ${badge}</div>
                ${sub ? `<div class="list-item__sub">${sub}</div>` : ''}
              </div>
            </div>
            ${action}
          </li>`
        })
        .join('')}</ul>`
    : `<div class="empty">${esc(owner?.display_name || 'Ce membre')} n'a pas encore ajouté de cadeau.</div>`

  app().innerHTML = shell(
    `
    <div class="card">
      <h2>Liste de ${esc(owner?.display_name || '?')}</h2>
      <p class="hint">${icons.lock} Réserve un cadeau : tout le monde le verra réservé, sauf ${esc(
        owner?.display_name || 'le propriétaire'
      )}.</p>
      <div id="list" style="margin-top:16px">${listHtml}</div>
    </div>
  `,
    { title: owner?.display_name || 'Liste', back }
  )
  wireLayout(app())

  // Actions réserver / annuler
  app().querySelectorAll('[data-reserve]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true
      try {
        await reserveGift(btn.getAttribute('data-reserve'), me)
      } catch (err) {
        alert(err.message) // le cadeau a peut-être été réservé entre-temps
      }
      renderMemberList({ id: groupId, userId: ownerId })
    })
  )

  app().querySelectorAll('[data-cancel]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true
      await cancelReservation(btn.getAttribute('data-cancel'))
      renderMemberList({ id: groupId, userId: ownerId })
    })
  )

  // Realtime : si un autre membre réserve/annule, on rafraîchit (si on est toujours
  // sur cette vue).
  unsubscribe = subscribeToGroup(groupId, () => {
    if (currentPath() === path) renderMemberList({ id: groupId, userId: ownerId })
  })
}
