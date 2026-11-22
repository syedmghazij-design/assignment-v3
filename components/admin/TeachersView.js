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
  const [assignQ, setAssignQ] = useState('');

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
    setAssignQ('');
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

  // subject (master) ke andar us ki classes
  const groupedCourses = store.courses
    .map((course) => ({ course, offerings: store.subjects.filter((x) => x.course_id === course.id) }))
    .filter((g) => g.offerings.length > 0)
    .filter((g) => {
      const q2 = assignQ.trim().toLowerCase();
      if (!q2) return true;
      return g.course.name.toLowerCase().includes(q2)
        || g.offerings.some((o) => (o.class?.name || '').toLowerCase().includes(q2));
    });

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
        title={`${assignT?.full_name || ''} — kaun se subject, kis class me`}
        footer={<><Btn onClick={() => setAssignT(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={saveAssign} disabled={busy}>{busy ? 'Saving…' : `Save (${selSubs.length} class-subject)`}</Btn></>}>

        <div className="hint" style={{ marginBottom: 12 }}>
          Har line = <b>ek subject + ek class</b>. Tick karo to ye teacher <b>us class</b> me wo subject padhayega.
          Ek subject kai classes me hai to <b>jitni classes chahiye utni tick</b> karo.
        </div>

        <Input placeholder="Subject ya class search karein…" value={assignQ}
          onChange={(e) => setAssignQ(e.target.value)} style={{ marginBottom: 12 }} />

        {groupedCourses.length === 0 ? (
          <div className="err">Koi subject nahi — pehle <b>Subjects</b> tab me master subject add karein, phir <b>Classes</b> me assign karein.</div>
        ) : groupedCourses.map(({ course, offerings }) => {
          const allOn = offerings.every((o) => selSubs.includes(o.id));
          return (
            <div key={course.id} style={{ marginBottom: 14, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div className="between" style={{ padding: '9px 12px', background: 'var(--green-50)', borderBottom: '1px solid var(--line)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: course.color || '#0f9d58' }} />
                  <b style={{ fontSize: 13.5 }}>{course.name}</b>
                  <span className="muted" style={{ fontSize: 11.5 }}>{course.code || ''}</span>
                </div>
                <button className="btn-link" style={{ fontSize: 12 }}
                  onClick={() => setSelSubs((cur) => {
                    const ids = offerings.map((o) => o.id);
                    return allOn ? cur.filter((x) => !ids.includes(x)) : Array.from(new Set([...cur, ...ids]));
                  })}>
                  {allOn ? 'sab hatao' : 'sab classes select karo'}
                </button>
              </div>

              {offerings.map((o) => {
                const mine = (o.teacher_ids || []).includes(assignT?.id) || o.teacher_id === assignT?.id;
                const others = (o.teachers || []).filter((t) => t.id !== assignT?.id).map((t) => t.full_name);
                const secs = o.sections && o.sections.length ? o.sections : (store.classes.find((c) => c.id === o.class_id)?.sections || []);
                const on = selSubs.includes(o.id);
                return (
                  <label key={o.id} className="between"
                    style={{ padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid #f0f4f1',
                      background: on ? '#f7fdf9' : '#fff' }}>
                    <span className="row" style={{ gap: 9 }}>
                      <input type="checkbox" checked={on} onChange={() => toggleSub(o.id)} />
                      <span>
                        <b style={{ fontSize: 13 }}>🏫 {o.class?.name || '—'}</b>
                        <span className="muted" style={{ fontSize: 11.5, marginLeft: 6 }}>
                          {secs.length ? `Section ${secs.join(', ')}` : 'sab sections'}
                        </span>
                      </span>
                    </span>
                    <span style={{ fontSize: 11.5 }}>
                      {mine ? <Badge kind="accepted">ye teacher padhata hai</Badge>
                        : others.length ? <span className="muted">abhi: {others.join(', ')}</span>
                        : <span className="muted">koi teacher nahi</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}

        <div className="hint">Tick hatane se teacher us class ka wo subject nahi padhayega (subject delete nahi hota).</div>
      </Modal>

      <Modal open={!!pwUser} onClose={() => setPwUser(null)} title={`Reset password — ${pwUser?.full_name || ''}`}
        footer={<><Btn onClick={() => setPwUser(null)}>Cancel</Btn><Btn variant="primary" onClick={doReset} disabled={busy}>Reset</Btn></>}>
        <Field label="Naya password"><Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" /></Field>
        <div className="hint">Teacher ko naya password batana hoga — wo baad me khud change kar sakta hai.</div>
      </Modal>
    </>
  );
}
