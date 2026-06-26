-- ============================================================================
-- WantThis — Extension "Administration"
-- À exécuter dans Supabase (SQL Editor) APRÈS schema.sql.
-- ============================================================================

-- Drapeau administrateur sur le profil.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ----------------------------------------------------------------------------
-- Te désigner administrateur :
-- Remplace l'email ci-dessous par le tien, puis exécute cette requête.
-- (Décommente la ligne en retirant les deux tirets.)
-- ----------------------------------------------------------------------------
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'ton-email@exemple.com');

-- Remarque : la suppression d'un compte (auth.users) supprime automatiquement,
-- par cascade, son profil, ses appartenances, ses cadeaux et ses réservations.
-- Si le compte supprimé avait CRÉÉ un groupe, ce groupe (et tout son contenu)
-- est également supprimé pour tous ses membres.
