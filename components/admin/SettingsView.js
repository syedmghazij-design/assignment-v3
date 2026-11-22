'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { Btn, Card, Field, Input, SectionTitle } from '@/components/ui';

export default function SettingsView({ store, reload }) {
  const inst = store.settings?.institution || {};
  const roll = store.settings?.roll_pattern || {};
  const acad = store.settings?.academic || {};

  const [name, setName] = useState(inst.name || '');
  const [short, setShort] = useState(inst.short || '');
  const [tagline, setTagline] = useState(inst.tagline || '');
  const [prefix, setPrefix] = useState(roll.prefix || '26-ARID-');
  const [start, setStart] = useState(roll.start || 4700);
  const [session, setSession] = useState(acad.session || '');
  const [semester, setSemester] = useState(acad.current_semester || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const rows = [
      { key: 'institution', value: { name, short, tagline } },
      { key: 'roll_pattern', value: { prefix, start: Number(start) || 4700, pad: 0 } },
      { key: 'academic', value: { session, current_semester: semester } },
    ];
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    setBusy(false);
    if (error) return toast(error.message, 'err');
    toast('Settings save ho gayin ✅');
    reload();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Settings</h1><div className="sub">Institute ki basic details aur roll number pattern</div></div>
        <Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Btn>
      </div>

      <div className="grid g2">
        <Card>
          <SectionTitle title="Institute" sub="Login page aur dashboard per nazar aata hai" />
          <Field label="Institute name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid g2">
            <Field label="Short name"><Input value={short} onChange={(e) => setShort(e.target.value)} placeholder="GIMS" /></Field>
            <Field label="Tagline"><Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Assignment Portal" /></Field>
          </div>
          <div className="grid g2">
            <Field label="Academic session"><Input value={session} onChange={(e) => setSession(e.target.value)} placeholder="2026-2030" /></Field>
            <Field label="Current semester"><Input value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Fall 2026" /></Field>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Roll number pattern" sub="Bulk students add karte waqt ye pattern use hota hai" />
          <Field label="Prefix" hint="Jaise: 26-ARID-  →  roll number 26-ARID-4700 banega">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="26-ARID-" />
          </Field>
          <Field label="Starting number" hint="Agla roll number isi se shuru hoga (auto-suggest)">
            <Input type="number" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <div className="ok" style={{ marginTop: 10 }}>
            Preview: <b>{prefix}{(Number(start) || 4700)}</b>, <b>{prefix}{(Number(start) || 4700) + 1}</b>, …
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            Note: roll number har student ka unique hota hai — login ID bhi wahi hota hai.
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle title="Security" sub="Admin login aur passwords" />
        <div className="stack">
          <div className="ok">
            Admin login ID: <b>admin@gims</b> — password change karne ke liye sidebar me “Change password” dabayen.
          </div>
          <div className="hint">
            Students aur teachers ke passwords admin panel me (Students / Teachers section) dikhte hain.
            Jab wo khud password change karein, admin panel me naya password automatically update ho jata hai.
          </div>
          <div className="hint">
            ⚠️ Service role key sirf Vercel ke Environment Variables me rakhein — kisi ke sath share na karein.
          </div>
        </div>
      </Card>
    </>
  );
}
