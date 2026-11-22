'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { ocrImage, parseTimetableText } from '@/lib/ocr';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Progress, SectionTitle, Select, TextArea } from '@/components/ui';
import { DAYS, DAYS_SHORT, uploadFile } from '@/lib/utils';

const SLOTS = [
  { slot: 1, start: '08:30', end: '09:50' },
  { slot: 2, start: '09:50', end: '11:10' },
  { slot: 3, start: '11:10', end: '12:30' },
  { slot: 4, start: '12:30', end: '13:50' },
  { slot: 5, start: '14:00', end: '15:20' },
  { slot: 6, start: '15:20', end: '16:40' },
];

export default function TimetableView({ store, reload, fixedClass }) {
  const [classId, setClassId] = useState(fixedClass?.id || store.classes[0]?.id || '');
  const [section, setSection] = useState(
    (fixedClass?.sections || store.classes[0]?.sections || ['A'])[0]
  );
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // {day, slot}
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrPct, setOcrPct] = useState(-1);
  const [ocrText, setOcrText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [form, setForm] = useState({ subject_id: '', label: '', start_time: '', end_time: '', room: '' });

  const sectionsOf = (id) => store.classes.find((c) => c.id === id)?.sections || ['A'];
  const subjects = store.subjects.filter((s) => s.class_id === classId);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data } = await supabase
      .from('timetable')
      .select('*, subject:subjects(name,code,teacher:profiles(full_name))')
      .eq('class_id', classId)
      .eq('section', section);
    setRows(data || []);
  }, [classId, section]);

  useEffect(() => { load(); }, [load]);

  const cell = (day, slot) => rows.find((r) => r.day === day && r.slot === slot);

  function openCell(day, slot) {
    const c = cell(day, slot);
    const def = SLOTS.find((s) => s.slot === slot);
    setEditing({ day, slot });
    setForm({
      subject_id: c?.subject_id || '',
      label: c?.label || '',
      start_time: c?.start_time || def?.start || '',
      end_time: c?.end_time || def?.end || '',
      room: c?.room || '',
    });
  }

  async function saveCell() {
    const { day, slot } = editing;
    const payload = {
      class_id: classId,
      section,
      day,
      slot,
      subject_id: form.subject_id || null,
      label: form.label || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      room: form.room || null,
    };
    const { error } = await supabase.from('timetable').upsert(payload, { onConflict: 'class_id,section,day,slot' });
    if (error) return toast(error.message, 'err');
    toast('Slot save ho gaya ✅');
    setEditing(null);
    load();
    reload?.();
  }

  async function clearCell() {
    const c = cell(editing.day, editing.slot);
    if (!c) return setEditing(null);
    const { error } = await supabase.from('timetable').delete().eq('id', c.id);
    if (error) return toast(error.message, 'err');
    toast('Slot khaali kar diya');
    setEditing(null);
    load();
  }

  async function clearAll() {
    if (!confirm('Is class + section ka poora timetable delete karein?')) return;
    const { error } = await supabase.from('timetable').delete().eq('class_id', classId).eq('section', section);
    if (error) return toast(error.message, 'err');
    toast('Timetable clear ho gaya');
    load();
  }

  /* ------------------------- OCR import ------------------------- */
  async function handleImage(f) {
    setOcrPct(0);
    try {
      const text = await ocrImage(f, setOcrPct);
      setOcrText(text);
      setParsed(parseTimetableText(text, subjects));
      await uploadFile('timetable-images', `${classId}/${section}/${Date.now()}.jpg`, f).catch(() => null);
    } catch (e) {
      toast(e.message, 'err');
    }
    setOcrPct(-1);
  }

  async function importParsed() {
    if (!parsed.length) return toast('Kuch parse nahi hua', 'err');
    const counters = {};
    const rowsToSave = parsed.map((p) => {
      counters[p.day] = (counters[p.day] || 0) + 1;
      return {
        class_id: classId,
        section,
        day: p.day,
        slot: Math.min(6, counters[p.day]),
        subject_id: p.subject_id || null,
        label: p.label || null,
        start_time: p.start_time || null,
        end_time: p.end_time || null,
        room: p.room || null,
      };
    });
    const { error } = await supabase.from('timetable').upsert(rowsToSave, { onConflict: 'class_id,section,day,slot' });
    if (error) return toast(error.message, 'err');
    toast('Timetable import ho gaya ✅');
    setOcrOpen(false);
    setParsed([]);
    setOcrText('');
    load();
  }

  useEffect(() => {
    if (ocrText) setParsed(parseTimetableText(ocrText, subjects));
  }, [ocrText]); // eslint-disable-line

  const stats = useMemo(() => rows.length, [rows]);

  return (
    <>
      <div className="topbar">
        <div><h1>Time Table</h1><div className="sub">Button dabayen aur slot set karein — ya image se OCR karein</div></div>
        <div className="row">
          {!fixedClass && (
            <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSection(sectionsOf(e.target.value)[0] || 'A'); }} style={{ width: 190 }}>
              {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <Select value={section} onChange={(e) => setSection(e.target.value)} style={{ width: 130 }}>
            {sectionsOf(classId).map((s) => <option key={s} value={s}>Section {s}</option>)}
          </Select>
          <Btn onClick={() => setOcrOpen(true)}>🖼 Import from image</Btn>
          <Btn variant="danger" onClick={clearAll}>Clear</Btn>
        </div>
      </div>

      <Card style={{ padding: 0 }}>
        <div className="tbl-scroll">
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Slot</th>
                {DAYS_SHORT.map((d) => <th key={d}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((sl) => (
                <tr key={sl.slot}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{sl.slot}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{sl.start}–{sl.end}</div>
                  </td>
                  {[1, 2, 3, 4, 5, 6].map((day) => {
                    const c = cell(day, sl.slot);
                    return (
                      <td key={day} style={{ padding: 6 }}>
                        <button
                          onClick={() => openCell(day, sl.slot)}
                          style={{
                            width: '100%', textAlign: 'left', cursor: 'pointer', borderRadius: 9,
                            border: c ? '1px solid #bfe6cf' : '1px dashed var(--line)',
                            background: c ? 'var(--green-50)' : '#fff', padding: '8px 9px', minHeight: 54,
                          }}
                        >
                          {c ? (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{c.subject?.name || c.label || '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                                {c.start_time}–{c.end_time} {c.room ? `· ${c.room}` : ''}
                              </div>
                            </>
                          ) : (
                            <span style={{ color: '#b7c8bd', fontSize: 12 }}>+</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="hint" style={{ marginTop: 10 }}>{stats} slot(s) set hain. Kisi bhi khaali box per click karein.</div>

      {/* cell editor */}
      <Modal open={!!editing} onClose={() => setEditing(null)}
        title={editing ? `${DAYS[editing.day - 1]} · Slot ${editing.slot}` : ''}
        footer={<><Btn onClick={() => setEditing(null)}>Cancel</Btn><Btn variant="danger" onClick={clearCell}>Clear slot</Btn><Btn variant="primary" onClick={saveCell}>Save</Btn></>}>
        <Field label="Subject">
          <Select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
            <option value="">— none (free text) —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Ya free text (e.g. Break / Lab / Assembly)">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <div className="grid g3">
          <Field label="Start"><Input value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} placeholder="08:30" /></Field>
          <Field label="End"><Input value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} placeholder="09:50" /></Field>
          <Field label="Room"><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="12" /></Field>
        </div>
      </Modal>

      {/* OCR import */}
      <Modal open={ocrOpen} onClose={() => setOcrOpen(false)} wide title="Import timetable from image (OCR)"
        footer={<><Btn onClick={() => setOcrOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={importParsed} disabled={!parsed.length}>Import {parsed.length} slots</Btn></>}>
        <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
          🖼 Timetable ki photo / screenshot chunein
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
        </label>
        {ocrPct >= 0 && <div style={{ marginTop: 12 }}><Progress value={ocrPct} /><div className="hint" style={{ marginTop: 4 }}>{ocrPct}% — padha ja raha hai…</div></div>}

        <div style={{ marginTop: 14 }}>
          <Field label="OCR text (edit kar sakte hain — har line ek slot)">
            <TextArea style={{ minHeight: 130 }} value={ocrText} onChange={(e) => setOcrText(e.target.value)} placeholder={'Monday 08:30-09:50 Data Structures Room 12\nMonday 09:50-11:10 Database Systems'} />
          </Field>
        </div>

        {parsed.length === 0 ? <Empty icon="🔍" text="Abhi kuch parse nahi hua. Text likhein ya image upload karein." /> : (
          <div className="tbl-scroll" style={{ maxHeight: 260 }}>
            <table className="tbl">
              <thead><tr><th>Day</th><th>Subject</th><th>Time</th><th>Room</th></tr></thead>
              <tbody>
                {parsed.map((p, i) => (
                  <tr key={i}>
                    <td>{DAYS[p.day - 1]}</td>
                    <td>
                      <Select value={p.subject_id} onChange={(e) => {
                        const n = [...parsed]; n[i] = { ...n[i], subject_id: e.target.value }; setParsed(n);
                      }}>
                        <option value="">— free text —</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </Select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.start_time} {p.end_time ? `– ${p.end_time}` : ''}</td>
                    <td>{p.room || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hint" style={{ marginTop: 10 }}>
          OCR hamesha 100% theek nahi hota — import ke baad grid me har slot click karke check / fix kar lein.
        </div>
      </Modal>
    </>
  );
}
