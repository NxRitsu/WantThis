import { app, esc, state } from '../store.js'
import { shell, wireLayout } from './layout.js'
import { getGifts, addGift, updateGift, deleteGift, unfurl } from '../api.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

function priceLabel(p) {
  return p == null ? '' : `${Number(p).toFixed(2)} €`
}

function giftItem(g) {
  const sub = [
    g.url ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">Voir le lien</a>` : '',
    g.price != null ? esc(priceLabel(g.price)) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return `
    <li class="list-item" data-gift="${esc(g.id)}">
      <div class="row" style="min-width:0">
        ${
          g.image_url
            ? `<img class="thumb" src="${esc(g.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
            : ''
        }
        <div class="list-item__main">
          <div class="list-item__title">${esc(g.title)}</div>
          ${sub ? `<div class="list-item__sub">${sub}</div>` : ''}
        </div>
      </div>
      <div class="row">
        <button class="btn btn--sm btn--ghost" data-edit="${esc(g.id)}">Modifier</button>
        <button class="btn btn--sm btn--danger" data-del="${esc(g.id)}">Suppr.</button>
      </div>
    </li>`
}

export async function renderMyList({ id: groupId }) {
  const back = `/group/${groupId}`
  app().innerHTML = shell(`<p class="muted">Chargement…</p>`, { title: 'Ma liste', back })
  wireLayout(app())

  const me = state.user.id
  let gifts = []
  try {
    gifts = await getGifts(groupId, me)
  } catch (err) {
    app().innerHTML = shell(`<div class="error">${esc(err.message)}</div>`, { title: 'Ma liste', back })
    wireLayout(app())
    return
  }

  const listHtml = gifts.length
    ? `<ul class="list">${gifts.map(giftItem).join('')}</ul>`
    : `<div class="empty">Aucun cadeau pour l'instant. Ajoute ta première idée ci-dessus.</div>`

  app().innerHTML = shell(
    `
    <div class="card">
      <h2>Ma liste</h2>
      <p class="hint">${icons.lock} Affichage neutre : impossible de savoir si tes cadeaux sont déjà réservés.</p>
      <div id="add-err" style="margin-top:16px"></div>
      <form id="add-form">
        <label for="url">Lien du produit (optionnel)</label>
        <input id="url" type="url" placeholder="https://… (photo et prix récupérés auto.)" />
        <div id="unfurl"></div>
        <label for="title">Titre du cadeau</label>
        <input id="title" type="text" required placeholder="Ex. Casque audio" />
        <label for="price">Prix indicatif (optionnel)</label>
        <input id="price" type="number" step="0.01" min="0" placeholder="49.90" />
        <button class="btn btn--block" type="submit">${icons.plus} Ajouter</button>
      </form>
    </div>

    <div class="card">
      <h3>Mes idées (${gifts.length})</h3>
      <div id="list">${listHtml}</div>
    </div>
  `,
    { title: 'Ma liste', back }
  )
  wireLayout(app())

  const urlInput = app().querySelector('#url')
  const titleInput = app().querySelector('#title')
  const priceInput = app().querySelector('#price')
  const unfurlBox = app().querySelector('#unfurl')

  // Image détectée pour le cadeau en cours de saisie.
  let fetchedImage = null
  // Jeton anti-course : seule la dernière requête lancée fait foi.
  let runToken = 0
  let lastFetchedUrl = ''

  async function tryUnfurl() {
    const url = urlInput.value.trim()
    if (!url || url === lastFetchedUrl) return
    if (!/^https?:\/\//i.test(url)) return
    lastFetchedUrl = url
    fetchedImage = null

    const token = ++runToken
    unfurlBox.innerHTML = `<div class="preview preview--loading"><span class="spinner"></span> Récupération de la fiche produit…</div>`

    try {
      const data = await unfurl(url)
      if (token !== runToken) return // une autre requête a démarré entre-temps

      if (data.title && !titleInput.value.trim()) titleInput.value = data.title
      if (data.price != null && !priceInput.value.trim()) priceInput.value = data.price
      fetchedImage = data.image || null

      if (fetchedImage || data.price != null) {
        unfurlBox.innerHTML = `
          <div class="preview">
            ${fetchedImage ? `<img class="thumb thumb--lg" src="${esc(fetchedImage)}" alt="" referrerpolicy="no-referrer" />` : ''}
            <div class="preview__text">
              <div class="preview__ok">${icons.check} Fiche récupérée</div>
              <div class="muted">${[
                fetchedImage ? 'photo' : '',
                data.price != null ? priceLabel(data.price) : '',
              ]
                .filter(Boolean)
                .join(' · ')}</div>
            </div>
          </div>`
      } else {
        unfurlBox.innerHTML = `<div class="preview muted">Aucune photo/prix trouvé sur cette page — remplis-les à la main.</div>`
      }
    } catch {
      if (token !== runToken) return
      unfurlBox.innerHTML = `<div class="preview muted">Récupération impossible — remplis les champs à la main.</div>`
    }
  }

  urlInput.addEventListener('change', tryUnfurl)
  urlInput.addEventListener('blur', tryUnfurl)

  // Ajout
  app().querySelector('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = e.target.querySelector('button[type=submit]')
    btn.disabled = true
    try {
      await addGift(groupId, me, {
        title: titleInput.value.trim(),
        url: urlInput.value.trim(),
        price: priceInput.value,
        image_url: fetchedImage,
      })
      renderMyList({ id: groupId })
    } catch (err) {
      app().querySelector('#add-err').innerHTML = `<div class="error">${icons.alert} ${esc(err.message)}</div>`
      btn.disabled = false
    }
  })

  // Suppression
  app().querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true
      await deleteGift(btn.getAttribute('data-del'))
      renderMyList({ id: groupId })
    })
  )

  // Édition inline
  app().querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit')
      const g = gifts.find((x) => x.id === id)
      const li = app().querySelector(`[data-gift="${id}"]`)
      li.innerHTML = `
        <form class="list-item__main" data-edit-form style="width:100%">
          <input type="text" class="ed-title" value="${esc(g.title)}" required />
          <input type="url" class="ed-url" value="${esc(g.url || '')}" placeholder="https://…" />
          <input type="number" step="0.01" min="0" class="ed-price" value="${g.price ?? ''}" placeholder="Prix" />
          <div class="row">
            <button class="btn btn--sm" type="submit">Enregistrer</button>
            <button class="btn btn--sm btn--ghost" type="button" data-cancel>Annuler</button>
          </div>
        </form>`
      li.querySelector('[data-cancel]').addEventListener('click', () => renderMyList({ id: groupId }))
      li.querySelector('[data-edit-form]').addEventListener('submit', async (e) => {
        e.preventDefault()
        await updateGift(id, {
          title: li.querySelector('.ed-title').value.trim(),
          url: li.querySelector('.ed-url').value.trim(),
          price: li.querySelector('.ed-price').value,
        })
        renderMyList({ id: groupId })
      })
    })
  )
}
