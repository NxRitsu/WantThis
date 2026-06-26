import { app } from '../store.js'
import { signIn, signUp, sendPasswordReset } from '../auth.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

export function renderLogin() {
  let mode = 'login' // 'login' | 'signup' | 'forgot'

  function subtitle() {
    if (mode === 'forgot') return 'Reçois un lien pour réinitialiser ton mot de passe.'
    return 'La wishlist familiale qui évite les doublons.'
  }

  function submitLabel() {
    if (mode === 'signup') return 'Créer mon compte'
    if (mode === 'forgot') return 'Envoyer le lien'
    return 'Se connecter'
  }

  function draw() {
    app().innerHTML = `
      <div class="auth-wrap">
        <div class="card">
          <div class="auth-logo">${icons.gift}</div>
          <h2 class="center">WantThis</h2>
          <p class="center muted">${subtitle()}</p>
          <div id="err"></div>
          <div id="ok"></div>
          <form id="auth-form">
            ${
              mode === 'signup'
                ? `<label for="name">Votre prénom</label>
                   <input id="name" type="text" required placeholder="Ex. Camille" />`
                : ''
            }
            <label for="email">Email</label>
            <input id="email" type="email" required placeholder="vous@email.com" />
            ${
              mode !== 'forgot'
                ? `<label for="password">Mot de passe</label>
                   <input id="password" type="password" required minlength="6" placeholder="••••••" />`
                : ''
            }
            <button class="btn btn--block" type="submit">${submitLabel()}</button>
          </form>
          ${
            mode === 'login'
              ? `<p class="center" style="margin:14px 0 0">
                   <button class="link-btn" id="forgot">Mot de passe oublié ?</button>
                 </p>`
              : ''
          }
          <p class="center muted" style="margin:14px 0 0">
            ${
              mode === 'signup'
                ? 'Déjà un compte ? <button class="link-btn" id="toggle">Se connecter</button>'
                : mode === 'forgot'
                  ? '<button class="link-btn" id="toggle">‹ Retour à la connexion</button>'
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

    app().querySelector('#forgot')?.addEventListener('click', () => {
      mode = 'forgot'
      draw()
    })

    app().querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const btn = e.target.querySelector('button[type=submit]')
      const errBox = app().querySelector('#err')
      const okBox = app().querySelector('#ok')
      errBox.innerHTML = ''
      okBox.innerHTML = ''
      btn.disabled = true
      try {
        const email = app().querySelector('#email').value.trim()

        if (mode === 'forgot') {
          await sendPasswordReset(email)
          okBox.innerHTML = `<div class="success-box">${icons.check} Si un compte existe, un email vient de partir. Vérifie ta boîte mail.</div>`
          e.target.reset()
          btn.disabled = false
          return
        }

        const password = app().querySelector('#password').value
        if (mode === 'signup') {
          const name = app().querySelector('#name').value.trim()
          await signUp(email, password, name)
        } else {
          await signIn(email, password)
        }
        navigate('/groups')
      } catch (err) {
        errBox.innerHTML = `<div class="error">${icons.alert} ${err.message || 'Une erreur est survenue.'}</div>`
        btn.disabled = false
      }
    })
  }

  draw()
}
