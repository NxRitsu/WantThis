import { supabase } from './supabase.js'

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Envoie un email avec un lien de réinitialisation. Le lien renvoie vers
// l'app (racine), où l'événement PASSWORD_RECOVERY déclenche l'écran de
// définition d'un nouveau mot de passe.
export async function sendPasswordReset(email) {
  // Marqueur ?type=recovery : Supabase y ajoute son ?code=… (flux PKCE). Au
  // retour, l'app lit ce marqueur pour ouvrir l'écran de nouveau mot de passe
  // (l'événement PASSWORD_RECOVERY se déclenche trop tôt pour être capté).
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}?type=recovery`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

// Définit le nouveau mot de passe (nécessite une session de récupération active).
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Notifie à chaque changement d'état (connexion / déconnexion / récupération).
// callback(session, event) — event ex: 'SIGNED_IN', 'PASSWORD_RECOVERY'…
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(session, event))
}
