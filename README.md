# 🎁 WantThis

Wishlist familiale partagée avec **réservation secrète** : quand tu réserves un cadeau
sur la liste d'un proche, tous les membres le voient réservé — **sauf le propriétaire de
la liste**, pour garder la surprise. La discrétion est garantie **côté serveur** par le
Row Level Security de PostgreSQL (impossible à contourner depuis le navigateur).

- **Frontend** : Vanilla JS + [Vite](https://vitejs.dev/), 100 % statique, PWA installable.
- **Backend** : [Supabase](https://supabase.com/) (Postgres + Auth + Realtime + RLS).
- **Hébergement** : GitHub Pages (déploiement auto via GitHub Actions).

## Mise en route

### 1. Supabase (à faire une fois)
1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → colle le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Providers** : vérifie que *Email* est activé. Pour des tests
   rapides en famille, tu peux désactiver *Confirm email*.
4. **Settings → API** : récupère `Project URL` et la clé `anon public`.

### 2. Configuration locale
```bash
cp .env.example .env       # puis colle tes 2 valeurs Supabase dans .env
npm install
npm run dev                # ouvre http://localhost:5173/WantThis/
```

### 3. Déploiement GitHub Pages
1. Repo GitHub → **Settings → Secrets and variables → Actions** : ajoute
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
2. **Settings → Pages** : source = *GitHub Actions*.
3. `git push` sur `main` → l'app se déploie sur
   `https://<utilisateur>.github.io/WantThis/`.

> ℹ️ Si ton repo ne s'appelle pas exactement `WantThis`, ajuste `base` dans
> `vite.config.js` et les chemins `/WantThis/` dans `index.html`, le manifest et le SW.

## Tester la réservation secrète (le point clé)
1. Crée 2 comptes (A et B), mets-les dans le même groupe (code d'invitation).
2. A ajoute un cadeau ; B le réserve.
3. Vérifie que **B** (et les autres) voient « Déjà réservé », mais que **A**
   (propriétaire) ne voit aucune trace de réservation sur sa propre liste.

## Structure
```
supabase/schema.sql   Tables + fonctions + policies RLS (le cœur de la sécurité)
src/supabase.js       Client Supabase
src/auth.js           Inscription / connexion / session
src/api.js            Accès données (groupes, cadeaux, réservations, realtime)
src/router.js         Routeur hash minimal
src/views/            Écrans (login, groups, dashboard, myList, memberList)
public/               Manifest PWA, service worker, icônes
scripts/gen-icons.mjs Génère les icônes PNG
```
