'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { matchStudents, ocrImage } from '@/lib/ocr';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Progress, SectionTitle, Select, TextArea } from '@/components/ui';
import { fmtDate, safeName, todayISO, uploadFile } from '@/lib/utils';

const STATUSES = [
  { key: 'present', label: 'P', full: 'Present' },
  { key: 'absent', label: 'A', full: 'Absent' },
  { key: 'late', label: 'L', full: 'Late' },
  { key: 'leave', label: 'Lv', full: 'Leave' },
];

export default function AttendanceView({ store, reload, profile, fixedClass }) {
  const [classId, setClassId] = useState(fixedClass?.id || store.classes[0]?.id || '');
  const [section, setSection] = useState(
    (fixedClass?.sections || store.classes[0]?.sections || ['A'])[0]
  );
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [statuses, setStatuses] = useState({});
  const [file, setFile] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrPct, setOcrPct] = useState(-1);
  const [imagePath, setImagePath] = useState(null);
  const [mode, setMode] = useState('present'); // listed = present / absent
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [sessions, setSessions] = useState([]);
  const [viewSession, setViewSession] = useState(null);

  const sectionsOf = (id) => store.classes.find((c) => c.id === id)?.sections || ['A'];
  const students = useMemo(
    () => store.students.filter((s) => s.class_id === classId && s.section === section),
    [store.students, classId, section]
  );
  const subjects = store.subjects.filter((s) => s.class_id === classId);

  async function loadSessions() {
    if (!classId) return;
    const { data } = await supabase
      .from('attendance_sessions')
      .select('*, subject:subjects(name)')
      .eq('class_id', classId)
      .order('date', { ascending: false })
      .limit(30);
    setSessions(data || []);
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  useEffect(() => {
    // class/section change -> reset sheet
    const next = {};
    students.forEach((s) => (next[s.id] = 'present'));
    setStatuses(next);
  }, [classId, section, students.length]);

  async function runOcr(f) {
    setFile(f);
    setOcrPct(0);
    try {
      const text = await ocrImage(f, setOcrPct);
      setOcrText(text);
      applyText(text, mode);
      toast('Image padh li gayi — checklist check karein');
    } catch (e) {
      toast(e.message, 'err');
    }
    setOcrPct(-1);
  }

  function applyText(text, m = mode) {
    const prefix = store.settings?.roll_pattern?.prefix || '26-ARID-';
    const { present } = matchStudents(text, students, prefix);
    const next = {};
    students.forEach((s) => {
      const listed = present.has(s.id);
      next[s.id] = (m === 'present' ? listed : !listed) ? 'present' : 'absent';
    });
    setStatuses(next);
  }

  function setAll(status) {
    const next = {};
    students.forEach((s) => (next[s.id] = status));
    setStatuses(next);
  }

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    students.forEach((s) => (c[statuses[s.id] || 'absent'] = (c[statuses[s.id] || 'absent'] || 0) + 1));
    return c;
  }, [students, statuses]);

  const filtered = students.filter((s) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return s.full_name?.toLowerCase().includes(t) || String(s.roll_no).toLowerCase().includes(t);
  });

  async function save() {
    if (!students.length) return toast('Is section me koi student nahi', 'err');
    setBusy(true);
    try {
      let path = imagePath;
      if (file && !imagePath) {
        path = `${classId}/${date}/${Date.now()}_${safeName(file.name)}`;
        await uploadFile('attendance-images', path, file);
        setImagePath(path);
      }

      const { data: session, error } = await supabase
        .from('attendance_sessions')
        .insert({
          class_id: classId,
          section,
          subject_id: subjectId || null,
          date,
          image_path: path,
          ocr_text: ocrText || null,
          total: students.length,
          present: counts.present + counts.late,
          created_by: profile?.id || null,
        })
        .select()
        .single();
      if (error) throw error;

      const records = students.map((s) => ({
        session_id: session.id,
        student_id: s.id,
        status: statuses[s.id] || 'absent',
      }));
      const { error: e2 } = await supabase.from('attendance_records').insert(records);
      if (e2) throw e2;

      toast('Attendance save ho gayi ✅');
      setImagePath(null);
      setFile(null);
      setOcrText('');
      loadSessions();
      reload?.();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  async function openSession(s) {
    const { data } = await supabase
      .from('attendance_records')
      .select('status, student:profiles!attendance_records_student_id_fkey(roll_no, full_name)')
      .eq('session_id', s.id);
    setViewSession({ ...s, records: data || [] });
  }

  async function deleteSession(s) {
    if (!confirm(`${fmtDate(s.date)} ki attendance delete karein?`)) return;
    const { error } = await supabase.from('attendance_sessions').delete().eq('id', s.id);
    if (error) return toast(error.message, 'err');
    toast('Session delete ho gaya');
    loadSessions();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Attendance (OCR)</h1><div className="sub">Sheet ki photo upload karein — roll numbers khud padh liye jayenge</div></div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="grid g4">
          {!fixedClass && (
            <Field label="Class">
              <Select value={classId} onChange={(e) => { setClassId(e.target.value); setSection((sectionsOf(e.target.value)[0] || 'A')); }}>
                {store.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Section">
            <Select value={section} onChange={(e) => setSection(e.target.value)}>
              {sectionsOf(classId).map((s) => <option key={s} value={s}>Section {s}</option>)}
            </Select>
          </Field>
          <Field label="Subject (optional)">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— general —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        <div className="row" style={{ marginTop: 6 }}>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            🖼 Upload attendance sheet
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && runOcr(e.target.files[0])} />
          </label>
          <Select value={mode} onChange={(e) => { setMode(e.target.value); if (ocrText) applyText(ocrText, e.target.value); }} style={{ width: 260 }}>
            <option value="present">Sheet me likhe roll = PRESENT</option>
            <option value="absent">Sheet me likhe roll = ABSENT</option>
          </Select>
          <Btn onClick={() => setAll('present')}>All present</Btn>
          <Btn onClick={() => setAll('absent')}>All absent</Btn>
          <div className="spacer" />
          <Btn variant="primary" onClick={save} disabled={busy || !students.length}>{busy ? 'Saving…' : 'Save attendance'}</Btn>
        </div>

        {ocrPct >= 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="between" style={{ fontSize: 12.5, marginBottom: 5 }}><b>OCR chal raha hai…</b><span>{ocrPct}%</span></div>
            <Progress value={ocrPct} />
          </div>
        )}

        {ocrText && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--green-700)', fontWeight: 700 }}>OCR se nikla hua text dekhein / manually edit karein</summary>
            <TextArea style={{ marginTop: 8, minHeight: 120 }} value={ocrText} onChange={(e) => { setOcrText(e.target.value); applyText(e.target.value); }} />
            <div className="hint">Text edit karke bahar click karein — checkboxes dobara set ho jayenge.</div>
          </details>
        )}
      </Card>

      <div className="grid g4" style={{ marginBottom: 14 }}>
        <div className="stat"><i className="bar" /><div className="k">Students</div><div className="v">{students.length}</div></div>
        <div className="stat"><i className="bar" /><div className="k">Present</div><div className="v">{counts.present}</div></div>
        <div className="stat warn"><i className="bar" /><div className="k">Absent</div><div className="v">{counts.absent}</div></div>
        <div className="stat info"><i className="bar" /><div className="k">Late / Leave</div><div className="v">{counts.late + counts.leave}</div></div>
      </div>

      <Card style={{ padding: 0, marginBottom: 18 }}>
        <div className="between" style={{ padding: '12px 14px' }}>
          <b>Checklist</b>
          <Input placeholder="Search student…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
        </div>
        {filtered.length === 0 ? <Empty icon="👥" text="Is section me koi student nahi — pehle Students section se add karein." /> : (
          <div className="tbl-scroll" style={{ maxHeight: '55vh' }}>
            <table className="tbl">
              <thead><tr><th>Roll No</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td><b>{s.roll_no}</b></td>
                    <td>{s.full_name}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {STATUSES.map((st) => (
                          <button
                            key={st.key}
                            className={`tab ${statuses[s.id] === st.key ? 'active' : ''}`}
                            style={{ padding: '4px 10px', fontSize: 11.5 }}
                            onClick={() => setStatuses({ ...statuses, [s.id]: st.key })}
                            title={st.full}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Purani attendance" sub="Is class ki recent sessions" />
        {sessions.length === 0 ? <Empty icon="📋" text="Abhi koi attendance save nahi hui." /> : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Section</th><th>Subject</th><th>Present</th><th></th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td><b>{fmtDate(s.date)}</b></td>
                    <td>{s.section}</td>
                    <td>{s.subject?.name || '—'}</td>
                    <td><Badge kind="accepted">{s.present}/{s.total}</Badge></td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <Btn size="sm" onClick={() => openSession(s)}>View</Btn>
                        <Btn size="sm" variant="danger" onClick={() => deleteSession(s)}>Delete</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!viewSession} onClose={() => setViewSession(null)} wide title={viewSession ? `Attendance — ${fmtDate(viewSession.date)}` : ''}>
        {viewSession && (
          <div className="tbl-scroll" style={{ maxHeight: '60vh' }}>
            <table className="tbl">
              <thead><tr><th>Roll</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {viewSession.records.map((r, i) => (
                  <tr key={i}>
                    <td>{r.student?.roll_no}</td>
                    <td>{r.student?.full_name}</td>
                    <td>
                      <Badge kind={r.status === 'present' ? 'accepted' : r.status === 'late' ? 'pending' : r.status === 'leave' ? 'info' : 'rejected'}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
