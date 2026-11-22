'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, SectionTitle, Select } from '@/components/ui';

const empty = { name: '', code: '', sections: 'A,B', session: '' };

export default function ClassesView({ store, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function startEdit(c) {
    setEditing(c);
    setForm({ name: c.name, code: c.code, sections: (c.sections || ['A']).join(','), session: c.session || '' });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.code.trim()) return toast('Name aur code zaroori hai', 'err');
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      sections: form.sections.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
      session: form.session.trim() || null,
    };
    const { error } = editing
      ? await supabase.from('classes').update(payload).eq('id', editing.id)
      : await supabase.from('classes').insert(payload);
    setBusy(false);
    if (error) return toast(error.message, 'err');
    toast(editing ? 'Class update ho gayi' : 'Class ban gayi ✅');
    setOpen(false);
    reload();
  }

  async function remove(c) {
    const count = store.students.filter((s) => s.class_id === c.id).length;
    if (!confirm(`${c.name} delete karein? Is me ${count} students aur ${store.subjects.filter((s) => s.class_id === c.id).length} subjects hain — sab effect hoga.`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', c.id);
    if (error) return toast(error.message, 'err');
    toast('Class delete ho gayi');
    reload();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Classes</h1><div className="sub">Har class ke sections aur session yahan se manage karein</div></div>
        <Btn variant="primary" onClick={startNew}>+ New class</Btn>
      </div>

      {store.classes.length === 0 ? (
        <Card><Empty icon="🏫" text="Sab se pehle ek class banayen — phir subjects aur students add karein." /></Card>
      ) : (
        <div className="grid g3">
          {store.classes.map((c) => {
            const students = store.students.filter((s) => s.class_id === c.id);
            const subjects = store.subjects.filter((s) => s.class_id === c.id);
            return (
              <Card key={c.id}>
                <div className="between">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15.5 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.code} {c.session ? `· ${c.session}` : ''}</div>
                  </div>
                  <Badge kind="info">{students.length} students</Badge>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 6 }}>
                  {(c.sections || []).map((s) => <Badge key={s} kind="gray">Section {s}</Badge>)}
                </div>
                <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>{subjects.length} subject(s)</div>
                <div className="row" style={{ marginTop: 14 }}>
                  <Btn size="sm" onClick={() => startEdit(c)}>Edit</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(c)}>Delete</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit class' : 'New class'}
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>Save</Btn></>}>
        <Field label="Class name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BS Computer Science" /></Field>
        <div className="grid g2">
          <Field label="Short code" hint="Unique, e.g. BS-CS-1"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BS-CS-1" /></Field>
          <Field label="Session"><Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="2026-2030" /></Field>
        </div>
        <Field label="Sections" hint="Comma se alag karein — A,B,C"><Input value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} placeholder="A,B" /></Field>
        <div className="hint">Class banane ke baad Settings me roll number pattern check karein.</div>
      </Modal>
    </>
  );
}
