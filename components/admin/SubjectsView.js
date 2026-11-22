'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, SectionTitle, Select } from '@/components/ui';
import { fmtDateTime, openFile } from '@/lib/utils';

export default function SubjectsView({ store, reload }) {
  const [classFilter, setClassFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ class_id: '', name: '', code: '', teacher_id: '', semester: '', color: '#0f9d58' });

  const list = useMemo(
    () => (classFilter === 'all' ? store.subjects : store.subjects.filter((s) => s.class_id === classFilter)),
    [store.subjects, classFilter]
  );

  function startNew() {
    setEditing(null);
    setForm({ class_id: store.classes[0]?.id || '', name: '', code: '', teacher_id: '', semester: '', color: '#0f9d58' });
    setOpen(true);
  }

  function startEdit(s) {
    setEditing(s);
    setForm({ class_id: s.class_id, name: s.name, code: s.code || '', teacher_id: s.teacher_id || '', semester: s.semester || '', color: s.color || '#0f9d58' });
    setOpen(true);
  }

  async function save() {
    if (!form.class_id || !form.name.trim()) return toast('Class aur subject name zaroori hai', 'err');
    setBusy(true);
    const payload = {
      class_id: form.class_id,
      name: form.name.trim(),
      code: form.code.trim() || null,
      teacher_id: form.teacher_id || null,
      semester: form.semester.trim() || null,
      color: form.color,
    };
    const { error } = editing
      ? await supabase.from('subjects').update(payload).eq('id', editing.id)
      : await supabase.from('subjects').insert(payload);
    setBusy(false);
    if (error) return toast(error.message, 'err');
    toast(editing ? 'Subject update ho gaya' : 'Subject add ho gaya ✅');
    setOpen(false);
    reload();
  }

  async function remove(s) {
    if (!confirm(`${s.name} delete karein? Is ki saari assignments bhi delete ho jayengi.`)) return;
    const { error } = await supabase.from('subjects').delete().eq('id', s.id);
    if (error) return toast(error.message, 'err');
    toast('Subject delete ho gaya');
    reload();
  }

  async function removeAssignment(a) {
    if (!confirm(`"${a.title}" delete karein?`)) return;
    const { error } = await supabase.from('assignments').delete().eq('id', a.id);
    if (error) return toast(error.message, 'err');
    toast('Assignment delete ho gayi');
    setDetail(null);
    reload();
  }

  const asgOf = (s) => store.assignments.filter((a) => a.subject_id === s.id);

  return (
    <>
      <div className="topbar">
        <div><h1>Subjects</h1><div className="sub">Subject banayein aur teacher assign karein</div></div>
        <div className="row">
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: 200 }}>
            <option value="all">All classes</option>
            {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Btn variant="primary" onClick={startNew}>+ New subject</Btn>
        </div>
      </div>

      {list.length === 0 ? (
        <Card><Empty icon="📚" text="Koi subject nahi. Pehle class banayen, phir subject add karein." /></Card>
      ) : (
        <div className="grid g3">
          {list.map((s) => {
            const asg = asgOf(s);
            return (
              <Card key={s.id}>
                <div className="between">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{s.class?.name} · {s.code || '—'}</div>
                  </div>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color || '#0f9d58' }} />
                </div>
                <div className="row" style={{ marginTop: 10, gap: 6 }}>
                  <Badge kind={s.teacher ? 'accepted' : 'rejected'}>{s.teacher?.full_name || 'No teacher'}</Badge>
                  <Badge kind="gray">{asg.length} assignments</Badge>
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <Btn size="sm" onClick={() => setDetail(s)}>Assignments</Btn>
                  <Btn size="sm" onClick={() => startEdit(s)}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(s)}>Delete</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* add / edit */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit subject' : 'New subject'}
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>Save</Btn></>}>
        <Field label="Class">
          <Select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
            {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </Select>
        </Field>
        <div className="grid g2">
          <Field label="Subject name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Data Structures" /></Field>
          <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS-201" /></Field>
        </div>
        <div className="grid g2">
          <Field label="Teacher">
            <Select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
              <option value="">— none —</option>
              {store.teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Semester"><Input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Fall 2026" /></Field>
        </div>
        <Field label="Colour (segment dot)"><input type="color" className="input" style={{ height: 44, padding: 4 }} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
      </Modal>

      {/* assignments list (admin full access) */}
      <Modal open={!!detail} onClose={() => setDetail(null)} wide title={detail ? `${detail.name} — assignments` : ''}>
        {detail && (
          <>
            {asgOf(detail).length === 0 ? <Empty icon="🗂️" text="Is subject me koi assignment nahi." /> : (
              <div className="list">
                {asgOf(detail).map((a) => {
                  const subs = store.subs.filter((s) => s.assignment_id === a.id);
                  return (
                    <div key={a.id} className="item">
                      <div>
                        <div className="t">{a.title}</div>
                        <div className="m">
                          <span>📅 {fmtDateTime(a.deadline)}</span>
                          <span>🎯 {a.max_marks}</span>
                          <span>{subs.length} submissions</span>
                        </div>
                      </div>
                      <div className="row">
                        {a.file_path && <Btn size="sm" onClick={() => openFile('assignment-files', a.file_path)}>File</Btn>}
                        <Btn size="sm" variant="danger" onClick={() => removeAssignment(a)}>Delete</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
