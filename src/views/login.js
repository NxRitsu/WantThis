import { app } from '../store.js'
import { signIn, signUp } from '../auth.js'
import { navigate } from '../router.js'

export function renderLogin() {
  let mode = 'login' // 'login' | 'signup'

  function draw() {
    app().innerHTML = `
      <div class="auth-wrap">
        <div class="card">
          <h2 class="center">🎁 WantThis</h2>
          <p class="center muted">La wishlist familiale qui évite les doublons.</p>
          <div id="err"></div>
          <form id="auth-form">
            ${
              mode === 'signup'
                ? `<label for="name">Votre prénom</label>
                   <input id="name" type="text" required placeholder="Ex. Camille" />`
                : ''
            }
            <label for="email">Email</label>
            <input id="email" type="email" required placeholder="vous@email.com" />
            <label for="password">Mot de passe</label>
            <input id="password" type="password" required minlength="6" placeholder="••••••" />
            <button class="btn btn--block" type="submit">
              ${mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
            </button>
          </form>
          <p class="center muted" style="margin-bottom:0">
            ${
              mode === 'signup'
                ? 'Déjà un compte ? <button class="link-btn" id="toggle">Se connecter</button>'
                : 'Pas encore de compte ? <button class="link-btn" id="toggle">S\'inscrire</button>'
            }
          </p>
        </div>
      </div>
    `

    app().querySelector('#toggle').addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login'
      draw()
    })

    app().querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = e.target.querySelector('button[type=submit]')
      const errBox = app().querySelector('#err')
      errBox.innerHTML = ''
      btn.disabled = true
      try {
        const email = app().querySelector('#email').value.trim()
        const password = app().querySelector('#password').value
        if (mode === 'signup') {
          const name = app().querySelector('#name').value.trim()
          await signUp(email, password, name)
        } else {
          await signIn(email, password)
        }
        navigate('/groups')
      } catch (err) {
        errBox.innerHTML = `<div class="error">${err.message || 'Une erreur est survenue.'}</div>`
        btn.disabled = false
      }
    })
  }

  draw()
}
