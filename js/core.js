// ═══════════════════════════════════════════════════════════════
// CORE — Firebase, ইউটিলিটি, ক্যাশ/ইনডেক্স, রাউটার, UI হেল্পার
// ═══════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyAHDYMgL9vHRTaer60qXRD8UuoVWn06Ip8",
  authDomain: "grameen-52d86.firebaseapp.com",
  projectId: "grameen-52d86",
  storageBucket: "grameen-52d86.firebasestorage.app",
  messagingSenderId: "1016084099405",
  appId: "1:1016084099405:web:5b98a4673c6631d9ae0704"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) {}
const FV = firebase.firestore.FieldValue;
const IMGBB_KEY = '3b6c1d56d21a4c3f52beb52c55859a28';
const LOGIN_DOMAIN = '@gaa-somity.app';

// ─────────────── ইউটিলিটি ───────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[,৳\s]/g, '')); return isFinite(n) ? n : 0; };
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const tk = n => '৳' + r2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const amt = n => r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n, l) => String(n).padStart(l, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n) => { const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const fmtD = s => { if (!s) return ''; const [y, m, d] = String(s).split('-'); return d + '-' + m + '-' + y; };
const tsStr = t => { if (!t) return ''; const d = t.toDate ? t.toDate() : new Date(t); return isNaN(d) ? '' : fmtD(ymd(d)) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_BN = { Sunday: 'রবিবার', Monday: 'সোমবার', Tuesday: 'মঙ্গলবার', Wednesday: 'বুধবার', Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার', Saturday: 'শনিবার' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f ? f(x) : x) || 0), 0);
const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
const uid8 = () => Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), type === 'error' ? 5000 : 3000);
}
function busy(on, msg) {
  let el = $('#busyOverlay');
  if (!el) { el = document.createElement('div'); el.id = 'busyOverlay'; el.innerHTML = '<div class="busy-box"><div class="spinner"></div><div class="busy-msg"></div></div>'; document.body.appendChild(el); }
  el.querySelector('.busy-msg').textContent = msg || 'অপেক্ষা করুন...';
  el.style.display = on ? 'flex' : 'none';
}
// বাটন double-click গার্ড + এরর হ্যান্ডলিং
async function guard(btn, fn) {
  if (btn && btn.dataset.busy === '1') return;
  if (btn) { btn.dataset.busy = '1'; btn.disabled = true; }
  try { return await fn(); }
  catch (e) { console.error(e); toast(e.userMsg || ('সমস্যা: ' + (e.message || e)), 'error'); }
  finally { if (btn) { btn.dataset.busy = ''; btn.disabled = false; } }
}
class UserError extends Error { constructor(m) { super(m); this.userMsg = m; } }
const fail = m => { throw new UserError(m); };

async function uploadImage(file) {
  if (!file) return '';
  const fd = new FormData(); fd.append('image', file);
  const r = await fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_KEY, { method: 'POST', body: fd });
  const j = await r.json();
  if (!j.success) throw new Error('ছবি আপলোড ব্যর্থ');
  return j.data.display_url || j.data.url;
}

// ─────────────── অ্যাপ স্টেট ───────────────
const App = {
  user: null,          // users/{uid} ডক + uid
  branch: '',          // বর্তমান কাজের শাখা কোড
  pages: {},           // রেজিস্টারকৃত পেজ
  current: null,
  org: { name: 'গ্রামীন আশার আলো কৃষি সমবায় সমিতি লিঃ', reg: '২০২৫.১.০১.৭২৪০.০২১৩', address: 'কলমাকান্দা, নেত্রকোনা' },
};
const isAdmin = () => App.user && (App.user.group === 'Super Admin');
const isBM = () => App.user && (isAdmin() || App.user.group === 'Branch Manager' || (App.user.flags || {}).bm);
const canBackDate = () => App.user && (isAdmin() || (App.user.flags || {}).backDate);
const allowedBranches = () => {
  if (!App.user) return [];
  if (isAdmin() || (App.user.flags || {}).controlling) return null; // সব শাখা
  return [...new Set([App.user.branch, ...(App.user.branches || [])].filter(Boolean))];
};

// ─────────────── ক্যাশ ───────────────
const Cache = {
  _m: {},
  async get(key, loader, ttl = 5 * 60000) {
    const e = this._m[key];
    if (e && Date.now() - e.t < ttl) return e.p;
    const p = loader().catch(err => { delete this._m[key]; throw err; });
    this._m[key] = { t: Date.now(), p };
    return p;
  },
  drop(prefix) { Object.keys(this._m).forEach(k => { if (!prefix || k.startsWith(prefix)) delete this._m[k]; }); },
};
const Data = {
  branches: () => Cache.get('branches', async () => (await db.collection('branches').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.code).localeCompare(String(b.code)))),
  async branch(code) { return (await Data.branches()).find(b => b.code === code || b.id === code); },
  samities: (branch) => Cache.get('sam_' + branch, async () => (await db.collection('samities').where('branch', '==', branch).get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.code).localeCompare(String(b.code)))),
  async samity(code) { const d = await db.collection('samities').doc(code).get(); return d.exists ? { id: d.id, ...d.data() } : null; },
  employees: (branch) => Cache.get('emp_' + (branch || '*'), async () => {
    const q = branch ? db.collection('employees').where('branch', '==', branch) : db.collection('employees');
    return (await q.get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.empId).localeCompare(String(b.empId)));
  }),
  ledgers: () => Cache.get('ledgers', async () => {
    const s = await db.collection('ledgers').get();
    return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.code.localeCompare(b.code));
  }, 30 * 60000),
  async ledgerMap() { const m = {}; (await Data.ledgers()).forEach(l => m[l.code] = l); return m; },
  purposes: () => Cache.get('purposes', async () => (await db.collection('loanPurposes').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.code.localeCompare(b.code))),
  instSettings: () => Cache.get('instset', async () => (await db.collection('emiInstSettings').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id))),
  holidays: () => Cache.get('holidays', async () => (await db.collection('holidays').get()).docs.map(d => ({ id: d.id, ...d.data() }))),
  // সদস্য ইনডেক্স: idx/mem_{branch} → {rows:{memberId:[name,samity,mobile,status,father,nid]}}
  memberIdx: (branch) => Cache.get('midx_' + branch, async () => { const d = await db.collection('idx').doc('mem_' + branch).get(); return (d.exists && d.data().rows) || {}; }, 60000),
  // একাউন্ট ইনডেক্স: idx/acc_{branch} → {rows:{accNo:[memberId,kind,type,status,samity,title]}}
  accIdx: (branch) => Cache.get('aidx_' + branch, async () => { const d = await db.collection('idx').doc('acc_' + branch).get(); return (d.exists && d.data().rows) || {}; }, 60000),
  async members(branch, samity) {
    const rows = await Data.memberIdx(branch);
    return Object.entries(rows).map(([id, r]) => ({ id, name: r[0], samity: r[1], mobile: r[2], status: r[3], father: r[4], nid: r[5] }))
      .filter(m => !samity || m.samity === samity).sort((a, b) => a.id.localeCompare(b.id));
  },
  async accountsOf(branch, memberId, kind, type) {
    const rows = await Data.accIdx(branch);
    return Object.entries(rows).map(([accNo, r]) => ({ accNo, memberId: r[0], kind: r[1], type: r[2], status: r[3], samity: r[4], title: r[5] }))
      .filter(a => (!memberId || a.memberId === memberId) && (!kind || (Array.isArray(kind) ? kind.includes(a.kind) : a.kind === kind)) && (!type || (Array.isArray(type) ? type.includes(a.type) : a.type === type)))
      .sort((a, b) => a.accNo.localeCompare(b.accNo));
  },
  async account(accNo) { const d = await db.collection('accounts').doc(accNo).get(); return d.exists ? { id: d.id, ...d.data() } : null; },
  async member(id) { const d = await db.collection('members').doc(id).get(); return d.exists ? { id: d.id, ...d.data() } : null; },
  // শাখার সমিতি snapshot (ব্যালেন্স রিপোর্টের জন্য — প্রতি সমিতি ১ রিড)
  async snaps(branch, samity) {
    const sams = samity ? [{ code: samity }] : await Data.samities(branch);
    const docs = await Promise.all(sams.map(s => db.collection('snap').doc(s.code).get()));
    const out = [];
    docs.forEach((d, i) => { const a = (d.exists && d.data().a) || {}; Object.entries(a).forEach(([accNo, v]) => out.push({ accNo, samity: sams[i].code, ...v })); });
    return out;
  },
};
const Idx = {
  memberRow: m => [m.name || '', m.samity || '', m.mobile || '', m.status || 'active', m.father || '', m.nid || ''],
  accRow: a => [a.memberId || '', a.kind, a.type, a.status || 'active', a.samity || '', a.title || ''],
  setMember(batch, branch, m) { batch.set(db.collection('idx').doc('mem_' + branch), { rows: { [m.memberId]: Idx.memberRow(m) } }, { merge: true }); Cache.drop('midx_' + branch); },
  setAccount(batch, branch, a) { batch.set(db.collection('idx').doc('acc_' + branch), { rows: { [a.accNo]: Idx.accRow(a) } }, { merge: true }); Cache.drop('aidx_' + branch); },
  delMember(batch, branch, id) { batch.update(db.collection('idx').doc('mem_' + branch), { ['rows.' + id]: FV.delete() }); Cache.drop('midx_' + branch); },
  delAccount(batch, branch, accNo) { batch.update(db.collection('idx').doc('acc_' + branch), { ['rows.' + accNo]: FV.delete() }); Cache.drop('aidx_' + branch); },
};
// ক্রমিক আইডি — counters/{name}
async function nextSeq(name, start = 1) {
  const ref = db.collection('counters').doc(name);
  return db.runTransaction(async tx => {
    const d = await tx.get(ref);
    const v = d.exists ? (d.data().v || 0) + 1 : start;
    tx.set(ref, { v }, { merge: true });
    return v;
  });
}
async function businessDate(branch) {
  const b = await Data.branch(branch || App.branch);
  return (b && b.businessDate) || today();
}
async function isHoliday(date, branch, samity) {
  const hs = await Data.holidays();
  return hs.some(h => h.date === date && (!h.branches || !h.branches.length || h.branches.includes(branch)) && (!h.samities || !h.samities.length || !samity || h.samities.includes(samity)));
}

// ─────────────── UI হেল্পার ───────────────
const UI = {
  // field spec: {k, l(label), t(type), req, ro, opts:[[v,t]], v(value), ph, span, attrs, hint}
  field(f) {
    if (f.t === 'hr') return `<div class="form-sep" style="grid-column:1/-1">${esc(f.l || '')}</div>`;
    if (f.t === 'html') return `<div style="grid-column:${f.span ? 'span ' + f.span : 'auto'}">${f.html}</div>`;
    const id = 'f_' + f.k + '_' + Math.random().toString(36).slice(2, 7);
    const req = f.req ? ' <span class="req">*</span>' : '';
    const common = `id="${id}" data-k="${f.k}" ${f.ro ? 'readonly tabindex="-1"' : ''} ${f.req ? 'data-req="1"' : ''} ${f.attrs || ''}`;
    let inp;
    switch (f.t) {
      case 'select': inp = `<select ${common} ${f.ro ? 'disabled' : ''}>${(f.opts || []).map(o => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`; break;
      case 'textarea': inp = `<textarea ${common} rows="${f.rows || 2}" placeholder="${esc(f.ph || '')}">${esc(f.v || '')}</textarea>`; break;
      case 'checkbox': return `<div class="form-group check" style="${f.span ? 'grid-column:span ' + f.span : ''}"><label><input type="checkbox" ${common} ${f.v ? 'checked' : ''}> ${esc(f.l)}</label></div>`;
      case 'file': inp = `<input type="file" ${common} accept="${f.accept || 'image/*'}">`; break;
      case 'member': inp = `<input type="text" ${common} list="${id}_dl" placeholder="${esc(f.ph || 'আইডি / নাম / মোবাইল লিখুন')}" autocomplete="off"><datalist id="${id}_dl"></datalist>`; break;
      default: inp = `<input type="${f.t || 'text'}" ${common} value="${esc(f.v == null ? '' : f.v)}" placeholder="${esc(f.ph || '')}" ${f.t === 'number' ? 'step="any"' : ''}>`;
    }
    return `<div class="form-group" style="${f.span ? 'grid-column:span ' + f.span : ''}"><label for="${id}">${esc(f.l)}${req}</label>${inp}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}</div>`;
  },
  grid(fields, cols = 3) { return `<div class="fgrid c${cols}">${fields.filter(Boolean).map(UI.field).join('')}</div>`; },
  el(root, k) { return root.querySelector(`[data-k="${k}"]`); },
  get(root) {
    const o = {};
    $$('[data-k]', root).forEach(e => {
      const k = e.dataset.k;
      if (e.type === 'checkbox') o[k] = e.checked;
      else if (e.type === 'number') o[k] = e.value === '' ? '' : num(e.value);
      else if (e.type === 'file') o[k] = e.files && e.files[0];
      else if (e.list) o[k] = (e.dataset.val || '').trim();
      else o[k] = (e.value || '').trim();
    });
    return o;
  },
  set(root, obj) {
    Object.entries(obj).forEach(([k, v]) => {
      const e = UI.el(root, k); if (!e) return;
      if (e.type === 'checkbox') e.checked = !!v;
      else if (e.list) { e.dataset.val = v || ''; e.value = v || ''; }
      else e.value = v == null ? '' : v;
    });
  },
  validate(root) {
    for (const e of $$('[data-req="1"]', root)) {
      const v = e.list ? e.dataset.val : e.value;
      if (e.offsetParent !== null && (v == null || String(v).trim() === '' || (e.type === 'number' && num(v) <= 0 && !e.readOnly))) {
        const lab = e.closest('.form-group')?.querySelector('label')?.textContent.replace('*', '').trim();
        e.focus(); fail(`"${lab}" দিন!`);
      }
    }
  },
  reset(root, keep = []) {
    $$('[data-k]', root).forEach(e => {
      if (keep.includes(e.dataset.k)) return;
      if (e.type === 'checkbox') e.checked = false;
      else if (e.tagName === 'SELECT') { if (!e.disabled) e.selectedIndex = 0; }
      else if (e.type === 'date') { /* তারিখ রেখে দাও */ }
      else { e.value = ''; if (e.list) e.dataset.val = ''; }
    });
  },
  opts(list, vf, tf, blank = '------------') { return (blank !== null ? `<option value="">${blank}</option>` : '') + list.map(x => `<option value="${esc(vf(x))}">${esc(tf(x))}</option>`).join(''); },
  fill(sel, list, vf, tf, blank) { if (!sel) return; const cur = sel.value; sel.innerHTML = UI.opts(list, vf, tf, blank); if ([...sel.options].some(o => o.value === cur)) sel.value = cur; },
  table(cols, rows, opts = {}) {
    // cols: [{h, f:(row)=>html, r(right align), sum:true}]
    const foot = cols.some(c => c.sum) ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.r ? 'r' : ''}"><b>${c.sum ? amt(sum(rows, r => num(c.v ? c.v(r) : c.f(r)))) : (i === 0 ? 'মোট' : '')}</b></td>`).join('')}</tr></tfoot>` : '';
    return `<div class="table-wrap"><table class="${opts.cls || ''}"><thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${cols.map(c => `<td class="${c.r ? 'r' : ''}">${c.f(r) == null ? '' : c.f(r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="empty">${opts.empty || 'কোনো তথ্য নেই'}</td></tr>`}</tbody>${foot}</table></div>`;
  },
  btn(label, onclick, cls = 'btn-primary', attrs = '') { return `<button class="btn ${cls}" ${attrs} onclick="${onclick}">${label}</button>`; },
  card(title, body, extra = '') { return `<div class="card">${title ? `<div class="card-title">${title}${extra}</div>` : ''}${body}</div>`; },
  info(pairs) { return `<div class="info-grid">${pairs.map(([l, v]) => `<div class="info-item"><label>${esc(l)}</label><p>${v}</p></div>`).join('')}</div>`; },
  modal(title, body, footer = '') {
    const m = document.createElement('div'); m.className = 'modal open';
    m.innerHTML = `<div class="modal-box wide"><div class="modal-header"><h3>${title}</h3><button class="modal-close">×</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}</div>`;
    m.querySelector('.modal-close').onclick = () => m.remove();
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    document.body.appendChild(m); return m;
  },
};

// ─────────────── পিকার বাইন্ডিং (শাখা → সমিতি → কর্মী → সদস্য → একাউন্ট) ───────────────
const Pick = {
  async branch(root, k = 'branch', opts = {}) {
    const sel = UI.el(root, k); if (!sel) return;
    const allowed = allowedBranches();
    let list = await Data.branches();
    if (allowed) list = list.filter(b => allowed.includes(b.code));
    if (opts.leafOnly) list = list.filter(b => b.type !== 'Head Office' || list.length === 1);
    UI.fill(sel, list, b => b.code, b => b.code + ' - ' + b.name, opts.all ? '— সব শাখা —' : '------------');
    if (!opts.all || allowed) sel.value = list.some(b => b.code === App.branch) ? App.branch : (list[0] ? list[0].code : '');
    if (allowed && allowed.length === 1) sel.disabled = true;
    sel.dispatchEvent(new Event('change'));
  },
  async samity(root, k = 'samity', bk = 'branch', opts = {}) {
    const sel = UI.el(root, k), bsel = UI.el(root, bk); if (!sel || !bsel) return;
    const load = async () => {
      const list = bsel.value ? await Data.samities(bsel.value) : [];
      UI.fill(sel, list.filter(s => opts.closed || s.status !== 'closed'), s => s.code, s => s.code + ' - ' + s.name, opts.all === false ? '------------' : '— সব সমিতি —');
      sel.dispatchEvent(new Event('change'));
    };
    bsel.addEventListener('change', load); await load();
  },
  async employee(root, k = 'employee', bk = 'branch', opts = {}) {
    const sel = UI.el(root, k), bsel = UI.el(root, bk); if (!sel) return;
    const load = async () => {
      const list = await Data.employees(bsel && bsel.value ? bsel.value : (opts.allBranch ? '' : App.branch));
      UI.fill(sel, list.filter(e => e.status !== 'inactive'), e => e.empId, e => e.empId + '-' + e.name, opts.blank || '------------');
    };
    if (bsel) bsel.addEventListener('change', load); await load();
  },
  // সদস্য পিকার: datalist সার্চ (আইডি/নাম/মোবাইল)
  async member(root, k = 'member', bk = 'branch', opts = {}) {
    const inp = UI.el(root, k), bsel = UI.el(root, bk), ssel = opts.samityKey ? UI.el(root, opts.samityKey) : null; if (!inp) return;
    const dl = inp.list;
    let members = [];
    const load = async () => {
      members = bsel && bsel.value ? await Data.members(bsel.value, ssel && ssel.value) : [];
      if (!opts.closed) members = members.filter(m => m.status !== 'closed');
      dl.innerHTML = members.slice(0, 5000).map(m => `<option value="${esc(m.id)} - ${esc(m.name)}${m.mobile ? ' (' + esc(m.mobile) + ')' : ''}">`).join('');
      inp.value = ''; inp.dataset.val = '';
    };
    const resolve = () => {
      const v = inp.value.trim(); if (!v) { inp.dataset.val = ''; return; }
      const id = v.split(' - ')[0].trim();
      let m = members.find(x => x.id === id) || members.find(x => x.mobile && x.mobile === v);
      if (!m && v.length >= 3) { const c = members.filter(x => x.name.toLowerCase().includes(v.toLowerCase())); if (c.length === 1) m = c[0]; }
      const prev = inp.dataset.val;
      inp.dataset.val = m ? m.id : '';
      if (m) inp.value = `${m.id} - ${m.name}`;
      if (prev !== inp.dataset.val) inp.dispatchEvent(new CustomEvent('picked', { detail: m || null }));
    };
    inp.addEventListener('change', resolve);
    inp.addEventListener('blur', resolve);
    if (bsel) bsel.addEventListener('change', load);
    if (ssel) ssel.addEventListener('change', load);
    await load();
    inp._members = () => members;
  },
  // একাউন্ট পিকার: সদস্য বাছাই হলে তার একাউন্টগুলো
  async account(root, k = 'account', mk = 'member', bk = 'branch', filter = {}) {
    const sel = UI.el(root, k), minp = UI.el(root, mk), bsel = UI.el(root, bk); if (!sel) return;
    const load = async () => {
      const mid = minp ? (minp.dataset.val || minp.value) : '';
      let list = (bsel && bsel.value && (mid || filter.noMember)) ? await Data.accountsOf(bsel.value, mid, filter.kind, filter.type) : [];
      if (!filter.closed) list = list.filter(a => a.status !== 'closed');
      UI.fill(sel, list, a => a.accNo, a => `${a.accNo} - ${a.title || ''} [${typeName(a.kind, a.type)}]`);
      if (list.length === 1) sel.value = list[0].accNo;
      sel.dispatchEvent(new Event('change'));
    };
    if (minp) minp.addEventListener('picked', load);
    if (bsel) bsel.addEventListener('change', load);
    await load();
  },
  ledger(sel, filter, blank = '------------') {
    return Data.ledgers().then(ls => UI.fill(sel, ls.filter(filter || (l => l.leaf)), l => l.code, l => l.code + ' - ' + l.name, blank));
  },
  dates(root, keys, val) { keys.forEach(k => { const e = UI.el(root, k); if (e && !e.value) e.value = val; }); },
};
function typeName(kind, type) {
  if (kind === 'dep') return (REF.DEP[type] || {}).short || type;
  if (kind === 'loan') return (REF.LOAN[type] || {}).short || type;
  if (kind === 'share') return 'Share';
  if (kind === 'other') return (REF.OTHER[type] || {}).name || type;
  return type;
}
function typeFull(kind, type) {
  if (kind === 'dep') return type + ' - ' + ((REF.DEP[type] || {}).name || '');
  if (kind === 'loan') return type + ' - ' + ((REF.LOAN[type] || {}).name || '');
  if (kind === 'other') return type + ' - ' + ((REF.OTHER[type] || {}).name || '');
  return kind;
}

// ─────────────── প্রিন্ট ───────────────
function printHTML(title, body, opts = {}) {
  const w = window.open('', '_blank');
  if (!w) { toast('পপ-আপ ব্লক করা আছে — অনুমতি দিন', 'error'); return; }
  const branchLine = opts.branchName ? `<div>${esc(opts.branchName)}</div>` : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
  <style>body{font-family:'Hind Siliguri',sans-serif;font-size:12px;margin:18px;color:#000}
  .ph{text-align:center;margin-bottom:10px}.ph h2{margin:0;font-size:18px}.ph h3{margin:6px 0 0;font-size:14px;text-decoration:underline}.ph div{font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #444;padding:3px 5px;vertical-align:top}th{background:#eee}
  td.r,th.r{text-align:right}.empty{text-align:center;color:#777}tfoot td{background:#f4f4f4}.meta{display:flex;justify-content:space-between;font-size:11px;margin:4px 0}
  .grp td{background:#f7f7f7;font-weight:700}.sig{display:flex;justify-content:space-between;margin-top:50px}.sig div{border-top:1px solid #000;padding-top:3px;width:22%;text-align:center}
  @page{size:${opts.landscape ? 'A4 landscape' : 'A4'};margin:10mm}</style></head><body>
  <div class="ph"><h2>${esc(App.org.name)}</h2><div>নিবন্ধন নং: ${esc(App.org.reg)}</div>${branchLine}<h3>${esc(title)}</h3>${opts.sub ? `<div>${opts.sub}</div>` : ''}</div>
  ${body}
  ${opts.noSig ? '' : '<div class="sig"><div>প্রস্তুতকারী</div><div>হিসাবরক্ষক</div><div>শাখা ব্যবস্থাপক</div><div>পরিচালক</div></div>'}
  <div style="font-size:10px;color:#666;margin-top:8px">প্রিন্ট: ${new Date().toLocaleString('en-GB')} — ${esc(App.user ? App.user.userId || App.user.email : '')}</div>
  <script>setTimeout(()=>window.print(),600)<\/script></body></html>`);
  w.document.close();
}
function downloadExcel(filename, html) {
  const blob = new Blob(['﻿<html><head><meta charset="utf-8"></head><body>' + html + '</body></html>'], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename + '.xls'; a.click();
}

// ─────────────── পেজ রেজিস্ট্রি ও রাউটার ───────────────
// App.page(id, {title, render(): html, init(el), perm?})
App.page = function (id, def) { App.pages[id] = { id, ...def }; };
App.go = function (id, params) {
  if (location.hash.slice(1) !== id) { App._params = params; location.hash = id; }
  else App.render(id, params);
};
App.canSee = function (id) {
  if (!App.user) return false;
  if (isAdmin()) return true;
  const p = App.pages[id]; if (p && p.always) return true;
  const pages = App.user._pages; // গ্রুপ + ইউজার পারমিশন মিলিয়ে
  return !pages || pages.includes(id);
};
App.render = async function (id, params) {
  const pg = App.pages[id] || App.pages.dashboard || Object.values(App.pages)[0];
  const main = $('#mainContent');
  if (!pg) { main.innerHTML = '<div class="card">পেজ নেই</div>'; return; }
  if (!App.canSee(pg.id)) { main.innerHTML = '<div class="card"><div class="alert alert-danger">এই পেজ দেখার অনুমতি নেই।</div></div>'; return; }
  App.current = pg.id;
  $$('.sub-item.active,.nav-item.active').forEach(e => e.classList.remove('active'));
  const si = $(`.sub-item[data-page="${pg.id}"]`) || $(`.nav-item[data-page="${pg.id}"]`);
  if (si) { si.classList.add('active'); const sm = si.closest('.submenu'); if (sm && !sm.classList.contains('open')) { sm.classList.add('open'); sm.previousElementSibling.classList.add('open'); } }
  main.innerHTML = `<div class="page" id="page-${pg.id}"><div class="page-title">${pg.icon || ''} ${esc(pg.title)}</div><div class="page-body">${pg.render ? pg.render(params || App._params || {}) : ''}</div></div>`;
  window.scrollTo(0, 0);
  if (window.innerWidth < 768) closeSidebar();
  const el = $('#page-' + pg.id);
  if (pg.init) { try { await pg.init(el, params || App._params || {}); } catch (e) { console.error(e); toast('পেজ লোডে সমস্যা: ' + e.message, 'error'); } }
  App._params = null;
};
window.addEventListener('hashchange', () => { if (App.user) App.render(location.hash.slice(1) || 'dashboard'); });

// ─────────────── সাইডবার ───────────────
function buildSidebar() {
  const sb = $('#sidebarNav');
  sb.innerHTML = MENU.map(sec => {
    if (sec.page) return App.canSee(sec.page) ? `<div class="nav-section"><div class="nav-item" data-page="${sec.page}" onclick="App.go('${sec.page}')"><span><span class="nav-icon">${sec.icon}</span>${esc(sec.t)}</span></div></div>` : '';
    const items = sec.items.filter(([, p]) => App.pages[p] && App.canSee(p));
    if (!items.length) return '';
    return `<div class="nav-section"><div class="nav-item" onclick="toggleMenu(this)"><span><span class="nav-icon">${sec.icon}</span>${esc(sec.t)}</span><span class="arrow">▶</span></div>
      <div class="submenu">${items.map(([t, p]) => `<div class="sub-item" data-page="${p}" onclick="App.go('${p}')">${esc(t)}</div>`).join('')}</div></div>`;
  }).join('');
  const s = $('#menuSearch'); if (s) s.value = '';
}
function toggleMenu(el) {
  const sub = el.nextElementSibling, open = sub.classList.contains('open');
  $$('.submenu.open').forEach(s => s.classList.remove('open')); $$('.nav-item.open').forEach(n => n.classList.remove('open'));
  if (!open) { sub.classList.add('open'); el.classList.add('open'); }
}
function filterMenu(q) {
  q = q.trim().toLowerCase();
  $$('#sidebarNav .nav-section').forEach(sec => {
    const subs = $$('.sub-item', sec); let any = false;
    subs.forEach(s => { const hit = !q || s.textContent.toLowerCase().includes(q); s.style.display = hit ? '' : 'none'; any = any || hit; });
    sec.style.display = (!q || any || (!subs.length && sec.textContent.toLowerCase().includes(q))) ? '' : 'none';
    const sm = $('.submenu', sec); if (sm) sm.classList.toggle('open', !!q && any);
  });
}
let sidebarOpen = false;
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  $('#sidebar').classList.toggle('closed', !sidebarOpen); $('#sidebar').classList.toggle('open', sidebarOpen);
  if (window.innerWidth >= 768) $('#mainContent').classList.toggle('shifted', sidebarOpen);
  else $('#sidebarOverlay').classList.toggle('show', sidebarOpen);
}
function closeSidebar() { sidebarOpen = false; $('#sidebar').classList.add('closed'); $('#sidebar').classList.remove('open'); $('#mainContent').classList.remove('shifted'); $('#sidebarOverlay').classList.remove('show'); }

// ─────────────── লগইন / সেশন ───────────────
async function doLogin() {
  const u = $('#loginUser').value.trim(), p = $('#loginPass').value;
  const err = $('#loginError'); err.style.display = 'none';
  if (!u || !p) { err.textContent = 'ইউজার আইডি ও পাসওয়ার্ড দিন'; err.style.display = 'block'; return; }
  const email = u.includes('@') ? u : u.toLowerCase() + LOGIN_DOMAIN;
  const btn = $('.btn-login'); btn.disabled = true; btn.textContent = 'লগইন হচ্ছে...';
  try { await auth.signInWithEmailAndPassword(email, p); }
  catch (e) { err.textContent = 'ইউজার আইডি বা পাসওয়ার্ড ভুল'; err.style.display = 'block'; }
  finally { btn.disabled = false; btn.textContent = 'লগইন করুন →'; }
}
async function doLogout() { try { await auth.signOut(); } catch (e) {} location.hash = ''; location.reload(); }
async function loadPermissions() {
  if (isAdmin()) { App.user._pages = null; return; }
  let pages = [];
  if (App.user.group) { const g = await db.collection('permGroups').doc(App.user.group).get(); if (g.exists) pages = g.data().pages || []; }
  if (Array.isArray(App.user.pages) && App.user.pages.length) pages = App.user.pages; // ইউজার-ভিত্তিক ওভাররাইড
  App.user._pages = [...new Set([...pages, 'dashboard', 'home', 'profile'])];
}
async function onSignedIn(fbUser) {
  const ud = await db.collection('users').doc(fbUser.uid).get();
  if (!ud.exists) {
    // প্রথম ইউজার → Super Admin হিসেবে বুটস্ট্র্যাপ
    const any = await db.collection('users').limit(1).get();
    if (any.empty) {
      const u = { uid: fbUser.uid, email: fbUser.email, userId: fbUser.email.split('@')[0], name: 'Admin', group: 'Super Admin', branch: '', status: 'active', flags: { bm: true, backDate: true, controlling: true }, createdAt: FV.serverTimestamp() };
      await db.collection('users').doc(fbUser.uid).set(u);
      await db.collection('config').doc('bootstrap').set({ by: fbUser.uid, at: FV.serverTimestamp() }).catch(() => {});
      App.user = u;
    } else { toast('এই ইউজারের প্রোফাইল নেই — Admin এর সাথে যোগাযোগ করুন', 'error'); await auth.signOut(); return; }
  } else App.user = { uid: fbUser.uid, ...ud.data() };
  // পুরোনো (v1) ইউজার ডক: role → group
  if (!App.user.group && App.user.role) App.user.group = App.user.role === 'Admin' ? 'Super Admin' : App.user.role;
  if (App.user.status === 'inactive') { toast('আপনার ইউজার নিষ্ক্রিয় করা আছে', 'error'); await auth.signOut(); return; }
  await loadPermissions();
  const bl = await Data.branches();
  const saved = localStorage.getItem('gaaBranch');
  const allowed = allowedBranches();
  App.branch = (saved && (!allowed || allowed.includes(saved)) && bl.some(b => b.code === saved)) ? saved : (App.user.branch || (bl[0] && bl[0].code) || '');
  db.collection('users').doc(fbUser.uid).update({ lastActivity: FV.serverTimestamp() }).catch(() => {});
  startApp();
}
async function startApp() {
  $('#loginScreen').style.display = 'none';
  $('#app').style.display = 'block';
  $('#hdrUser').textContent = (App.user.userId || App.user.email || '') + ' • ' + (App.user.group || '');
  await refreshBranchBadge();
  buildSidebar();
  loadNotice();
  if (window.innerWidth >= 768) { sidebarOpen = false; toggleSidebar(); }
  App.render(location.hash.slice(1) || 'dashboard');
}
async function refreshBranchBadge() {
  const b = await Data.branch(App.branch);
  $('#hdrBranch').textContent = b ? `${b.code} - ${b.name}` : 'শাখা নেই';
  $('#hdrDate').textContent = b ? 'Business Date: ' + fmtD(b.businessDate || today()) : fmtD(today());
}
async function showBranchModal() {
  const allowed = allowedBranches();
  let list = await Data.branches(); if (allowed) list = list.filter(b => allowed.includes(b.code));
  const m = UI.modal('🏢 শাখা পরিবর্তন', `<select id="bmSel" class="full">${UI.opts(list, b => b.code, b => b.code + ' - ' + b.name, null)}</select>`, `<button class="btn btn-primary" id="bmOk">✅ নির্বাচন করুন</button>`);
  $('#bmSel', m).value = App.branch;
  $('#bmOk', m).onclick = async () => { App.branch = $('#bmSel', m).value; localStorage.setItem('gaaBranch', App.branch); m.remove(); await refreshBranchBadge(); App.render(App.current || 'dashboard'); };
}
async function loadNotice() {
  try {
    const s = await db.collection('notices').orderBy('createdAt', 'desc').limit(5).get();
    const n = s.docs.map(d => d.data()).find(x => !x.branch || x.branch === App.branch);
    const bar = $('#noticeBar');
    if (n) { bar.innerHTML = `<marquee style="color:${{ Red: '#c0392b', Green: '#1e8449', Yellow: '#b7950b', Black: '#000' }[n.color] || '#c0392b'}">${esc(n.text)}</marquee>`; bar.style.display = 'block'; }
    else bar.style.display = 'none';
  } catch (e) {}
}
document.addEventListener('DOMContentLoaded', () => auth.onAuthStateChanged(async u => {
  $('#loader').style.display = 'none';
  if (u) { try { await onSignedIn(u); } catch (e) { console.error(e); toast('লোড সমস্যা: ' + e.message, 'error'); } }
  else { App.user = null; $('#app').style.display = 'none'; $('#loginScreen').style.display = 'flex'; }
}));
document.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#loginScreen').style.display === 'flex') doLogin(); });

// ─────────────── জেনেরিক CRUD পেজ ───────────────
/* opts = {id, title, icon, coll, key (doc id field), fields:[spec], cols:2|3,
     list:{cols:[{h,f}], filter:[spec], query:(f)=>Query|Promise<rows>}, autoId:(data)=>Promise<id>,
     before:(data, isEdit, old)=>data, after:(data,isEdit)=>{}, submitLabel, searchLabel, canDelete, extraButtons } */
function CrudPage(o) {
  App.page(o.id, {
    title: o.title, icon: o.icon || '',
    render: () => `
      <div class="card">${o.top || ''}${UI.grid(o.fields, o.cols || 3)}
        <div class="actions">${UI.btn(o.submitLabel || '💾 সংরক্ষণ', `CrudPage.save('${o.id}',this)`, 'btn-success')}
        ${UI.btn('↺ নতুন', `CrudPage.reset('${o.id}')`, 'btn-secondary')}${o.extraButtons || ''}</div></div>
      ${o.list ? `<div class="card"><div class="card-title">🔍 ${o.searchLabel || 'অনুসন্ধান'}</div>${o.list.filter ? UI.grid(o.list.filter, 4) : ''}
        <div class="actions">${UI.btn('🔍 ' + (o.searchLabel || 'অনুসন্ধান'), `CrudPage.search('${o.id}',this)`)}${UI.btn('🖨️ প্রিন্ট', `CrudPage.print('${o.id}')`, 'btn-outline')}</div>
        <div class="crud-list" style="margin-top:10px"></div></div>` : ''}`,
    init: async (el) => {
      el._edit = null;
      if (o.init) await o.init(el);
      if (o.list && o.list.auto !== false) await CrudPage.search(o.id);
    },
  });
  CrudPage.defs[o.id] = o;
}
CrudPage.defs = {};
CrudPage.root = id => $('#page-' + id);
CrudPage.reset = function (id) {
  const o = CrudPage.defs[id], el = CrudPage.root(id); el._edit = null;
  UI.reset($('.card', el), o.keepOnReset || ['branch']);
  $$('[data-k]', $('.card', el)).forEach(e => { if (e.dataset.lockEdit) e.readOnly = false; });
  if (o.onReset) o.onReset(el);
};
CrudPage.save = function (id, btn) {
  return guard(btn, async () => {
    const o = CrudPage.defs[id], el = CrudPage.root(id), form = $('.card', el);
    UI.validate(form);
    let data = UI.get(form);
    for (const f of o.fields) if (f.t === 'file') { const file = data[f.k]; delete data[f.k]; if (file) { busy(true, 'ছবি আপলোড হচ্ছে...'); try { data[f.k + 'Url'] = await uploadImage(file); } finally { busy(false); } } }
    const isEdit = !!el._edit;
    if (o.before) data = await o.before(data, isEdit, el._edit);
    let docId = isEdit ? el._edit.id : (o.key && data[o.key]) || null;
    if (!isEdit && o.autoId) { docId = await o.autoId(data); if (o.key) data[o.key] = docId; }
    const ref = docId ? db.collection(o.coll).doc(String(docId)) : db.collection(o.coll).doc();
    if (!isEdit) { const ex = await ref.get(); if (ex.exists) fail('এই আইডি আগে থেকেই আছে: ' + docId); data.createdBy = App.user.userId || App.user.uid; data.createdAt = FV.serverTimestamp(); }
    else { data.updatedBy = App.user.userId || App.user.uid; data.updatedAt = FV.serverTimestamp(); }
    await ref.set(data, { merge: true });
    if (o.after) await o.after({ ...data, id: ref.id }, isEdit);
    Cache.drop(o.cacheKey || '');
    toast(isEdit ? '✅ আপডেট হয়েছে' : '✅ সংরক্ষণ হয়েছে' + (docId ? ' — আইডি: ' + docId : ''));
    CrudPage.reset(id);
    if (o.list) CrudPage.search(id);
  });
};
CrudPage.search = async function (id, btn) {
  const o = CrudPage.defs[id], el = CrudPage.root(id); if (!el) return;
  const box = $('.crud-list', el); if (!box) return;
  return guard(btn, async () => {
    box.innerHTML = '<div class="mini">লোড হচ্ছে...</div>';
    const f = o.list.filter ? UI.get($$('.card', el)[1]) : {};
    let rows = o.list.query ? await o.list.query(f) : (await db.collection(o.coll).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    if (rows && rows.docs) rows = rows.docs.map(d => ({ id: d.id, ...d.data() }));
    if (o.list.post) rows = o.list.post(rows, f);
    el._rows = rows;
    const cols = [...o.list.cols];
    if (o.list.actions !== false) cols.push({ h: 'Action', f: r => `<span class="list-actions">${UI.btn('✏️', `CrudPage.edit('${id}','${esc(r.id)}')`, 'btn-outline btn-sm')}${o.canDelete ? UI.btn('🗑️', `CrudPage.del('${id}','${esc(r.id)}',this)`, 'btn-danger btn-sm') : ''}${o.list.rowActions ? o.list.rowActions(r) : ''}</span>` });
    box.innerHTML = `<div class="mini">মোট: ${rows.length}</div>` + UI.table(cols, rows);
  });
};
CrudPage.edit = async function (id, docId) {
  const o = CrudPage.defs[id], el = CrudPage.root(id);
  const d = await db.collection(o.coll).doc(docId).get(); if (!d.exists) return;
  el._edit = { id: d.id, ...d.data() };
  const form = $('.card', el);
  if (o.beforeEdit) await o.beforeEdit(el, el._edit);
  UI.set(form, el._edit);
  if (o.key) { const k = UI.el(form, o.key); if (k) { k.readOnly = true; k.dataset.lockEdit = '1'; } }
  if (o.onEdit) await o.onEdit(el, el._edit);
  window.scrollTo(0, 0); toast('এডিট মোড — পরিবর্তন করে সংরক্ষণ চাপুন', 'info');
};
CrudPage.del = function (id, docId, btn) {
  const o = CrudPage.defs[id];
  if (!confirm('মুছে ফেলবেন?')) return;
  return guard(btn, async () => { if (o.beforeDelete) await o.beforeDelete(docId); await db.collection(o.coll).doc(docId).delete(); Cache.drop(o.cacheKey || ''); toast('মুছে ফেলা হয়েছে'); CrudPage.search(id); });
};
CrudPage.print = function (id) {
  const o = CrudPage.defs[id], el = CrudPage.root(id);
  printHTML(o.title + ' তালিকা', UI.table(o.list.cols, el._rows || []), { landscape: true, noSig: true });
};

// সাধারণ রিপোর্ট পেজ: ফিল্টার + "Print Report" + স্ক্রিনে প্রিভিউ
/* opts = {id, title, filters:[spec], run:(f)=>Promise<{html, sub, landscape}>, init(el), buttons:[[label, fnName]]} */
function ReportPage(o) {
  App.page(o.id, {
    title: o.title, icon: o.icon || '📄',
    render: () => `<div class="report-filter">${UI.grid(o.filters, o.cols || 4)}
      <div class="filter-actions">${UI.btn('🔍 দেখুন', `ReportPage.run('${o.id}',this)`)}${UI.btn('🖨️ Print Report', `ReportPage.run('${o.id}',this,true)`, 'btn-print')}${UI.btn('📥 Excel', `ReportPage.excel('${o.id}')`, 'btn-outline')}${(o.buttons || []).map(([l, m]) => UI.btn(l, `ReportPage.run('${o.id}',this,true,'${m}')`, 'btn-outline')).join('')}</div></div>
      <div class="card rpt-out"><div class="mini">ফিল্টার দিয়ে "দেখুন" চাপুন</div></div>`,
    init: async (el) => {
      const f = $('.report-filter', el);
      const keys = o.filters.map(x => x.k);
      if (keys.includes('branch')) await Pick.branch(f, 'branch', { all: o.allBranch });
      if (keys.includes('samity')) await Pick.samity(f, 'samity', 'branch');
      if (keys.includes('employee')) await Pick.employee(f, 'employee', 'branch', { blank: '— সব —' });
      if (keys.includes('member')) await Pick.member(f, 'member', 'branch', { samityKey: keys.includes('samity') ? 'samity' : null, closed: true });
      const bd = await businessDate();
      ['date', 'upto', 'from'].forEach(k => { const e = UI.el(f, k); if (e && !e.value) e.value = k === 'from' ? (o.fromDefault === 'month' ? bd.slice(0, 8) + '01' : bd) : bd; });
      if (o.init) await o.init(el, f);
    },
  });
  ReportPage.defs[o.id] = o;
}
ReportPage.defs = {};
ReportPage.run = function (id, btn, print, mode) {
  const o = ReportPage.defs[id], el = $('#page-' + id);
  return guard(btn, async () => {
    const f = UI.get($('.report-filter', el));
    $$('[data-req="1"]', $('.report-filter', el)).forEach(e => { if (!(e.list ? e.dataset.val : e.value)) fail('"' + e.closest('.form-group').querySelector('label').textContent.replace('*', '').trim() + '" দিন'); });
    busy(true, 'রিপোর্ট তৈরি হচ্ছে...');
    let res; try { res = await o.run(f, mode); } finally { busy(false); }
    const b = f.branch ? await Data.branch(f.branch) : null;
    el._last = { ...res, branchName: b ? b.code + ' - ' + b.name : 'সকল শাখা' };
    $('.rpt-out', el).innerHTML = `<div class="mini" style="margin-bottom:6px">${res.sub || ''}</div>` + res.html;
    if (print) printHTML(res.title || o.title, res.html, { sub: res.sub, landscape: res.landscape != null ? res.landscape : o.landscape, branchName: el._last.branchName, noSig: res.noSig });
  });
};
ReportPage.excel = function (id) { const el = $('#page-' + id); if (!el._last) return toast('আগে "দেখুন" চাপুন', 'error'); downloadExcel(ReportPage.defs[id].title, el._last.html); };
const F = { // সাধারণ ফিল্টার স্পেক
  branch: { k: 'branch', l: 'শাখার নাম', t: 'select' },
  samity: { k: 'samity', l: 'সমিতির নাম', t: 'select' },
  employee: { k: 'employee', l: 'ফিল্ড অফিসার', t: 'select' },
  member: { k: 'member', l: 'সদস্য আইডি', t: 'member' },
  from: { k: 'from', l: 'তারিখ হতে', t: 'date' },
  upto: { k: 'upto', l: 'তারিখ পর্যন্ত', t: 'date' },
  date: { k: 'date', l: 'রিপোর্টের তারিখ', t: 'date' },
  btype: { k: 'btype', l: 'Branch Type', t: 'select', opts: [['me', 'Only Me'], ['all', 'All Branch'], ['others', 'All Others Branch']] },
  user: { k: 'user', l: 'ইউজার', t: 'select', opts: [['', '— সব —']] },
};
