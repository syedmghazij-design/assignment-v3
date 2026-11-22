'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Btn, Card, Empty, SectionTitle, Spinner, Stat, StatusBadge } from '@/components/ui';
import { fmtDateTime, initials, pct } from '@/lib/utils';
import ClassesView from './ClassesView';
import SubjectsView from './SubjectsView';
import TeachersView from './TeachersView';
import StudentsView from './StudentsView';
import AttendanceView from './AttendanceView';
import TimetableView from './TimetableView';
import SettingsView from './SettingsView';

export default function AdminApp({ profile, onLogout, onChangePw }) {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState({
    classes: [], subjects: [], teachers: [], students: [], assignments: [], subs: [], creds: {}, settings: {},
  });

  async function load() {
    const [cls, subj, teach, stud, asg, subs, creds, sett] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*, teacher:profiles(full_name), class:classes(name,code)').order('name'),
      supabase.from('profiles').select('*').eq('role', 'teacher').order('full_name'),
      supabase.from('profiles').select('*, class:classes(name,code)').eq('role', 'student').order('roll_no'),
      supabase.from('assignments').select('*, subject:subjects(name,code,class:classes(name))').order('created_at', { ascending: false }),
      supabase.from('submissions').select('id,status,is_late,submitted_at,assignment_id,student:profiles!submissions_student_id_fkey(roll_no,full_name)').order('submitted_at', { ascending: false }).limit(400),
      supabase.from('user_credentials').select('user_id,password_text'),
      supabase.from('settings').select('*'),
    ]);

    const credMap = {};
    (creds.data || []).forEach((c) => (credMap[c.user_id] = c.password_text));
    const setMap = {};
    (sett.data || []).forEach((s) => (setMap[s.key] = s.value));

    setStore({
      classes: cls.data || [],
      subjects: subj.data || [],
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
    { key: 'students', label: 'Students', ico: '👥' },
    { key: 'teachers', label: 'Teachers', ico: '🎓' },
    { key: 'classes', label: 'Classes', ico: '🏫' },
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
            {tab === 'dashboard' && <Dashboard stats={stats} store={store} go={setTab} />}
            {tab === 'students' && <StudentsView store={store} reload={load} />}
            {tab === 'teachers' && <TeachersView store={store} reload={load} />}
            {tab === 'classes' && <ClassesView store={store} reload={load} />}
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
function Dashboard({ stats, store, go }) {
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
          <Btn onClick={() => go('students')}>+ Student</Btn>
          <Btn variant="primary" onClick={() => go('attendance')}>Upload attendance</Btn>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="Students" value={stats.students} hint="Total enrolled" onClick={() => go('students')} />
        <Stat label="Teachers" value={stats.teachers} hint="Faculty" onClick={() => go('teachers')} />
        <Stat label="Classes" value={stats.classes} hint={`${stats.subjects} subjects`} onClick={() => go('classes')} />
        <Stat label="Assignments" value={stats.assignments} hint={`${stats.subs} submissions`} onClick={() => go('subjects')} />
      </div>

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
