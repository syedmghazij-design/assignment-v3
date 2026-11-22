'use client';

import { useEffect, useState } from 'react';

/* ------------------------------- BUTTON ------------------------------- */
export function Btn({ variant = 'ghost', size, className = '', children, ...props }) {
  const cls = ['btn', variant !== 'ghost' ? `btn-${variant}` : 'btn-ghost', size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

/* -------------------------------- CARD -------------------------------- */
export function Card({ className = '', children, style, ...rest }) {
  return (
    <div className={`card ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, right }) {
  return (
    <div className="between" style={{ marginBottom: 14 }}>
      <div>
        <h3 style={{ fontSize: 16.5 }}>{title}</h3>
        {sub && <div className="muted" style={{ marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* -------------------------------- STAT -------------------------------- */
export function Stat({ label, value, hint, tone = '', onClick }) {
  return (
    <div className={`stat ${tone}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <i className="bar" />
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {hint && <div className="h">{hint}</div>}
    </div>
  );
}

/* ------------------------------- BADGES ------------------------------- */
export function Badge({ children, kind = 'gray' }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function StatusBadge({ status, late }) {
  const map = {
    pending: { kind: 'pending', text: 'Pending review' },
    accepted: { kind: 'accepted', text: 'Accepted' },
    rejected: { kind: 'rejected', text: 'Rejected' },
    notSubmitted: { kind: 'gray', text: 'Not submitted' },
  };
  const s = map[status] || map.notSubmitted;
  return (
    <span className="row" style={{ gap: 6 }}>
      <Badge kind={s.kind}>{s.text}</Badge>
      {late && <Badge kind="late">Late</Badge>}
    </span>
  );
}

/* -------------------------------- TABS -------------------------------- */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? 'active' : ''}`}
          onClick={() => onChange(t.key)}
          type="button"
        >
          {t.label}
          {t.count !== undefined && t.count !== null ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- MODAL ------------------------------- */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    function esc(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* -------------------------------- FORM -------------------------------- */
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}
export function Select({ children, ...props }) {
  return (
    <select className="input" {...props}>
      {children}
    </select>
  );
}
export function TextArea(props) {
  return <textarea className="input" {...props} />;
}

/* -------------------------------- MISC -------------------------------- */
export function Empty({ icon = '📭', text = 'Yahan abhi kuch nahi hai' }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      {text}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function Progress({ value = 0 }) {
  return (
    <div className="progress">
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function on(e) {
      const id = Math.random().toString(36).slice(2);
      setItems((p) => [...p, { id, ...e.detail }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3800);
    }
    window.addEventListener('gims-toast', on);
    return () => window.removeEventListener('gims-toast', on);
  }, []);
  return (
    <div className="toaster">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type === 'err' ? 'err' : t.type === 'warn' ? 'warn' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
