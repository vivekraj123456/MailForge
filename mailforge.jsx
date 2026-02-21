import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Google Fonts ────────────────────────────────────────────────────────────
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  `}</style>
);

// ─── Design System Tokens ───────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:       #0c0d10;
    --surface:  #13141a;
    --surface2: #1c1e27;
    --border:   #2a2d3a;
    --border2:  #363a4d;
    --text:     #e8e9f0;
    --muted:    #7a7d94;
    --accent:   #d4a847;
    --accent2:  #f0c96b;
    --red:      #e05c5c;
    --green:    #4caf7d;
    --blue:     #5b8dee;
    --purple:   #9b72ef;
    --font-head: 'DM Serif Display', serif;
    --font-body: 'Instrument Sans', sans-serif;
    --font-mono: 'DM Mono', monospace;
    --r: 8px;
    --r2: 12px;
    --shadow: 0 4px 24px rgba(0,0,0,0.5);
    --shadow2: 0 8px 40px rgba(0,0,0,0.7);
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 14px; }
  button { font-family: var(--font-body); cursor: pointer; border: none; background: none; color: inherit; }
  input, textarea, select { font-family: var(--font-body); font-size: 14px; color: var(--text); background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r); padding: 8px 12px; width: 100%; outline: none; transition: border 0.2s; }
  input:focus, textarea:focus, select:focus { border-color: var(--accent); }
  select option { background: var(--surface2); }
  textarea { resize: vertical; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .tag-gold { background: rgba(212,168,71,0.15); color: var(--accent2); }
  .tag-green { background: rgba(76,175,125,0.15); color: var(--green); }
  .tag-red { background: rgba(224,92,92,0.15); color: var(--red); }
  .tag-blue { background: rgba(91,141,238,0.15); color: var(--blue); }
  .tag-muted { background: rgba(122,125,148,0.15); color: var(--muted); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: var(--r); font-size: 13px; font-weight: 500; transition: all 0.2s; white-space: nowrap; }
  .btn-primary { background: var(--accent); color: #0c0d10; }
  .btn-primary:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(212,168,71,0.3); }
  .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .btn-ghost:hover { color: var(--text); border-color: var(--border2); background: var(--surface2); }
  .btn-danger { background: rgba(224,92,92,0.1); color: var(--red); border: 1px solid rgba(224,92,92,0.2); }
  .btn-danger:hover { background: rgba(224,92,92,0.2); }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r2); }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease forwards; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .pulse { animation: pulse 1.5s ease infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }
`;

// ─── Utilities ───────────────────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const fmt = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

function extractVariables(html) {
  const matches = html.match(/\{\{([a-zA-Z0-9_]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

function renderTemplate(html, data, fields) {
  let result = html;
  for (const field of fields) {
    const val = data[field.variable_key] ?? field.default_value ?? '';
    let formatted = val;
    if (field.input_type === 'date' && val) {
      try { formatted = fmtDate(val); } catch {}
    }
    const escaped = String(formatted).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    result = result.replace(new RegExp(`\\{\\{${field.variable_key}\\}\\}`, 'g'), escaped);
  }
  // highlight unmapped
  result = result.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, '<mark style="background:rgba(224,92,92,0.3);color:#e05c5c;padding:1px 4px;border-radius:3px;">{{$1}}</mark>');
  return result;
}

// ─── Default Data ────────────────────────────────────────────────────────────
const SAMPLE_TEMPLATE_HTML = `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <tr>
    <td style="padding:40px 48px 24px;border-bottom:2px solid #1a1a2e;">
      <p style="font-size:12px;letter-spacing:0.12em;color:#888;text-transform:uppercase;margin:0 0 8px;">Interview Invitation</p>
      <h1 style="font-size:28px;color:#1a1a2e;margin:0;font-weight:normal;">Dear {{recipient_name}},</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 48px;">
      <p style="color:#333;line-height:1.8;font-size:15px;">Thank you for your interest in the <strong>{{job_role}}</strong> position at <strong>{{company_name}}</strong>. We have carefully reviewed your application and are pleased to invite you for an interview.</p>
      <p style="color:#333;line-height:1.8;font-size:15px;margin-top:16px;">We would like to schedule a conversation by <strong>{{followup_date}}</strong> to discuss your background and this exciting opportunity in more detail.</p>
      <div style="margin:32px 0;padding:24px;background:#f8f8fc;border-left:3px solid #1a1a2e;border-radius:0 6px 6px 0;">
        <p style="color:#555;font-size:14px;line-height:1.7;margin:0;">{{custom_note}}</p>
      </div>
      <p style="color:#333;line-height:1.8;font-size:15px;">Please reply to this email to confirm your availability or suggest an alternative time that works best for you.</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 48px 40px;border-top:1px solid #eee;">
      <p style="color:#888;font-size:13px;margin:0;">Warm regards,<br><strong style="color:#1a1a2e;">{{sender_name}}</strong><br><em>{{sender_title}}</em></p>
    </td>
  </tr>
</table>`;

const SAMPLE_FIELDS = [
  { id: genId(), variable_key: 'recipient_name', label: 'Candidate Full Name', input_type: 'text', required: true, default_value: '', placeholder: 'e.g. Alice Johnson', sort_order: 0 },
  { id: genId(), variable_key: 'job_role', label: 'Position Applied For', input_type: 'dropdown', required: true, default_value: 'Software Engineer', options: 'Software Engineer\nProduct Manager\nData Analyst\nUX Designer', sort_order: 1 },
  { id: genId(), variable_key: 'company_name', label: 'Company Name', input_type: 'text', required: true, default_value: 'Acme Corp', placeholder: 'e.g. Acme Corp', sort_order: 2 },
  { id: genId(), variable_key: 'followup_date', label: 'Follow-Up Date', input_type: 'date', required: true, default_value: '', sort_order: 3 },
  { id: genId(), variable_key: 'custom_note', label: 'Personalized Note', input_type: 'textarea', required: false, default_value: 'We were particularly impressed by your experience in building scalable systems.', placeholder: 'Add a personal touch...', sort_order: 4 },
  { id: genId(), variable_key: 'sender_name', label: 'Your Name', input_type: 'text', required: true, default_value: '', placeholder: 'e.g. Sarah Chen', sort_order: 5 },
  { id: genId(), variable_key: 'sender_title', label: 'Your Title', input_type: 'text', required: false, default_value: 'Head of Talent Acquisition', placeholder: 'e.g. Hiring Manager', sort_order: 6 },
];

const INITIAL_TEMPLATES = [
  { id: 'tmpl_001', name: 'Interview Invitation', description: 'Professional recruitment outreach for interview scheduling', subject: 'Interview Invitation – {{recipient_name}} | {{job_role}} at {{company_name}}', html: SAMPLE_TEMPLATE_HTML, status: 'active', created_at: new Date(Date.now()-86400000*3).toISOString(), updated_at: new Date(Date.now()-86400000).toISOString() },
];

const INITIAL_FORMS = {
  'tmpl_001': { fields: SAMPLE_FIELDS }
};

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    template: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
    form: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6"/></svg>,
    send: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>,
    logs: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>,
    plus: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>,
    trash: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>,
    edit: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>,
    eye: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    copy: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.375"/></svg>,
    arrow: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>,
    check: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>,
    warning: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
    drag: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"/></svg>,
    code: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>,
    dash: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>,
    mail: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>,
    close: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
    var: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"/></svg>,
    up: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>,
    down: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>,
    refresh: <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>,
  };
  return icons[name] || null;
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, templates, openSend }) {
  const nav = [
    { key: 'dashboard', icon: 'dash', label: 'Dashboard' },
    { key: 'templates', icon: 'template', label: 'Templates' },
    { key: 'logs', icon: 'logs', label: 'Send History' },
  ];
  return (
    <div style={{ width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0 }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={16} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 16, color: 'var(--text)', lineHeight: 1 }}>MailForge</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 2 }}>EMAIL AUTOMATION</div>
          </div>
        </div>
      </div>
      <nav style={{ padding: '12px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', padding: '4px 8px 8px', textTransform: 'uppercase' }}>Navigation</div>
        {nav.map(item => (
          <button key={item.key} onClick={() => setView(item.key)} className="btn" style={{
            width: '100%', justifyContent: 'flex-start', gap: 10, padding: '9px 10px', marginBottom: 2,
            background: view === item.key ? 'rgba(212,168,71,0.1)' : 'transparent',
            color: view === item.key ? 'var(--accent)' : 'var(--muted)',
            borderRadius: 'var(--r)', border: 'none', fontSize: 13, fontWeight: view === item.key ? 600 : 400,
          }}>
            <Icon name={item.icon} size={15} />{item.label}
          </button>
        ))}
        {templates.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', padding: '16px 8px 8px', textTransform: 'uppercase' }}>Quick Send</div>
            {templates.filter(t => t.status === 'active').map(t => (
              <button key={t.id} onClick={() => openSend(t.id)} className="btn" style={{
                width: '100%', justifyContent: 'flex-start', gap: 10, padding: '7px 10px', marginBottom: 2,
                background: view === `send_${t.id}` ? 'rgba(212,168,71,0.1)' : 'transparent',
                color: view === `send_${t.id}` ? 'var(--accent)' : 'var(--muted)',
                borderRadius: 'var(--r)', border: 'none', fontSize: 12,
              }}>
                <Icon name="send" size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
              </button>
            ))}
          </>
        )}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Workspace</div>
        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>Personal Account</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Free Plan</div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ templates, logs, setView, openSend }) {
  const sent = logs.filter(l => l.status === 'sent').length;
  const stats = [
    { label: 'Templates', value: templates.length, sub: `${templates.filter(t=>t.status==='active').length} active`, color: 'var(--accent)' },
    { label: 'Emails Sent', value: sent, sub: 'this session', color: 'var(--green)' },
    { label: 'Send History', value: logs.length, sub: 'total records', color: 'var(--blue)' },
  ];
  return (
    <div className="fade-in" style={{ padding: 40, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 36, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>Good morning,</h1>
        <p style={{ color: 'var(--muted)', fontSize: 15 }}>Your email automation workspace is ready.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: 28 }}>
            <div style={{ fontSize: 36, fontFamily: 'var(--font-mono)', color: s.color, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Your Templates</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setView('templates')}><Icon name="arrow" size={12} style={{transform:'rotate(180deg)'}}/> View all</button>
          </div>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <Icon name="template" size={32} />
              <p style={{ marginTop: 12, fontSize: 13 }}>No templates yet</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setView('templates')}><Icon name="plus" size={12}/> Create one</button>
            </div>
          ) : templates.map(t => (
            <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }} >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{fmt(t.updated_at)}</div>
              </div>
              <span className={`tag ${t.status==='active'?'tag-green':'tag-muted'}`}>{t.status}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => openSend(t.id)}><Icon name="send" size={12}/></button>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Recent Sends</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setView('logs')}>View all</button>
          </div>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <Icon name="mail" size={32} />
              <p style={{ marginTop: 12, fontSize: 13 }}>No emails sent yet</p>
            </div>
          ) : logs.slice(-5).reverse().map(l => (
            <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.to_email}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{l.subject?.slice(0,40)}...</div>
              </div>
              <span className={`tag ${l.status==='sent'?'tag-green':'tag-red'}`}>{l.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Templates List ───────────────────────────────────────────────────────────
function TemplatesList({ templates, setTemplates, forms, setForms, setView, openSend }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const create = () => {
    if (!newName.trim()) return;
    const id = `tmpl_${genId()}`;
    const tmpl = { id, name: newName.trim(), description: newDesc.trim(), subject: `Hello {{recipient_name}}`, html: `<p style="font-family:Georgia,serif;font-size:16px;color:#333;line-height:1.8;">Dear {{recipient_name}},</p>\n<p style="font-family:Georgia,serif;font-size:16px;color:#333;line-height:1.8;margin-top:16px;">Thank you for reaching out.</p>\n<p style="font-family:Georgia,serif;font-size:16px;color:#555;margin-top:32px;">Best regards,<br>{{sender_name}}</p>`, status: 'active', created_at: now(), updated_at: now() };
    const defaultFields = [
      { id: genId(), variable_key: 'recipient_name', label: 'Recipient Name', input_type: 'text', required: true, default_value: '', placeholder: '', sort_order: 0 },
      { id: genId(), variable_key: 'sender_name', label: 'Your Name', input_type: 'text', required: true, default_value: '', placeholder: '', sort_order: 1 },
    ];
    setTemplates(prev => [...prev, tmpl]);
    setForms(prev => ({ ...prev, [id]: { fields: defaultFields } }));
    setNewName(''); setNewDesc(''); setCreating(false);
    setView(`edit_${id}`);
  };

  const del = (id) => { setTemplates(prev => prev.filter(t => t.id !== id)); setForms(prev => { const f = {...prev}; delete f[id]; return f; }); };
  const duplicate = (t) => {
    const id = `tmpl_${genId()}`;
    const copy = { ...t, id, name: `${t.name} (copy)`, created_at: now(), updated_at: now() };
    setTemplates(prev => [...prev, copy]);
    setForms(prev => ({ ...prev, [id]: prev[t.id] ? { fields: prev[t.id].fields.map(f => ({...f, id: genId()})) } : { fields: [] } }));
  };

  return (
    <div className="fade-in" style={{ padding: 40, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 32, fontWeight: 400, color: 'var(--text)' }}>Email Templates</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={14}/> New Template</button>
      </div>
      {creating && (
        <div className="card fade-in" style={{ padding: 24, marginBottom: 24, borderColor: 'var(--accent)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>New Template</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Template Name *</label><input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Follow-up Email" onKeyDown={e => e.key === 'Enter' && create()} /></div>
            <div><label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Description</label><input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this template for?" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={create} disabled={!newName.trim()}>Create & Edit</button>
            <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}
      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
          <Icon name="template" size={48} />
          <p style={{ marginTop: 16, fontSize: 16 }}>No templates yet. Create your first one.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {templates.map(t => {
            const varCount = extractVariables(t.html).length;
            return (
              <div key={t.id} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.2s', ':hover': { borderColor: 'var(--border2)' } }}>
                <div style={{ width: 44, height: 44, background: 'rgba(212,168,71,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="template" size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
                    <span className={`tag ${t.status==='active'?'tag-green':'tag-muted'}`}>{t.status}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{t.description || 'No description'}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
                    <span><span className="tag tag-gold" style={{ marginRight: 4 }}>{varCount} vars</span></span>
                    <span>Updated {fmt(t.updated_at)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openSend(t.id)}><Icon name="send" size={13}/> Send</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setView(`edit_${t.id}`)}><Icon name="edit" size={13}/> Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setView(`form_${t.id}`)}><Icon name="form" size={13}/> Form</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => duplicate(t)} title="Duplicate"><Icon name="copy" size={13}/></button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(t.id)} title="Delete"><Icon name="trash" size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Variable Panel ───────────────────────────────────────────────────────────
// Fully editable: rename detected vars (renames all occurrences in HTML+subject),
// delete them, add new ones, and manage the quick-insert preset list.
const DEFAULT_QUICK = ['recipient_name','company_name','job_role','followup_date','sender_name','sender_title','custom_note'];

function VariablePanel({ allVars, html, subject, setHtml, setSubject, insertVar, templateId, setView }) {
  // editing state for detected vars: { [varKey]: draftName }
  const [editing, setEditing]   = useState({});
  // quick insert list — user can add / rename / delete
  const [quickList, setQuickList] = useState(DEFAULT_QUICK);
  const [editingQ, setEditingQ]   = useState({}); // { [idx]: draft }
  const [newVarDraft, setNewVarDraft] = useState('');
  const [newQDraft,   setNewQDraft]   = useState('');
  const [addingVar,   setAddingVar]   = useState(false);
  const [addingQ,     setAddingQ]     = useState(false);

  // ── helpers ────────────────────────────────────────────────────────────────
  const sanitizeKey = s => s.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

  // rename a variable everywhere in html + subject
  const renameVar = (oldKey, newKey) => {
    newKey = sanitizeKey(newKey);
    if (!newKey || newKey === oldKey) return;
    const re = new RegExp(`\\{\\{${oldKey}\\}\\}`, 'g');
    setHtml(h => h.replace(re, `{{${newKey}}}`));
    setSubject(s => s.replace(re, `{{${newKey}}}`));
  };

  // remove a variable everywhere
  const deleteVar = (key) => {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    setHtml(h => h.replace(re, ''));
    setSubject(s => s.replace(re, ''));
  };

  // commit rename on Enter / blur
  const commitRename = (oldKey) => {
    const draft = (editing[oldKey] ?? '').trim();
    if (draft && draft !== oldKey) renameVar(oldKey, draft);
    setEditing(e => { const n={...e}; delete n[oldKey]; return n; });
  };

  // add a brand-new variable token to quick list
  const commitNewVar = () => {
    const k = sanitizeKey(newVarDraft);
    if (!k) return;
    insertVar(k);
    setNewVarDraft(''); setAddingVar(false);
  };

  const commitNewQ = () => {
    const k = sanitizeKey(newQDraft);
    if (!k || quickList.includes(k)) { setNewQDraft(''); setAddingQ(false); return; }
    setQuickList(l => [...l, k]);
    setNewQDraft(''); setAddingQ(false);
  };

  const commitQRename = (idx) => {
    const draft = sanitizeKey(editingQ[idx] ?? '');
    if (draft && draft !== quickList[idx]) setQuickList(l => l.map((v,i) => i===idx ? draft : v));
    setEditingQ(e => { const n={...e}; delete n[idx]; return n; });
  };

  const deleteQ = (idx) => setQuickList(l => l.filter((_,i) => i!==idx));

  const inputStyle = (focused) => ({
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent2)',
    background: focused ? 'var(--bg)' : 'transparent',
    border: focused ? '1px solid var(--accent)' : '1px solid transparent',
    borderRadius: 4, padding: '1px 4px', width: '100%', outline: 'none',
  });

  const S = { panel: { width: 260, borderLeft: '1px solid var(--border)', background: 'var(--surface)', overflow: 'auto', padding: '20px 16px', flexShrink: 0 } };

  return (
    <div style={S.panel}>

      {/* ── DETECTED VARIABLES ─────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Detected Variables</div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding:'2px 6px', fontSize:10, gap:3 }}
          onClick={() => setAddingVar(v => !v)}
          title="Add a new variable"
        ><Icon name="plus" size={11}/> Add</button>
      </div>

      {/* new var input */}
      {addingVar && (
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          <input
            autoFocus
            value={newVarDraft}
            onChange={e => setNewVarDraft(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') commitNewVar(); if(e.key==='Escape'){setNewVarDraft('');setAddingVar(false);} }}
            placeholder="variable_name"
            style={{ fontFamily:'var(--font-mono)', fontSize:11, flex:1, padding:'5px 8px' }}
          />
          <button className="btn btn-primary btn-sm" style={{padding:'4px 8px'}} onClick={commitNewVar}><Icon name="check" size={11}/></button>
          <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={()=>{setNewVarDraft('');setAddingVar(false);}}><Icon name="close" size={11}/></button>
        </div>
      )}

      {allVars.length === 0 ? (
        <div style={{ color:'var(--muted)', fontSize:12, textAlign:'center', padding:'28px 0', lineHeight:1.7 }}>
          No variables yet.<br/>
          <span style={{fontSize:11}}>Type <code style={{fontFamily:'var(--font-mono)',color:'var(--accent2)'}}>{'{{name}}'}</code> in the editor</span>
        </div>
      ) : allVars.map(v => {
        const isEditing = v in editing;
        return (
          <div key={v} style={{ background:'var(--surface2)', borderRadius:'var(--r)', marginBottom:6, overflow:'hidden', border:`1px solid ${isEditing ? 'var(--accent)' : 'var(--border)'}`, transition:'border 0.15s' }}>
            {/* header row */}
            <div style={{ padding:'7px 10px', display:'flex', alignItems:'center', gap:6 }}>
              <Icon name="var" size={12} />
              {isEditing ? (
                <input
                  autoFocus
                  value={editing[v]}
                  onChange={e => setEditing(ed => ({...ed, [v]: e.target.value}))}
                  onKeyDown={e => { if(e.key==='Enter') commitRename(v); if(e.key==='Escape') setEditing(ed=>{const n={...ed};delete n[v];return n;}); }}
                  onBlur={() => commitRename(v)}
                  style={inputStyle(true)}
                />
              ) : (
                <code
                  style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent2)', flex:1, cursor:'text', padding:'1px 4px', borderRadius:4, border:'1px solid transparent' }}
                  title="Click to rename"
                  onClick={() => setEditing(ed => ({...ed, [v]: v}))}
                >{v}</code>
              )}
              {isEditing ? (
                <button className="btn btn-primary btn-sm" style={{padding:'2px 5px',fontSize:10}} onMouseDown={()=>commitRename(v)} title="Confirm rename"><Icon name="check" size={10}/></button>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{padding:'2px 5px',fontSize:10}} onClick={()=>setEditing(ed=>({...ed,[v]:v}))} title="Rename"><Icon name="edit" size={10}/></button>
              )}
              <button className="btn btn-danger btn-sm" style={{padding:'2px 5px',fontSize:10}} onClick={()=>deleteVar(v)} title={`Remove all {{${v}}} from template`}><Icon name="trash" size={10}/></button>
            </div>
            {/* action row */}
            {!isEditing && (
              <div style={{ padding:'0 10px 7px', display:'flex', gap:4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex:1, fontSize:10, padding:'3px 0', justifyContent:'center', color:'var(--muted)' }}
                  onClick={() => insertVar(v)}
                  title="Insert at cursor"
                ><Icon name="plus" size={10}/> insert</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex:1, fontSize:10, padding:'3px 0', justifyContent:'center', color:'var(--muted)' }}
                  onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); }}
                  title="Copy to clipboard"
                ><Icon name="copy" size={10}/> copy</button>
              </div>
            )}
          </div>
        );
      })}

      {/* ── QUICK INSERT ───────────────────────────────────────────── */}
      <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Quick Insert</div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding:'2px 6px', fontSize:10, gap:3 }}
            onClick={() => setAddingQ(q => !q)}
            title="Add preset variable"
          ><Icon name="plus" size={11}/> Add</button>
        </div>

        {addingQ && (
          <div style={{ display:'flex', gap:4, marginBottom:8 }}>
            <input
              autoFocus
              value={newQDraft}
              onChange={e => setNewQDraft(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter') commitNewQ(); if(e.key==='Escape'){setNewQDraft('');setAddingQ(false);} }}
              placeholder="preset_name"
              style={{ fontFamily:'var(--font-mono)', fontSize:11, flex:1, padding:'5px 8px' }}
            />
            <button className="btn btn-primary btn-sm" style={{padding:'4px 8px'}} onClick={commitNewQ}><Icon name="check" size={11}/></button>
            <button className="btn btn-ghost btn-sm" style={{padding:'4px 8px'}} onClick={()=>{setNewQDraft('');setAddingQ(false);}}><Icon name="close" size={11}/></button>
          </div>
        )}

        {quickList.filter(v => !allVars.includes(v)).length === 0 && !addingQ && (
          <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', padding:'12px 0' }}>All presets already in template</div>
        )}

        {quickList.filter(v => !allVars.includes(v)).map((v, rawIdx) => {
          const idx = quickList.indexOf(v);
          const isEditingQ = idx in editingQ;
          return (
            <div key={v} style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4, padding:'4px 8px', borderRadius:'var(--r)', background:'var(--surface2)', border:`1px solid ${isEditingQ?'var(--accent)':'var(--border)'}`, transition:'border 0.15s' }}>
              {isEditingQ ? (
                <>
                  <input
                    autoFocus
                    value={editingQ[idx]}
                    onChange={e => setEditingQ(eq=>({...eq,[idx]:e.target.value}))}
                    onKeyDown={e => { if(e.key==='Enter') commitQRename(idx); if(e.key==='Escape') setEditingQ(eq=>{const n={...eq};delete n[idx];return n;}); }}
                    onBlur={() => commitQRename(idx)}
                    style={{ fontFamily:'var(--font-mono)', fontSize:11, flex:1, background:'transparent', border:'none', color:'var(--accent2)', outline:'none' }}
                  />
                  <button className="btn btn-primary btn-sm" style={{padding:'2px 5px'}} onMouseDown={()=>commitQRename(idx)}><Icon name="check" size={10}/></button>
                </>
              ) : (
                <>
                  <button
                    style={{ flex:1, background:'none', border:'none', textAlign:'left', cursor:'pointer', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--muted)', padding:0 }}
                    onClick={() => insertVar(v)}
                    title={`Insert {{${v}}}`}
                  ><Icon name="plus" size={10}/> {v}</button>
                  <button className="btn btn-ghost btn-sm" style={{padding:'2px 4px'}} onClick={()=>setEditingQ(eq=>({...eq,[idx]:v}))} title="Rename preset"><Icon name="edit" size={10}/></button>
                  <button className="btn btn-danger btn-sm" style={{padding:'2px 4px'}} onClick={()=>deleteQ(idx)} title="Remove preset"><Icon name="trash" size={10}/></button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* ── NAV BUTTONS ────────────────────────────────────────────── */}
      <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6 }}>
        <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={() => setView(`form_${templateId}`)}><Icon name="form" size={13}/> Build Form</button>
        <button className="btn btn-primary btn-sm" style={{ width:'100%' }} onClick={() => setView(`send_${templateId}`) }><Icon name="send" size={13}/> Open Send Console</button>
      </div>
    </div>
  );
}

// ─── WYSIWYG Rich Text Editor ─────────────────────────────────────────────────
// Uses iframe + designMode so the browser handles paste 100% natively.
// MutationObserver fires AFTER the DOM is fully settled (unlike `input` which fires before).
// The full document outerHTML is captured so every <style> block survives into preview.
function RichEditor({ html, onChange, onVarInsert }) {
  const iframeRef  = useRef(null);
  const seedHtml   = useRef(html);   // initial value, never changes
  const onChgRef   = useRef(onChange);
  onChgRef.current = onChange;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function boot() {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // ── write a complete, standalone document ──────────────────────────────
      // NO base-reset CSS — we want whatever the pasted content brings to win.
      // Only minimal body padding so the editor feels comfortable.
      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    margin: 0;
    padding: 24px 32px;
    outline: none;
    min-height: 100vh;
    box-sizing: border-box;
    /* No font/color defaults — let pasted content own everything */
  }
  /* Cursor blink in empty editor */
  body:empty::before { content: 'Paste or type your email here…'; color: #aaa; }
</style>
</head>
<body>${seedHtml.current}</body>
</html>`);
      doc.close();
      doc.designMode = 'on';

      // ── emit helper ────────────────────────────────────────────────────────
      // We capture body.innerHTML (not outerHTML) as the template source.
      // All pasted <style> blocks land inside body when pasted from rich sources,
      // so they travel with the content.
      const emit = () => {
        if (doc.body) onChgRef.current(doc.body.innerHTML);
      };

      // ── MutationObserver: the ONLY reliable post-paste hook ────────────────
      // The browser finishes inserting paste nodes, then calls our observer.
      // `input` and `keyup` fire too early during paste — observer fires after.
      const mo = new MutationObserver(emit);
      mo.observe(doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      // Also capture on paste event with a 0ms delay as belt-and-suspenders.
      // Some browsers batch large paste operations and MO fires mid-batch.
      const onPaste = () => setTimeout(emit, 0);
      doc.addEventListener('paste', onPaste);

      // Normal keyboard edits
      doc.addEventListener('keyup', emit);

      return () => {
        mo.disconnect();
        doc.removeEventListener('paste', onPaste);
        doc.removeEventListener('keyup', emit);
      };
    }

    const doc = iframe.contentDocument;
    let cleanup;
    if (doc && (doc.readyState === 'complete' || doc.readyState === 'interactive')) {
      cleanup = boot();
    } else {
      const onLoad = () => { cleanup = boot(); };
      iframe.addEventListener('load', onLoad, { once: true });
      return () => iframe.removeEventListener('load', onLoad);
    }
    return () => cleanup?.();
  }, []);

  // Variable insertion into the iframe's selection
  useEffect(() => {
    if (!onVarInsert) return;
    onVarInsert.current = (key) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      iframeRef.current.contentWindow.focus();
      doc.execCommand('insertText', false, `{{${key}}}`);
      if (doc.body) onChgRef.current(doc.body.innerHTML);
    };
  });

  // Toolbar execCommand — runs inside iframe context
  const exec = useCallback((cmd, val = null) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    iframeRef.current.contentWindow.focus();
    doc.execCommand(cmd, false, val);
    if (doc.body) onChgRef.current(doc.body.innerHTML);
  }, []);

  const Div = () => <div style={{ width:1, height:18, background:'var(--border)', margin:'0 3px', flexShrink:0 }}/>;

  const TB = ({ cmd, val, title, children, red }) => (
    <button onMouseDown={e => { e.preventDefault(); exec(cmd, val); }} title={title}
      style={{ padding:'4px 7px', background:'transparent', border:'none', color: red?'var(--red)':'var(--text)',
               cursor:'pointer', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, flexShrink:0 }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--border2)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
    >{children}</button>
  );

  const selStyle = { padding:'3px 5px', fontSize:11, background:'var(--surface)', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', height:26 };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', border:'1px solid var(--border)', borderRadius:'var(--r)' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:1, padding:'5px 8px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', flexWrap:'wrap', flexShrink:0 }}>
        <TB cmd="bold"          title="Bold (Ctrl+B)"><b style={{fontSize:13}}>B</b></TB>
        <TB cmd="italic"        title="Italic (Ctrl+I)"><i style={{fontSize:13}}>I</i></TB>
        <TB cmd="underline"     title="Underline (Ctrl+U)"><u style={{fontSize:13}}>U</u></TB>
        <TB cmd="strikeThrough" title="Strikethrough"><s style={{fontSize:12}}>S</s></TB>
        <Div/>
        <TB cmd="justifyLeft"   title="Align left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="17" y2="18"/></svg>
        </TB>
        <TB cmd="justifyCenter" title="Centre">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/></svg>
        </TB>
        <TB cmd="justifyRight"  title="Align right">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="7" y1="18" x2="21" y2="18"/></svg>
        </TB>
        <Div/>
        <TB cmd="insertUnorderedList" title="Bullet list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </TB>
        <TB cmd="insertOrderedList" title="Numbered list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="9" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2" y="15" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2" y="21" fontSize="7" fill="currentColor" stroke="none">3</text></svg>
        </TB>
        <TB cmd="indent"  title="Indent">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><polyline points="3,9 7,12 3,15"/></svg>
        </TB>
        <TB cmd="outdent" title="Outdent">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><polyline points="7,9 3,12 7,15"/></svg>
        </TB>
        <Div/>
        <select onMouseDown={e=>e.stopPropagation()} onChange={e=>{exec('formatBlock',e.target.value);e.target.value='';}} defaultValue="" style={selStyle}>
          <option value="" disabled>Style</option>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Blockquote</option>
          <option value="pre">Preformatted</option>
        </select>
        <select onMouseDown={e=>e.stopPropagation()} onChange={e=>{exec('fontSize',e.target.value);e.target.value='';}} defaultValue="" style={selStyle}>
          <option value="" disabled>Size</option>
          {['10','12','14','16','18','24','32','48'].map((sz,i)=><option key={sz} value={i+1}>{sz}px</option>)}
        </select>
        <label title="Text colour" style={{display:'flex',alignItems:'center',gap:2,cursor:'pointer'}}>
          <span style={{fontSize:11,color:'var(--muted)',userSelect:'none'}}>A</span>
          <input type="color" defaultValue="#000000" onChange={e=>exec('foreColor',e.target.value)}
            style={{width:20,height:20,padding:1,border:'1px solid var(--border)',borderRadius:3,cursor:'pointer',background:'none'}}/>
        </label>
        <label title="Highlight" style={{display:'flex',alignItems:'center',gap:2,cursor:'pointer'}}>
          <span style={{fontSize:10,color:'var(--muted)',userSelect:'none'}}>▣</span>
          <input type="color" defaultValue="#ffff00" onChange={e=>exec('hiliteColor',e.target.value)}
            style={{width:20,height:20,padding:1,border:'1px solid var(--border)',borderRadius:3,cursor:'pointer',background:'none'}}/>
        </label>
        <Div/>
        <TB cmd="removeFormat" title="Clear formatting" red>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/><line x1="17" y1="7" x2="7" y2="17" stroke="var(--red)" strokeWidth="2.5"/></svg>
        </TB>
        <div style={{flex:1}}/>
        <span style={{fontSize:10,color:'var(--accent)',fontFamily:'var(--font-mono)',padding:'2px 8px',background:'rgba(212,168,71,0.08)',borderRadius:4,border:'1px solid rgba(212,168,71,0.18)',whiteSpace:'nowrap'}}>
          ✓ spaces · tables · lines · colours preserved
        </span>
      </div>

      {/* The iframe — browser owns paste completely */}
      <iframe
        ref={iframeRef}
        title="rich-editor"
        style={{ flex:1, border:'none', width:'100%', minHeight:0, display:'block', background:'#fff' }}
      />
    </div>
  );
}

// ─── Template Editor ──────────────────────────────────────────────────────────
function TemplateEditor({ template, setTemplates, setView, openSend }) {
  const [html, setHtml] = useState(template.html);
  const [subject, setSubject] = useState(template.subject);
  const [name, setName] = useState(template.name);
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'html' | 'preview'
  const [saved, setSaved] = useState(false);
  const varInsertRef = useRef(null);
  const vars = useMemo(() => extractVariables(html), [html]);
  const subjectVars = useMemo(() => extractVariables(subject), [subject]);
  const allVars = useMemo(() => [...new Set([...vars, ...subjectVars])], [vars, subjectVars]);

  const save = () => {
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, name, subject, html, updated_at: now() } : t));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  // HTML mode paste: insert clipboard HTML verbatim — no cleanup, zero stripping
  // User pasted HTML = what they want, exactly, character for character
  const handleHtmlPaste = (e) => {
    const clipHtml = e.clipboardData?.getData('text/html');
    if (!clipHtml) return; // fall through to default plain-text paste

    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Extract just the <body> content if a full document, otherwise use as-is
    const bodyMatch = clipHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const content = bodyMatch ? bodyMatch[1] : clipHtml;

    const newVal = html.slice(0, start) + content + html.slice(end);
    setHtml(newVal);
    setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + content.length; }, 0);
  };

  const insertVar = (key) => {
    if (editorMode === 'visual' && varInsertRef.current) {
      varInsertRef.current(key);
    } else {
      const textarea = document.getElementById('html-editor');
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const tag = `{{${key}}}`;
        setHtml(html.slice(0, start) + tag + html.slice(end));
        setTimeout(() => { textarea.focus(); textarea.setSelectionRange(start + tag.length, start + tag.length); }, 0);
      } else {
        setHtml(prev => prev + `{{${key}}}`);
      }
    }
  };

  const MODES = [
    { key: 'visual', icon: 'edit', label: 'Visual' },
    { key: 'html', icon: 'code', label: 'HTML' },
    { key: 'preview', icon: 'eye', label: 'Preview' },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView('templates')}><Icon name="arrow" size={14}/> Templates</button>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <input value={name} onChange={e => setName(e.target.value)} style={{ fontSize: 14, fontWeight: 600, background: 'transparent', border: 'none', color: 'var(--text)', padding: '4px 0', width: 240 }} />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 3, background: 'var(--surface2)', borderRadius: 'var(--r)', padding: 3 }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setEditorMode(m.key)} className="btn btn-sm" style={{ background: editorMode===m.key ? 'var(--surface)' : 'transparent', color: editorMode===m.key ? 'var(--text)' : 'var(--muted)', borderRadius: 6 }}>
              <Icon name={m.icon} size={12}/> {m.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>{saved ? <><Icon name="check" size={13}/> Saved!</> : <><Icon name="check" size={13}/> Save</>}</button>
        <button className="btn btn-primary btn-sm" style={{background:'var(--green)',marginLeft:4}} onClick={() => { save(); openSend(template.id); }}><Icon name="send" size={13}/> Send</button>
      </div>
      {/* Subject line */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Subject</span>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject — supports {{variables}}" style={{ flex: 1, fontSize: 13 }} />
        </div>
      </div>
      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: editorMode === 'preview' ? 0 : 20 }}>
          {editorMode === 'visual' && (
            <RichEditor key="rich" html={html} onChange={setHtml} onVarInsert={varInsertRef} />
          )}
          {editorMode === 'html' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="code" size={13} />
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raw HTML · paste from any source preserves HTML formatting</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{html.length} chars · {vars.length} vars</span>
              </div>
              <textarea
                id="html-editor"
                value={html}
                onChange={e => setHtml(e.target.value)}
                onPaste={handleHtmlPaste}
                spellCheck={false}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, resize: 'none', borderRadius: 'var(--r)', padding: 16, whiteSpace: 'pre', background: 'var(--surface2)', color: '#c9d1d9', border: '1px solid var(--border)' }}
              />
            </div>
          )}
          {editorMode === 'preview' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 32, background: '#e8e8ea' }}>
              <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.15)' }}>
                {/* srcdoc = complete bare document — NO base stylesheet resets.
                    The body content is exactly what the editor captured, so every
                    inline style, table attribute, and whitespace node survives.     */}
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px 32px;}</style></head><body>${
                    html.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,
                      '<mark style="background:#fff3cd;color:#856404;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px;">{{$1}}</mark>')
                  }</body></html>`}
                  style={{ width: '100%', minHeight: 600, border: 'none', display: 'block', borderRadius: 4 }}
                  title="preview"
                />
              </div>
            </div>
          )}
        </div>
        {/* Variable panel */}
        <VariablePanel
          allVars={allVars}
          html={html}
          subject={subject}
          setHtml={setHtml}
          setSubject={setSubject}
          insertVar={insertVar}
          templateId={template.id}
          setView={setView}
        />
      </div>
    </div>
  );
}

// ─── Form Builder ─────────────────────────────────────────────────────────────
const FIELD_TYPES = ['text','email','number','date','dropdown','textarea','phone','url'];

function FormBuilder({ template, forms, setForms, setView }) {
  const form = forms[template.id] || { fields: [] };
  const [fields, setFields] = useState(form.fields);
  const [expandedId, setExpandedId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const templateVars = useMemo(() => extractVariables(template.html + ' ' + template.subject), [template]);
  const usedKeys = useMemo(() => new Set(fields.map(f => f.variable_key)), [fields]);

  const save = () => {
    setForms(prev => ({ ...prev, [template.id]: { fields } }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const addField = (varKey) => {
    const f = { id: genId(), variable_key: varKey || '', label: varKey ? varKey.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'New Field', input_type: 'text', required: false, default_value: '', placeholder: '', sort_order: fields.length };
    setFields(prev => [...prev, f]);
    setExpandedId(f.id);
  };

  const updateField = (id, patch) => setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  const removeField = (id) => setFields(prev => prev.filter(f => f.id !== id));
  const moveUp = (idx) => { if (idx === 0) return; const arr = [...fields]; [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; setFields(arr); };
  const moveDown = (idx) => { if (idx === fields.length-1) return; const arr = [...fields]; [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]]; setFields(arr); };

  const unmapped = templateVars.filter(v => !usedKeys.has(v));
  const orphaned = fields.filter(f => f.variable_key && !templateVars.includes(f.variable_key));

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView('templates')}><Icon name="arrow" size={14}/> Templates</button>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{template.name}</span>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <span style={{ fontSize: 14, color: 'var(--accent)' }}>Form Builder</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setView(`edit_${template.id}`)}><Icon name="code" size={13}/> Edit Template</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setView(`send_${template.id}`)}><Icon name="send" size={13}/> Send Console</button>
        <button className="btn btn-primary btn-sm" onClick={save}>{saved ? <><Icon name="check" size={13}/> Saved!</> : 'Save Form'}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Fields list */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {(unmapped.length > 0 || orphaned.length > 0) && (
              <div style={{ padding: 16, background: 'rgba(212,168,71,0.08)', border: '1px solid rgba(212,168,71,0.25)', borderRadius: 'var(--r)', marginBottom: 20 }}>
                {unmapped.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon name="warning" size={14} /><span style={{ fontSize: 12, color: 'var(--accent2)' }}><strong>{unmapped.length} template variable{unmapped.length!==1?'s':''}</strong> not yet mapped to form fields:</span>
                  <div style={{ display: 'flex', gap: 4 }}>{unmapped.map(v => <button key={v} onClick={() => addField(v)} className="tag tag-gold" style={{ cursor: 'pointer', border: '1px solid rgba(212,168,71,0.3)' }}>+ {v}</button>)}</div>
                </div>}
                {orphaned.length > 0 && <div style={{ fontSize: 12, color: 'var(--red)' }}><Icon name="warning" size={13}/> Fields mapped to non-existent variables: {orphaned.map(f => f.variable_key).join(', ')}</div>}
              </div>
            )}
            {fields.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--muted)' }}>
                <Icon name="form" size={48} />
                <p style={{ marginTop: 16, fontSize: 15 }}>No fields yet</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Add fields below or click the unmapped variable badges above</p>
              </div>
            ) : fields.map((field, idx) => (
              <div key={field.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={e => { e.preventDefault(); setDragOver(idx); }} onDragEnd={() => { if (dragIdx !== null && dragOver !== null && dragIdx !== dragOver) { const arr = [...fields]; const [moved] = arr.splice(dragIdx, 1); arr.splice(dragOver, 0, moved); setFields(arr); } setDragIdx(null); setDragOver(null); }} className="card fade-in" style={{ marginBottom: 12, border: dragOver === idx ? '1px solid var(--accent)' : '1px solid var(--border)', transition: 'all 0.2s' }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}>
                  <span style={{ color: 'var(--border2)', cursor: 'grab' }}><Icon name="drag" size={16}/></span>
                  <div style={{ flex: 1, display: 'flex', align: 'center', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{field.label || 'Untitled'}</span>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)', background: 'rgba(212,168,71,0.08)', padding: '2px 6px', borderRadius: 4 }}>{`{{${field.variable_key}}}`}</code>
                    <span className="tag tag-muted">{field.input_type}</span>
                    {field.required && <span className="tag tag-red">required</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); moveUp(idx); }} disabled={idx===0}><Icon name="up" size={12}/></button>
                    <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); moveDown(idx); }} disabled={idx===fields.length-1}><Icon name="down" size={12}/></button>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); removeField(field.id); }}><Icon name="trash" size={12}/></button>
                  </div>
                </div>
                {expandedId === field.id && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Field Label *</label>
                        <input value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Variable Key *</label>
                        <select value={field.variable_key} onChange={e => updateField(field.id, { variable_key: e.target.value })}>
                          <option value="">— Select variable —</option>
                          {templateVars.map(v => <option key={v} value={v}>{`{{${v}}}`}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Input Type</label>
                        <select value={field.input_type} onChange={e => updateField(field.id, { input_type: e.target.value })}>
                          {FIELD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Placeholder Text</label>
                        <input value={field.placeholder || ''} onChange={e => updateField(field.id, { placeholder: e.target.value })} placeholder="Hint for the user" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Default Value</label>
                        <input value={field.default_value || ''} onChange={e => updateField(field.id, { default_value: e.target.value })} placeholder="Pre-filled value" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Required</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[true,false].map(v => (
                            <button key={String(v)} onClick={() => updateField(field.id, { required: v })} className="btn btn-sm" style={{ background: field.required === v ? (v ? 'rgba(224,92,92,0.2)' : 'rgba(122,125,148,0.1)') : 'var(--surface2)', color: field.required === v ? (v ? 'var(--red)' : 'var(--muted)') : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6 }}>{v ? 'Yes' : 'No'}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {field.input_type === 'dropdown' && (
                      <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dropdown Options (one per line)</label>
                        <textarea value={field.options || ''} onChange={e => updateField(field.id, { options: e.target.value })} rows={4} placeholder="Option 1&#10;Option 2&#10;Option 3" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => addField()}><Icon name="plus" size={14}/> Add Field</button>
            </div>
          </div>
        </div>
        {/* Sidebar: variable coverage */}
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', background: 'var(--surface)', padding: 20, overflow: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' }}>Variable Coverage</div>
          {templateVars.map(v => {
            const mapped = fields.find(f => f.variable_key === v);
            return (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: mapped ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', flex: 1 }}>{v}</code>
                {!mapped && <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => addField(v)}>Map</button>}
              </div>
            );
          })}
          {templateVars.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No variables in template</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Send Console ─────────────────────────────────────────────────────────────
function SendConsole({ template, forms, logs, setLogs, setView }) {
  const form = forms[template.id] || { fields: [] };
  const fields = form.fields;
  const [data, setData] = useState(() => {
    const d = {};
    fields.forEach(f => { d[f.variable_key] = f.default_value || ''; });
    return d;
  });
  const [toEmail, setToEmail] = useState('');
  const [toName, setToName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [previewTab, setPreviewTab] = useState('email');

  const renderedHtml = useMemo(() => renderTemplate(template.html, data, fields), [template.html, data, fields]);
  const renderedSubject = useMemo(() => {
    let s = template.subject;
    fields.forEach(f => { s = s.replace(new RegExp(`\\{\\{${f.variable_key}\\}\\}`, 'g'), data[f.variable_key] || f.default_value || ''); });
    return s;
  }, [template.subject, data, fields]);

  const validate = () => {
    const errs = {};
    if (!toEmail) errs.to_email = 'Recipient email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) errs.to_email = 'Invalid email address';
    fields.filter(f => f.required).forEach(f => { if (!data[f.variable_key] && !f.default_value) errs[f.variable_key] = 'This field is required'; });
    return errs;
  };

  const handleSend = async () => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1400)); // simulated send
    const log = { id: `log_${genId()}`, template_id: template.id, template_name: template.name, to_email: toEmail, to_name: toName, subject: renderedSubject, rendered_html: renderedHtml, status: 'sent', sent_at: now(), created_at: now() };
    setLogs(prev => [...prev, log]);
    setSending(false); setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  // Paste handler: for text/textarea fields, strip HTML tags so only plain text is inserted
  // This preserves line breaks and whitespace structure from copied email text
  const handleFieldPaste = (e, set) => {
    const htmlData = e.clipboardData?.getData('text/html');
    if (!htmlData) return; // allow default plain-text paste
    e.preventDefault();
    // Convert HTML to readable plain text preserving line breaks
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlData
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/li>/gi, '\n');
    const plain = (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    const ta = e.target;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newVal = ta.value.slice(0, start) + plain + ta.value.slice(end);
    set(newVal);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + plain.length; }, 0);
  };

  const Field = ({ field }) => {
    const val = data[field.variable_key] ?? '';
    const err = errors[field.variable_key];
    const set = v => setData(prev => ({ ...prev, [field.variable_key]: v }));
    const inputStyle = { borderColor: err ? 'var(--red)' : undefined };
    const opts = field.options ? field.options.split('\n').filter(Boolean) : [];
    return (
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: err ? 'var(--red)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          {field.label} {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>{`{{${field.variable_key}}}`}</code>
        </label>
        {field.input_type === 'textarea' ? (
          <textarea value={val} onChange={e => set(e.target.value)} onPaste={e => handleFieldPaste(e, set)} placeholder={field.placeholder} rows={3} style={inputStyle} />
        ) : field.input_type === 'dropdown' ? (
          <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
            <option value="">— Select —</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={field.input_type} value={val} onChange={e => set(e.target.value)} onPaste={e => handleFieldPaste(e, set)} placeholder={field.placeholder} style={inputStyle} />
        )}
        {err && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{err}</p>}
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setView('templates')}><Icon name="arrow" size={14}/> Templates</button>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{template.name}</span>
        <span style={{ color: 'var(--border2)' }}>/</span>
        <span style={{ fontSize: 14, color: 'var(--accent)' }}>Send Console</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => setView(`edit_${template.id}`)}><Icon name="edit" size={13}/> Edit Template</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setView(`form_${template.id}`)}><Icon name="form" size={13}/> Edit Form</button>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '400px 1fr', overflow: 'hidden' }}>
        {/* Left: Form */}
        <div style={{ borderRight: '1px solid var(--border)', overflow: 'auto', padding: 28, background: 'var(--surface)' }}>
          {fields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--muted)' }}>
              <Icon name="form" size={40} />
              <p style={{ marginTop: 16 }}>No form fields configured.</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setView(`form_${template.id}`)}>Build Form</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recipient</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: errors.to_email ? 'var(--red)' : 'var(--muted)', display: 'block', marginBottom: 6 }}>To: Email Address *</label>
                  <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@company.com" style={{ borderColor: errors.to_email ? 'var(--red)' : undefined }} />
                  {errors.to_email && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.to_email}</p>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Display Name</label>
                  <input value={toName} onChange={e => setToName(e.target.value)} placeholder="Recipient's name (optional)" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Template Variables</div>
              {fields.map(f => <Field key={f.id} field={f} />)}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                {sent ? (
                  <div style={{ padding: '14px 20px', background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 'var(--r)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Icon name="check" size={16} />
                    <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>Email sent successfully!</span>
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%', padding: '12px 24px', fontSize: 14 }} onClick={handleSend} disabled={sending}>
                    {sending ? (
                      <><div className="spin" style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0c0d10', borderRadius: '50%' }} /> Sending...</>
                    ) : (
                      <><Icon name="send" size={15}/> Send Email</>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {/* Right: Preview */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', background: '#e8e8ea' }}>
          <div style={{ padding: '12px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Live Preview</span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 6, padding: 3 }}>
              {['email','html'].map(tab => (
                <button key={tab} onClick={() => setPreviewTab(tab)} className="btn btn-sm" style={{ background: previewTab===tab ? 'var(--surface2)' : 'transparent', color: previewTab===tab ? 'var(--text)' : 'var(--muted)', borderRadius: 4, fontSize: 11 }}>{tab.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: '12px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>SUBJECT</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{renderedSubject}</div>
          </div>
          <div style={{ flex: 1, padding: 28, overflow: 'auto' }}>
            {previewTab === 'email' ? (
              <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.2)', minHeight: 400 }}>
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px 32px;}</style></head><body>${renderedHtml}</body></html>`}
                  style={{ width: '100%', minHeight: 500, border: 'none', display: 'block', borderRadius: 4 }}
                  title="email-preview"
                />
              </div>
            ) : (
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c9d1d9', background: 'var(--surface)', padding: 20, borderRadius: 'var(--r)', overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{renderedHtml}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FieldRow — must be defined OUTSIDE SendModal so React never remounts it ──
function FieldRow({ v, data, setData, errors, fMap }) {
  const err  = errors[v];
  const field = fMap[v];
  const type  = field?.input_type || 'text';
  const opts  = (field?.options || '').split('\n').filter(Boolean);
  const label = field?.label || v.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const val   = data[v] || '';
  const set   = useCallback(newVal => setData(d => ({ ...d, [v]: newVal })), [v, setData]);
  const iStyle = { borderColor: err ? 'var(--red)' : undefined };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:5 }}>
        <label style={{ fontSize:12, fontWeight:500, color: err?'var(--red)':'var(--text)' }}>{label}</label>
        <code style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--muted)' }}>{`{{${v}}}`}</code>
        {field?.required && <span style={{fontSize:10,color:'var(--red)'}}>*</span>}
        {err && <span style={{fontSize:11,color:'var(--red)',marginLeft:'auto'}}>{err}</span>}
      </div>
      {type === 'textarea' ? (
        <textarea rows={3} value={val} onChange={e=>set(e.target.value)} style={iStyle} placeholder={field?.placeholder||''} />
      ) : type === 'dropdown' ? (
        <select value={val} onChange={e=>set(e.target.value)} style={iStyle}>
          <option value="">— select —</option>
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={val} onChange={e=>set(e.target.value)} style={iStyle} placeholder={field?.placeholder||''} />
      )}
    </div>
  );
}

// ─── Send Modal ───────────────────────────────────────────────────────────────
function SendModal({ template, forms, onClose, onSent }) {
  const form    = forms[template.id] || { fields: [] };
  const fMap    = useMemo(() => Object.fromEntries(form.fields.map(f => [f.variable_key, f])), [form.fields]);

  // Auto-detect every {{var}} in the template — this is the source of truth
  const vars = useMemo(() => extractVariables(template.html + ' ' + template.subject), [template]);

  // Build initial data from form defaults
  const [data, setData]       = useState(() => {
    const d = {};
    vars.forEach(v => { d[v] = fMap[v]?.default_value || ''; });
    return d;
  });
  const [toEmail, setToEmail] = useState('');
  const [toName,  setToName]  = useState('');
  const [errors,  setErrors]  = useState({});
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [tab,     setTab]     = useState('form'); // 'form' | 'preview'

  // Live-rendered output
  const rendered = useMemo(() => {
    let h = template.html, s = template.subject;
    vars.forEach(v => {
      const val = data[v] || '';
      const re  = new RegExp(`\\{\\{${v}\\}\\}`, 'g');
      h = h.replace(re, val.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
      s = s.replace(re, val);
    });
    return { html: h, subject: s };
  }, [template, vars, data]);

  // Validation
  const validate = () => {
    const e = {};
    if (!toEmail.trim()) e._to = 'Recipient email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) e._to = 'Invalid email address';
    vars.forEach(v => {
      const field = fMap[v];
      if (field?.required && !data[v] && !field.default_value) e[v] = 'Required';
    });
    return e;
  };

  const handleSend = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    onSent({
      id: `log_${genId()}`, template_id: template.id, template_name: template.name,
      to_email: toEmail, to_name: toName, subject: rendered.subject,
      rendered_html: rendered.html, status: 'sent', sent_at: now(), created_at: now(),
    });
    setSending(false); setSent(true);
    setTimeout(onClose, 1800);
  };

  // Close on Escape
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.72)', zIndex:999, backdropFilter:'blur(3px)' }}
      />

      {/* Modal */}
      <div className="fade-in" style={{
        position:'fixed', inset:0, zIndex:1000,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:24, pointerEvents:'none',
      }}>
        <div onClick={e=>e.stopPropagation()} style={{
          pointerEvents:'all',
          width:'100%', maxWidth:1020, height:'min(88vh, 780px)',
          background:'var(--surface)', borderRadius:16,
          border:'1px solid var(--border2)',
          boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
          display:'flex', flexDirection:'column', overflow:'hidden',
        }}>

          {/* Header */}
          <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'var(--surface)' }}>
            <div style={{ width:36, height:36, background:'rgba(212,168,71,0.12)', border:'1px solid rgba(212,168,71,0.25)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon name="send" size={16} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>Send Email</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>
                {template.name} · <span style={{fontFamily:'var(--font-mono)', fontSize:11}}>{vars.length} variable{vars.length!==1?'s':''}</span>
              </div>
            </div>
            {/* Tab switcher */}
            <div style={{ display:'flex', gap:3, background:'var(--surface2)', borderRadius:8, padding:3 }}>
              {[['form','Form'],['preview','Preview']].map(([k,l]) => (
                <button key={k} onClick={()=>setTab(k)} className="btn btn-sm" style={{
                  background: tab===k ? 'var(--surface)' : 'transparent',
                  color: tab===k ? 'var(--text)' : 'var(--muted)',
                  borderRadius:6, fontSize:12, padding:'5px 14px',
                }}>{l}</button>
              ))}
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{padding:'6px 8px', marginLeft:4}}>
              <Icon name="close" size={16}/>
            </button>
          </div>

          {/* Subject bar */}
          <div style={{ padding:'10px 24px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>Subject</span>
            <div style={{ fontSize:13, color:'var(--text)', fontFamily:'var(--font-mono)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rendered.subject}</div>
          </div>

          {/* Body */}
          <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

            {/* ── FORM TAB (mobile: full, desktop: always left col) ── */}
            <div style={{
              width: tab==='preview' ? 0 : '100%',
              maxWidth: 420, flexShrink:0,
              overflow:'auto', padding: tab==='preview' ? 0 : '24px 24px 0',
              borderRight:'1px solid var(--border)',
              transition:'all 0.2s',
              display: tab==='preview' ? 'none' : 'block',
            }}>

              {/* Recipient */}
              <div style={{ marginBottom:20, paddingBottom:18, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Recipient</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:5 }}>
                    <label style={{ fontSize:12, fontWeight:500, color: errors._to?'var(--red)':'var(--text)' }}>Email Address</label>
                    <span style={{fontSize:10,color:'var(--red)'}}>*</span>
                    {errors._to && <span style={{fontSize:11,color:'var(--red)',marginLeft:'auto'}}>{errors._to}</span>}
                  </div>
                  <input type="email" value={toEmail} onChange={e=>setToEmail(e.target.value)}
                    placeholder="recipient@company.com"
                    style={{ borderColor: errors._to?'var(--red)':undefined }}
                    onKeyDown={e=>e.key==='Enter'&&handleSend()}
                  />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:500, color:'var(--muted)', display:'block', marginBottom:5 }}>Display Name <span style={{fontWeight:400,fontSize:11}}>(optional)</span></label>
                  <input value={toName} onChange={e=>setToName(e.target.value)} placeholder="Recipient's name" />
                </div>
              </div>

              {/* Variables */}
              {vars.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'var(--muted)' }}>
                  <Icon name="var" size={32}/>
                  <p style={{marginTop:12,fontSize:13}}>No variables in this template</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>
                    Template Variables
                  </div>
                  {vars.map(v => <FieldRow key={v} v={v} data={data} setData={setData} errors={errors} fMap={fMap} />)}
                </>
              )}

              {/* Spacer so last field isn't hidden behind footer */}
              <div style={{height:100}}/>
            </div>

            {/* ── PREVIEW PANE ── */}
            <div style={{
              flex:1, overflow:'auto',
              background:'#e8e8ea',
              display: tab==='form' ? 'none' : 'block',
            }}>
              <div style={{ padding:28 }}>
                <div style={{ maxWidth:660, margin:'0 auto', background:'#fff', borderRadius:4, boxShadow:'0 4px 32px rgba(0,0,0,0.18)', minHeight:400 }}>
                  <iframe
                    key={rendered.html}
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px 32px;}</style></head><body>${rendered.html}</body></html>`}
                    style={{ width:'100%', minHeight:480, border:'none', display:'block', borderRadius:4 }}
                    title="send-preview"
                  />
                </div>
              </div>
            </div>

            {/* ── ALWAYS-VISIBLE right preview on wide screens ── */}
            {tab === 'form' && (
              <div style={{ flex:1, overflow:'auto', background:'#e8e8ea', display:'flex', flexDirection:'column' }}>
                <div style={{ padding:24, flex:1, overflow:'auto' }}>
                  <div style={{ maxWidth:620, margin:'0 auto', background:'#fff', borderRadius:4, boxShadow:'0 4px 32px rgba(0,0,0,0.15)', minHeight:360 }}>
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px 32px;}</style></head><body>${rendered.html}</body></html>`}
                      style={{ width:'100%', minHeight:420, border:'none', display:'block', borderRadius:4 }}
                      title="send-preview-side"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0, display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              {sent && (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--green)', fontSize:13, fontWeight:500 }}>
                  <Icon name="check" size={15}/> Email sent successfully!
                </div>
              )}
              {Object.keys(errors).length > 0 && !sent && (
                <div style={{ display:'flex', alignItems:'center', gap:6, color:'var(--red)', fontSize:12 }}>
                  <Icon name="warning" size={13}/> Please fix the errors above
                </div>
              )}
            </div>
            <button className="btn btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ padding:'10px 28px', fontSize:14, minWidth:140 }}
              onClick={handleSend}
              disabled={sending || sent}
            >
              {sent ? (
                <><Icon name="check" size={14}/> Sent!</>
              ) : sending ? (
                <><div className="spin" style={{width:14,height:14,border:'2px solid rgba(0,0,0,0.2)',borderTopColor:'#0c0d10',borderRadius:'50%'}}/> Sending…</>
              ) : (
                <><Icon name="send" size={14}/> Send Email</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Email Logs ───────────────────────────────────────────────────────────────
function EmailLogs({ logs, setView }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const filtered = logs.filter(l => !filter || l.to_email?.includes(filter) || l.template_name?.includes(filter) || l.subject?.includes(filter)).slice().reverse();

  return (
    <div className="fade-in" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ width: selected ? 420 : '100%', borderRight: selected ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.3s' }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 400 }}>Send History</h1>
            <span className="tag tag-muted">{logs.length} total</span>
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by email, template, subject..." />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted)' }}>
              <Icon name="mail" size={48} />
              <p style={{ marginTop: 16, fontSize: 15 }}>{logs.length === 0 ? 'No emails sent yet' : 'No results match your filter'}</p>
            </div>
          ) : filtered.map(log => (
            <div key={log.id} onClick={() => setSelected(selected?.id === log.id ? null : log)} style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected?.id === log.id ? 'rgba(212,168,71,0.06)' : 'transparent', transition: 'background 0.15s', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: log.status === 'sent' ? 'rgba(76,175,125,0.15)' : 'rgba(224,92,92,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={log.status === 'sent' ? 'check' : 'warning'} size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{log.to_email}</span>
                  <span className={`tag ${log.status==='sent'?'tag-green':'tag-red'}`}>{log.status}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{log.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
                  <span>{log.template_name}</span><span>·</span><span>{fmt(log.sent_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{selected.to_email}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Sent {fmt(selected.sent_at)}</div>
            </div>
            <span className={`tag ${selected.status==='sent'?'tag-green':'tag-red'}`}>{selected.status}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><Icon name="close" size={14}/></button>
          </div>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>SUBJECT</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{selected.subject}</div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 28, background: '#e8e8ea' }}>
            <div style={{ maxWidth: 700, margin: '0 auto', background: '#fff', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.2)' }}>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px 32px;}</style></head><body>${selected.rendered_html}</body></html>`}
                style={{ width: '100%', minHeight: 500, border: 'none', display: 'block', borderRadius: 4 }}
                title="log-preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]           = useState('dashboard');
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [forms, setForms]         = useState(INITIAL_FORMS);
  const [logs, setLogs]           = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [sendModal, setSendModal] = useState(null); // templateId | null

  const openSend = (templateId) => setSendModal(templateId);
  const closeSend = () => setSendModal(null);
  const handleSent = (log) => { setLogs(prev => [...prev, log]); };

  // Persist to storage
  useEffect(() => {
    (async () => {
      try {
        const [t, f, l] = await Promise.all([
          window.storage.get('mf_templates').catch(() => null),
          window.storage.get('mf_forms').catch(() => null),
          window.storage.get('mf_logs').catch(() => null),
        ]);
        if (t) setTemplates(JSON.parse(t.value));
        if (f) setForms(JSON.parse(f.value));
        if (l) setLogs(JSON.parse(l.value));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (!loaded) return; window.storage?.set('mf_templates', JSON.stringify(templates)).catch(()=>{}); }, [templates, loaded]);
  useEffect(() => { if (!loaded) return; window.storage?.set('mf_forms', JSON.stringify(forms)).catch(()=>{}); }, [forms, loaded]);
  useEffect(() => { if (!loaded) return; window.storage?.set('mf_logs', JSON.stringify(logs)).catch(()=>{}); }, [logs, loaded]);

  const getTemplate = (id) => templates.find(t => t.id === id);

  const renderView = () => {
    if (view === 'dashboard') return <Dashboard templates={templates} logs={logs} setView={setView} openSend={openSend} />;
    if (view === 'templates') return <TemplatesList templates={templates} setTemplates={setTemplates} forms={forms} setForms={setForms} setView={setView} openSend={openSend} />;
    if (view === 'logs') return <EmailLogs logs={logs} setView={setView} />;
    if (view.startsWith('edit_')) { const t = getTemplate(view.slice(5)); return t ? <TemplateEditor template={t} setTemplates={setTemplates} setView={setView} openSend={openSend} /> : null; }
    if (view.startsWith('form_')) { const t = getTemplate(view.slice(5)); return t ? <FormBuilder template={t} forms={forms} setForms={setForms} setView={setView} openSend={openSend} /> : null; }
    if (view.startsWith('send_')) { const t = getTemplate(view.slice(5)); return t ? <SendConsole template={t} forms={forms} logs={logs} setLogs={setLogs} setView={setView} openSend={openSend} /> : null; }
    return <Dashboard templates={templates} logs={logs} setView={setView} openSend={openSend} />;
  };

  const showSidebar = !view.startsWith('edit_') && !view.startsWith('form_') && !view.startsWith('send_');

  const modalTemplate = sendModal ? getTemplate(sendModal) : null;

  if (!loaded) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spin" style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
    </div>
  );

  return (
    <>
      <FontLoader />
      <style>{CSS}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {showSidebar && <Sidebar view={view} setView={setView} templates={templates} openSend={openSend} />}
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
          {renderView()}
        </main>
      </div>
      {modalTemplate && (
        <SendModal
          template={modalTemplate}
          forms={forms}
          onClose={closeSend}
          onSent={(log) => { handleSent(log); }}
        />
      )}
    </>
  );
}
