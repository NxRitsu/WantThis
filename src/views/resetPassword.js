import { app } from '../store.js'
import { getSession, updatePassword } from '../auth.js'
import { navigate } from '../router.js'
import { icons } from '../icons.js'

// Écran de définition d'un nouveau mot de passe, atteint après avoir cliqué le
// lien de réinitialisation reçu par email (session de récupération active).
export async function renderResetPassword() {
  const session = await getSession()

  if (!session) {
    app().innerHTML = `
      <div class="auth-wrap">
        <div class="card">
          <div class="auth-logo">${icons.lock}</div>
          <h2 class="center">Lien expiré</h2>
          <p class="center muted">Ce lien de réinitialisation n'est plus valide.</p>
          <button class="btn btn--block" id="back">Retour à la connexion</button>
        </div>
      </div>`
    app().querySelector('#back').addEventListener('click', () => navigate('/login'))
    return
  }

  app().innerHTML = `
    <div class="auth-wrap">
      <div class="card">
        <div class="auth-logo">${icons.lock}</div>
        <h2 class="center">Nouveau mot de passe</h2>
        <p class="center muted">Choisis un nouveau mot de passe pour ton compte.</p>
        <div id="err"></div>
        <form id="pw-form">
          <label for="pw1">Nouveau mot de passe</label>
          <input id="pw1" type="password" required minlength="6" placeholder="••••••" />
          <label for="pw2">Confirme le mot de passe</label>
          <input id="pw2" type="password" required minlength="6" placeholder="••••••" />
          <button class="btn btn--block" type="submit">${icons.check} Enregistrer</button>
        </form>
      </div>
    </div>`

  app().querySelector('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const errBox = app().querySelector('#err')
    const pw1 = app().querySelector('#pw1').value
    const pw2 = app().querySelector('#pw2').value
    errBox.innerHTML = ''

    if (pw1 !== pw2) {
      errBox.innerHTML = `<div class="error">${icons.alert} Les deux mots de passe ne correspondent pas.</div>`
      return
    }

    const btn = e.target.querySelector('button[type=submit]')
    btn.disabled = true
    try {
      await updatePassword(pw1)
      navigate('/groups')
    } catch (err) {
      errBox.innerHTML = `<div class="error">${icons.alert} ${err.message || 'Une erreur est survenue.'}</div>`
      btn.disabled = false
    }
  })
}
