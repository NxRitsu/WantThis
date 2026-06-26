import { supabase } from './supabase.js'
import { state } from './store.js'

// ---------------------------------------------------------------------------
// Groupes
// ---------------------------------------------------------------------------

// Crée un groupe (via la fonction SQL qui ajoute aussi le créateur comme membre).
export async function createGroup(name) {
  const { data, error } = await supabase.rpc('create_group', { _name: name })
  if (error) throw error
  return data
}

// Rejoint un groupe via son code d'invitation.
export async function joinGroup(code) {
  const { data, error } = await supabase.rpc('join_group_by_code', { _code: code })
  if (error) throw error
  return data // group_id
}

// Quitte un groupe.
export async function leaveGroup(groupId, userId) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

// Liste les groupes dont l'utilisateur est membre.
// On filtre explicitement sur MON user_id : le RLS m'autorise à voir toutes les
// lignes d'appartenance de mes groupes (utile pour le dashboard), donc sans ce
// filtre un groupe apparaîtrait autant de fois qu'il a de membres.
export async function getMyGroups() {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, groups ( id, name, invite_code, created_by )')
    .eq('user_id', state.user.id)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => row.groups).filter(Boolean)
}

// Liste les membres (profils) d'un groupe.
// Deux requêtes explicites : il n'y a pas de clé étrangère directe entre
// group_members et profiles (toutes deux pointent vers auth.users), donc on
// ne peut pas utiliser la jointure implicite de PostgREST.
export async function getGroupMembers(groupId) {
  const { data: rows, error } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
  if (error) throw error

  const ids = (rows ?? []).map((r) => r.user_id)
  if (!ids.length) return []

  const { data: profiles, error: err2 } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ids)
  if (err2) throw err2
  return profiles ?? []
}

// ---------------------------------------------------------------------------
// Cadeaux
// ---------------------------------------------------------------------------

// Cadeaux d'un membre donné dans un groupe.
export async function getGifts(groupId, ownerId) {
  const { data, error } = await supabase
    .from('gifts')
    .select('*')
    .eq('group_id', groupId)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addGift(groupId, ownerId, { title, url, price }) {
  const { data, error } = await supabase
    .from('gifts')
    .insert({
      group_id: groupId,
      owner_id: ownerId,
      title,
      url: url || null,
      price: price === '' || price == null ? null : Number(price),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateGift(giftId, { title, url, price }) {
  const { data, error } = await supabase
    .from('gifts')
    .update({
      title,
      url: url || null,
      price: price === '' || price == null ? null : Number(price),
    })
    .eq('id', giftId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteGift(giftId) {
  const { error } = await supabase.from('gifts').delete().eq('id', giftId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Réservations (RLS garantit que le propriétaire ne voit jamais les siennes)
// ---------------------------------------------------------------------------

// Récupère les réservations pour une liste de cadeaux.
// Pour le propriétaire de ces cadeaux, le RLS renvoie un tableau vide.
export async function getReservations(giftIds) {
  if (!giftIds.length) return []
  const { data, error } = await supabase
    .from('reservations')
    .select('id, gift_id, reserved_by')
    .in('gift_id', giftIds)
  if (error) throw error
  return data ?? []
}

export async function reserveGift(giftId, userId) {
  const { data, error } = await supabase
    .from('reservations')
    .insert({ gift_id: giftId, reserved_by: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function cancelReservation(giftId) {
  const { error } = await supabase.from('reservations').delete().eq('gift_id', giftId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Realtime : synchro en direct des réservations et cadeaux d'un groupe.
// ---------------------------------------------------------------------------
export function subscribeToGroup(groupId, onChange) {
  const channel = supabase
    .channel(`group-${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gifts' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
