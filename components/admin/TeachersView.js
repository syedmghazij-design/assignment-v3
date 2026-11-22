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
                <tr><th>Name</th><th>Login ID</th><th>Password</th><th>Subjects</th><th>Phone</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const subs = store.subjects.filter((s) => s.teacher_id === t.id);
                  return (
                    <tr key={t.id}>
                      <td><b>{t.full_name}</b></td>
                      <td><code>{t.username}</code></td>
                      <td>{showPw ? <code>{store.creds[t.id] || '—'}</code> : '••••••'}</td>
                      <td>
                        {subs.length === 0 ? <span className="muted">—</span> : (
                          <div className="row" style={{ gap: 4 }}>
                            {subs.slice(0, 3).map((s) => <Badge key={s.id} kind="gray">{s.name}</Badge>)}
                            {subs.length > 3 && <Badge kind="info">+{subs.length - 3}</Badge>}
                          </div>
                        )}
                      </td>
                      <td>{t.phone || '—'}</td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
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

      <Modal open={!!pwUser} onClose={() => setPwUser(null)} title={`Reset password — ${pwUser?.full_name || ''}`}
        footer={<><Btn onClick={() => setPwUser(null)}>Cancel</Btn><Btn variant="primary" onClick={doReset} disabled={busy}>Reset</Btn></>}>
        <Field label="Naya password"><Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" /></Field>
        <div className="hint">Teacher ko naya password batana hoga — wo baad me khud change kar sakta hai.</div>
      </Modal>
    </>
  );
}
