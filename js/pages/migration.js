// ═══════════════════════════════════════════════════════════════
// সেটিংস → Balance Migrations / Member Migrations (eKisti হুবহু)
// পুরোনো হিসাব একসাথে বসানো: Excel আপলোড → কলাম ম্যাপিং → গ্রিডে ঠিক করা → Submit
// ড্রাফট সারি থাকে migDraft/{bal|mem}_{branch} এ (রিফ্রেশ করলেও হারায় না)
// টাকা বসে "Adjustment (20010000)" লেজারের বিপরীতে — ক্যাশে কোনো লেনদেন হয় না
// ═══════════════════════════════════════════════════════════════
const Mig = {
  ADJ: '20010000',
  rid: () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
  f2: v => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num(v)),
  // SheetJS — প্রয়োজন হলে লোড
  xlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return Mig._xp || (Mig._xp = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => ok(window.XLSX); s.onerror = () => { Mig._xp = null; no(new Error('Excel লাইব্রেরি লোড হয়নি — ইন্টারনেট চেক করুন')); }; document.head.appendChild(s); }));
  },
  async readExcel(file) {
    const X = await Mig.xlsx();
    const wb = X.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = X.utils.sheet_to_json(ws, { defval: '', raw: true });
    const head = (X.utils.sheet_to_json(ws, { header: 1, blankrows: false })[0] || []).map(h => String(h).trim()).filter(Boolean);
    return { cols: head, rows };
  },
  date(v) { const r = Mig._date(v); return r && r < '1990' ? '' : r; },   // eKisti খালি তারিখ "0001-01-01" দেয় — বাদ
  _date(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) { const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000); return d.toISOString().slice(0, 10); }
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return `${m[1]}-${pad(m[2], 2)}-${pad(m[3], 2)}`;
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return `${m[3]}-${pad(m[2], 2)}-${pad(m[1], 2)}`;
    return '';
  },
  freq(v) {
    const s = String(v || '').trim().toUpperCase(); if (!s) return '';
    if (REF.FREQ[s]) return s;
    const map = { DAILY: 'D', WEEKLY: 'W', MONTHLY: 'M', QUARTERLY: 'Q', 'HALF YEARLY': 'H', YEARLY: 'Y', 'দৈনিক': 'D', 'সাপ্তাহিক': 'W', 'মাসিক': 'M' };
    return map[s] || (REF.FREQ[s[0]] ? s[0] : '');
  },
  sex(v) { const s = String(v || '').trim().toLowerCase(); if (!s) return ''; if (/^(m|male|পুরুষ)/.test(s)) return 'Male'; if (/^(f|female|মহিলা|নারী)/.test(s)) return 'Female'; if (/^(o|third|তৃতীয়)/.test(s)) return 'Third Gender'; return ''; },
  // Excel কলাম → সফটওয়্যার ফিল্ড ম্যাপিং টেবিল (একই ফিল্ড দুবার নয়)
  drawMapping(el, cols, model) {
    const box = $('.mig-map', el); box.hidden = false;
    $('.mig-map-body', el).innerHTML = cols.map(c => `<tr><td>${esc(c)}</td><td><select class="mig-msel" data-col="${esc(c)}"><option value="">Select Software Field</option>${Object.entries(model).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></td></tr>`).join('');
    // নাম মিলে গেলে অটো ম্যাপ
    $$('.mig-msel', el).forEach(s => { const c = s.dataset.col.toLowerCase().replace(/[^a-z0-9]/g, ''); const hit = Object.entries(model).find(([k, l]) => l.toLowerCase().replace(/[^a-z0-9]/g, '') === c || k.replace(/_/g, '') === c); if (hit && !$$('.mig-msel', el).some(o => o !== s && o.value === hit[0])) s.value = hit[0]; s.dataset.prev = s.value; });
    $$('.mig-msel', el).forEach(s => s.addEventListener('change', () => {
      if (s.value && $$('.mig-msel', el).some(o => o !== s && o.value === s.value)) { toast(`${model[s.value]} is already selected. Please choose a different field.`, 'error'); s.value = ''; }
      s.dataset.prev = s.value;
    }));
  },
  mappings(el) { return $$('.mig-msel', el).filter(s => s.value).map(s => ({ excel_column: s.dataset.col, model_column: s.value })); },
  async upload(el) {
    const f = UI.el(el, 'excel').files[0]; if (!f) fail('Please select a file!');
    busy(true, 'Excel পড়া হচ্ছে...');
    try { el._xl = await Mig.readExcel(f); } finally { busy(false); }
    if (!el._xl.cols.length) fail('Excel ফাইলে কোনো কলাম পাওয়া যায়নি');
    Mig.drawMapping(el, el._xl.cols, el._model);
    toast(`✅ File uploaded successfully — ${el._xl.rows.length} rows, ${el._xl.cols.length} columns`);
  },
  async loadDraft(key) { const d = await db.collection('migDraft').doc(key).get(); return (d.exists && d.data().rows) || []; },
  saveDraft(el) {
    clearTimeout(el._st);
    el._st = setTimeout(() => db.collection('migDraft').doc(el._dkey).set({ rows: el._rows.map(r => { const o = { ...r }; delete o.err; delete o.msg; return o; }), at: FV.serverTimestamp(), by: App.user.userId }).catch(e => toast('ড্রাফট সেভ হয়নি: ' + e.message, 'error')), 800);
  },
  async flushDraft(el) { clearTimeout(el._st); await db.collection('migDraft').doc(el._dkey).set({ rows: el._rows.map(r => { const o = { ...r }; delete o.err; delete o.msg; return o; }), at: FV.serverTimestamp(), by: App.user.userId }); },
  head(el, title, hint) {
    return `<div class="mig-dhead"><b>${title}</b><span class="mig-badge err" hidden>0 errors</span><span class="mig-badge rows">0 rows</span></div><div class="mig-hint">${hint}</div>`;
  },
  badges(el, n, errs) { const e = $('.mig-badge.err', el); e.hidden = !errs; e.textContent = errs + (errs === 1 ? ' error' : ' errors'); $('.mig-badge.rows', el).textContent = n + (n === 1 ? ' row' : ' rows'); },
  form(title, fields, btns, model) {
    return UI.card(title, UI.grid(fields, 4)
      + `<div class="mig-up"><label class="mig-zone">📎 <span class="mig-fname">Attach Excel</span><small>xls, xlsx</small><input type="file" data-k="excel" accept=".xls,.xlsx,.csv" hidden onchange="this.closest('.mig-zone').querySelector('.mig-fname').textContent=this.files.length?this.files[0].name:'Attach Excel';this.closest('.mig-zone').classList.toggle('on',this.files.length>0)"></label>
      <div class="filter-actions">${btns}</div></div>
      <div class="mig-map" hidden><div class="form-sep">Mapping Excel Data</div><table class="tbl mig-mtbl"><thead><tr><th>Excel Column</th><th>Migration Column</th></tr></thead><tbody class="mig-map-body"></tbody></table><div class="actions">${UI.btn('Process Excel File', model, 'btn-success')}</div></div>`);
  },
};

// ───────────────────────── Balance Migrations ─────────────────────────
const BAL_MODEL = {
  center_code: 'Somity Code', branch_client_id: 'Member ID', client_name: 'Member Name', deposit_balance: 'General Savings (RMC)', security_savings: 'Security Savings (UMC)',
  lnactype_code: 'Loan AC Type', loan_opening_date: 'Opening Date', noof_installment: 'No Of Installment', inst_frequency: 'Inst Frequency', inst_amount: 'Inst Amount',
  loan_amount: 'Loan Amount', emi_down_amount: 'Down Payment', rate_of_profit: 'Profit Rate', total_loan_receive: 'Total Loan Receive', legacy_account: 'Old Loan Account', installment_from_date: 'Installment From Date',
};
const BAL_KEY = { center_code: 'samity', branch_client_id: 'memberId', client_name: 'name', deposit_balance: 'gs', security_savings: 'ss', lnactype_code: 'type', loan_opening_date: 'openDate', noof_installment: 'n', inst_frequency: 'freq', inst_amount: 'inst', loan_amount: 'loan', emi_down_amount: 'down', rate_of_profit: 'rate', total_loan_receive: 'recv', legacy_account: 'oldAcc', installment_from_date: 'fromDate' };
const BAL_FREQ = ['D', 'W', 'M', 'Q'];
const BAL_NUM = ['n', 'inst', 'loan', 'down', 'rate', 'recv', 'gs', 'ss'];

App.page('balMigration', {
  title: 'Balance Migrations', icon: '🔁',
  render: () => Mig.form('Balance Migrations', [{ k: 'branch', l: 'Branch Name', t: 'select' }, { k: 'samity', l: 'Samity Name', t: 'select' }, { k: 'txDate', l: 'Transaction Date', t: 'date', req: 1 }, { k: 'addMembers', l: 'Add Members', t: 'select', req: 1, opts: [['Y', 'Yes'], ['N', 'No']] }],
    UI.btn('Search', 'BalMig.search(this)') + UI.btn('Upload Excel File', 'BalMig.upload(this)', 'btn-outline'), 'BalMig.process(this)')
    + UI.card('', Mig.head(null, 'Balance Migration Data', 'Red rows need a loan type, opening date, and frequency when the loan amount is entered, or they contain a negative amount.')
      + `<div class="mig-strip">${[['inst', 'Inst Amount'], ['loan', 'Loan Amount'], ['down', 'Down Payment'], ['tl', 'Total Loan'], ['recv', 'Total Receive'], ['due', 'Total Due'], ['gs', 'General Savings'], ['ss', 'Security Savings']].map(([k, l]) => `<div><small>${l}</small><b data-s="${k}">0.00</b></div>`).join('')}</div>
      <div class="mig-grid"><table class="tbl mig-tbl"><thead><tr><th colspan="2">Member</th><th colspan="12">Loan Information</th><th colspan="2">Deposit Information</th><th>Action</th></tr>
      <tr><th class="mig-sid">ID</th><th class="mig-sname">Name</th><th>Loan ACType</th><th>OpeningDate</th><th>No OfInst</th><th>InstFreq</th><th>InstAmount</th><th>Inst FromDate</th><th>LoanAmount</th><th>DownPayment</th><th>ProfitRate</th><th>TotalLoan</th><th>TotalReceive</th><th>TotalDue</th><th>GeneralSavings</th><th>SecuritySavings</th><th>Action</th></tr></thead>
      <tbody class="mig-body"><tr class="mig-empty"><td colspan="17">Search a samity to load balance migration data.</td></tr></tbody>
      <tfoot><tr><th colspan="6" style="text-align:right">Total:</th><th data-t="inst">0.00</th><th></th><th data-t="loan">0.00</th><th data-t="down">0.00</th><th></th><th data-t="tl">0.00</th><th data-t="recv">0.00</th><th data-t="due">0.00</th><th data-t="gs">0.00</th><th data-t="ss">0.00</th><th></th></tr></tfoot></table></div>
      <div class="actions">${UI.btn('Submit Balance Migration', 'BalMig.submit(this)', 'btn-success')}</div>`),
  async init(el) {
    if (!isAdmin()) { el.innerHTML = '<div class="card"><div class="alert alert-danger">শুধু Super Admin Balance Migration করতে পারবেন।</div></div>'; return; }
    el._model = BAL_MODEL; el._rows = [];
    await Pick.branch(el); await Pick.samity(el, 'samity', 'branch', { all: false });
    const setKey = async () => { el._dkey = 'bal_' + UI.el(el, 'branch').value; el._rows = await Mig.loadDraft(el._dkey); BalMig.draw(el); if (UI.el(el, 'branch').value) UI.el(el, 'txDate').value = await businessDate(UI.el(el, 'branch').value); };
    UI.el(el, 'branch').addEventListener('change', setKey); await setKey();
    UI.el(el, 'samity').addEventListener('change', () => BalMig.draw(el));
    const body = $('.mig-body', el);
    body.addEventListener('change', e => BalMig.edit(el, e.target));
    body.addEventListener('focusin', e => { if (e.target.type === 'number' && !e.target.readOnly) try { e.target.select(); } catch (x) {} });
    body.addEventListener('wheel', e => { if (e.target.type === 'number' && document.activeElement === e.target) e.target.blur(); }, { passive: true });
  },
});
const BalMig = {
  calc(r) { const P = num(r.loan), tl = r2(P + P * num(r.rate) / 100); return { tl, due: r2(tl - num(r.recv)) }; },
  err(r) {
    if (BAL_NUM.some(k => num(r[k]) < 0)) return 'Negative amount';
    if (num(r.loan) > 0 && (!r.type || !r.openDate || !r.freq)) return 'Loan type, opening date ও frequency দিন';
    if (r.noMember) return 'সদস্য পাওয়া যায়নি';
    return '';
  },
  visible(el) { const s = UI.el(el, 'samity').value; return el._rows.filter(r => !s || r.samity === s); },
  draw(el) {
    const rows = BalMig.visible(el), body = $('.mig-body', el);
    const lopts = LOAN_TYPES.map(([c, t]) => [c, t]);
    if (!rows.length) { body.innerHTML = '<tr class="mig-empty"><td colspan="17">' + (el._rows.length ? 'No Balance Migration Data Found.' : 'Search a samity to load balance migration data.') + '</td></tr>'; BalMig.totals(el); Mig.badges(el, 0, 0); return; }
    let errs = 0;
    const inp = (r, k, t = 'number', ro) => `<input class="mig-in${t === 'number' ? ' num' : ''}" type="${t}" data-id="${r.id}" data-f="${k}" value="${esc(r[k] == null ? '' : r[k])}"${ro ? ' readonly' : ''}>`;
    body.innerHTML = rows.map(r => {
      const e = r.msg || BalMig.err(r); if (e) errs++; const c = BalMig.calc(r);
      return `<tr data-id="${r.id}" class="${e ? 'mig-bad' : ''}" title="${esc(e)}"><td class="mig-sid">${esc(r.memberId || '')}</td><td class="mig-sname">${esc(r.name || '')}</td>
        <td><select class="mig-in" data-id="${r.id}" data-f="type"><option value="">${r.type ? 'Select Account Type' : 'No Account Type'}</option>${lopts.map(([c2, t]) => `<option value="${c2}"${r.type === c2 ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
        <td>${inp(r, 'openDate', 'date')}</td><td>${inp(r, 'n')}</td>
        <td><select class="mig-in" data-id="${r.id}" data-f="freq"><option value=""></option>${BAL_FREQ.map(f => `<option value="${f}"${r.freq === f ? ' selected' : ''}>${esc(REF.FREQ[f])}</option>`).join('')}</select></td>
        <td>${inp(r, 'inst')}</td><td>${inp(r, 'fromDate', 'date')}</td><td>${inp(r, 'loan')}</td><td>${inp(r, 'down')}</td><td>${inp(r, 'rate')}</td>
        <td><input class="mig-in num calc" type="number" value="${c.tl.toFixed(2)}" data-c="tl" readonly></td><td>${inp(r, 'recv')}</td>
        <td><input class="mig-in num calc" type="number" data-id="${r.id}" data-f="due" value="${c.due.toFixed(2)}"></td><td>${inp(r, 'gs')}</td><td>${inp(r, 'ss')}</td>
        <td class="mig-act"><button type="button" class="mig-add" title="Add Row" onclick="BalMig.addRow('${r.id}')">+</button><button type="button" class="mig-rm" title="Remove Row" onclick="BalMig.removeRow('${r.id}')">−</button></td></tr>`;
    }).join('');
    BalMig.totals(el); Mig.badges(el, rows.length, errs);
  },
  totals(el) {
    const t = { inst: 0, loan: 0, down: 0, tl: 0, recv: 0, due: 0, gs: 0, ss: 0 };
    BalMig.visible(el).forEach(r => { const c = BalMig.calc(r); t.inst += num(r.inst); t.loan += num(r.loan); t.down += num(r.down); t.tl += c.tl; t.recv += num(r.recv); t.due += c.due; t.gs += num(r.gs); t.ss += num(r.ss); });
    Object.entries(t).forEach(([k, v]) => { $$(`[data-t="${k}"],[data-s="${k}"]`, el).forEach(x => x.textContent = Mig.f2(v)); });
  },
  edit(el, t) {
    const r = el._rows.find(x => x.id === t.dataset.id); if (!r) return;
    const k = t.dataset.f;
    if (k === 'due') { const tl = BalMig.calc(r).tl; r.recv = Math.max(0, r2(tl - num(t.value))); }
    else r[k] = BAL_NUM.includes(k) ? (t.value === '' ? '' : num(t.value)) : t.value;
    delete r.msg;
    const tr = t.closest('tr'); const c = BalMig.calc(r);
    $('[data-c="tl"]', tr).value = c.tl.toFixed(2); $('[data-f="due"]', tr).value = c.due.toFixed(2); $('[data-f="recv"]', tr).value = r.recv === '' ? '' : r.recv;
    const e = BalMig.err(r); tr.classList.toggle('mig-bad', !!e); tr.title = e;
    BalMig.totals(el); Mig.badges(el, BalMig.visible(el).length, $$('.mig-body tr.mig-bad', el).length); Mig.saveDraft(el);
  },
  search(btn) {
    const el = $('#page-balMigration');
    return guard(btn, async () => {
      const b = UI.el(el, 'branch').value, s = UI.el(el, 'samity').value; if (!b) fail('Please select Branch Name!');
      if (UI.el(el, 'addMembers').value === 'Y') {
        if (!s) fail('সমিতি বাছাই করুন (Add Members = Yes)');
        const have = new Set(el._rows.map(r => r.memberId));
        const add = (await Data.members(b, s)).filter(m => m.status === 'active' && !have.has(m.id)).map(m => ({ id: Mig.rid(), samity: s, memberId: m.id, name: m.name, type: '', openDate: '', n: '', freq: '', inst: '', fromDate: '', loan: '', down: '', rate: '', recv: '', gs: '', ss: '' }));
        el._rows.push(...add); if (add.length) { Mig.saveDraft(el); toast(add.length + ' জন সদস্য যোগ হয়েছে'); }
      }
      el._rows.sort((a, c) => String(a.memberId).localeCompare(String(c.memberId)));
      BalMig.draw(el);
    });
  },
  addRow(id) {
    const el = $('#page-balMigration'); const i = el._rows.findIndex(r => r.id === id); if (i < 0) return; const o = el._rows[i];
    el._rows.splice(i + 1, 0, { id: Mig.rid(), samity: o.samity, memberId: o.memberId, name: o.name, type: '', openDate: '', n: '', freq: '', inst: '', fromDate: '', loan: '', down: '', rate: '', recv: '', gs: '', ss: '' });
    BalMig.draw(el); Mig.saveDraft(el);
  },
  removeRow(id) { const el = $('#page-balMigration'); el._rows = el._rows.filter(r => r.id !== id); BalMig.draw(el); Mig.saveDraft(el); },
  upload(btn) { return guard(btn, () => Mig.upload($('#page-balMigration'))); },
  process(btn) {
    const el = $('#page-balMigration');
    return guard(btn, async () => {
      const b = UI.el(el, 'branch').value; if (!el._xl) fail('Please select a file!'); if (!b) fail('Please select Branch Name!');
      const maps = Mig.mappings(el); if (!maps.length) fail('Please map at least one Excel column to a model field.');
      if (!maps.some(m => m.model_column === 'branch_client_id')) fail('"Member ID" কলাম ম্যাপ করুন');
      const mem = {}; (await Data.members(b)).forEach(m => mem[m.id] = m);
      const sams = await Data.samities(b);
      const loanCode = v => { const s = String(v || '').trim(); if (!s) return ''; if (REF.LOAN[s] && !REF.LOAN[s].staff) return s; const c = s.match(/\d{4}/); if (c && REF.LOAN[c[0]]) return c[0]; const hit = LOAN_TYPES.find(([, t]) => t.toLowerCase().includes(s.toLowerCase())); return hit ? hit[0] : ''; };
      let n = 0;
      el._xl.rows.forEach(x => {
        const r = { id: Mig.rid(), samity: '', memberId: '', name: '', type: '', openDate: '', n: '', freq: '', inst: '', fromDate: '', loan: '', down: '', rate: '', recv: '', gs: '', ss: '', oldAcc: '' };
        maps.forEach(m => { const k = BAL_KEY[m.model_column]; let v = x[m.excel_column]; if (v == null) v = '';
          if (k === 'openDate' || k === 'fromDate') v = Mig.date(v); else if (k === 'freq') v = Mig.freq(v); else if (k === 'type') v = loanCode(v); else if (BAL_NUM.includes(k)) v = String(v).trim() === '' ? '' : num(String(v).replace(/,/g, '')); else v = String(v).trim();
          r[k] = v; });
        if (!r.memberId) return;
        let mid = String(r.memberId).replace(/\D/g, ''); if (!mem[mid] && mem[b + pad(mid, 6)]) mid = b + pad(mid, 6); r.memberId = mid;
        const m = mem[mid]; if (m) { r.name = r.name || m.name; r.samity = m.samity; } else r.noMember = true;
        if (!m && r.samity) { const s = sams.find(z => z.code === r.samity || String(z.code).endsWith(String(r.samity))); r.samity = s ? s.code : r.samity; }
        el._rows.push(r); n++;
      });
      el._rows.sort((a, c) => String(a.memberId).localeCompare(String(c.memberId)));
      await Mig.flushDraft(el); BalMig.draw(el);
      toast(`✅ ${n} টি সারি প্রসেস হয়েছে`);
    });
  },
  // একটি সারি পোস্ট: সঞ্চয় ওপেনিং + ঋণ (পুরোনো আদায়সহ)
  async postRow(b, txDate, r) {
    const m = await Data.member(r.memberId); if (!m) fail('সদস্য পাওয়া যায়নি');
    for (const [type, v] of [['2001', num(r.gs)], ['2002', num(r.ss)]]) {
      if (v <= 0) continue;
      const ex = (await Data.accountsOf(b, r.memberId, 'dep', type)).find(a => a.status !== 'closed');
      const accNo = ex ? ex.accNo : await BalMig.openDep(b, m, type, txDate);
      const a = await Tx.acc(accNo);
      await Tx.post(b, txDate, 'OPENING_ACC', 'Balance Migration ' + accNo + ' - ' + (m.name || ''), [await Tx.credit(a, v, { contraGl: Mig.ADJ, tt: 'OPEN_BAL', narration: 'Balance Migration', skipProfile: true })]);
    }
    if (num(r.loan) > 0) {
      const P = num(r.loan), rate = num(r.rate); let n = parseInt(r.n) || 0; const inst = num(r.inst);
      const total = P + Math.round(P * rate / 100);
      if (!n && inst) n = Math.ceil(total / inst); if (!n) fail('No Of Inst / Inst Amount দিন');
      const c = Loan.calc(P, rate, n, inst || undefined);
      if (num(r.recv) > c.total) fail('Total Receive মোট ঋণের চেয়ে বেশি');
      const first = r.fromDate && r.fromDate >= '1990' ? r.fromDate : Loan.nextDate(r.openDate, r.freq, 1);
      await LoanForm.disburse({
        branch: b, member: r.memberId, type: r.type, openDate: r.openDate, postDate: txDate, purpose: '', purposeName: 'Balance Migration', principal: P, rate, profit: c.profit, totalRepay: c.total,
        n, actualN: c.actualN, totalN: c.totalN, instAmount: c.actualInst, calcInst: c.inst, lastInst: c.lastInst, freq: r.freq, firstDate: first, expDate: Loan.expiry(first, r.freq, c.totalN), settingId: '',
        fees: {}, blockAcc: '', blockAmt: 0, guarantors: [], payLedger: Mig.ADJ, openPaid: num(r.recv), downPay: num(r.down), oldAccNo: r.oldAcc || '',
      }, { noConfirm: true });
    }
  },
  async openDep(b, m, type, date) {
    const accNo = await newAccNo(b, m.memberId || m.id); const d = REF.DEP[type];
    const acc = { accNo, kind: 'dep', type, branch: b, memberId: m.memberId || m.id, samity: m.samity, title: m.name, address: m.presentAddr || '', phone: m.mobile || '', openDate: date, freq: '', instAmount: 0, rate: num(d && d.rate), sched: '', months: 0, maturityDate: '', nominees: [], status: 'active', balance: 0, totCr: 0, totDr: 0, profitPaid: 0, block: { amount: 0, dep: false, wd: false }, migrated: true, createdBy: App.user.userId, createdAt: FV.serverTimestamp() };
    const bt = db.batch(); bt.set(db.collection('accounts').doc(accNo), acc); Idx.setAccount(bt, b, acc); bt.set(db.collection('snap').doc(m.samity), { a: { [accNo]: DepSnap(acc) } }, { merge: true }); await bt.commit();
    return accNo;
  },
  submit(btn) {
    const el = $('#page-balMigration');
    return guard(btn, async () => {
      if (!isAdmin()) fail('শুধু Super Admin');
      const b = UI.el(el, 'branch').value, txDate = UI.el(el, 'txDate').value;
      if (!b) fail('Please select Branch Name!'); if (!txDate) fail('"Transaction Date" দিন!');
      const rows = BalMig.visible(el).filter(r => num(r.loan) > 0 || num(r.gs) > 0 || num(r.ss) > 0);
      if (!rows.length) fail('বসানোর মতো কোনো ব্যালেন্স নেই');
      const bad = rows.filter(r => BalMig.err(r)); if (bad.length) fail(`${bad.length} টি লাল সারি আগে ঠিক করুন`);
      const t = { loan: 0, recv: 0, gs: 0, ss: 0 }; rows.forEach(r => { t.loan += num(r.loan); t.recv += num(r.recv); t.gs += num(r.gs); t.ss += num(r.ss); });
      if (!confirm(`Balance Migration নিশ্চিত করুন (${rows.length} সারি, তারিখ ${fmtD(txDate)}):\nLoan ${tk(t.loan)} • Receive ${tk(t.recv)}\nGeneral Savings ${tk(t.gs)} • Security Savings ${tk(t.ss)}\n\nটাকা Adjustment (20010000) লেজারের বিপরীতে বসবে।`)) return;
      let ok = 0; const errs = [];
      try {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]; busy(true, `Balance Migration ${i + 1}/${rows.length} — ${r.memberId}`);
          try { await BalMig.postRow(b, txDate, r); el._rows = el._rows.filter(x => x.id !== r.id); ok++; }
          catch (e) { r.msg = e.message; errs.push(r.memberId + ': ' + e.message); }
        }
        if (!errs.length) { const vis = new Set(BalMig.visible(el).map(r => r.id)); el._rows = el._rows.filter(r => !vis.has(r.id)); } // eKisti: সফল হলে তালিকা খালি
      } finally { busy(false); await Mig.flushDraft(el).catch(() => {}); BalMig.draw(el); Cache.drop(); }
      if (!errs.length) toast(`✅ Balance Migration সম্পন্ন — ${ok} সারি`);
      else UI.modal('⚠️ Balance Migration', `<p>✅ সফল: <b>${ok}</b> • ❌ ব্যর্থ: <b>${errs.length}</b> (লাল সারিতে রয়ে গেছে)</p><div class="mini" style="max-height:300px;overflow:auto">${errs.map(esc).join('<br>')}</div>`);
    });
  },
};

// ───────────────────────── Member Migrations ─────────────────────────
const MEM_MODEL = {
  center_code: 'Somity Code', branch_client_id: 'Member ID', client_name: 'Member Name', client_type: 'Member Type', primary_product: 'Primary Product', client_admit_share: 'Share Amount',
  client_father_name: 'Father’s Name', client_mother_name: 'Mother’s Name', spouse_name: 'Spouse Name', client_blood_group: 'Blood Group', client_sex: 'Gender', client_religion: 'Religion',
  client_marital_status: 'Marital Status', client_national_id: 'National ID', client_present_address: 'Present Address', client_permanent_address: 'Permanent Address', client_phone: 'Phone Number',
  client_email: 'Email', client_joining_date: 'Admission Date', client_date_of_birth: 'Date of Birth', client_education: 'Education', client_monthly_income: 'Monthly Income',
  client_referred_by: 'Reference By', client_proprietor_name: 'Proprietor Name',
};
const MEM_KEY = { center_code: 'samity', branch_client_id: 'memberId', client_name: 'name', client_type: 'memberType', primary_product: 'product', client_admit_share: 'share', client_father_name: 'father', client_mother_name: 'mother', spouse_name: 'spouse', client_blood_group: 'blood', client_sex: 'sex', client_religion: 'religion', client_marital_status: 'marital', client_national_id: 'nid', client_present_address: 'presentAddr', client_permanent_address: 'permAddr', client_phone: 'mobile', client_email: 'email', client_joining_date: 'joinDate', client_date_of_birth: 'dob', client_education: 'education', client_monthly_income: 'income', client_referred_by: 'reference', client_proprietor_name: 'proprietor' };
const MEM_PRODUCTS = Object.entries(REF.DEP).map(([c, d]) => [c, d.name]);

App.page('memMigration', {
  title: 'Member Migrations', icon: '👥',
  render: () => Mig.form('Member Migrations', [{ k: 'branch', l: 'Branch Name', t: 'select' }, { k: 'samity', l: 'Samity Name', t: 'select' }, { k: 'rows', l: 'Number of Member', t: 'number' }],
    UI.btn('Search', 'MemMig.search(this)') + UI.btn('Create Blank Rows', 'MemMig.createRows(this)', 'btn-outline') + UI.btn('Upload Excel File', 'MemMig.upload(this)', 'btn-outline'), 'MemMig.process(this)')
    + UI.card('', Mig.head(null, 'Member Migration Data', 'Red rows need a member name, samity, gender, father or husband name, mobile, present address, and admission date.')
      + `<div class="mig-grid"><table class="tbl mig-tbl"><thead><tr><th colspan="3">Member</th><th colspan="7">Personal</th><th colspan="2">Product</th><th>Action</th></tr>
      <tr><th class="mig-ssl">SL</th><th class="mig-sid">ID</th><th class="mig-sname">Name</th><th>Somity</th><th>Gender</th><th>Father's/Husband's Name</th><th>Mobile</th><th>Present Address</th><th>Admission Date</th><th>NID</th><th>Primary Product</th><th>Share Amount</th><th>Action</th></tr></thead>
      <tbody class="mig-body"><tr class="mig-empty"><td colspan="13">Search a samity to load member migration data.</td></tr></tbody></table></div>
      <div class="actions">${UI.btn('Add New Row', 'MemMig.addRow(this)', 'btn-outline')}${UI.btn('Submit Migration', 'MemMig.submit(this)', 'btn-success')}</div>`),
  async init(el) {
    if (!isAdmin()) { el.innerHTML = '<div class="card"><div class="alert alert-danger">শুধু Super Admin Member Migration করতে পারবেন।</div></div>'; return; }
    el._model = MEM_MODEL; el._rows = [];
    await Pick.branch(el); await Pick.samity(el, 'samity', 'branch', { all: false });
    const setKey = async () => { el._dkey = 'mem_' + UI.el(el, 'branch').value; el._rows = await Mig.loadDraft(el._dkey); el._sams = UI.el(el, 'branch').value ? await Data.samities(UI.el(el, 'branch').value) : []; el._idx = UI.el(el, 'branch').value ? await Data.memberIdx(UI.el(el, 'branch').value) : {}; MemMig.draw(el); };
    UI.el(el, 'branch').addEventListener('change', setKey); await setKey();
    UI.el(el, 'samity').addEventListener('change', () => MemMig.draw(el));
    const body = $('.mig-body', el);
    body.addEventListener('change', e => MemMig.edit(el, e.target));
    body.addEventListener('focusin', e => { if (e.target.dataset.f === 'share') try { e.target.select(); } catch (x) {} });
  },
});
const MemMig = {
  blank(el, samity, memberId, joinDate) { return { id: Mig.rid(), memberId: memberId || '', name: '', samity: samity || '', sex: '', father: '', mobile: '', presentAddr: '', joinDate: joinDate || '', nid: '', product: '', share: '' }; },
  err(el, r) {
    if (!r.name || !r.samity || !r.sex || !r.father || !r.mobile || !r.presentAddr || !r.joinDate) return 'Name, Somity, Gender, Father/Husband, Mobile, Address, Admission Date দিন';
    const b = UI.el(el, 'branch').value; const id = String(r.memberId || '');
    if (!id || !id.startsWith(b) || id.length !== b.length + 6) return 'Member ID ' + b + 'XXXXXX ফরম্যাটে দিন';
    if (el._idx && el._idx[id]) return 'এই Member ID আগে থেকেই আছে';
    if (el._rows.filter(x => String(x.memberId) === id).length > 1) return 'Duplicate Member ID';
    if (num(r.share) < 0) return 'Negative amount';
    return '';
  },
  visible(el) { const s = UI.el(el, 'samity').value; return el._rows.filter(r => !s || r.samity === s); },
  draw(el) {
    const rows = MemMig.visible(el), body = $('.mig-body', el);
    if (!rows.length) { body.innerHTML = '<tr class="mig-empty"><td colspan="13">Search a samity to load member migration data.</td></tr>'; Mig.badges(el, 0, 0); return; }
    let errs = 0;
    const inp = (r, k, t = 'text') => `<input class="mig-in${t === 'number' ? ' num' : ''}" type="${t}" data-id="${r.id}" data-f="${k}" value="${esc(r[k] == null ? '' : r[k])}">`;
    const sel = (r, k, opts, blank) => `<select class="mig-in" data-id="${r.id}" data-f="${k}"><option value="">${blank}</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${String(r[k]) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    const sopts = (el._sams || []).map(s => [s.code, s.code + ' - ' + s.name]);
    body.innerHTML = rows.map((r, i) => {
      const e = r.msg || MemMig.err(el, r); if (e) errs++;
      return `<tr data-id="${r.id}" class="${e ? 'mig-bad' : ''}" title="${esc(e)}"><td class="mig-ssl">${i + 1}</td><td class="mig-sid">${inp(r, 'memberId', 'number')}</td><td class="mig-sname">${inp(r, 'name')}</td>
        <td>${sel(r, 'samity', sopts, r.samity ? 'Select Somity' : 'No Somity Selected')}</td><td>${sel(r, 'sex', [['Male', 'Male'], ['Female', 'Female'], ['Third Gender', 'Third Gender']], '')}</td>
        <td>${inp(r, 'father')}</td><td>${inp(r, 'mobile', 'number')}</td><td><textarea class="mig-in" rows="1" data-id="${r.id}" data-f="presentAddr">${esc(r.presentAddr || '')}</textarea></td>
        <td>${inp(r, 'joinDate', 'date')}</td><td>${inp(r, 'nid')}</td><td>${sel(r, 'product', MEM_PRODUCTS, r.product ? 'Select' : 'No Primary Product')}</td><td>${inp(r, 'share', 'number')}</td>
        <td class="mig-act"><button type="button" class="mig-rm" title="Remove Row" onclick="MemMig.removeRow('${r.id}')">−</button></td></tr>`;
    }).join('');
    Mig.badges(el, rows.length, errs);
  },
  edit(el, t) {
    const r = el._rows.find(x => x.id === t.dataset.id); if (!r) return;
    const k = t.dataset.f; r[k] = k === 'share' ? (t.value === '' ? '' : num(t.value)) : t.value.trim(); delete r.msg;
    if (k === 'memberId' || k === 'samity') { MemMig.draw(el); } else { const tr = t.closest('tr'); const e = MemMig.err(el, r); tr.classList.toggle('mig-bad', !!e); tr.title = e; Mig.badges(el, MemMig.visible(el).length, $$('.mig-body tr.mig-bad', el).length); }
    Mig.saveDraft(el);
  },
  // পরের আইডি: শাখার সর্বোচ্চ আইডি (ইনডেক্স + ড্রাফট) + ১
  nextSeq(el) { const b = UI.el(el, 'branch').value; const ids = [...Object.keys(el._idx || {}), ...el._rows.map(r => String(r.memberId))].filter(id => id.startsWith(b) && id.length === b.length + 6).map(id => Number(id.slice(b.length)) || 0); return (ids.length ? Math.max(...ids) : 0) + 1; },
  search(btn) {
    const el = $('#page-memMigration');
    return guard(btn, async () => { const b = UI.el(el, 'branch').value; if (!b) fail('Please select Branch Name!'); Cache.drop('midx_' + b); el._idx = await Data.memberIdx(b); el._rows = await Mig.loadDraft(el._dkey); MemMig.draw(el); });
  },
  createRows(btn) {
    const el = $('#page-memMigration');
    return guard(btn, async () => {
      const b = UI.el(el, 'branch').value, s = UI.el(el, 'samity').value, n = parseInt(UI.el(el, 'rows').value) || 0;
      if (!b) fail('Please Select Branch Name'); if (!s) fail('Please Select Somity Name'); if (!n) fail('Enter Number of Member!'); if (n > 300) fail('একবারে সর্বোচ্চ ৩০০ সারি');
      const jd = await businessDate(b); let seq = MemMig.nextSeq(el);
      for (let i = 0; i < n; i++) el._rows.push(MemMig.blank(el, s, b + pad(seq++, 6), jd));
      await Mig.flushDraft(el); MemMig.draw(el); UI.el(el, 'rows').value = '';
    });
  },
  addRow(btn) {
    const el = $('#page-memMigration');
    return guard(btn, async () => {
      const b = UI.el(el, 'branch').value, s = UI.el(el, 'samity').value; if (!b) fail('Branch Code is Required'); if (!s) fail('Center Code is Required');
      el._rows.push(MemMig.blank(el, s, b + pad(MemMig.nextSeq(el), 6), await businessDate(b))); MemMig.draw(el); Mig.saveDraft(el);
    });
  },
  removeRow(id) { const el = $('#page-memMigration'); el._rows = el._rows.filter(r => r.id !== id); MemMig.draw(el); Mig.saveDraft(el); },
  upload(btn) { return guard(btn, () => Mig.upload($('#page-memMigration'))); },
  process(btn) {
    const el = $('#page-memMigration');
    return guard(btn, async () => {
      const b = UI.el(el, 'branch').value; if (!el._xl) fail('Please select a file!'); if (!b) fail('Please select Branch Name!');
      const maps = Mig.mappings(el); if (!maps.length) fail('Please map at least one Excel column to a model field.');
      const s0 = UI.el(el, 'samity').value; const jd = await businessDate(b); let seq = MemMig.nextSeq(el); let n = 0;
      const prod = v => { const s = String(v || '').trim(); if (!s) return ''; if (REF.DEP[s]) return s; const c = s.match(/\d{4}/); if (c && REF.DEP[c[0]]) return c[0]; const hit = MEM_PRODUCTS.find(([, t]) => t.toLowerCase() === s.toLowerCase() || t.toLowerCase().includes(s.toLowerCase())); return hit ? hit[0] : ''; };
      el._xl.rows.forEach(x => {
        const r = MemMig.blank(el, s0, '', '');
        maps.forEach(m => { const k = MEM_KEY[m.model_column]; let v = x[m.excel_column]; if (v == null) v = '';
          if (k === 'joinDate' || k === 'dob') v = Mig.date(v); else if (k === 'sex') v = Mig.sex(v); else if (k === 'product') v = prod(v); else if (k === 'share' || k === 'income') v = String(v).trim() === '' ? '' : num(String(v).replace(/,/g, '')); else v = String(v).trim();
          r[k] = v; });
        if (!r.name && !r.memberId) return;
        if (r.mobile && /^1\d{9}$/.test(r.mobile)) r.mobile = '0' + r.mobile;
        if (r.samity) { const s = (el._sams || []).find(z => z.code === r.samity || String(z.code).endsWith(String(r.samity)) || z.name === r.samity); r.samity = s ? s.code : r.samity; } else r.samity = s0;
        let id = String(r.memberId || '').replace(/\D/g, ''); if (id && id.length <= 6) id = b + pad(id, 6); r.memberId = id || b + pad(seq++, 6);
        if (!r.joinDate) r.joinDate = jd;
        el._rows.push(r); n++;
      });
      await Mig.flushDraft(el); MemMig.draw(el); toast(`✅ ${n} জন সদস্য প্রসেস হয়েছে`);
    });
  },
  async postRow(b, r) {
    const memberId = String(r.memberId);
    if ((await db.collection('members').doc(memberId).get()).exists) fail('এই Member ID আগে থেকেই আছে');
    const data = { name: r.name, father: r.father, mother: r.mother || '', spouse: r.spouse || '', mobile: r.mobile, joinDate: r.joinDate, presentAddr: r.presentAddr, permAddr: r.permAddr || '', reference: r.reference || '', nid: r.nid || '', email: r.email || '', blood: r.blood || '', sex: r.sex, religion: r.religion || '', marital: r.marital || '', dob: r.dob || '', income: num(r.income), education: r.education || '', proprietor: r.proprietor || '', memberType: r.memberType || '', primaryProduct: r.product || '', nominee: {} };
    const mdoc = { memberId, branch: b, samity: r.samity, ...data, status: 'active', shareAdmit: num(r.share), admitFee: 0, passbookFee: 0, migrated: true, createdBy: App.user.userId, createdAt: FV.serverTimestamp() };
    const shareAcc = 'S' + memberId;
    const sa = { accNo: shareAcc, kind: 'share', type: 'share', branch: b, memberId, samity: r.samity, title: r.name, openDate: r.joinDate, status: 'active', balance: 0, totCr: 0, totDr: 0, createdAt: FV.serverTimestamp() };
    const bt = db.batch();
    bt.set(db.collection('members').doc(memberId), mdoc); Idx.setMember(bt, b, mdoc);
    if (num(r.share) > 0) { // শেয়ার দিলে তবেই শেয়ার একাউন্ট
      bt.set(db.collection('accounts').doc(shareAcc), sa); Idx.setAccount(bt, b, sa);
      bt.set(db.collection('snap').doc(r.samity), { a: { [shareAcc]: { m: memberId, k: 'share', t: 'share', b: 0, st: 'active', od: r.joinDate } } }, { merge: true });
    }
    await bt.commit();
    if (r.product) await BalMig.openDep(b, mdoc, r.product, r.joinDate);
    if (num(r.share) > 0) { const a = await Tx.acc(shareAcc); await Tx.post(b, r.joinDate, 'OPENING_ACC', 'Member Migration Share ' + memberId + ' - ' + r.name, [await Tx.credit(a, num(r.share), { contraGl: Mig.ADJ, tt: 'OPEN_BAL', narration: 'Member Migration Share', skipProfile: true })]); }
  },
  submit(btn) {
    const el = $('#page-memMigration');
    return guard(btn, async () => {
      if (!isAdmin()) fail('শুধু Super Admin');
      const b = UI.el(el, 'branch').value, s = UI.el(el, 'samity').value; if (!b) fail('Branch Code is Required'); if (!s) fail('Center Code is Required');
      Cache.drop('midx_' + b); el._idx = await Data.memberIdx(b);
      const rows = MemMig.visible(el); if (!rows.length) fail('কোনো সারি নেই');
      const bad = rows.filter(r => MemMig.err(el, r)); if (bad.length) { MemMig.draw(el); fail(`${bad.length} টি লাল সারি আগে ঠিক করুন`); }
      if (!confirm(`${rows.length} জন সদস্য মাইগ্রেট হবে (শেয়ার মোট ${tk(sum(rows, r => num(r.share)))} — Adjustment এর বিপরীতে)। নিশ্চিত?`)) return;
      let ok = 0; const errs = [];
      try {
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]; busy(true, `Member Migration ${i + 1}/${rows.length} — ${r.memberId}`);
          try { await MemMig.postRow(b, r); el._rows = el._rows.filter(x => x.id !== r.id); ok++; }
          catch (e) { r.msg = e.message; errs.push(r.memberId + ': ' + e.message); }
        }
      } finally { busy(false); await Mig.flushDraft(el).catch(() => {}); await Member.syncCounter(b).catch(() => {}); Cache.drop(); el._idx = await Data.memberIdx(b).catch(() => ({})); MemMig.draw(el); }
      if (!errs.length) toast(`✅ Member Migration সম্পন্ন — ${ok} জন সদস্য`);
      else UI.modal('⚠️ Member Migration', `<p>✅ সফল: <b>${ok}</b> • ❌ ব্যর্থ: <b>${errs.length}</b></p><div class="mini" style="max-height:300px;overflow:auto">${errs.map(esc).join('<br>')}</div>`);
    });
  },
};
