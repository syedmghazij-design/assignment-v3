'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { createUsers, deleteUser, resetPassword } from '@/lib/adminApi';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Progress, Select } from '@/components/ui';

export default function StudentsView({ store, reload, fixedClass }) {
  const prefix = store.settings?.roll_pattern?.prefix || '26-ARID-';
  const startNo = store.settings?.roll_pattern?.start || 4700;

  const [q, setQ] = useState('');
  const [cls, setCls] = useState('all');
  const [sec, setSec] = useState('all');
  const [showPw, setShowPw] = useState(false);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);

  const nextRoll = useMemo(() => {
    const tails = store.students
      .map((s) => Number(String(s.roll_no || '').split('-').pop()))
      .filter((n) => !isNaN(n));
    const max = tails.length ? Math.max(...tails) : startNo - 1;
    return `${prefix}${max + 1}`;
  }, [store.students, prefix, startNo]);

  const [form, setForm] = useState({ full_name: '', roll_no: '', password: '', class_id: '', section: 'A', phone: '' });
  const [bulk, setBulk] = useState({
    class_id: fixedClass?.id || '', section: (fixedClass?.sections || ['A'])[0],
    from: 4701, to: 4710, password: '', useRollAsPw: true,
  });
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] });

  const sectionsOf = (classId) => store.classes.find((c) => c.id === classId)?.sections || ['A'];
  const subsOfClass = (classId) => store.subjects.filter((s) => s.class_id === classId);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return store.students.filter((st) => {
      if (fixedClass && st.class_id !== fixedClass.id) return false;
      if (!fixedClass && cls !== 'all' && st.class_id !== cls) return false;
      if (sec !== 'all' && st.section !== sec) return false;
      if (!s) return true;
      return (
        st.full_name?.toLowerCase().includes(s) ||
        String(st.roll_no || '').toLowerCase().includes(s) ||
        st.username?.toLowerCase().includes(s)
      );
    });
  }, [store.students, q, cls, sec]);

  function startNew() {
    setEditing(null);
    setForm({
      full_name: '',
      roll_no: nextRoll,
      password: '',
      class_id: fixedClass?.id || store.classes[0]?.id || '',
      section: ((fixedClass?.sections || store.classes[0]?.sections) || ['A'])[0],
      phone: '',
    });
    setOpen(true);
  }

  function startEdit(st) {
    setEditing(st);
    setForm({
      full_name: st.full_name || '',
      roll_no: st.roll_no || '',
      password: '',
      class_id: st.class_id || '',
      section: st.section || 'A',
      phone: st.phone || '',
    });
    setOpen(true);
  }

  async function save() {
    if (!form.full_name.trim() || !form.roll_no.trim()) return toast('Name aur roll number zaroori hai', 'err');
    if (!form.class_id) return toast('Class select karein', 'err');
    setBusy(true);
    try {
      if (editing) {
        if (form.password) await resetPassword(editing.id, form.password);
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name.trim(),
            roll_no: form.roll_no.trim(),
            username: form.roll_no.trim(),
            class_id: form.class_id,
            section: form.section,
            phone: form.phone || null,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast('Student update ho gaya ✅');
      } else {
        if (form.password.length < 6) throw new Error('Password kam az kam 6 characters');
        const res = await createUsers([
          {
            username: form.roll_no.trim(),
            password: form.password,
            role: 'student',
            full_name: form.full_name.trim(),
            roll_no: form.roll_no.trim(),
            class_id: form.class_id,
            section: form.section,
            phone: form.phone || null,
          },
        ]);
        const r = res.results?.[0];
        if (r && !r.ok) throw new Error(r.error);
        toast('Student add ho gaya ✅');
      }
      setOpen(false);
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  async function runBulk() {
    const from = Number(bulk.from);
    const to = Number(bulk.to);
    if (!bulk.class_id) return toast('Class select karein', 'err');
    if (!from || !to || to < from) return toast('Number range theek likhein', 'err');
    const count = to - from + 1;
    if (count > 500) return toast('Ek waqt me 500 se zyada nahi', 'err');
    if (!bulk.useRollAsPw && bulk.password.length < 6) return toast('Password kam az kam 6 characters', 'err');

    const all = [];
    for (let n = from; n <= to; n++) {
      const roll = `${prefix}${n}`;
      all.push({
        username: roll,
        roll_no: roll,
        password: bulk.useRollAsPw ? roll : bulk.password,
        role: 'student',
        full_name: `Student ${n}`,
        class_id: bulk.class_id,
        section: bulk.section,
      });
    }

    setBusy(true);
    setProgress({ done: 0, total: all.length, errors: [] });
    const errors = [];
    const CHUNK = 10;
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      try {
        const res = await createUsers(chunk);
        (res.results || []).forEach((r) => {
          if (!r.ok) errors.push(`${r.username}: ${r.error}`);
        });
      } catch (e) {
        errors.push(e.message);
      }
      setProgress({ done: Math.min(i + CHUNK, all.length), total: all.length, errors });
    }
    setBusy(false);
    toast(`${all.length - errors.length} students add ho gaye ✅`, errors.length ? 'warn' : 'ok');
    if (errors.length) setProgress((p) => ({ ...p, errors }));
    else {
      setBulkOpen(false);
      setProgress({ done: 0, total: 0, errors: [] });
    }
    reload();
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

  async function remove(st) {
    if (!confirm(`${st.full_name} (${st.roll_no}) delete karein? Is ki saari submissions bhi delete ho jayengi.`)) return;
    setBusy(true);
    try {
      await deleteUser(st.id);
      toast('Student delete ho gaya');
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  function exportCsv() {
    const rows = [['Roll No', 'Name', 'Class', 'Section', 'Login ID', 'Password', 'Phone']];
    list.forEach((st) => {
      rows.push([
        st.roll_no || '', st.full_name || '', st.class?.name || '', st.section || '',
        st.username || '', store.creds[st.id] || '', st.phone || '',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `students-${Date.now()}.csv`;
    a.click();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Students</h1><div className="sub">{store.students.length} students · roll number hi login ID hai</div></div>
        <div className="row">
          <Btn onClick={() => setBulkOpen(true)}>⚡ Bulk add (400+)</Btn>
          <Btn onClick={exportCsv}>⬇ CSV</Btn>
          <Btn variant="primary" onClick={startNew}>+ New student</Btn>
        </div>
      </div>

      <Card className="tight" style={{ marginBottom: 14 }}>
        <div className="row">
          <Input placeholder="Search name / roll no…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          {!fixedClass && (
            <Select value={cls} onChange={(e) => { setCls(e.target.value); setSec('all'); }} style={{ width: 200 }}>
              <option value="all">All classes</option>
              {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <Select value={sec} onChange={(e) => setSec(e.target.value)} style={{ width: 140 }}>
            <option value="all">All sections</option>
            {(fixedClass ? (fixedClass.sections || ['A']) : cls === 'all' ? [...new Set(store.classes.flatMap((c) => c.sections || ['A']))] : sectionsOf(cls)).map((s) => (
              <option key={s} value={s}>Section {s}</option>
            ))}
          </Select>
          <div className="spacer" />
          <Btn size="sm" onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'} passwords</Btn>
          <Badge kind="info">{list.length} showing</Badge>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        {list.length === 0 ? (
          <Empty icon="👥" text="Koi student nahi mila. '+ New student' ya 'Bulk add' use karein." />
        ) : (
          <div className="tbl-scroll" style={{ maxHeight: '65vh' }}>
            <table className="tbl">
              <thead>
                <tr><th>Roll No</th><th>Name</th><th>Class</th><th>Sec</th><th>Password</th><th>Phone</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((st) => (
                  <tr key={st.id}>
                    <td><b>{st.roll_no || '—'}</b></td>
                    <td>{st.full_name}</td>
                    <td>
                      {st.class?.name || <span className="muted">not set</span>}
                      {st.class_id && (
                        <div className="muted" style={{ fontSize: 11 }}>{subsOfClass(st.class_id).length} subject(s)</div>
                      )}
                    </td>
                    <td>{st.section || '—'}</td>
                    <td>{showPw ? <code>{store.creds[st.id] || '—'}</code> : '••••••'}</td>
                    <td>{st.phone || '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Btn size="sm" onClick={() => startEdit(st)}>Edit</Btn>
                        <Btn size="sm" onClick={() => { setPwUser(st); setNewPw(''); }}>Reset pw</Btn>
                        <Btn size="sm" variant="danger" onClick={() => remove(st)}>Del</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* single add / edit */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit student' : 'New student'}
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
        <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ali Hassan" /></Field>
        <div className="grid g2">
          <Field label="Roll number (login ID)" hint={`Pattern: ${prefix}xxxx`}>
            <Input value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} />
          </Field>
          <Field label={editing ? 'Naya password (optional)' : 'Password'}>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 characters" />
          </Field>
        </div>
        <div className="grid g2">
          {fixedClass ? (
            <Field label="Class">
              <Input value={fixedClass.name} disabled />
            </Field>
          ) : (
            <Field label="Class">
              <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value, section: (sectionsOf(e.target.value)[0] || 'A') })}>
                <option value="">— select —</option>
                {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Section">
            <Select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
              {(form.class_id ? sectionsOf(form.class_id) : ['A']).map((s) => <option key={s} value={s}>Section {s}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Subjects (class se khud mil jaate hain)" hint="Is student ko in subjects ke assignments dikhenge">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {subsOfClass(form.class_id).length > 0 ? (
              subsOfClass(form.class_id).map((x) => (
                <Badge key={x.id} kind="gray">{x.name}{x.teacher?.full_name ? ` · ${x.teacher.full_name}` : ''}</Badge>
              ))
            ) : (
              <span className="muted" style={{ fontSize: 12.5 }}>
                {form.class_id ? 'Is class me abhi koi subject nahi — Admin → Subjects se add karein.' : 'Pehle class select karein.'}
              </span>
            )}
          </div>
        </Field>
        <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      </Modal>

      {/* bulk add */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk students add (400+ ek sath)"
        footer={<><Btn onClick={() => setBulkOpen(false)}>Close</Btn><Btn variant="primary" onClick={runBulk} disabled={busy}>{busy ? 'Creating…' : 'Create students'}</Btn></>}>
        <div className="ok">
          Roll numbers <b>{prefix}{bulk.from || '—'}</b> se <b>{prefix}{bulk.to || '—'}</b> tak banenge.
          Total: <b>{Math.max(0, Number(bulk.to) - Number(bulk.from) + 1)}</b> students.
        </div>
        <div className="grid g2">
          {fixedClass ? (
            <Field label="Class"><Input value={fixedClass.name} disabled /></Field>
          ) : (
            <Field label="Class">
              <Select value={bulk.class_id} onChange={(e) => setBulk({ ...bulk, class_id: e.target.value, section: (sectionsOf(e.target.value)[0] || 'A') })}>
                <option value="">— select —</option>
                {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Section">
            <Select value={bulk.section} onChange={(e) => setBulk({ ...bulk, section: e.target.value })}>
              {(bulk.class_id ? sectionsOf(bulk.class_id) : ['A']).map((s) => <option key={s} value={s}>Section {s}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid g2">
          <Field label="From number"><Input type="number" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} /></Field>
          <Field label="To number"><Input type="number" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} /></Field>
        </div>
        <Field label="Password rule">
          <Select value={bulk.useRollAsPw ? '1' : '0'} onChange={(e) => setBulk({ ...bulk, useRollAsPw: e.target.value === '1' })}>
            <option value="1">Password = roll number (har student alag)</option>
            <option value="0">Same password for all</option>
          </Select>
        </Field>
        {!bulk.useRollAsPw && (
          <Field label="Common password"><Input value={bulk.password} onChange={(e) => setBulk({ ...bulk, password: e.target.value })} placeholder="min 6 characters" /></Field>
        )}
        <Field label="Subjects (bulk students ko khud milenge)" hint="Class ke saare subjects">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {subsOfClass(bulk.class_id).length > 0 ? (
              subsOfClass(bulk.class_id).map((x) => <Badge key={x.id} kind="gray">{x.name}</Badge>)
            ) : (
              <span className="muted" style={{ fontSize: 12.5 }}>
                {bulk.class_id ? 'Is class me koi subject nahi — pehle Subjects add kareins.' : 'Class select karein.'}
              </span>
            )}
          </div>
        </Field>
        <div className="hint">Students ke naam filhal “Student 4701” type honge — baad me Edit se asli naam likh sakte hain. CSV download se list bhi nikal sakte hain.</div>

        {progress.total > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="between" style={{ marginBottom: 6, fontSize: 12.5 }}>
              <b>Progress</b><span>{progress.done} / {progress.total}</span>
            </div>
            <Progress value={(progress.done / progress.total) * 100} />
            {progress.errors.length > 0 && (
              <div className="err" style={{ marginTop: 10, maxHeight: 120, overflow: 'auto', fontSize: 12 }}>
                {progress.errors.slice(0, 8).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* reset password */}
      <Modal open={!!pwUser} onClose={() => setPwUser(null)} title={`Reset password — ${pwUser?.full_name || ''}`}
        footer={<><Btn onClick={() => setPwUser(null)}>Cancel</Btn><Btn variant="primary" onClick={doReset} disabled={busy}>Reset</Btn></>}>
        <Field label="Naya password"><Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" /></Field>
      </Modal>
    </>
  );
}
