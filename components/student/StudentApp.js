'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Progress, SectionTitle, Spinner, Stat, StatusBadge, Tabs, TextArea } from '@/components/ui';
import { DAYS, DAYS_SHORT, fmtDate, fmtDateTime, fmtTime, initials, openFile, pct, safeName, timeLeft, todayISO, uploadFile } from '@/lib/utils';

export default function StudentApp({ profile, onLogout, onChangePw }) {
  const [tab, setTab] = useState('dashboard');
  const [workFilter, setWorkFilter] = useState('pending');
  const [openSubject, setOpenSubject] = useState(null);
  const [uploadFor, setUploadFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ subjects: [], assignments: [], subs: [], timetable: [], sessions: [], records: [] });

  async function load() {
    setLoading(true);
    const classId = profile.class_id;

    const [subj, tt] = await Promise.all([
      classId
        ? supabase.from('subjects').select('*, teacher:profiles(full_name)').eq('class_id', classId).order('name')
        : Promise.resolve({ data: [] }),
      classId
        ? supabase
            .from('timetable')
            .select('*, subject:subjects(name,code,teacher:profiles(full_name))')
            .eq('class_id', classId)
            .eq('section', profile.section || 'A')
            .order('day')
            .order('slot')
        : Promise.resolve({ data: [] }),
    ]);

    // sirf woh subjects jo is section ko padhaye ja rahe hain (sections null = sab)
    const subjects = (subj.data || []).filter(
      (s) => !s.sections || s.sections.length === 0 || s.sections.includes(profile.section || 'A')
    );
    const ids = subjects.map((s) => s.id);

    const [asg, subs, att, recs] = await Promise.all([
      ids.length
        ? supabase.from('assignments').select('*, subject:subjects(name,code,color)').in('subject_id', ids).eq('is_published', true).order('deadline', { ascending: true })
        : Promise.resolve({ data: [] }),
      supabase.from('submissions').select('*, reviewer:profiles!submissions_reviewed_by_fkey(full_name)').eq('student_id', profile.id),
      classId
        ? supabase.from('attendance_records').select('status, session:attendance_sessions!inner(id,date,class_id,subject:subjects(name))').eq('student_id', profile.id).limit(60)
        : Promise.resolve({ data: [] }),
      Promise.resolve({ data: [] }),
    ]);

    setD({
      subjects,
      assignments: asg.data || [],
      subs: subs.data || [],
      timetable: tt.data || [],
      sessions: [],
      records: att.data || [],
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const rows = useMemo(() => {
    const map = new Map(d.subs.map((s) => [s.assignment_id, s]));
    return d.assignments.map((a) => ({ ...a, sub: map.get(a.id) || null, status: map.get(a.id)?.status || 'notSubmitted' }));
  }, [d.assignments, d.subs]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => !r.sub).length;
    const review = rows.filter((r) => r.sub?.status === 'pending').length;
    const accepted = rows.filter((r) => r.sub?.status === 'accepted').length;
    const rejected = rows.filter((r) => r.sub?.status === 'rejected').length;
    const late = rows.filter((r) => r.sub?.is_late).length;
    return { total: rows.length, pending, review, accepted, rejected, late };
  }, [rows]);

  const attStats = useMemo(() => {
    const total = d.records.length;
    const present = d.records.filter((r) => r.status === 'present' || r.status === 'late').length;
    return { total, present, percent: pct(present, total) };
  }, [d.records]);

  const todayClasses = useMemo(() => {
    const dayNum = new Date().getDay(); // 0 = Sunday
    if (dayNum === 0) return [];        // Sunday = chutti
    return d.timetable.filter((t) => t.day === dayNum);
  }, [d.timetable]);

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', ico: '▦' },
    { key: 'subjects', label: 'Subjects', ico: '▤' },
    { key: 'work', label: 'My Work', ico: '✎' },
    { key: 'timetable', label: 'Timetable', ico: '◷' },
    { key: 'attendance', label: 'Attendance', ico: '✓' },
    { key: 'profile', label: 'Profile', ico: '☺' },
  ];

  const go = (key, filter) => {
    if (filter) setWorkFilter(filter);
    setOpenSubject(null);
    setTab(key);
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-logo">G</div>
          <div>
            <b>GIMS Portal</b>
            <small>Student</small>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.key} className={`nav-btn ${tab === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
            <span className="ico">{n.ico}</span>
            <span className="lbl">{n.label}</span>
          </button>
        ))}
        <div className="side-foot">
          <div className="side-user">
            <div className="avatar">{initials(profile.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.full_name}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{profile.roll_no}</div>
            </div>
          </div>
          <button className="nav-btn" onClick={onChangePw}><span className="ico">⚿</span><span className="lbl">Change password</span></button>
          <button className="nav-btn" onClick={onLogout}><span className="ico">⏻</span><span className="lbl">Logout</span></button>
        </div>
      </aside>

      <main className="main">
        {loading ? (
          <Spinner />
        ) : (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                profile={profile}
                rows={rows}
                stats={stats}
                todayClasses={todayClasses}
                attStats={attStats}
                go={go}
                onOpen={(a) => { setOpenSubject(null); setUploadFor(a); }}
              />
            )}

            {tab === 'subjects' && !openSubject && (
              <Subjects subjects={d.subjects} rows={rows} onOpen={(s) => setOpenSubject(s)} />
            )}

            {tab === 'subjects' && openSubject && (
              <SubjectDetail
                subject={openSubject}
                rows={rows.filter((r) => r.subject_id === openSubject.id)}
                onBack={() => setOpenSubject(null)}
                onUpload={(a) => setUploadFor(a)}
              />
            )}

            {tab === 'work' && <MyWork rows={rows} filter={workFilter} setFilter={setWorkFilter} onUpload={(a) => setUploadFor(a)} />}

            {tab === 'timetable' && <Timetable rows={d.timetable} profile={profile} />}

            {tab === 'attendance' && <Attendance records={d.records} stats={attStats} />}

            {tab === 'profile' && <ProfileCard profile={profile} stats={stats} attStats={attStats} onChangePw={onChangePw} onLogout={onLogout} />}
          </>
        )}
      </main>

      {uploadFor && (
        <UploadModal
          assignment={uploadFor}
          existing={uploadFor.sub}
          studentId={profile.id}
          onClose={() => setUploadFor(null)}
          onDone={() => { setUploadFor(null); load(); }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
function Dashboard({ profile, rows, stats, todayClasses, attStats, go, onOpen }) {
  const next = rows.filter((r) => !r.sub && new Date(r.deadline) > new Date()).slice(0, 4);
  const overdue = rows.filter((r) => !r.sub && new Date(r.deadline) <= new Date());

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Assalam-o-Alaikum, {profile.full_name?.split(' ')[0]} 👋</h1>
          <div className="sub">
            {profile.class?.name || 'Class not assigned'} · Section {profile.section || 'A'} · {profile.roll_no}
          </div>
        </div>
        <div className="row">
          <span className="chip">📚 {stats.total} assignments</span>
          <span className="chip">✓ {attStats.percent}% attendance</span>
        </div>
      </div>

      {!profile.class_id && (
        <div className="err">Aap ki class admin ne assign nahi ki. Admin se kehin ke Students section me aap ki class set karein.</div>
      )}

      <div className="grid g5" style={{ marginBottom: 16 }}>
        <Stat label="Total" value={stats.total} hint="Assignments" onClick={() => go('work', 'all')} />
        <Stat label="Pending" value={stats.pending} tone="warn" hint="Upload karna hai" onClick={() => go('work', 'pending')} />
        <Stat label="In review" value={stats.review} tone="info" hint="Teacher dekh raha hai" onClick={() => go('work', 'review')} />
        <Stat label="Accepted" value={stats.accepted} hint="Mubarak ho" onClick={() => go('work', 'accepted')} />
        <Stat label="Rejected" value={stats.rejected} tone="bad" hint="Dobara upload karein" onClick={() => go('work', 'rejected')} />
      </div>

      <div className="grid g2">
        <Card>
          <SectionTitle title="Next deadlines" sub="Sab se qareeb wali assignments" right={<Btn size="sm" onClick={() => go('work', 'pending')}>View all</Btn>} />
          {next.length === 0 ? (
            <Empty icon="🎉" text="Koi pending assignment nahi — sab clear hai!" />
          ) : (
            <div className="list">
              {next.map((a) => {
                const tl = timeLeft(a.deadline);
                return (
                  <div key={a.id} className="item">
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{a.title}</div>
                      <div className="m">
                        <span>{a.subject?.name}</span>
                        <span>Due {fmtDateTime(a.deadline)}</span>
                      </div>
                    </div>
                    <div className="row">
                      <Badge kind={tl.ms < 36e5 * 6 ? 'rejected' : 'pending'}>{tl.text}</Badge>
                      <Btn size="sm" variant="primary" onClick={() => onOpen(a)}>Upload</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {overdue.length > 0 && (
            <div className="hint" style={{ marginTop: 12, color: 'var(--red)' }}>
              ⚠️ {overdue.length} assignment ki deadline guzar gayi hai — "My Work → Pending" me dekhein.
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Aaj ke classes" sub={new Date().getDay() === 0 ? 'Sunday' : DAYS[new Date().getDay() - 1]} />
          {todayClasses.length === 0 ? (
            <Empty icon="☕" text="Aaj koi class nahi 🎉" />
          ) : (
            <div className="list">
              {todayClasses.map((c) => (
                <div key={c.id} className="item">
                  <div>
                    <div className="t">{c.subject?.name || c.label || '—'}</div>
                    <div className="m">
                      <span>{c.start_time} – {c.end_time}</span>
                      {c.room && <span>Room {c.room}</span>}
                      {c.subject?.teacher?.full_name && <span>{c.subject.teacher.full_name}</span>}
                    </div>
                  </div>
                  <Badge kind="info">Slot {c.slot}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ================================================================== */
function Subjects({ subjects, rows, onOpen }) {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Subjects</h1>
          <div className="sub">Kisi bhi subject ka segment khol kar us ki assignments dekhein</div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <Card><Empty icon="📚" text="Abhi koi subject add nahi hua. Admin se rabta karein." /></Card>
      ) : (
        <div className="segs">
          {subjects.map((s) => {
            const list = rows.filter((r) => r.subject_id === s.id);
            const pending = list.filter((r) => !r.sub).length;
            const accepted = list.filter((r) => r.sub?.status === 'accepted').length;
            const rejected = list.filter((r) => r.sub?.status === 'rejected').length;
            const done = accepted + rejected;
            return (
              <button key={s.id} className="seg" onClick={() => onOpen(s)}>
                <div className="between">
                  <div className="nm">{s.name}</div>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color || '#0f9d58' }} />
                </div>
                <div className="cd">{s.code || '—'} {s.teacher?.full_name ? '· ' + s.teacher.full_name : ''}</div>
                <div className="dotline">
                  {list.length === 0 && <i />}
                  {list.slice(0, 6).map((r) => (
                    <i key={r.id} style={{ background: r.sub ? (r.sub.status === 'accepted' ? '#22b364' : r.sub.status === 'rejected' ? '#d92d20' : '#f59e0b') : '#e6efe9' }} />
                  ))}
                </div>
                <div className="m" style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', display: 'flex', gap: 10 }}>
                  <span><b style={{ color: 'var(--amber)' }}>{pending}</b> pending</span>
                  <span><b style={{ color: 'var(--green-700)' }}>{accepted}</b> accepted</span>
                  {rejected > 0 && <span><b style={{ color: 'var(--red)' }}>{rejected}</b> rejected</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ================================================================== */
function SubjectDetail({ subject, rows, onBack, onUpload }) {
  const pending = rows.filter((r) => !r.sub).length;
  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={onBack}>← All subjects</button>
          <h1 style={{ marginTop: 6 }}>{subject.name}</h1>
          <div className="sub">
            {subject.code} {subject.teacher?.full_name ? `· ${subject.teacher.full_name}` : ''} · {rows.length} assignment(s)
          </div>
        </div>
        <span className="chip">{pending} pending</span>
      </div>

      {rows.length === 0 ? (
        <Card><Empty icon="🗂️" text="Is subject me abhi koi assignment nahi aayi." /></Card>
      ) : (
        <div className="stack">
          {rows.map((a) => <AssignmentCard key={a.id} a={a} onUpload={onUpload} />)}
        </div>
      )}
    </>
  );
}

export function AssignmentCard({ a, onUpload }) {
  const tl = timeLeft(a.deadline);
  return (
    <Card className="tight">
      <div className="between">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="row" style={{ gap: 8 }}>
            <b style={{ fontSize: 15 }}>{a.title}</b>
            <StatusBadge status={a.status} late={a.sub?.is_late} />
          </div>
          {a.description && <div className="muted" style={{ marginTop: 5 }}>{a.description}</div>}
          <div className="m" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>📅 Due {fmtDateTime(a.deadline)}</span>
            <span>🎯 {a.max_marks} marks</span>
            <span>{a.allow_late ? 'Late allowed' : 'Late band'}</span>
            {a.sub && <span>📤 {fmtDateTime(a.sub.submitted_at)}</span>}
            {a.sub?.marks != null && <span>⭐ {a.sub.marks}/{a.max_marks}</span>}
          </div>
          {a.sub?.feedback && (
            <div className="hint" style={{ marginTop: 8, padding: '8px 10px', background: 'var(--green-50)', borderRadius: 8 }}>
              <b>Teacher feedback:</b> {a.sub.feedback}
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {a.file_path && (
            <Btn size="sm" onClick={() => openFile('assignment-files', a.file_path)}>📎 Question file</Btn>
          )}
          {a.sub?.file_path && (
            <Btn size="sm" onClick={() => openFile('submission-files', a.sub.file_path)}>👁 My file</Btn>
          )}
          {(!a.sub || a.sub.status === 'rejected') && (
            <Btn size="sm" variant="primary" onClick={() => onUpload(a)}>
              {a.sub ? 'Re-upload' : 'Upload'}
            </Btn>
          )}
          {a.sub && a.sub.status === 'pending' && (
            <Btn size="sm" onClick={() => onUpload(a)}>Replace</Btn>
          )}
        </div>
      </div>
      {!a.sub && (
        <div style={{ marginTop: 12 }}>
          <Progress value={tl.overdue ? 100 : Math.max(4, 100 - Math.min(100, (tl.ms / (7 * 864e5)) * 100))} />
          <div className="hint" style={{ marginTop: 5, color: tl.overdue ? 'var(--red)' : 'var(--ink-3)' }}>{tl.text}</div>
        </div>
      )}
    </Card>
  );
}

/* ================================================================== */
function MyWork({ rows, filter, setFilter, onUpload }) {
  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'pending') return rows.filter((r) => !r.sub);
    if (filter === 'review') return rows.filter((r) => r.sub?.status === 'pending');
    if (filter === 'accepted') return rows.filter((r) => r.sub?.status === 'accepted');
    if (filter === 'rejected') return rows.filter((r) => r.sub?.status === 'rejected');
    if (filter === 'late') return rows.filter((r) => r.sub?.is_late);
    return rows;
  }, [rows, filter]);

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => !r.sub).length,
    review: rows.filter((r) => r.sub?.status === 'pending').length,
    accepted: rows.filter((r) => r.sub?.status === 'accepted').length,
    rejected: rows.filter((r) => r.sub?.status === 'rejected').length,
    late: rows.filter((r) => r.sub?.is_late).length,
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>My Work</h1>
          <div className="sub">Sab assignments ek jagah — filter buttons se</div>
        </div>
      </div>

      <Tabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'review', label: 'In review', count: counts.review },
          { key: 'accepted', label: 'Accepted', count: counts.accepted },
          { key: 'rejected', label: 'Rejected', count: counts.rejected },
          { key: 'late', label: 'Late', count: counts.late },
          { key: 'all', label: 'All', count: counts.all },
        ]}
      />

      <div className="stack" style={{ marginTop: 14 }}>
        {filtered.length === 0 ? (
          <Card><Empty icon="🍃" text="Is section me kuch nahi hai." /></Card>
        ) : (
          filtered.map((a) => (
            <Card key={a.id} className="tight">
              <div className="between">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{a.title}</b>
                    <StatusBadge status={a.status} late={a.sub?.is_late} />
                    <Badge kind="gray">{a.subject?.name}</Badge>
                  </div>
                  <div className="m" style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>📅 {fmtDateTime(a.deadline)}</span>
                    <span>🎯 {a.max_marks}</span>
                    {a.sub && <span>📤 {fmtDateTime(a.sub.submitted_at)}</span>}
                    {a.sub?.marks != null && <span>⭐ {a.sub.marks}/{a.max_marks}</span>}
                  </div>
                  {a.sub?.feedback && <div className="hint" style={{ marginTop: 6 }}><b>Feedback:</b> {a.sub.feedback}</div>}
                </div>
                <div className="row">
                  {a.sub?.file_path && <Btn size="sm" onClick={() => openFile('submission-files', a.sub.file_path)}>My file</Btn>}
                  {(!a.sub || a.sub.status === 'rejected') && <Btn size="sm" variant="primary" onClick={() => onUpload(a)}>{a.sub ? 'Re-upload' : 'Upload'}</Btn>}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================== */
function Timetable({ rows, profile }) {
  const todayIdx = Math.max(0, Math.min(5, new Date().getDay() - 1));
  const [day, setDay] = useState(new Date().getDay() === 0 ? 0 : todayIdx);
  const list = rows.filter((r) => r.day === day + 1);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Time Table</h1>
          <div className="sub">{profile.class?.name} · Section {profile.section || 'A'} — din ke button dabayen</div>
        </div>
      </div>

      <Tabs tabs={DAYS_SHORT.map((d, i) => ({ key: String(i), label: d }))} active={String(day)} onChange={(k) => setDay(Number(k))} />

      <div className="grid g3" style={{ marginTop: 16 }}>
        {list.length === 0 ? (
          <Card style={{ gridColumn: '1 / -1' }}><Empty icon="🗓️" text="Is din koi class nahi." /></Card>
        ) : (
          list.map((c) => (
            <Card key={c.id} className="tight">
              <div className="between">
                <Badge kind="info">Slot {c.slot}</Badge>
                <span className="hint">{c.start_time} – {c.end_time}</span>
              </div>
              <div style={{ fontWeight: 800, marginTop: 10, fontSize: 15 }}>{c.subject?.name || c.label || '—'}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {c.subject?.teacher?.full_name || '—'} {c.room ? `· Room ${c.room}` : ''}
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================== */
function Attendance({ records, stats }) {
  return (
    <>
      <div className="topbar">
        <div>
          <h1>My Attendance</h1>
          <div className="sub">Admin daily attendance upload karta hai</div>
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <Stat label="Attendance %" value={`${stats.percent}%`} hint="Overall" />
        <Stat label="Present" value={stats.present} />
        <Stat label="Marked days" value={stats.total} />
      </div>

      <Card>
        <SectionTitle title="Recent records" />
        {records.length === 0 ? (
          <Empty icon="📋" text="Abhi attendance record nahi hai." />
        ) : (
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Subject</th><th>Status</th></tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDate(r.session?.date)}</td>
                    <td>{r.session?.subject?.name || '—'}</td>
                    <td>
                      <Badge kind={r.status === 'present' ? 'accepted' : r.status === 'late' ? 'pending' : r.status === 'leave' ? 'info' : 'rejected'}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ================================================================== */
function ProfileCard({ profile, stats, attStats, onChangePw, onLogout }) {
  return (
    <>
      <div className="topbar"><div><h1>My Profile</h1><div className="sub">Aap ki details</div></div></div>

      <div className="grid g2">
        <Card>
          <div className="row" style={{ gap: 14, marginBottom: 16 }}>
            <div className="avatar big">{initials(profile.full_name)}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{profile.full_name}</div>
              <div className="muted">{profile.roll_no}</div>
            </div>
          </div>
          <table className="tbl">
            <tbody>
              <tr><td>Login ID</td><td><b>{profile.username}</b></td></tr>
              <tr><td>Class</td><td>{profile.class?.name || '—'}</td></tr>
              <tr><td>Section</td><td>{profile.section || '—'}</td></tr>
              <tr><td>Phone</td><td>{profile.phone || '—'}</td></tr>
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 16 }}>
            <Btn variant="primary" onClick={onChangePw}>Change password</Btn>
            <Btn variant="danger" onClick={onLogout}>Logout</Btn>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Snapshot" />
          <div className="grid g2">
            <Stat label="Accepted" value={stats.accepted} />
            <Stat label="Pending" value={stats.pending} tone="warn" />
            <Stat label="Rejected" value={stats.rejected} tone="bad" />
            <Stat label="Attendance" value={`${attStats.percent}%`} tone="info" />
          </div>
        </Card>
      </div>
    </>
  );
}

/* ================================================================== */
function UploadModal({ assignment, existing, studentId, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState(existing?.note || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tl = timeLeft(assignment.deadline);
  const late = tl.overdue;
  const blocked = late && !assignment.allow_late;

  async function submit() {
    setErr('');
    if (!file && !existing?.file_path) return setErr('Pehle file select karein.');
    if (blocked) return setErr('Deadline guzar chuki hai aur late submission band hai. Teacher se baat karein.');
    if (file && file.size > 25 * 1024 * 1024) return setErr('File 25MB se bari hai.');

    setBusy(true);
    try {
      let path = existing?.file_path || null;
      let name = existing?.file_name || null;
      let size = existing?.file_size || null;

      if (file) {
        path = `${studentId}/${assignment.id}/${Date.now()}_${safeName(file.name)}`;
        await uploadFile('submission-files', path, file);
        name = file.name;
        size = file.size;
      }

      const payload = {
        assignment_id: assignment.id,
        student_id: studentId,
        file_path: path,
        file_name: name,
        file_size: size,
        note,
        submitted_at: new Date().toISOString(),
        status: 'pending',
        marks: null,
        feedback: null,
        reviewed_at: null,
      };

      const { error } = await supabase.from('submissions').upsert(payload, { onConflict: 'assignment_id,student_id' });
      if (error) throw error;

      toast(late ? 'Late submission bhej di gayi — teacher review karega' : 'Assignment submit ho gayi ✅');
      onDone();
    } catch (e) {
      setErr(e.message || 'Upload fail ho gaya');
    }
    setBusy(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Upload — ${assignment.title}`}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || blocked}>{busy ? 'Uploading…' : 'Submit assignment'}</Btn>
        </>
      }
    >
      {err && <div className="err">{err}</div>}
      {blocked && <div className="err">Deadline guzar gayi hai aur is assignment me late submission allowed nahi hai.</div>}
      {late && assignment.allow_late && (
        <div className="ok">⚠️ Ye submission <b>late</b> mark hogi (deadline {fmtDateTime(assignment.deadline)} thi). Teacher chahe to accept kar sakta hai.</div>
      )}

      <div className="hint" style={{ marginBottom: 14 }}>
        Subject: <b>{assignment.subject?.name}</b> · Deadline: <b>{fmtDateTime(assignment.deadline)}</b> · Marks: <b>{assignment.max_marks}</b>
      </div>

      {existing?.file_path && (
        <div className="ok" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Maujooda file: <b>{existing.file_name}</b></span>
          <Btn size="sm" onClick={() => openFile('submission-files', existing.file_path)}>View</Btn>
        </div>
      )}

      <Field label="File (PDF / DOCX / ZIP / image)" hint="Max 25 MB">
        <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </Field>

      <Field label="Note (optional)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kuch likhna ho to…" />
      </Field>
    </Modal>
  );
}
