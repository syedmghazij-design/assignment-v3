'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, SectionTitle, Stat, Tabs } from '@/components/ui';
import StudentsView from './StudentsView';
import TimetableView from './TimetableView';
import AttendanceView from './AttendanceView';

const empty = { name: '', code: '', sections: 'A,B', session: '' };

export default function ClassesView({ store, reload, profile, focus }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const [openCls, setOpenCls] = useState(null);
  const [tab, setTab] = useState('overview');

  const [assignOpen, setAssignOpen] = useState(false);
  const [editSub, setEditSub] = useState(null);
  const [pickCourses, setPickCourses] = useState([]);
  const [pickTeachers, setPickTeachers] = useState([]);
  const [pickSections, setPickSections] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (focus) {
      setOpenCls(focus);
      setTab('overview');
    }
  }, [focus]);

  /* ---------------- class CRUD ---------------- */
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
    toast(editing ? 'Class update ho gayi' : 'Class ban gayi ✅ — ab subjects assign karein');
    setOpen(false);
    reload();
  }
  async function remove(c) {
    const count = store.students.filter((s) => s.class_id === c.id).length;
    if (!confirm(`${c.name} delete karein? Is me ${count} students aur ${store.subjects.filter((s) => s.class_id === c.id).length} subjects hain — sab effect hoga.`)) return;
    const { error } = await supabase.from('classes').delete().eq('id', c.id);
    if (error) return toast(error.message, 'err');
    toast('Class delete ho gayi');
    if (openCls?.id === c.id) setOpenCls(null);
    reload();
  }

  /* ---------------- subject assign ---------------- */
  function openAssignFor(cls) {
    setEditSub(null);
    setPickCourses([]);
    setPickTeachers([]);
    setPickSections(cls.sections || ['A']);
    setQ('');
    setAssignOpen(true);
  }
  function openEditOffering(sub) {
    setEditSub(sub);
    setPickCourses([sub.course_id]);
    setPickTeachers(sub.teacher_ids || []);
    setPickSections(sub.sections && sub.sections.length ? sub.sections : (openCls?.sections || ['A']));
    setQ('');
    setAssignOpen(true);
  }
  const toggle = (arr, setArr, v) => setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const poolOf = (courseId) => (store.coursePool || {})[courseId] || [];

  // subject select karte hi us ke saare teachers apne aap tick ho jate hain
  function toggleCourse(id) {
    const next = pickCourses.includes(id) ? pickCourses.filter((x) => x !== id) : [...pickCourses, id];
    setPickCourses(next);
    if (!editSub) {
      const set = new Set(pickTeachers);
      next.forEach((cid) => poolOf(cid).forEach((tid) => set.add(tid)));
      setPickTeachers(Array.from(set));
    }
  }

  async function saveAssign() {
    if (!openCls) return;
    if (!editSub && pickCourses.length === 0) return toast('Kam az kam ek subject select karein', 'err');
    setBusy(true);
    try {
      const targets = [];
      if (!editSub) {
        for (const courseId of pickCourses) {
          const course = store.courses.find((c) => c.id === courseId);
          if (!course) continue;
          const existing = store.subjects.find((s) => s.class_id === openCls.id && s.course_id === courseId);
          if (existing) { targets.push(existing); continue; }
          const allSecs = (openCls.sections || []);
          const { data, error } = await supabase
            .from('subjects')
            .insert({
              class_id: openCls.id,
              course_id: course.id,
              name: course.name,
              code: course.code || null,
              semester: course.semester || null,
              color: course.color || '#0f9d58',
              sections: pickSections.length === allSecs.length ? null : pickSections,
              teacher_id: pickTeachers[0] || null,
            })
            .select('*')
            .single();
          if (error) throw error;
          targets.push(data);
        }
      } else {
        const allSecs = (openCls.sections || []);
        const { error } = await supabase
          .from('subjects')
          .update({
            sections: pickSections.length === allSecs.length ? null : pickSections,
            teacher_id: pickTeachers[0] || null,
          })
          .eq('id', editSub.id);
        if (error) throw error;
        targets.push(editSub);
      }

      for (const sub of targets) {
        await supabase.from('subject_teachers').delete().eq('subject_id', sub.id);
        if (pickTeachers.length) {
          const rows = pickTeachers.map((tid, i) => ({ subject_id: sub.id, teacher_id: tid, is_lead: i === 0 }));
          const { error } = await supabase.from('subject_teachers').insert(rows);
          if (error) throw error;
        }
      }

      toast(editSub ? 'Subject update ho gaya ✅' : `${targets.length} subject(s) class me add ho gaye ✅`);
      setAssignOpen(false);
      reload();
    } catch (e) {
      toast(e.message, 'err');
    }
    setBusy(false);
  }

  async function removeOffering(sub) {
    if (!confirm(`"${sub.name}" is class se hatayen? Is ki assignments bhi delete ho jayengi.`)) return;
    const { error } = await supabase.from('subjects').delete().eq('id', sub.id);
    if (error) return toast(error.message, 'err');
    toast('Subject class se hat gaya');
    reload();
  }

  const courseList = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? store.courses.filter((c) => c.name?.toLowerCase().includes(s) || String(c.code || '').toLowerCase().includes(s)) : store.courses;
  }, [store.courses, q]);

  /* ==================== CLASS WORKSPACE ==================== */
  if (openCls) {
    const cls = store.classes.find((c) => c.id === openCls.id) || openCls;
    const offerings = store.subjects.filter((s) => s.class_id === cls.id);
    const students = store.students.filter((s) => s.class_id === cls.id);
    const noTeacher = offerings.filter((s) => !(s.teacher_ids || []).length && !s.teacher_id);
    const activePool = editSub
      ? poolOf(editSub.course_id)
      : Array.from(new Set(pickCourses.flatMap((cid) => poolOf(cid))));
    const asgCount = store.assignments.filter((a) => offerings.some((o) => o.id === a.subject_id)).length;

    return (
      <>
        <div className="topbar">
          <div>
            <button className="btn-link" onClick={() => setOpenCls(null)}>← All classes</button>
            <h1 style={{ marginTop: 6 }}>{cls.name}</h1>
            <div className="sub">
              {cls.code} {cls.session ? `· ${cls.session}` : ''} · {students.length} students · {offerings.length} subjects
            </div>
          </div>
          <div className="row">
            <Btn onClick={() => startEdit(cls)}>Edit class</Btn>
            <Btn variant="primary" onClick={() => { setTab('subjects'); openAssignFor(cls); }}>+ Subject assign</Btn>
          </div>
        </div>

        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'subjects', label: 'Subjects & Teachers', count: offerings.length },
            { key: 'students', label: 'Students', count: students.length },
            { key: 'timetable', label: 'Time Table' },
            { key: 'attendance', label: 'Attendance' },
          ]}
        />

        <div style={{ marginTop: 16 }}>
          {tab === 'overview' && (
            <>
              <div className="grid g4" style={{ marginBottom: 16 }}>
                <Stat label="Students" value={students.length} hint={`${(cls.sections || []).length} section(s)`} />
                <Stat label="Subjects" value={offerings.length} hint="is class me" />
                <Stat label="Assignments" value={asgCount} hint="in subjects ki" />
                <Stat label="Bina teacher" value={noTeacher.length} hint={noTeacher.length ? 'fix karein' : 'sab theek'} />
              </div>

              <Card className="tight" style={{ marginBottom: 14 }}>
                <SectionTitle title="Sections" sub="Har section ke students" />
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {(cls.sections || []).map((s) => {
                    const n = students.filter((x) => x.section === s).length;
                    return (
                      <button key={s} onClick={() => setTab('students')}
                        style={{ padding: '10px 16px', borderRadius: 12, border: '1.5px solid var(--line)', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                        Section {s} <span className="muted" style={{ fontWeight: 500 }}>· {n}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {noTeacher.length > 0 && (
                <Card className="tight" style={{ border: '1.5px solid var(--amber)' }}>
                  <div style={{ fontSize: 13 }}>
                    ⚠️ <b>{noTeacher.length} subject bina teacher</b> — {noTeacher.map((s) => s.name).join(', ')}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Btn size="sm" variant="primary" onClick={() => setTab('subjects')}>Subjects kholo →</Btn>
                  </div>
                </Card>
              )}
            </>
          )}

          {tab === 'subjects' && (
            <>
              <div className="between" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Is class ke subjects</div>
                <Btn variant="primary" onClick={() => openAssignFor(cls)}>+ Subject assign karein</Btn>
              </div>

              {offerings.length === 0 ? (
                <Card><Empty icon="📚" text="Is class me koi subject nahi. '+ Subject assign karein' dabayen." /></Card>
              ) : (
                <div className="stack">
                  {offerings.map((s) => {
                    const secs = s.sections && s.sections.length ? s.sections : (cls.sections || []);
                    return (
                      <Card key={s.id} className="tight">
                        <div className="between">
                          <div style={{ minWidth: 0 }}>
                            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color || '#0f9d58' }} />
                              <b style={{ fontSize: 15 }}>{s.name}</b>
                              <span className="muted" style={{ fontSize: 12 }}>{s.code || ''}</span>
                              {secs.map((x) => <Badge key={x} kind="info">Sec {x}</Badge>)}
                            </div>
                            <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
                              👩‍🏫 {(s.teachers || []).map((t) => t.full_name).join(', ') || 'koi teacher assign nahi — Edit dabayen'}
                            </div>
                          </div>
                          <div className="row" style={{ gap: 6 }}>
                            <Btn size="sm" onClick={() => openEditOffering(s)}>Teachers / Sections</Btn>
                            <Btn size="sm" variant="danger" onClick={() => removeOffering(s)}>Remove</Btn>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'students' && <StudentsView store={store} reload={reload} fixedClass={cls} />}
          {tab === 'timetable' && <TimetableView store={store} reload={reload} fixedClass={cls} />}
          {tab === 'attendance' && <AttendanceView store={store} reload={reload} profile={profile} fixedClass={cls} />}
        </div>

        {/* assign modal */}
        <Modal open={assignOpen} onClose={() => setAssignOpen(false)} wide
          title={editSub ? `${editSub.name} — teachers & sections` : `${cls.name} — subjects assign karein`}
          footer={<><Btn onClick={() => setAssignOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={saveAssign} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Btn></>}>

          {!editSub && (
            <Field label="1) Subjects select karein" hint="Master list se — ek saath kai select kar sakte hain">
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
              <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
                {courseList.length === 0 ? (
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Koi subject nahi — pehle <b>Subjects</b> tab me add karein.
                  </div>
                ) : courseList.map((c) => {
                  const already = store.subjects.some((s) => s.class_id === cls.id && s.course_id === c.id);
                  return (
                    <label key={c.id} className="between"
                      style={{ padding: '6px 8px', borderRadius: 8, cursor: 'pointer', opacity: already ? 0.55 : 1 }}>
                      <span className="row" style={{ gap: 8 }}>
                        <input type="checkbox" checked={pickCourses.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                        <b style={{ fontSize: 13 }}>{c.name}</b>
                        <span className="muted" style={{ fontSize: 11.5 }}>{c.code || ''}</span>
                      </span>
                      {already && <Badge kind="gray">pehle se hai</Badge>}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label={`${editSub ? '1' : '2'}) Teachers (kai select kar sakte hain)`}
            hint="Jo teachers us subject ke liye pehle se tay hain wo khud tick ho jate hain — jo is class ko padhayega wo rakho, baqi hata do">
            {store.teachers.length === 0 ? (
              <div className="err">Koi teacher nahi — pehle Teachers tab me teacher add karein.</div>
            ) : (
              <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
                {store.teachers.map((t) => (
                  <label key={t.id} className="between" style={{ padding: '6px 8px', borderRadius: 8, cursor: 'pointer' }}>
                    <span className="row" style={{ gap: 8 }}>
                      <input type="checkbox" checked={pickTeachers.includes(t.id)} onChange={() => toggle(pickTeachers, setPickTeachers, t.id)} />
                      <b style={{ fontSize: 13 }}>{t.full_name}</b>
                      <span className="muted" style={{ fontSize: 11.5 }}>{t.username}</span>
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      {activePool.includes(t.id) && <Badge kind="info">🔖 subject ka teacher</Badge>}
                      {pickTeachers[0] === t.id && <Badge kind="accepted">lead</Badge>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field label={`${editSub ? '2' : '3'}) Sections`} hint="Jin sections ko ye subject padhaya jayega">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {(cls.sections || ['A']).map((sec) => {
                const on = pickSections.includes(sec);
                return (
                  <button key={sec} type="button" onClick={() => toggle(pickSections, setPickSections, sec)}
                    style={{
                      padding: '7px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      border: `1.5px solid ${on ? 'var(--green-600)' : 'var(--line)'}`,
                      background: on ? 'var(--green-50)' : '#fff',
                      color: on ? 'var(--green-800)' : 'var(--ink-3)',
                    }}>
                    Section {sec}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="hint">
            Pehla tick kiya hua teacher <b>lead</b> banega. Saare selected teachers ko assignment banane aur check karne ka haq hoga.
          </div>
        </Modal>
      </>
    );
  }

  /* ==================== GRID ==================== */
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Classes</h1>
          <div className="sub">Class kholein → Students, Subjects, Time Table, Attendance — sab wahin</div>
        </div>
        <Btn variant="primary" onClick={startNew}>+ New class</Btn>
      </div>

      {store.classes.length === 0 ? (
        <Card><Empty icon="🏫" text="Sab se pehle ek class banayen (jaise BS Computer Science)." /></Card>
      ) : (
        <div className="grid g3">
          {store.classes.map((c) => {
            const students = store.students.filter((s) => s.class_id === c.id);
            const subjects = store.subjects.filter((s) => s.class_id === c.id);
            const noTeacher = subjects.filter((s) => !(s.teacher_ids || []).length && !s.teacher_id).length;
            return (
              <Card key={c.id}>
                <div className="between">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15.5 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.code} {c.session ? `· ${c.session}` : ''}</div>
                  </div>
                  <Badge kind="info">{students.length}</Badge>
                </div>

                <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
                  {(c.sections || []).map((s) => (
                    <Badge key={s} kind="gray">Sec {s} · {students.filter((x) => x.section === s).length}</Badge>
                  ))}
                </div>

                <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  {subjects.length} subject(s)
                  {noTeacher > 0 && <span style={{ color: 'var(--red)' }}> · {noTeacher} bina teacher</span>}
                </div>

                {subjects.length > 0 && (
                  <div className="row" style={{ marginTop: 8, gap: 4, flexWrap: 'wrap' }}>
                    {subjects.slice(0, 4).map((s) => <Badge key={s.id} kind="info">{s.name}</Badge>)}
                    {subjects.length > 4 && <Badge kind="gray">+{subjects.length - 4}</Badge>}
                  </div>
                )}

                <div className="row" style={{ marginTop: 14, gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" variant="primary" onClick={() => { setOpenCls(c); setTab('overview'); }}>Open →</Btn>
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
        <Field label="Class / Program ka naam" hint="Jaise: BS Computer Science, BS AI, BS SE">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="BS Computer Science" />
        </Field>
        <div className="grid g2">
          <Field label="Short code" hint="Unique, e.g. BS-CS"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BS-CS" /></Field>
          <Field label="Session"><Input value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} placeholder="2026-2030" /></Field>
        </div>
        <Field label="Sections" hint="Comma se alag karein — A,B,C"><Input value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} placeholder="A,B" /></Field>
        <div className="hint">Class banane ke baad <b>Open →</b> dabao — students, subjects, timetable sab wahin milenge.</div>
      </Modal>
    </>
  );
}
