'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Btn, Card, Empty, SectionTitle, Spinner, Stat, StatusBadge } from '@/components/ui';
import { fmtDateTime, initials, pct } from '@/lib/utils';
import ClassesView from './ClassesView';
import SubjectsView from './SubjectsView';
import TeachersView from './TeachersView';
import AttendanceView from './AttendanceView';
import TimetableView from './TimetableView';
import SettingsView from './SettingsView';

export default function AdminApp({ profile, onLogout, onChangePw }) {
  const [tab, setTab] = useState('dashboard');
  const [classFocus, setClassFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState({
    classes: [], courses: [], subjects: [], links: [], coursePool: {}, teachers: [], students: [], assignments: [], subs: [], creds: {}, settings: {},
  });

  async function load() {
    const [cls, subj, teach, stud, asg, subs, creds, sett, crs, lnk, cpool] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*, class:classes(name,code)').order('name'),
      supabase.from('profiles').select('*').eq('role', 'teacher').order('full_name'),
      supabase.from('profiles').select('*, class:classes(name,code)').eq('role', 'student').order('roll_no'),
      supabase.from('assignments').select('*, subject:subjects(name,code,class:classes(name))').order('created_at', { ascending: false }),
      supabase.from('submissions').select('id,status,is_late,submitted_at,assignment_id,student:profiles!submissions_student_id_fkey(roll_no,full_name)').order('submitted_at', { ascending: false }).limit(400),
      supabase.from('user_credentials').select('user_id,password_text'),
      supabase.from('settings').select('*'),
      supabase.from('courses').select('*').order('name'),
      supabase.from('subject_teachers').select('subject_id, teacher_id, is_lead'),
      supabase.from('course_teachers').select('course_id, teacher_id'),
    ]);

    const credMap = {};
    (creds.data || []).forEach((c) => (credMap[c.user_id] = c.password_text));
    const setMap = {};
    (sett.data || []).forEach((s) => (setMap[s.key] = s.value));

    // master subject ke teachers pool  { courseId: [teacherId] }
    const coursePool = {};
    (cpool.data || []).forEach((r) => {
      (coursePool[r.course_id] = coursePool[r.course_id] || []).push(r.teacher_id);
    });

    // har subject ke teachers (multiple) + lead teacher
    const bySub = {};
    (lnk.data || []).forEach((l) => {
      (bySub[l.subject_id] = bySub[l.subject_id] || []).push(l.teacher_id);
    });
    const teacherName = {};
    (teach.data || []).forEach((t) => (teacherName[t.id] = t.full_name));
    const subjects = (subj.data || []).map((x) => {
      const ids = bySub[x.id] || (x.teacher_id ? [x.teacher_id] : []);
      return {
        ...x,
        teacher_ids: ids,
        teachers: ids.map((id) => ({ id, full_name: teacherName[id] || '—' })),
        teacher: { full_name: ids.map((id) => teacherName[id]).filter(Boolean).join(', ') || null },
      };
    });

    setStore({
      classes: cls.data || [],
      courses: crs.data || [],
      links: lnk.data || [],
      coursePool,
      subjects,
      teachers: teach.data || [],
      students: stud.data || [],
      assignments: asg.data || [],
      subs: subs.data || [],
      creds: credMap,
      settings: setMap,
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const pending = store.subs.filter((s) => s.status === 'pending').length;
    const late = store.subs.filter((s) => s.is_late).length;
    const accepted = store.subs.filter((s) => s.status === 'accepted').length;
    return {
      students: store.students.length,
      teachers: store.teachers.length,
      classes: store.classes.length,
      subjects: store.subjects.length,
      assignments: store.assignments.length,
      subs: store.subs.length,
      pending, late, accepted,
    };
  }, [store]);

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', ico: '▦' },
    { key: 'teachers', label: 'Teachers', ico: '🎓' },
    { key: 'classes', label: 'Classes & Students', ico: '🏫' },
    { key: 'subjects', label: 'Subjects', ico: '📚' },
    { key: 'attendance', label: 'Attendance (OCR)', ico: '🖼' },
    { key: 'timetable', label: 'Time Table', ico: '◷' },
    { key: 'settings', label: 'Settings', ico: '⚙' },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-logo">G</div>
          <div><b>GIMS Portal</b><small>Admin</small></div>
        </div>
        {NAV.map((n) => (
          <button key={n.key} className={`nav-btn ${tab === n.key ? 'active' : ''}`} onClick={() => setTab(n.key)}>
            <span className="ico">{n.ico}</span><span className="lbl">{n.label}</span>
          </button>
        ))}
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{initials(profile.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{profile.full_name}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{profile.username}</div>
            </div>
          </div>
          <button className="nav-btn" onClick={onChangePw}><span className="ico">⚿</span><span className="lbl">Change password</span></button>
          <button className="nav-btn" onClick={onLogout}><span className="ico">⏻</span><span className="lbl">Logout</span></button>
        </div>
      </aside>

      <main className="main">
        {loading ? <Spinner /> : (
          <>
            {tab === 'dashboard' && (
              <Dashboard stats={stats} store={store} go={setTab} onOpenClass={(c) => { setClassFocus(c); setTab('classes'); }} />
            )}
            {tab === 'teachers' && <TeachersView store={store} reload={load} />}
            {tab === 'classes' && <ClassesView store={store} reload={load} profile={profile} focus={classFocus} />}
            {tab === 'subjects' && <SubjectsView store={store} reload={load} />}
            {tab === 'attendance' && <AttendanceView store={store} reload={load} profile={profile} />}
            {tab === 'timetable' && <TimetableView store={store} reload={load} />}
            {tab === 'settings' && <SettingsView store={store} reload={load} />}
          </>
        )}
      </main>
    </div>
  );
}

/* ================================================================== */
function AuditCard({ store, go }) {
  const hasT = (x) => (x.teacher_ids || []).length > 0 || !!x.teacher_id;

  const noTeacher = store.subjects.filter((x) => !hasT(x));
  const noClassStudent = store.students.filter((x) => !x.class_id);
  const emptyClasses = store.classes.filter((c) => !store.subjects.some((x) => x.class_id === c.id));
  const idleTeachers = store.teachers.filter(
    (t) => !store.subjects.some((x) => (x.teacher_ids || []).includes(t.id) || x.teacher_id === t.id)
  );
  const noRoll = store.students.filter((x) => !x.roll_no);

  const rows = [
    { n: noTeacher.length, txt: 'subject bina teacher — classes me assign karein', tab: 'classes', tone: 'var(--amber)' },
    { n: emptyClasses.length, txt: 'class bina kisi subject ke', tab: 'classes', tone: 'var(--amber)' },
    { n: idleTeachers.length, txt: 'teacher ko koi subject assign nahi', tab: 'teachers', tone: 'var(--ink-3)' },
    { n: noClassStudent.length, txt: 'student bina class', tab: 'classes', tone: 'var(--red)' },
    { n: noRoll.length, txt: 'student bina roll number', tab: 'classes', tone: 'var(--red)' },
  ].filter((r) => r.n > 0);

  return (
    <Card className="tight" style={{ marginBottom: 16, border: rows.length ? '1.5px solid var(--amber)' : '1.5px solid var(--green-400)' }}>
      <div className="between" style={{ marginBottom: rows.length ? 10 : 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5 }}>
          {rows.length ? '⚠️ Audit — in cheezon per nazar daalein' : '✅ Audit — sab kuch theek juda hua hai'}
        </div>
        {rows.length > 0 && <Badge kind="pending">{rows.reduce((a, b) => a + b.n, 0)} cheezein</Badge>}
      </div>
      {rows.map((r) => (
        <button key={r.txt} className="between"
          onClick={() => go(r.tab)}
          style={{ width: '100%', background: '#fff', border: '1px solid var(--line)', borderRadius: 10,
            padding: '8px 12px', marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 13 }}>
            <b style={{ color: r.tone }}>{r.n}</b> {r.txt}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>fix →</span>
        </button>
      ))}
    </Card>
  );
}

/* ================================================================== */
function Dashboard({ stats, store, go, onOpenClass }) {
  const recent = store.subs.slice(0, 8);
  const perClass = store.classes.map((c) => ({
    name: c.code || c.name,
    count: store.students.filter((s) => s.class_id === c.id).length,
  }));
  const maxClass = Math.max(1, ...perClass.map((c) => c.count));

  const donut = [
    { label: 'Accepted', value: stats.accepted, color: '#0f9d58' },
    { label: 'Pending', value: stats.pending, color: '#f59e0b' },
    { label: 'Rejected', value: Math.max(0, stats.subs - stats.accepted - stats.pending), color: '#d92d20' },
  ];
  const totalD = Math.max(1, donut.reduce((a, b) => a + b.value, 0));
  let acc = 0;
  const gradient = donut
    .map((d) => {
      const from = (acc / totalD) * 360;
      acc += d.value;
      const to = (acc / totalD) * 360;
      return `${d.color} ${from}deg ${to}deg`;
    })
    .join(', ');

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Admin Dashboard</h1>
          <div className="sub">{store.settings?.institution?.name || 'Your institution'} · poora control yahan se</div>
        </div>
        <div className="row">
          <Btn onClick={() => go('classes')}>+ Student (class ke andar)</Btn>
          <Btn variant="primary" onClick={() => go('attendance')}>Upload attendance</Btn>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Students" value={stats.students} hint="Total enrolled" onClick={() => go('classes')} />
        <Stat label="Teachers" value={stats.teachers} hint="Faculty" onClick={() => go('teachers')} />
        <Stat label="Classes" value={stats.classes} hint={`${stats.subjects} subjects`} onClick={() => go('classes')} />
        <Stat label="Assignments" value={stats.assignments} hint={`${stats.subs} submissions`} onClick={() => go('subjects')} />
      </div>

      <AuditCard store={store} go={go} />

      <SectionTitle
        title="Classes"
        sub="Class kholo — students, subjects, timetable, attendance sab wahin se"
        right={<Btn size="sm" onClick={() => go('classes')}>All classes</Btn>}
      />
      {store.classes.length === 0 ? (
        <Card style={{ marginBottom: 16 }}>
          <Empty icon="🏫" text="Koi class nahi. Classes tab se pehli class banayen." />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Btn variant="primary" onClick={() => go('classes')}>+ New class</Btn>
          </div>
        </Card>
      ) : (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          {store.classes.map((c) => {
            const st = store.students.filter((x) => x.class_id === c.id);
            const sj = store.subjects.filter((x) => x.class_id === c.id);
            const noT = sj.filter((x) => !(x.teacher_ids || []).length && !x.teacher_id).length;
            return (
              <Card key={c.id}>
                <div className="between">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.code}</div>
                  </div>
                  <Badge kind="info">{st.length} students</Badge>
                </div>
                <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                  {(c.sections || []).map((x) => (
                    <Badge key={x} kind="gray">Sec {x} · {st.filter((y) => y.section === x).length}</Badge>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  {sj.length} subject(s){noT > 0 ? ` · ${noT} bina teacher` : ''}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Btn size="sm" variant="primary" onClick={() => onOpenClass(c)}>Open class →</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}


      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Stat label="Pending review" value={stats.pending} tone="warn" hint="Teachers ko dekhni hain" />
        <Stat label="Late submissions" value={stats.late} tone="bad" hint="Deadline ke baad" />
        <Stat label="Accepted" value={stats.accepted} hint={`${pct(stats.accepted, stats.subs)}% of all`} />
      </div>

      <div className="grid g2">
        <Card>
          <SectionTitle title="Submissions breakdown" sub="Sab assignments mila kar" />
          {stats.subs === 0 ? <Empty icon="📊" text="Abhi koi submission nahi aayi." /> : (
            <div className="row" style={{ gap: 24, alignItems: 'center' }}>
              <div style={{
                width: 140, height: 140, borderRadius: '50%',
                background: `conic-gradient(${gradient})`,
                display: 'grid', placeItems: 'center', flex: '0 0 auto',
              }}>
                <div style={{ width: 92, height: 92, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{stats.subs}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>total</div>
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 8, flex: 1 }}>
                {donut.map((d) => (
                  <div key={d.label} className="between">
                    <span className="row" style={{ gap: 8 }}>
                      <i style={{ width: 10, height: 10, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                      {d.label}
                    </span>
                    <b>{d.value}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Students per class" right={<Btn size="sm" onClick={() => go('classes')}>Manage</Btn>} />
          {perClass.length === 0 ? <Empty icon="🏫" text="Abhi koi class nahi bani." /> : (
            <div className="stack" style={{ gap: 10 }}>
              {perClass.map((c) => (
                <div key={c.name}>
                  <div className="between" style={{ marginBottom: 4, fontSize: 12.5 }}>
                    <b>{c.name}</b><span className="muted">{c.count}</span>
                  </div>
                  <div className="progress"><i style={{ width: `${(c.count / maxClass) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle title="Latest submissions" sub="Real-time activity" />
        {recent.length === 0 ? <Empty icon="📭" text="Abhi kuch nahi." /> : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map((s) => {
                  const a = store.assignments.find((x) => x.id === s.assignment_id);
                  return (
                    <tr key={s.id}>
                      <td><b>{s.student?.full_name}</b><div className="muted" style={{ fontSize: 11.5 }}>{s.student?.roll_no}</div></td>
                      <td>{a?.title} <span className="muted">· {a?.subject?.name}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(s.submitted_at)}</td>
                      <td><StatusBadge status={s.status} late={s.is_late} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
