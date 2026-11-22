'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { createUsers, deleteUser, resetPassword, updateUser } from '@/lib/adminApi';
import { Badge, Btn, Card, Empty, Field, Input, Modal } from '@/components/ui';

export default function TeachersView({ store, reload }) {
  const [q, setQ] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: '', username: '', password: '', phone: '' });
  const [assignT, setAssignT] = useState(null);
  const [selSubs, setSelSubs] = useState([]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return store.teachers;
    return store.teachers.filter(
      (t) => t.full_name?.toLowerCase().includes(s) || t.username?.toLowerCase().includes(s)
    );
  }, [store.teachers, q]);

  function startNew() {
    setEditing(null);
    setForm({ full_name: '', username: '', password: '', phone: '' });
    setOpen(true);
  }

  function startEdit(t) {
    setEditing(t);
    setForm({ full_name: t.full_name || '', username: t.username || '', password: '', phone: t.phone || '' });
    setOpen(true);
  }

  async function save() {
    if (!form.full_name.trim() || !form.username.trim()) return toast('Name aur login ID zaroori hai', 'err');
    setBusy(true);
    try {
      if (editing) {
        if (form.password) await resetPassword(editing.id, form.password);
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: form.full_name.trim(), username: form.username.trim().toLowerCase(), phone: form.phone || null })
          .eq('id', editing.id);
        if (error) throw error;
        toast('Teacher update ho gaya ✅');
      } else {
        if (form.password.length < 6) throw new Error('Password kam az kam 6 characters');
        const res = await createUsers([
          {
            username: form.username.trim().toLowerCase(),
            password: form.password,
            role: 'teacher',
            full_name: form.full_name.trim(),
            phone: form.phone || null,
          },
        ]);
        const r = res.results?.[0];
        if (r && !r.ok) throw new Error(r.error);
        toast('Teacher add ho gaya ✅');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  function openAssign(t) {
    setAssignT(t);
    setSelSubs(store.subjects.filter((x) => (x.teacher_ids || []).includes(t.id) || x.teacher_id === t.id).map((x) => x.id));
  }

  function toggleSub(id) {
    setSelSubs((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function saveAssign() {
    if (!assignT) return;
    setBusy(true);
    try {
      const current = store.subjects
        .filter((x) => (x.teacher_ids || []).includes(assignT.id) || x.teacher_id === assignT.id)
        .map((x) => x.id);
      const add = selSubs.filter((id) => !current.includes(id));
      const rem = current.filter((id) => !selSubs.includes(id));

      if (add.length) {
        const rows = add.map((sid) => ({ subject_id: sid, teacher_id: assignT.id, is_lead: false }));
        const { error } = await supabase.from('subject_teachers').insert(rows);
        if (error && !/duplicate/i.test(error.message)) throw error;
        // agar subject ka koi teacher hi nahi tha to ye lead ban jaye
        for (const sid of add) {
          const sub = store.subjects.find((x) => x.id === sid);
          if (sub && !sub.teacher_id) await supabase.from('subjects').update({ teacher_id: assignT.id }).eq('id', sid);
        }
      }
      if (rem.length) {
        const { error } = await supabase.from('subject_teachers').delete().eq('teacher_id', assignT.id).in('subject_id', rem);
        if (error) throw error;
        for (const sid of rem) {
          const sub = store.subjects.find((x) => x.id === sid);
          if (sub && sub.teacher_id === assignT.id) {
            const others = (sub.teacher_ids || []).filter((x) => x !== assignT.id);
            await supabase.from('subjects').update({ teacher_id: others[0] || null }).eq('id', sid);
          }
        }
      }
      toast(`${selSubs.length} subject(s) assign ho gaye ✅`);
      setAssignT(null);
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  async function doReset() {
    if (newPw.length < 6) return toast('Password kam az kam 6 characters', 'err');
    setBusy(true);
    try {
      await resetPassword(pwUser.id, newPw);
      toast('Password reset ho gaya ✅');
      setPwUser(null);
      setNewPw('');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  async function remove(t) {
    if (!confirm(`${t.full_name} ko delete karein? In ke subjects "no teacher" ho jayenge.`)) return;
    setBusy(true);
    try {
      await deleteUser(t.id);
      toast('Teacher delete ho gaya');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Teachers</h1><div className="sub">Login ID aur password aap khud banate hain</div></div>
        <div className="row">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <Btn onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'} passwords</Btn>
          <Btn variant="primary" onClick={startNew}>+ New teacher</Btn>
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        {list.length === 0 ? (
          <Empty icon="🎓" text="Koi teacher nahi. '+ New teacher' se pehla teacher add karein." />
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Login ID</th><th>Password</th><th>Subjects &amp; Classes</th><th>Phone</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const subs = store.subjects.filter((s) => (s.teacher_ids || []).includes(t.id) || s.teacher_id === t.id);
                  return (
                    <tr key={t.id}>
                      <td><b>{t.full_name}</b></td>
                      <td><code>{t.username}</code></td>
                      <td>{showPw ? <code>{store.creds[t.id] || '—'}</code> : '••••••'}</td>
                      <td style={{ maxWidth: 260 }}>
                        {subs.length === 0 ? <span className="muted">koi subject nahi — assign karein</span> : (
                          <>
                            <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                              {subs.slice(0, 3).map((s) => <Badge key={s.id} kind="gray">{s.name}</Badge>)}
                              {subs.length > 3 && <Badge kind="info">+{subs.length - 3}</Badge>}
                            </div>
                            <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>
                              🏫 {Array.from(new Set(subs.map((s) => s.class?.name).filter(Boolean))).join(', ') || '—'}
                            </div>
                          </>
                        )}
                      </td>
                      <td>{t.phone || '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <Btn size="sm" variant="primary" onClick={() => openAssign(t)}>📚 Subjects</Btn>
                          <Btn size="sm" onClick={() => startEdit(t)}>Edit</Btn>
                          <Btn size="sm" onClick={() => { setPwUser(t); setNewPw(''); }}>Reset pw</Btn>
                          <Btn size="sm" variant="danger" onClick={() => remove(t)}>Delete</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit teacher' : 'New teacher'}
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
        <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Tehseen Ali" /></Field>
        <Field label="Login ID (username)" hint="Koi bhi likh sakte hain — spaces nahi">
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="tehseen.ali" />
        </Field>
        <div className="grid g2">
          <Field label={editing ? 'Naya password (khaali chhorein to same rahega)' : 'Password'}>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" />
          </Field>
          <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!assignT} onClose={() => setAssignT(null)} wide
        title={`Subjects assign karein — ${assignT?.full_name || ''}`}
        footer={<><Btn onClick={() => setAssignT(null)}>Cancel</Btn><Btn variant="primary" onClick={saveAssign} disabled={busy}>{busy ? 'Saving…' : `Save (${selSubs.length} selected)`}</Btn></>}>
        <div className="hint" style={{ marginBottom: 12 }}>
          Jis subject per tick lagayenge wo is teacher ko assign ho jaega — aur us ki class bhi khud aa jayegi.
          Aap ek teacher ko <b>kai classes ke kai subjects</b> de sakte hain.
        </div>
        {store.subjects.length === 0 ? (
          <div className="err">Pehle Admin → Subjects me subjects banayen (class ke saath).</div>
        ) : (
          store.classes.map((c) => {
            const list = store.subjects.filter((x) => x.class_id === c.id);
            if (!list.length) return null;
            return (
              <div key={c.id} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6, color: 'var(--green-800)' }}>
                  🏫 {c.name} <span className="muted" style={{ fontWeight: 500 }}>{c.code}</span>
                </div>
                {list.map((x) => {
                  const mine = (x.teacher_ids || []).includes(assignT?.id) || x.teacher_id === assignT?.id;
                  const other = !mine && ((x.teacher_ids || []).length > 0 || !!x.teacher_id);
                  return (
                    <label key={x.id} className="between"
                      style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: selSubs.includes(x.id) ? 'var(--green-50)' : '#fff' }}>
                      <span className="row" style={{ gap: 8 }}>
                        <input type="checkbox" checked={selSubs.includes(x.id)} onChange={() => toggleSub(x.id)} />
                        <b style={{ fontSize: 13 }}>{x.name}</b>
                        <span className="muted" style={{ fontSize: 11.5 }}>{x.code || ''}</span>
                      </span>
                      <span style={{ fontSize: 11.5 }}>
                        {mine ? <Badge kind="accepted">assa hai</Badge>
                          : other ? <span className="muted">abhi: {x.teacher?.full_name || 'kisi aur'}</span>
                          : <span className="muted">koi teacher nahi</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })
        )}
        <div className="hint">Tick hatane se subject “no teacher” ho jaega (delete nahi hota).</div>
      </Modal>

      <Modal open={!!pwUser} onClose={() => setPwUser(null)} title={`Reset password — ${pwUser?.full_name || ''}`}
        footer={<><Btn onClick={() => setPwUser(null)}>Cancel</Btn><Btn variant="primary" onClick={doReset} disabled={busy}>Reset</Btn></>}>
        <Field label="Naya password"><Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" /></Field>
        <div className="hint">Teacher ko naya password batana hoga — wo baad me khud change kar sakta hai.</div>
      </Modal>
    </>
  );
}
