'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Select } from '@/components/ui';

const empty = { name: '', code: '', semester: '', color: '#0f9d58' };

const COLORS = ['#0f9d58', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#ec4899'];

export default function SubjectsView({ store, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [mapCourse, setMapCourse] = useState(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return store.courses;
    return store.courses.filter(
      (c) => c.name?.toLowerCase().includes(s) || String(c.code || '').toLowerCase().includes(s)
    );
  }, [store.courses, q]);

  // ek master subject kahan kahan padhaya ja raha hai
  const usageOf = (courseId) => store.subjects.filter((s) => s.course_id === courseId);

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(c) {
    setEditing(c);
    setForm({ name: c.name, code: c.code || '', semester: c.semester || '', color: c.color || '#0f9d58' });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast('Subject ka naam zaroori hai', 'err');
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      semester: form.semester.trim() || null,
      color: form.color,
    };
    const { error } = editing
      ? await supabase.from('courses').update(payload).eq('id', editing.id)
      : await supabase.from('courses').insert(payload);
    if (error) {
      setBusy(false);
      return toast(
        /duplicate|unique/i.test(error.message) ? 'Ye subject pehle se mojood hai' : error.message,
        'err'
      );
    }
    // naam badla to offerings bhi update karo
    if (editing) {
      await supabase.from('subjects').update({ name: payload.name, code: payload.code, color: payload.color }).eq('course_id', editing.id);
    }
    setBusy(false);
    toast(editing ? 'Subject update ho gaya ✅' : 'Subject add ho gaya ✅ — ab Class me assign karein');
    setOpen(false);
    reload();
  }

  async function remove(c) {
    const n = usageOf(c.id).length;
    if (!n) {
      if (!confirm(`"${c.name}" delete karein?`)) return;
      const { error } = await supabase.from('courses').delete().eq('id', c.id);
      if (error) return toast(error.message, 'err');
      toast('Subject delete ho gaya');
      return reload();
    }
    if (!confirm(`"${c.name}" ${n} class(es) me assign hai. Delete karne se wo assignments bhi hat jayengi. Delete karein?`)) return;
    const { error } = await supabase.from('courses').delete().eq('id', c.id);
    if (error) return toast(error.message, 'err');
    toast('Subject delete ho gaya');
    reload();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Subjects (master list)</h1>
          <div className="sub">
            Subject yahan <b>ek hi baar</b> add karo — phir har class ko assign karo (Classes → class kholein)
          </div>
        </div>
        <div className="row">
          <Input placeholder="Search subject…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <Btn variant="primary" onClick={startNew}>+ New subject</Btn>
        </div>
      </div>

      <Card className="tight" style={{ marginBottom: 14, background: 'var(--green-50)' }}>
        <div style={{ fontSize: 13 }}>
          💡 <b>Programming Fundamentals</b> sirf ek baar yahan add karo. Phir <b>Classes</b> me ja kar us class ko
          ye subject assign karo — aur wahan hi decide karo ke <b>kaun kaun se teachers</b> padhayenge aur
          <b> kaun se sections</b> ko.
        </div>
      </Card>

      {list.length === 0 ? (
        <Card><Empty icon="📚" text="Koi subject nahi. '+ New subject' se pehla subject add karein (jaise Programming Fundamentals)." /></Card>
      ) : (
        <div className="grid g3">
          {list.map((c) => {
            const use = usageOf(c.id);
            const classes = Array.from(new Set(use.map((s) => s.class?.name).filter(Boolean)));
            const teachers = Array.from(new Set(use.flatMap((s) => (s.teachers || []).map((t) => t.full_name)))).filter(Boolean);
            return (
              <Card key={c.id}>
                <div className="between">
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 99, background: c.color || '#0f9d58' }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15.5 }}>{c.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {c.code || '—'} {c.semester ? `· ${c.semester}` : ''}
                      </div>
                    </div>
                  </div>
                  <Badge kind={use.length ? 'accepted' : 'gray'}>{use.length} class(es)</Badge>
                </div>

                <div className="row" style={{ marginTop: 12, gap: 4, flexWrap: 'wrap' }}>
                  {classes.length ? classes.map((n) => <Badge key={n} kind="info">🏫 {n}</Badge>) : <span className="muted" style={{ fontSize: 12 }}>kisi class me assign nahi</span>}
                </div>

                {teachers.length > 0 && (
                  <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                    👩‍🏫 {teachers.join(', ')}
                  </div>
                )}

                <div className="row" style={{ marginTop: 14, gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" variant="primary" onClick={() => setMapCourse(c)}>Kaun kis class me? →</Btn>
                  <Btn size="sm" onClick={() => startEdit(c)}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(c)}>Delete</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!mapCourse} onClose={() => setMapCourse(null)} wide
        title={`${mapCourse?.name || ''} — kaun si class, kaun sa teacher`}
        footer={<Btn onClick={() => setMapCourse(null)}>Close</Btn>}>
        {(() => {
          const offers = store.subjects.filter((x) => x.course_id === mapCourse?.id);
          if (!offers.length) return <div className="err">Ye subject abhi kisi class me assign nahi — Classes → Open → + Subject assign karein.</div>;
          return (
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr><th>Class</th><th>Sections</th><th>Teachers</th></tr>
                </thead>
                <tbody>
                  {offers.map((o) => {
                    const cls = store.classes.find((c) => c.id === o.class_id);
                    const secs = o.sections && o.sections.length ? o.sections : (cls?.sections || []);
                    const ts = o.teachers || [];
                    return (
                      <tr key={o.id}>
                        <td><b>{cls?.name || '—'}</b><div className="muted" style={{ fontSize: 11.5 }}>{cls?.code || ''}</div></td>
                        <td>{secs.length ? secs.map((x) => <Badge key={x} kind="info">Sec {x}</Badge>) : '—'}</td>
                        <td>
                          {ts.length ? ts.map((t, i) => (
                            <div key={t.id} style={{ fontSize: 12.5 }}>
                              {i === 0 ? '⭐ ' : '· '}{t.full_name}{i === 0 ? ' (lead)' : ''}
                            </div>
                          )) : <span style={{ color: 'var(--red)', fontSize: 12.5 }}>koi teacher nahi</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div className="hint" style={{ marginTop: 10 }}>
          Badalna ho? <b>Classes → Open → Subjects &amp; Teachers → Teachers / Sections</b>, ya <b>Teachers → 📚</b>.
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit subject' : 'New subject (master list)'}
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>
        <Field label="Subject ka naam" hint="Jaise: Programming Fundamentals">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Programming Fundamentals" />
        </Field>
        <div className="grid g2">
          <Field label="Code" hint="Jaise: CS-101"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS-101" /></Field>
          <Field label="Semester"><Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="1st" /></Field>
        </div>
        <Field label="Rang (badge ka color)">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                style={{
                  width: 28, height: 28, borderRadius: 99, background: c, cursor: 'pointer',
                  border: form.color === c ? '3px solid #111' : '2px solid #fff',
                  boxShadow: '0 0 0 1px #ddd',
                }} />
            ))}
          </div>
        </Field>
        <div className="hint">
          Yahan sirf subject banta hai. <b>Class assign + teachers</b> Classes tab me hoga.
        </div>
      </Modal>
    </>
  );
}
