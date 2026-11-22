'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Badge, Btn, Card, Empty, Field, Input, Modal, Progress, SectionTitle, Select, Spinner, Stat, StatusBadge, Tabs, TextArea } from '@/components/ui';
import { DAYS_SHORT, fmtDate, fmtDateTime, initials, openFile, pct, safeName, timeLeft, uploadFile } from '@/lib/utils';

export default function TeacherApp({ profile, onLogout, onChangePw }) {
  const [tab, setTab] = useState('dashboard');
  const [openClass, setOpenClass] = useState(null);
  const [checkSubject, setCheckSubject] = useState(null);
  const [openSubject, setOpenSubject] = useState(null);
  const [openAssignment, setOpenAssignment] = useState(null);
  const [newAsgFor, setNewAsgFor] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState({ subjects: [], assignments: [], subs: [], timetable: [] });

  async function load() {
    setLoading(true);
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*, class:classes(id,name,code), teacher:profiles(full_name)')
      .eq('teacher_id', profile.id)
      .order('name');

    const ids = (subjects || []).map((s) => s.id);

    const [asg, subsRes, tt] = await Promise.all([
      ids.length
        ? supabase.from('assignments').select('*, subject:subjects(name,code,color)').in('subject_id', ids).order('deadline', { ascending: false })
        : Promise.resolve({ data: [] }),
      ids.length ? fetchSubs(ids) : Promise.resolve({ data: [] }),
      ids.length
        ? supabase.from('timetable').select('*, subject:subjects(name,code), class:classes(name)').in('subject_id', ids).order('day').order('slot')
        : Promise.resolve({ data: [] }),
    ]);

    setD({ subjects: subjects || [], assignments: asg.data || [], subs: subsRes.data || [], timetable: tt.data || [] });
    setLoading(false);
  }

  async function fetchSubs(subjectIds) {
    const { data: asgIds } = await supabase.from('assignments').select('id').in('subject_id', subjectIds);
    const ids = (asgIds || []).map((a) => a.id);
    if (!ids.length) return { data: [] };
    return supabase
      .from('submissions')
      .select('*, student:profiles!submissions_student_id_fkey(roll_no, full_name, section)')
      .in('assignment_id', ids)
      .order('submitted_at', { ascending: false });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const stats = useMemo(() => {
    const pending = d.subs.filter((s) => s.status === 'pending').length;
    const latePending = d.subs.filter((s) => s.is_late && s.status === 'pending').length;
    return { subjects: d.subjects.length, assignments: d.assignments.length, pending, latePending, total: d.subs.length };
  }, [d]);

  const go = (key, c, s, a) => {
    setOpenClass(c || null);
    setOpenSubject(s || null);
    setOpenAssignment(a || null);
    setCheckSubject(null);
    setTab(key);
  };

  const NAV = [
    { key: 'dashboard', label: 'Dashboard', ico: '▦' },
    { key: 'classes', label: 'My Classes', ico: '🏫' },
    { key: 'pending', label: 'To Review', ico: '⏳' },
    { key: 'late', label: 'Late Submissions', ico: '⌛' },
    { key: 'timetable', label: 'My Schedule', ico: '◷' },
    { key: 'profile', label: 'Profile', ico: '☺' },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-logo">G</div>
          <div><b>GIMS Portal</b><small>Teacher</small></div>
        </div>
        {NAV.map((n) => (
          <button key={n.key} className={`nav-btn ${tab === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
            <span className="ico">{n.ico}</span><span className="lbl">{n.label}</span>
            {n.key === 'pending' && stats.pending > 0 && (
              <span style={{ marginLeft: 'auto', background: '#fff', color: 'var(--green-800)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>{stats.pending}</span>
            )}
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
            {tab === 'dashboard' && <Dashboard profile={profile} stats={stats} d={d} go={go} onNew={() => setNewAsgFor({})} onReview={setReview} />}

            {tab === 'classes' && !openClass && (
              <MyClasses subjects={d.subjects} d={d} onOpen={(c) => go('classes', c)} />
            )}

            {tab === 'classes' && openClass && !openSubject && (
              <ClassView
                cls={openClass}
                subjects={d.subjects.filter((s) => s.class_id === openClass.id)}
                d={d}
                timetable={d.timetable.filter((t) => t.class_id === openClass.id)}
                onBack={() => go('classes')}
                onOpenSubject={(s) => go('classes', openClass, s)}
                onNew={(s) => setNewAsgFor({ subject_id: s.id })}
                onCheck={(s) => { setCheckSubject(s); setOpenSubject(s); setTab('classes'); }}
              />
            )}

            {tab === 'classes' && openSubject && checkSubject && checkSubject.id === openSubject.id && (
              <SubmissionList
                title={`${openSubject.name} — check karein`}
                subtitle={`${openClass?.name || ''} · saari submissions ek jagah`}
                rows={d.subs.filter((x) => d.assignments.some((a) => a.id === x.assignment_id && a.subject_id === openSubject.id))}
                assignments={d.assignments}
                onReview={setReview}
                onBack={() => { setCheckSubject(null); setOpenSubject(null); }}
              />
            )}

            {tab === 'classes' && openSubject && !checkSubject && !openAssignment && (
              <SubjectView
                subject={openSubject}
                assignments={d.assignments.filter((a) => a.subject_id === openSubject.id)}
                subs={d.subs}
                onBack={() => { setOpenSubject(null); setCheckSubject(null); }}
                onNew={() => setNewAsgFor({ subject_id: openSubject.id })}
                onCheck={() => setCheckSubject(openSubject)}
                onOpenAssignment={(a) => setOpenAssignment(a)}
                onReview={setReview}
                reload={load}
              />
            )}

            {tab === 'classes' && openSubject && openAssignment && (
              <AssignmentView
                assignment={openAssignment}
                subs={d.subs.filter((s) => s.assignment_id === openAssignment.id)}
                onBack={() => setOpenAssignment(null)}
                onReview={setReview}
              />
            )}

            {tab === 'pending' && (
              <SubmissionList
                title="To Review"
                subtitle="Students ki nayi submissions — accept ya reject karein"
                rows={d.subs.filter((s) => s.status === 'pending')}
                assignments={d.assignments}
                onReview={setReview}
                defaultFilter="ontime"
              />
            )}

            {tab === 'late' && (
              <SubmissionList
                title="Late Submissions"
                subtitle="Deadline ke baad aayi submissions — alag section me"
                rows={d.subs.filter((s) => s.is_late)}
                assignments={d.assignments}
                onReview={setReview}
                defaultFilter="late"
                forceLate
              />
            )}

            {tab === 'timetable' && <MySchedule rows={d.timetable} profile={profile} />}

            {tab === 'profile' && (
              <ProfileCard profile={profile} stats={stats} subjects={d.subjects} onChangePw={onChangePw} onLogout={onLogout} />
            )}
          </>
        )}
      </main>

      {newAsgFor && (
        <NewAssignmentModal
          subjects={d.subjects}
          preset={newAsgFor}
          teacherId={profile.id}
          onClose={() => setNewAsgFor(null)}
          onDone={() => { setNewAsgFor(null); load(); }}
        />
      )}

      {review && (
        <ReviewModal
          sub={review}
          assignment={d.assignments.find((a) => a.id === review.assignment_id)}
          teacherId={profile.id}
          onClose={() => setReview(null)}
          onDone={() => { setReview(null); load(); }}
        />
      )}
    </div>
  );
}

/* ================================================================== */
function Dashboard({ profile, stats, d, go, onNew, onReview }) {
  const pendingRows = d.subs.filter((s) => s.status === 'pending').slice(0, 5);
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Welcome, {profile.full_name} 👋</h1>
          <div className="sub">Aap ke subjects, assignments aur submissions ka khulasa</div>
        </div>
        <Btn variant="primary" onClick={onNew}>+ New assignment</Btn>
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat label="My subjects" value={stats.subjects} hint="Is semester" onClick={() => go('classes')} />
        <Stat label="Assignments" value={stats.assignments} hint="Banayi hui" onClick={() => go('classes')} />
        <Stat label="To review" value={stats.pending} tone="warn" hint="Students wait kar rahe hain" onClick={() => go('pending')} />
        <Stat label="Late pending" value={stats.latePending} tone="bad" hint="Deadline ke baad wali" onClick={() => go('late')} />
      </div>

      <div className="grid g2">
        <Card>
          <SectionTitle title="Jinhe review chahiye" right={<Btn size="sm" onClick={() => go('pending')}>View all</Btn>} />
          {pendingRows.length === 0 ? (
            <Empty icon="✅" text="Sab clear! Koi pending submission nahi." />
          ) : (
            <div className="list">
              {pendingRows.map((s) => {
                const a = d.assignments.find((x) => x.id === s.assignment_id);
                return (
                  <div key={s.id} className="item">
                    <div>
                      <div className="t">{s.student?.full_name} <span className="muted">({s.student?.roll_no})</span></div>
                      <div className="m"><span>{a?.title}</span><span>{fmtDateTime(s.submitted_at)}</span></div>
                    </div>
                    <div className="row">
                      {s.is_late && <Badge kind="late">Late</Badge>}
                      <Btn size="sm" variant="primary" onClick={() => onReview(s)}>Review</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Meri classes" right={<Btn size="sm" onClick={() => go('classes')}>Open</Btn>} />
          {d.subjects.length === 0 ? (
            <Empty icon="📚" text="Admin ne abhi koi subject assign nahi kiya." />
          ) : (
            <div className="list">
              {d.subjects.map((s) => {
                const list = d.assignments.filter((a) => a.subject_id === s.id);
                return (
                  <div key={s.id} className="item" onClick={() => go('classes', null, s)} role="button" style={{ cursor: 'pointer' }}>
                    <div>
                      <div className="t">{s.name}</div>
                      <div className="m"><span>{s.class?.name}</span><span>{s.code}</span></div>
                    </div>
                    <Badge kind="info">{list.length} assignment</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ================================================================== */
function MyClasses({ subjects, d, onOpen }) {
  const map = new Map();
  subjects.forEach((s) => {
    const key = s.class_id || 'none';
    if (!map.has(key)) {
      map.set(key, { id: s.class_id, name: s.class?.name || 'No class', code: s.class?.code || '', subjects: [] });
    }
    map.get(key).subjects.push(s);
  });
  const classes = Array.from(map.values());

  const pendingOf = (ids) => {
    const asgIds = d.assignments.filter((a) => ids.includes(a.subject_id)).map((a) => a.id);
    return d.subs.filter((x) => asgIds.includes(x.assignment_id) && x.status === 'pending').length;
  };

  return (
    <>
      <div className="topbar">
        <div><h1>My Classes</h1><div className="sub">Aap jin classes ko parhate hain — class kholein phir subject chunein</div></div>
      </div>

      {classes.length === 0 ? (
        <Card><Empty icon="🏫" text="Koi class/subject assign nahi hui. Admin se rabta karein (Admin → Teachers → Subjects)." /></Card>
      ) : (
        <div className="grid g3">
          {classes.map((c) => {
            const ids = c.subjects.map((x) => x.id);
            const pend = pendingOf(ids);
            const asgCount = d.assignments.filter((a) => ids.includes(a.subject_id)).length;
            return (
              <Card key={c.id || c.name}>
                <div className="between">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.code || '—'}</div>
                  </div>
                  {pend > 0 ? <Badge kind="pending">{pend} to review</Badge> : <Badge kind="gray">clear</Badge>}
                </div>
                <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
                  {c.subjects.map((x) => <Badge key={x.id} kind="info">{x.name}</Badge>)}
                </div>
                <div className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
                  {c.subjects.length} subject(s) · {asgCount} assignment(s)
                </div>
                <div style={{ marginTop: 14 }}>
                  <Btn variant="primary" onClick={() => onOpen(c)}>Class kholein →</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ================================================================== */
function ClassView({ cls, subjects, d, timetable, onBack, onOpenSubject, onNew, onCheck }) {
  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={onBack}>← My classes</button>
          <h1 style={{ marginTop: 6 }}>{cls.name}</h1>
          <div className="sub">{cls.code || '—'} · {subjects.length} subject(s) — har subject se assignment de sakte hain ya check kar sakte hain</div>
        </div>
      </div>

      {subjects.length === 0 ? (
        <Card><Empty icon="📚" text="Is class me aap ka koi subject nahi." /></Card>
      ) : (
        <div className="stack">
          {subjects.map((s) => {
            const asg = d.assignments.filter((a) => a.subject_id === s.id);
            const asgIds = asg.map((a) => a.id);
            const rows = d.subs.filter((x) => asgIds.includes(x.assignment_id));
            const pending = rows.filter((x) => x.status === 'pending').length;
            const late = rows.filter((x) => x.is_late).length;
            return (
              <Card key={s.id} className="tight">
                <div className="between">
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: s.color || '#0f9d58' }} />
                      <b style={{ fontSize: 15.5 }}>{s.name}</b>
                      <span className="muted" style={{ fontSize: 12 }}>{s.code || ''} {s.semester ? `· ${s.semester}` : ''}</span>
                    </div>
                    <div className="m" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span><b>{asg.length}</b> assignment(s)</span>
                      <span><b style={{ color: 'var(--amber)' }}>{pending}</b> to review</span>
                      <span><b style={{ color: 'var(--red)' }}>{late}</b> late</span>
                      <span><b>{rows.length}</b> total submissions</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <Btn variant="primary" onClick={() => onNew(s)}>➕ Nayi assignment</Btn>
                    <Btn onClick={() => onCheck(s)}>📥 Check karni hai{pending ? ` (${pending})` : ''}</Btn>
                    <Btn onClick={() => onOpenSubject(s)}>Open</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {timetable.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionTitle title="Is class ka time table" sub="Aap ke subjects ki classes" />
          <Card className="tight" style={{ padding: 0 }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead><tr><th>Day</th><th>Slot</th><th>Subject</th><th>Section</th><th>Room</th></tr></thead>
                <tbody>
                  {timetable
                    .slice()
                    .sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.slot).localeCompare(String(b.slot)))
                    .map((t) => (
                      <tr key={t.id}>
                        <td><b>{t.day}</b></td>
                        <td>{t.slot}</td>
                        <td>{t.subject?.name || '—'}</td>
                        <td>{t.section || '—'}</td>
                        <td>{t.room || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

/* ================================================================== */
function SubjectView({ subject, assignments, subs, onBack, onNew, onCheck, onOpenAssignment, onReview, reload }) {
  const [confirmDel, setConfirmDel] = useState(null);
  const asgIds = assignments.map((a) => a.id);
  const myRows = subs.filter((x) => asgIds.includes(x.assignment_id));
  const pendingCount = myRows.filter((x) => x.status === 'pending').length;

  async function remove(a) {
    const { error } = await supabase.from('assignments').delete().eq('id', a.id);
    if (error) return toast(error.message, 'err');
    toast('Assignment delete ho gayi');
    setConfirmDel(null);
    reload();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={onBack}>← My subjects</button>
          <h1 style={{ marginTop: 6 }}>{subject.name}</h1>
          <div className="sub">{subject.class?.name} · {subject.code} · {assignments.length} assignment(s)</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={onNew}>➕ Nayi assignment</Btn>
          <Btn onClick={onCheck}>📥 Check karni hai{pendingCount ? ` (${pendingCount})` : ''}</Btn>
        </div>
      </div>

      {assignments.length === 0 ? (
        <Card><Empty icon="🗂️" text="Is subject me koi assignment nahi. '+ New assignment' dabayen." /></Card>
      ) : (
        <div className="stack">
          {assignments.map((a) => {
            const list = subs.filter((s) => s.assignment_id === a.id);
            const ontime = list.filter((s) => !s.is_late);
            const late = list.filter((s) => s.is_late);
            const pending = list.filter((s) => s.status === 'pending');
            const accepted = list.filter((s) => s.status === 'accepted');
            const rejected = list.filter((s) => s.status === 'rejected');
            const tl = timeLeft(a.deadline);
            return (
              <Card key={a.id} className="tight">
                <div className="between">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <b style={{ fontSize: 15 }}>{a.title}</b>
                      {tl.overdue ? <Badge kind="rejected">Deadline over</Badge> : <Badge kind="accepted">Open</Badge>}
                      {!a.allow_late && <Badge kind="gray">Late band</Badge>}
                    </div>
                    <div className="m" style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📅 {fmtDateTime(a.deadline)}</span>
                      <span>🎯 {a.max_marks} marks</span>
                      <span>📥 {list.length} submissions · {ontime.length} on-time · {late.length} late</span>
                    </div>
                    <div className="row" style={{ marginTop: 10, gap: 6 }}>
                      <Badge kind="pending">{pending.length} pending</Badge>
                      <Badge kind="accepted">{accepted.length} accepted</Badge>
                      <Badge kind="rejected">{rejected.length} rejected</Badge>
                    </div>
                    <div style={{ marginTop: 10 }}><Progress value={pct(accepted.length, list.length)} /></div>
                  </div>
                  <div className="row">
                    {a.file_path && <Btn size="sm" onClick={() => openFile('assignment-files', a.file_path)}>📎 File</Btn>}
                    <Btn size="sm" variant="primary" onClick={() => onOpenAssignment(a)}>View submissions</Btn>
                    <Btn size="sm" variant="danger" onClick={() => setConfirmDel(a)}>Delete</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete assignment?"
        footer={<><Btn onClick={() => setConfirmDel(null)}>Cancel</Btn><Btn variant="danger" onClick={() => remove(confirmDel)}>Yes, delete</Btn></>}>
        <b>{confirmDel?.title}</b> delete hone se is ki saari student submissions bhi delete ho jayengi. Ye wapas nahi aayengi.
      </Modal>
    </>
  );
}

/* ================================================================== */
function AssignmentView({ assignment, subs, onBack, onReview }) {
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => {
    if (filter === 'ontime') return subs.filter((s) => !s.is_late);
    if (filter === 'late') return subs.filter((s) => s.is_late);
    if (filter === 'pending') return subs.filter((s) => s.status === 'pending');
    if (filter === 'accepted') return subs.filter((s) => s.status === 'accepted');
    if (filter === 'rejected') return subs.filter((s) => s.status === 'rejected');
    return subs;
  }, [subs, filter]);

  return (
    <>
      <div className="topbar">
        <div>
          <button className="btn-link" onClick={onBack}>← Back</button>
          <h1 style={{ marginTop: 6 }}>{assignment.title}</h1>
          <div className="sub">Deadline {fmtDateTime(assignment.deadline)} · {assignment.max_marks} marks · {subs.length} submissions</div>
        </div>
      </div>

      <Tabs active={filter} onChange={setFilter} tabs={[
        { key: 'all', label: 'All', count: subs.length },
        { key: 'pending', label: 'Pending', count: subs.filter((s) => s.status === 'pending').length },
        { key: 'ontime', label: 'On time', count: subs.filter((s) => !s.is_late).length },
        { key: 'late', label: 'Late', count: subs.filter((s) => s.is_late).length },
        { key: 'accepted', label: 'Accepted', count: subs.filter((s) => s.status === 'accepted').length },
        { key: 'rejected', label: 'Rejected', count: subs.filter((s) => s.status === 'rejected').length },
      ]} />

      <div style={{ marginTop: 14 }}>
        <SubmissionTable rows={filtered} onReview={onReview} />
      </div>
    </>
  );
}

/* ================================================================== */
function SubmissionList({ title, subtitle, rows, assignments, onReview, defaultFilter = 'all', forceLate, onBack }) {
  const [filter, setFilter] = useState(defaultFilter);
  const filtered = useMemo(() => {
    if (filter === 'ontime') return rows.filter((s) => !s.is_late);
    if (filter === 'late') return rows.filter((s) => s.is_late);
    return rows;
  }, [rows, filter]);

  return (
    <>
      <div className="topbar">
        <div>
          {onBack && <button className="btn-link" onClick={onBack}>← Back</button>}
          <h1 style={{ marginTop: onBack ? 6 : 0 }}>{title}</h1>
          <div className="sub">{subtitle}</div>
        </div>
      </div>
      {!forceLate && (
        <Tabs active={filter} onChange={setFilter} tabs={[
          { key: 'all', label: 'All', count: rows.length },
          { key: 'ontime', label: 'On time', count: rows.filter((s) => !s.is_late).length },
          { key: 'late', label: 'Late', count: rows.filter((s) => s.is_late).length },
        ]} />
      )}
      <div style={{ marginTop: 14 }}>
        <SubmissionTable rows={filtered} assignments={assignments} onReview={onReview} showAssignment />
      </div>
    </>
  );
}

function SubmissionTable({ rows, assignments, onReview, showAssignment }) {
  if (!rows.length) return <Card><Empty icon="📭" text="Koi submission nahi mili." /></Card>;
  return (
    <Card className="tight" style={{ padding: 0 }}>
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Student</th>
              {showAssignment && <th>Assignment</th>}
              <th>Submitted</th>
              <th>Status</th>
              <th>Marks</th>
              <th>File</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const a = assignments?.find((x) => x.id === s.assignment_id);
              return (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{s.student?.full_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{s.student?.roll_no}</div>
                  </td>
                  {showAssignment && <td style={{ maxWidth: 180 }}>{a?.title}</td>}
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(s.submitted_at)}</td>
                  <td><StatusBadge status={s.status} late={s.is_late} /></td>
                  <td>{s.marks != null ? `${s.marks}/${a?.max_marks ?? '—'}` : '—'}</td>
                  <td>{s.file_path ? <Btn size="sm" onClick={() => openFile('submission-files', s.file_path)}>Open</Btn> : <span className="muted">—</span>}</td>
                  <td><Btn size="sm" variant="primary" onClick={() => onReview(s)}>Review</Btn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================================================================== */
function MySchedule({ rows, profile }) {
  const [day, setDay] = useState(String(Math.max(0, Math.min(5, new Date().getDay() - 1))));
  const list = rows.filter((r) => r.day === Number(day) + 1);
  return (
    <>
      <div className="topbar"><div><h1>My Schedule</h1><div className="sub">{profile.full_name} — teaching slots</div></div></div>
      <Tabs tabs={DAYS_SHORT.map((d, i) => ({ key: String(i), label: d }))} active={day} onChange={setDay} />
      <div className="grid g3" style={{ marginTop: 16 }}>
        {list.length === 0 ? <Card style={{ gridColumn: '1/-1' }}><Empty icon="🗓️" text="Is din koi class nahi." /></Card> :
          list.map((c) => (
            <Card key={c.id} className="tight">
              <div className="between"><Badge kind="info">Slot {c.slot}</Badge><span className="hint">{c.start_time} – {c.end_time}</span></div>
              <div style={{ fontWeight: 800, marginTop: 10 }}>{c.subject?.name || c.label}</div>
              <div className="muted">{c.class?.name} · Section {c.section} {c.room ? `· ${c.room}` : ''}</div>
            </Card>
          ))}
      </div>
    </>
  );
}

/* ================================================================== */
function ProfileCard({ profile, stats, subjects, onChangePw, onLogout }) {
  return (
    <>
      <div className="topbar"><div><h1>My Profile</h1></div></div>
      <div className="grid g2">
        <Card>
          <div className="row" style={{ gap: 14, marginBottom: 16 }}>
            <div className="avatar big">{initials(profile.full_name)}</div>
            <div><div style={{ fontWeight: 800, fontSize: 17 }}>{profile.full_name}</div><div className="muted">Teacher</div></div>
          </div>
          <table className="tbl"><tbody>
            <tr><td>Login ID</td><td><b>{profile.username}</b></td></tr>
            <tr><td>Phone</td><td>{profile.phone || '—'}</td></tr>
            <tr><td>Subjects</td><td>{subjects.map((s) => s.name).join(', ') || '—'}</td></tr>
          </tbody></table>
          <div className="row" style={{ marginTop: 16 }}>
            <Btn variant="primary" onClick={onChangePw}>Change password</Btn>
            <Btn variant="danger" onClick={onLogout}>Logout</Btn>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Snapshot" />
          <div className="grid g2">
            <Stat label="Subjects" value={stats.subjects} />
            <Stat label="Assignments" value={stats.assignments} />
            <Stat label="To review" value={stats.pending} tone="warn" />
            <Stat label="Late" value={stats.latePending} tone="bad" />
          </div>
        </Card>
      </div>
    </>
  );
}

/* ================================================================== */
function NewAssignmentModal({ subjects, preset, teacherId, onClose, onDone }) {
  const [subjectId, setSubjectId] = useState(preset?.subject_id || subjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [marks, setMarks] = useState(10);
  const [allowLate, setAllowLate] = useState(true);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    if (!subjectId) return setErr('Subject select karein.');
    if (!title.trim()) return setErr('Title likhein.');
    if (!deadline) return setErr('Deadline select karein.');

    setBusy(true);
    try {
      let path = null, name = null;
      if (file) {
        path = `${subjectId}/${Date.now()}_${safeName(file.name)}`;
        await uploadFile('assignment-files', path, file);
        name = file.name;
      }
      const { error } = await supabase.from('assignments').insert({
        subject_id: subjectId,
        title: title.trim(),
        description: desc.trim() || null,
        deadline: new Date(deadline).toISOString(),
        max_marks: Number(marks) || 10,
        allow_late: allowLate,
        file_path: path,
        file_name: name,
        created_by: teacherId,
      });
      if (error) throw error;
      toast('Assignment ban gayi ✅');
      onDone();
    } catch (e) {
      setErr(e.message || 'Save fail');
    }
    setBusy(false);
  }

  return (
    <Modal open onClose={onClose} title="New assignment"
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Create assignment'}</Btn></>}>
      {err && <div className="err">{err}</div>}
      <Field label="Subject">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.class?.name} · {s.name}</option>)}
        </Select>
      </Field>
      <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Assignment 3 — Linked List" /></Field>
      <Field label="Description / instructions">
        <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Kya karna hai, kis format me file chahiye…" />
      </Field>
      <div className="grid g3">
        <Field label="Deadline"><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
        <Field label="Total marks"><Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} /></Field>
        <Field label="Late submission">
          <Select value={allowLate ? '1' : '0'} onChange={(e) => setAllowLate(e.target.value === '1')}>
            <option value="1">Allowed (alag section me)</option>
            <option value="0">Band (strict)</option>
          </Select>
        </Field>
      </div>
      <Field label="Attach question file (optional)"><input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
    </Modal>
  );
}

/* ================================================================== */
function ReviewModal({ sub, assignment, teacherId, onClose, onDone }) {
  const [marks, setMarks] = useState(sub.marks ?? '');
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function act(status) {
    setErr('');
    if (status === 'accepted' && marks !== '' && Number(marks) > (assignment?.max_marks || 100)) {
      return setErr(`Marks ${assignment?.max_marks} se zyada nahi ho sakte.`);
    }
    setBusy(true);
    const { error } = await supabase.from('submissions').update({
      status,
      marks: marks === '' ? null : Number(marks),
      feedback: feedback || null,
      reviewed_by: teacherId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', sub.id);
    setBusy(false);
    if (error) return setErr(error.message);
    toast(status === 'accepted' ? 'Submission accept ho gayi ✅' : 'Submission reject kar di gayi');
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Review submission"
      footer={
        <>
          <Btn onClick={onClose}>Close</Btn>
          <Btn variant="danger" onClick={() => act('rejected')} disabled={busy}>Reject</Btn>
          <Btn variant="primary" onClick={() => act('accepted')} disabled={busy}>{busy ? 'Saving…' : 'Accept'}</Btn>
        </>
      }>
      {err && <div className="err">{err}</div>}
      <div className="ok">
        <b>{sub.student?.full_name}</b> ({sub.student?.roll_no}) · {assignment?.title}
        <br />Submitted {fmtDateTime(sub.submitted_at)} {sub.is_late && <Badge kind="late">Late</Badge>}
      </div>
      {sub.note && <div className="hint" style={{ marginBottom: 12 }}><b>Student note:</b> {sub.note}</div>}
      <div className="row" style={{ marginBottom: 12 }}>
        <Btn size="sm" onClick={() => openFile('submission-files', sub.file_path)} disabled={!sub.file_path}>📎 Open submitted file</Btn>
        {assignment?.file_path && <Btn size="sm" onClick={() => openFile('assignment-files', assignment.file_path)}>Question file</Btn>}
      </div>
      <div className="grid g2">
        <Field label={`Marks (out of ${assignment?.max_marks ?? '—'})`}>
          <Input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="e.g. 8" />
        </Field>
        <Field label="Status"><Input value={sub.status} disabled /></Field>
      </div>
      <Field label="Feedback (student ko dikhega)">
        <TextArea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Achi koshish… ye improve karein…" />
      </Field>
    </Modal>
  );
}
