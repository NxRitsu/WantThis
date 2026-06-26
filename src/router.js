// Routeur minimal basé sur le hash (#/...), compatible GitHub Pages
// (pas besoin de configuration serveur pour les routes profondes).

const routes = []

export function route(pattern, handler) {
  // pattern ex: '/group/:id/member/:userId'
  const keys = []
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\//g, '\\/')
        .replace(/:(\w+)/g, (_, key) => {
          keys.push(key)
          return '([^/]+)'
        }) +
      '$'
  )
  routes.push({ regex, keys, handler })
}

export function navigate(path) {
  if (location.hash === '#' + path) {
    handleRoute()
  } else {
    location.hash = path
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, '') || '/'
}

let fallback = null
export function setFallback(handler) {
  fallback = handler
}

export function handleRoute() {
  const path = currentPath()
  for (const { regex, keys, handler } of routes) {
    const match = path.match(regex)
    if (match) {
      const params = {}
      keys.forEach((key, i) => (params[key] = decodeURIComponent(match[i + 1])))
      handler(params)
      return
    }
  }
  if (fallback) fallback(path)
}

export function startRouter() {
  window.addEventListener('hashchange', handleRoute)
  handleRoute()
}
