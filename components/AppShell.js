'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isConfigured } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Toaster, Modal, Field, Input, Btn, Spinner } from './ui';
import Login from './Login';
import StudentApp from './student/StudentApp';
import TeacherApp from './teacher/TeacherApp';
import AdminApp from './admin/AdminApp';

export default function AppShell() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadProfile = useCallback(async (uid) => {
    // 1) poora query (class ke sath)
    let res = await supabase
      .from('profiles')
      .select('*, class:classes(id,name,code,sections)')
      .eq('id', uid)
      .maybeSingle();

    let data = res.data;
    let error = res.error;

    // 2) embed fail ho (stale schema cache) to simple query
    if (error) {
      const fb = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (!fb.error) {
        data = fb.data;
        error = null;
        if (data?.class_id) {
          const c = await supabase
            .from('classes')
            .select('id,name,code,sections')
            .eq('id', data.class_id)
            .maybeSingle();
          if (c.data) data.class = c.data;
        }
      } else {
        error = fb.error;
      }
    }

    if (error) {
      {
            const m = String(error.message || 'unknown');
            const hint = /permission denied/i.test(m)
              ? 'Supabase me `TURANT-FIX-GRANTS.sql` chalao (GRANT missing).'
              : /does not exist|schema cache/i.test(m)
              ? 'Supabase me `notify pgrst, \'reload schema\';` chalao.'
              : 'Supabase → SQL Editor me `1-SETUP-DATABASE.sql` dobara chalao.';
            setLoadError('Database error: ' + m + ' — ' + hint);
          }
      setProfile(null);
    } else if (!data) {
      setLoadError('Is login ka profile record database me nahi mila. Supabase SQL Editor me 00-SETUP-ALL-IN-ONE.sql chalayen.');
      setProfile(null);
    } else {
      setLoadError('');
      setProfile(data);
    }
    setBooting(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data?.session?.user) await loadProfile(data.session.user.id);
      else setBooting(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        const uid = session.user.id;
        // Supabase ke andar lock hota hai — is liye query ko baahar (next tick) bhejte hain
        setTimeout(() => loadProfile(uid), 0);
      }
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  if (!isConfigured) {
    return (
      <div style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
        <div className="card">
          <h2 style={{ marginBottom: 10 }}>⚙️ Supabase keys missing</h2>
          <p className="muted">
            Project me <code>.env.local</code> file nahi mili (ya Vercel per env variables add nahi hue).
            <br />
            <b>NEXT_PUBLIC_SUPABASE_URL</b> aur <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> add karein
            — phir naya deployment (Retry deployment) chalayen.
          </p>
          <p className="muted">Poori guide: <b>docs/SETUP-URDU.md</b></p>
        </div>
      </div>
    );
  }

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div>
          <Spinner />
          <div className="muted" style={{ textAlign: 'center' }}>Loading portal…</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <Login onDone={() => setBooting(true)} loadError={loadError} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {profile.role === 'admin' && <AdminApp profile={profile} onLogout={logout} onChangePw={() => setPwOpen(true)} />}
      {profile.role === 'teacher' && <TeacherApp profile={profile} onLogout={logout} onChangePw={() => setPwOpen(true)} />}
      {profile.role === 'student' && <StudentApp profile={profile} onLogout={logout} onChangePw={() => setPwOpen(true)} />}
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
      <Toaster />
    </>
  );
}

/* --------------------------------------------------------------- */
function ChangePassword({ open, onClose }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    if (p1.length < 6) return setErr('Password kam az kam 6 characters ka ho.');
    if (p1 !== p2) return setErr('Dono password same nahi hain.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    await supabase.rpc('set_my_password', { p_password: p1 });
    setBusy(false);
    setP1('');
    setP2('');
    toast('Password change ho gaya ✅');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change password"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </Btn>
        </>
      }
    >
      {err && <div className="err">{err}</div>}
      <Field label="Naya password">
        <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="••••••" />
      </Field>
      <Field label="Naya password dobara">
        <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="••••••" />
      </Field>
      <div className="hint">Password change hone ke baad admin ke panel me bhi naya password nazar aayega.</div>
    </Modal>
  );
}
