import { supabase } from './supabase';

/* ------------------------------------------------------------------
   Admin user management — SAB Supabase RPC se hota hai
   (koi server / API route / service_role key ki zaroorat nahi)
   Security: har function ke andar `public.is_admin()` check hai.
------------------------------------------------------------------- */

function pretty(msg = '') {
  if (/duplicate key|already registered|already been registered/i.test(msg))
    return 'Ye login ID / roll number pehle se mojood hai — dobara add nahi ho sakta.';
  if (/password/i.test(msg) && /6/.test(msg)) return msg;
  if (/is_admin|admin ye kaam/i.test(msg)) return 'Sirf admin ye kaam kar sakta hai.';
  if (/row-level security|permission denied/i.test(msg))
    return 'Permission nahi mili — admin se login karein.';
  return msg.replace(/^ERROR:\s*/i, '');
}

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(pretty(error.message));
  return data;
}

/** ek user banao ya update karo */
export async function upsertUser(u) {
  return rpc('admin_upsert_user', {
    p_username: String(u.username || '').trim(),
    p_password: u.password || null,
    p_role: u.role || 'student',
    p_full_name: u.full_name || null,
    p_roll_no: u.roll_no || null,
    p_class_id: u.class_id || null,
    p_section: u.section || null,
    p_phone: u.phone || null,
    p_user_id: u.user_id || null,
  });
}

/**
 * Bulk create — 5 users ek sath (parallel), baqi queue me.
 * return: { results: [{username, ok, error}] }
 */
export async function createUsers(users) {
  const results = new Array(users.length);
  let cursor = 0;

  async function worker() {
    while (cursor < users.length) {
      const i = cursor++;
      try {
        await upsertUser(users[i]);
        results[i] = { username: users[i].username, ok: true };
      } catch (e) {
        results[i] = { username: users[i].username, ok: false, error: e.message };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, users.length) }, worker));
  return { results };
}

/** password reset */
export async function resetPassword(user_id, password) {
  return rpc('admin_set_password', { p_id: user_id, p_password: password });
}

/** user ko poori tarah delete */
export async function deleteUser(user_id) {
  return rpc('admin_delete_user', { p_id: user_id });
}

/** alias (kuch views ise use karti hain) */
export const updateUser = upsertUser;
