import './style.css'
import { state } from './store.js'
import { getSession, onAuthChange } from './auth.js'
import { route, setFallback, startRouter, navigate, currentPath } from './router.js'
import { renderLogin } from './views/login.js'
import { renderGroups } from './views/groups.js'
import { renderDashboard } from './views/dashboard.js'
import { renderMyList } from './views/myList.js'
import { renderMemberList } from './views/memberList.js'

// --- Garde d'authentification : redirige vers /login si pas connecté ---
function requireAuth(handler) {
  return (params) => {
    if (!state.user) {
      navigate('/login')
      return
    }
    handler(params)
  }
}

// --- Déclaration des routes ---
route('/login', () => {
  if (state.user) return navigate('/groups')
  renderLogin()
})
route('/groups', requireAuth(renderGroups))
route('/group/:id', requireAuth(renderDashboard))
route('/group/:id/me', requireAuth(renderMyList))
route('/group/:id/member/:userId', requireAuth(renderMemberList))

setFallback(() => navigate(state.user ? '/groups' : '/login'))

// --- Initialisation : récupérer la session avant de démarrer le routeur ---
async function boot() {
  const session = await getSession()
  state.user = session?.user ?? null

  // Réagir aux connexions / déconnexions.
  onAuthChange((session) => {
    const wasLogged = !!state.user
    state.user = session?.user ?? null
    if (!state.user && wasLogged) {
      navigate('/login')
    }
  })

  startRouter()

  // Si on arrive à la racine, router vers le bon écran.
  if (currentPath() === '/') {
    navigate(state.user ? '/groups' : '/login')
  }
}

boot()

// --- PWA : enregistrement du service worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/WantThis/sw.js').catch((err) => {
      console.warn('Service worker non enregistré :', err)
    })
  })
}
