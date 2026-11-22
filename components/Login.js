'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Btn, Field, Input } from './ui';
import { APP_VERSION, SUPABASE_HOST, KEY_KIND } from '@/lib/version';

export default function Login({ onDone, loadError }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [db, setDb] = useState('checking'); // checking | ok | noadmin | badkey

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('resolve_login', { p_identifier: 'admin@gims' });
        if (!alive) return;
        if (error) setDb('badkey');
        else if (data) setDb('ok');
        else setDb('noadmin');
      } catch {
        if (alive) setDb('badkey');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!id.trim() || !pw) return setErr('Login ID aur password dono likhein.');

    setBusy(true);
    const { data: email, error: rpcErr } = await supabase.rpc('resolve_login', {
      p_identifier: id.trim(),
    });

    if (rpcErr) {
      setBusy(false);
      return setErr('Login check nahi ho saka: ' + rpcErr.message);
    }
    if (!email) {
      setBusy(false);
      return setErr('Ye login ID exist nahi karti. Roll number / username check karein.');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);

    if (error) {
      const msg = error.message || '';
      setRaw(msg);
      if (/invalid login credentials/i.test(msg))
        setErr(
          `Password ya login ID ghalat hai. Is site ka database: ${SUPABASE_HOST || 'NOT SET'}. ` +
          'Agar ye purana Supabase project hai to Cloudflare me NEXT_PUBLIC_SUPABASE_URL aur ANON_KEY update karke Retry deployment karo.'
        );
      else if (/email not confirmed/i.test(msg))
        setErr('Account confirm nahi hua — Supabase → SQL Editor me supabase/fix-admin.sql chalayen.');
      else if (/rate limit|too many/i.test(msg))
        setErr('Bohat zyada koshishein ho gayin — 1 minute baad try karein.');
      else if (/captcha/i.test(msg))
        setErr('Supabase ne CAPTCHA on kiya hua hai — Authentication → Settings me band karein.');
      else setErr(msg || 'Login fail ho gaya.');
      return;
    }

    setRaw('');
    onDone?.();
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <div className="brand">
          <div className="brand-logo">G</div>
          <div>
            GIMS <span style={{ opacity: 0.7, fontWeight: 600 }}>Portal</span>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 className="login-headline">
            Assignments,
            <br />
            attendance & timetable.
            <br />
            <span style={{ opacity: 0.8 }}>Ek hi jagah.</span>
          </h1>
          <p className="login-sub">
            Students assignment upload karein, teachers review aur accept / reject karein, admin poori
            university manage kare — sab kuch organised sections me.
          </p>

          <div className="login-feats">
            <div className="login-feat"><span className="dot" /> Subject-wise assignment segments</div>
            <div className="login-feat"><span className="dot" /> Deadline strict + late submissions alag section</div>
            <div className="login-feat"><span className="dot" /> OCR se daily attendance aur timetable</div>
            <div className="login-feat"><span className="dot" /> 400+ students ke liye bulk roll-number import</div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, opacity: 0.65, position: 'relative', zIndex: 2 }}>
          © {new Date().getFullYear()} GIMS — Assignment & Attendance Management System
        </div>
      </div>

      <div className="login-right">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <div className="muted" style={{ marginBottom: 22 }}>
            Apna roll number, teacher username ya admin ID use karein.
          </div>

          {loadError && !err && <div className="err">{loadError}</div>}

          {err && (
            <div className="err">
              {err}
              {raw && <div style={{ marginTop: 6, opacity: 0.75, fontSize: 11.5 }}>server: {raw}</div>}
            </div>
          )}

          <Field label="Login ID">
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="26-ARID-4700"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <Btn variant="primary" className="btn-block" type="submit" disabled={busy} style={{ marginTop: 6 }}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </Btn>

          <div className="hint" style={{ marginTop: 18, textAlign: 'center' }}>
            Login ID ya password bhool gaye? Apne class teacher / admin se rabta karein —
            wo admin panel se reset kar dain ge.
          </div>

          <div
            className="hint"
            style={{
              marginTop: 18, paddingTop: 12, borderTop: '1px dashed var(--line)',
              textAlign: 'center', fontSize: 11, lineHeight: 1.7, wordBreak: 'break-all',
            }}
          >
            {APP_VERSION} · key: {KEY_KIND}
            <br />
            database: <b style={{ color: SUPABASE_HOST ? 'var(--green-700)' : 'var(--red)' }}>{SUPABASE_HOST || 'NOT SET'}</b>
            <br />
            {db === 'checking' && <span>status: checking…</span>}
            {db === 'ok' && <span style={{ color: 'var(--green-700)' }}>✅ database ready — admin@gims mil gaya</span>}
            {db === 'noadmin' && <span style={{ color: 'var(--amber)' }}>⚠️ database juda hai, magar admin@gims nahi mila → Supabase me 1-SETUP-DATABASE.sql chalao</span>}
            {db === 'badkey' && <span style={{ color: 'var(--red)' }}>❌ database se rabta nahi — Cloudflare ki keys check karo</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
