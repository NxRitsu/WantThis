import { icons } from './icons.js'

// Tutoriels affichés dans une modale à étapes.
// - 'login'  : sur l'écran de connexion (comment créer un compte / se connecter + présentation).
// - 'usage'  : sur l'accueil (comment se servir de l'app une fois connecté).
const TUTORIALS = {
  login: {
    title: 'Bienvenue sur WantThis',
    steps: [
      {
        icon: icons.gift,
        title: 'À quoi ça sert ?',
        body: `WantThis est la <b>wishlist de la famille</b>. Chacun note les cadeaux qui lui
               feraient plaisir, et on réserve ceux des autres <b>en secret</b> — fini les
               doublons et les cadeaux en double le jour J.`,
      },
      {
        icon: icons.plus,
        title: 'Créer ton compte',
        body: `Première visite ? Clique sur <b>« S'inscrire »</b>, indique ton <b>prénom</b>,
               ton <b>email</b> et un <b>mot de passe</b>. C'est tout : pas d'installation,
               ça marche depuis le téléphone comme l'ordinateur.`,
      },
      {
        icon: icons.lock,
        title: 'Te connecter',
        body: `Les fois suivantes, entre simplement ton <b>email</b> et ton <b>mot de passe</b>.
               Mot de passe oublié ? Le lien <b>« Mot de passe oublié ? »</b> t'envoie un email
               pour le réinitialiser.`,
      },
      {
        icon: icons.users,
        title: 'Et ensuite ?',
        body: `Une fois connecté, tu rejoins le <b>groupe de ta famille</b> avec un code, ou tu
               en crées un. Un autre petit bouton <b>« i »</b> t'expliquera l'utilisation à
               ce moment-là.`,
      },
    ],
  },
  usage: {
    title: 'Comment utiliser WantThis',
    steps: [
      {
        icon: icons.users,
        title: 'Les groupes',
        body: `Tout se passe dans un <b>groupe</b> (ta famille, tes proches…). <b>Crée-en un</b>
               ou <b>rejoins</b> celui de ta famille avec le <b>code d'invitation</b> qu'on t'a
               partagé. Tu peux être dans plusieurs groupes.`,
      },
      {
        icon: icons.link,
        title: 'Inviter ta famille',
        body: `Ouvre un groupe : tu y verras un <b>code d'invitation</b>. Partage-le (SMS,
               WhatsApp…) : chaque personne qui l'entre rejoint le même groupe et voit les
               mêmes listes.`,
      },
      {
        icon: icons.plus,
        title: 'Remplir ta liste',
        body: `Dans <b>« Ma liste »</b>, ajoute tes idées de cadeaux. Colle simplement le
               <b>lien d'un produit</b> : la <b>photo</b> et le <b>prix</b> se remplissent tout
               seuls. Tu peux aussi tout saisir à la main.`,
      },
      {
        icon: icons.check,
        title: 'Réserver en secret',
        body: `Sur la liste d'un proche, clique <b>« Réserver »</b> sur un cadeau. Les autres
               membres le voient <b>« Déjà réservé »</b> (pour ne pas l'acheter aussi)… mais
               <b>la personne concernée ne voit rien</b> : la surprise est intacte.`,
      },
      {
        icon: icons.lock,
        title: 'Ta liste reste une surprise',
        body: `Sur <b>ta propre liste</b>, tu ne sauras jamais quels cadeaux ont déjà été
               réservés. C'est voulu — et garanti côté serveur — pour que tu gardes la surprise
               toi aussi. 🎁`,
      },
    ],
  },
}

// Markup du petit bouton « i » à insérer dans une vue.
export function tutoButton() {
  return `<button class="tuto-btn" data-tuto type="button" aria-label="Comment ça marche ?" title="Comment ça marche ?">${icons.info}</button>`
}

// Branche le bouton [data-tuto] présent dans `root` pour ouvrir le tutoriel `kind`.
export function wireTuto(root, kind) {
  const btn = root.querySelector('[data-tuto]')
  if (btn) btn.addEventListener('click', () => openTuto(kind))
}

// Ouvre la modale de tutoriel (overlay custom, sans dialogue natif bloquant).
function openTuto(kind) {
  const data = TUTORIALS[kind]
  if (!data) return

  let i = 0
  const overlay = document.createElement('div')
  overlay.className = 'tuto-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', data.title)

  function close() {
    document.removeEventListener('keydown', onKey)
    overlay.classList.add('tuto-overlay--closing')
    setTimeout(() => overlay.remove(), 160)
  }

  function go(delta) {
    const next = i + delta
    if (next < 0) return
    if (next >= data.steps.length) return close()
    i = next
    draw()
  }

  function onKey(e) {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
  }

  function draw() {
    const step = data.steps[i]
    const last = i === data.steps.length - 1
    overlay.innerHTML = `
      <div class="tuto-card">
        <button class="tuto-close" data-close type="button" aria-label="Fermer">${icons.close}</button>
        <div class="tuto-icon">${step.icon}</div>
        <h3 class="tuto-title">${step.title}</h3>
        <p class="tuto-body">${step.body}</p>
        <div class="tuto-dots">${data.steps
          .map((_, k) => `<span class="tuto-dot${k === i ? ' is-active' : ''}"></span>`)
          .join('')}</div>
        <div class="tuto-nav">
          ${i > 0 ? `<button class="btn btn--sm btn--ghost" data-prev type="button">Précédent</button>` : '<span></span>'}
          <button class="btn btn--sm" data-next type="button">${last ? "C'est parti !" : 'Suivant'}</button>
        </div>
      </div>`
    overlay.querySelector('[data-close]').addEventListener('click', close)
    overlay.querySelector('[data-prev]')?.addEventListener('click', () => go(-1))
    overlay.querySelector('[data-next]').addEventListener('click', () => go(1))
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  document.addEventListener('keydown', onKey)
  document.body.appendChild(overlay)
  draw()
}
