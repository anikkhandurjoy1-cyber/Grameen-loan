// ═══════════════════════════════════════════════════════════════
// ড্যাশবোর্ড — eKisti এর হুবহু লেআউট (ApexCharts)
// বাম: আদায় টার্গেট, কর্মচারীর ঋণ আদায়ের হার, ঋণ স্থিতি (ডোনাট), ঋণ সংক্রান্ত তথ্য
// ডান: ১৫টি আজকের কার্ড, আজকের সঞ্চয় আদায়/ফেরত (বার চার্ট)
// নিচে: সঞ্চয় স্থিতি, সদস্য তথ্য, সমিতির তথ্য
// রিড কম: সমিতি snapshot + আজকের লেনদেন + glDaily/glMonthly; ১০ মিনিট ক্যাশ
// ═══════════════════════════════════════════════════════════════
App.page('dashboard', {
  title: 'ড্যাশবোর্ড', icon: '🏠', always: true,
  render: () => ''
    + `<div class="card db-filter"><div class="db-welcome"><h3>Welcome back, ${esc((App.user && (App.user.name || App.user.userId)) || '')} !</h3><div class="mini">Track your somity activity, leads and deals here.</div></div>
    ${UI.grid([{ ...F.branch, l: 'Branch Name' }, { k: 'btype', l: 'Branch Type', t: 'select', opts: [['me', 'Only Me'], ['all', 'All Branch'], ['others', 'All Others Branch']] }, { k: 'employee', l: 'Employee Name', t: 'select' }, { k: 'date', l: 'Business Date', t: 'date', req: 1 }], 4)}
    <div class="actions">${UI.btn('Refresh Dashboard', 'Dash.load(this,true)', 'btn-info')}</div></div><div class="dash-out"><div class="mini">লোড হচ্ছে...</div></div>`,
  init: async el => {
    const f = $('.db-filter', el);
    await Pick.branch(f, 'branch'); await Pick.employee(f, 'employee', 'branch', { blank: '----------' });
    UI.el(f, 'date').value = await businessDate();
    // পারমিশন: সব শাখার অনুমতি না থাকলে শুধু নিজের শাখা; ম্যানেজার/এডমিন না হলে শুধু নিজের (কর্মচারী) ডেটা
    const u = App.user || {}, fl = u.flags || {};
    if (!isAdmin() && !fl.controlling) { UI.el(f, 'btype').value = 'me'; UI.el(f, 'btype').disabled = true; }
    if (!isBM()) { const e = UI.el(f, 'employee'); if (u.empId) { if (![...e.options].some(o => o.value === u.empId)) e.add(new Option(u.empId + ' - ' + (u.name || ''), u.empId)); e.value = u.empId; } e.disabled = true; }
    // eKisti: শাখা বদলালে শুধু কর্মচারীর তালিকা আর বিজনেস ডেট বদলায় — ডেটা আসে "Refresh Dashboard" এ
    UI.el(f, 'branch').addEventListener('change', async () => { const b = UI.el(f, 'branch').value; if (!isBM()) { UI.el(f, 'date').value = await businessDate(b); return; } UI.fill(UI.el(f, 'employee'), b ? await Data.employees(b) : [], e => e.empId, e => e.empId + ' - ' + e.name, '----------'); UI.el(f, 'date').value = await businessDate(b); });
    await Dash.load();
  },
});

// ── হোম (eKisti appauth-home): হেডারের লোগো/নামে ট্যাপ করলে — সার্চ + গোল আইকন ──
App.page('home', { title: 'হোম', icon: '', always: true, render: () => Home.html(), init: el => Home.bind(el) });
// ── eKisti হোম: মডিউল সার্চ + আইকন টাইল ──
const HOME_TILES = [
  ['সদস্য ভর্তি', 'memberAdd', '🧑‍💼', '#dbeafe'], ['সদস্য তালিকা', 'memberList', '👥', '#fde68a'], ['সদস্য পাসবই', 'rptPassbook', '📘', '#e0e7ff'], ['নতুন সঞ্চয়ী হিসাব', 'depOpen', '🌱', '#dcfce7'],
  ['সঞ্চয় জমা', 'depRcv', '💰', '#fef3c7'], ['সঞ্চয় ফেরত', 'depPay', '💵', '#fee2e2'], ['সঞ্চয় হিসাব ক্লোজ', 'depClosing', '🏠', '#fce7f3'], ['নতুন ঋণ হিসাব', 'loanOpen', '🏦', '#ede9fe'],
  ['ঋণের তালিকা', 'loanDisbList', '📋', '#e0f2fe'], ['ঋণের কিস্তি', 'emiRcv', '🤝', '#dcfce7'], ['সমিতি কালেকশন', 'sheetPosting', '🧮', '#f1f5f9'], ['সদস্য কিস্তি কালেকশন', 'memberColl', '📅', '#fef9c3'],
  ['আজকের সকল কালেকশন', 'rptCollDetails', '🗂️', '#ffedd5'], ['এ্যাকাউন্ট লেনদেন', 'accTxn', '🔁', '#ffedd5'], ['লেজার লেনদেন', 'ledgerTxn', '📒', '#dcfce7'], ['ভাউচার তালিকা', 'voucherList', '🧾', '#f3e8ff'],
  ['কালেকশন শীট', 'rptCollSheet', '📝', '#e0f2fe'], ['এ্যাকাউন্ট ভিত্তিক প্রাপ্তি-প্রদান', 'rptAccRecPay', '🏧', '#dcfce7'], ['ক্যাশ বুক (ক্যাশ এবং ব্যাংক)', 'rptCashBook', '🏛️', '#fef3c7'], ['ডি.সি.আর', 'rptDCR', '📊', '#fee2e2'],
  ['লোন রিকভারি রিপোর্ট', 'rptRecovery', '📈', '#fef9c3'], ['প্রাপ্তি প্রদান-২', 'rptRecPay2', '🧮', '#dbeafe'], ['ভর্তি রেজিঃ', 'rptAdmission', '📇', '#ffedd5'], ['বিতরণ রেজিঃ', 'rptDisbReg', '📓', '#f1f5f9'],
  ['ফিল্ড অফিসার রিপোর্ট', 'rptFieldOfficer', '🧑‍🌾', '#e0f2fe'], ['সদস্য ব্যালেন্স রিপোর্ট', 'rptMemberBalance', '📑', '#fef3c7'], ['ডি.পি.এস জমা', 'dpsRcv', '🪙', '#fef9c3'], ['সঞ্চয় লেনদেন ব্লক', 'lienAdd', '🔒', '#f1f5f9'],
];
const Home = {
  html() {
    const tiles = HOME_TILES.filter(([, p]) => App.pages[p] && App.canSee(p));
    return `<div class="card home-card"><div class="home-search"><span>🔍 <b>Search</b></span><div class="hs-wrap"><input type="search" class="hs-inp" placeholder="Search modules, forms, reports" autocomplete="off"><div class="hs-list" hidden></div></div></div>
      <div class="home-grid">${tiles.map(([l, p, ic, bg]) => `<a class="home-tile" onclick="App.go('${p}')"><span class="ht-ic" style="background:${bg}">${ic}</span><span class="ht-l">${esc(l)}</span></a>`).join('')}</div></div>`;
  },
  all() {
    const out = [];
    MENU.forEach(sec => { if (sec.page) out.push([sec.t, sec.page, '']); (sec.items || []).forEach(([l, p]) => out.push([l, p, sec.t])); });
    return out.filter(([, p]) => App.pages[p] && App.canSee(p)).filter((x, i, a) => a.findIndex(y => y[1] === x[1]) === i);
  },
  bind(el) {
    const inp = $('.hs-inp', el), box = $('.hs-list', el); if (!inp) return;
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) { box.hidden = true; return; }
      const list = Home.all().filter(([l, p, s]) => !q || l.toLowerCase().includes(q) || p.toLowerCase().includes(q) || (App.pages[p].title || '').toLowerCase().includes(q) || s.toLowerCase().includes(q)).slice(0, 60);
      box.innerHTML = list.length ? list.map(([l, p, s]) => `<div class="hs-it" data-p="${p}">${esc(l)} <small>${esc(s)}</small></div>`).join('') : '<div class="hs-it">কিছু পাওয়া যায়নি</div>';
      box.hidden = false;
    };
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('.hs-it[data-p]', box); if (f) App.go(f.dataset.p); } });
    inp.addEventListener('blur', () => setTimeout(() => box.hidden = true, 150));
    box.addEventListener('pointerdown', e => { const it = e.target.closest('.hs-it[data-p]'); if (it) { e.preventDefault(); App.go(it.dataset.p); } });
  },
};
// নতুন যা এসেছে (সংক্ষেপে, নতুনটি আগে)
const APP_NEWS = [
  ['2.8', 'নতুন ডিজাইন, মোবাইলে পুরো লেখা দেখা যায়, পেজ খোলে সাথে সাথে'],
  ['2.7.8', 'ক্লোজড ঋণ আর নতুন ঋণের সাথে দেখায় না'],
  ['2.7.6', 'শুক্রবার বন্ধ — দৈনিক কিস্তিতে শুক্রবার বাদ, ডে ক্লোজে শুক্রবার বাদ'],
  ['2.7.4', 'বেতন পোস্টিং কর্মীর একাউন্টে জমা, টাকা দেওয়ার সময় নগদ কাটে'],
  ['2.7.3', 'শীট পোস্টিং ও সদস্য ভিত্তিক কালেকশন eKisti এর মতো'],
  ['2.7.0', 'হাওলাদ গ্রহন/ফেরত লেজার লেনদেনে'],
];
const VT_NAME = { EMI_RCV: 'কিস্তি জমা', COLLECTION: 'কালেকশন', SHEET: 'শীট পোস্টিং', DEP_RCV: 'সঞ্চয় জমা', DEP_PAY: 'সঞ্চয় ফেরত', LOAN_DISB: 'ঋণ বিতরণ', LOAN_OPEN: 'ঋণ বিতরণ', ACC_TXN: 'একাউন্ট লেনদেন', LEDGER_TXN: 'লেজার লেনদেন', JV: 'জার্নাল', SALARY: 'বেতন পোস্টিং', MEMBER_ADMISSION: 'সদস্য ভর্তি', PASSBOOK_ISSUE: 'পাসবুক বিক্রয়', DEP_CLOSING: 'ডিপোজিট ক্লোজিং', LOAN_WAIVER: 'ঋণ মওকুফ', LOAN_PENALTY: 'ঋণ জরিমানা', LOAN_RESCHEDULE: 'ঋণ পুনঃ বিতরণ', DEP_TRANSFER: 'ডিপোজিট স্থানান্তর', SHARE_RCV: 'শেয়ার জমা', SHARE_PAY: 'শেয়ার ফেরত', PROFIT_DIST: 'মুনাফা বন্টন', PROFIT_PAYMENT: 'লভ্যাংশ প্রদান', IB_SEND: 'তহবিল প্রেরণ', IB_RECEIVE: 'তহবিল গ্রহণ', OPENING: 'ওপেনিং', OPENING_ACC: 'ওপেনিং ব্যালেন্স' };
const DEP_GROUP = t => { const d = REF.DEP[t] || {}; return d.dtype === 'FD' ? 'fd' : d.dtype === 'RD' ? 'rd' : t === '2002' || d.comp ? 'ss' : 'gs'; };
const DEP_GROUP_NAME = { gs: 'সাধারণ সঞ্চয়', ss: 'বিশেষ সঞ্চয়', fd: 'স্থায়ী আমানত', rd: 'মেয়াদী আমানত' };
const Dash = {
  charts: [],
  hello() { const h = new Date().getHours(); return h < 12 ? 'শুভ সকাল' : h < 17 ? 'শুভ অপরাহ্ন' : 'শুভ সন্ধ্যা'; },
  // সূর্যোদয় অর্ধবৃত্ত: আজকের আদায় / আদায়যোগ্য
  sun(pct) {
    const p = Math.max(0, Math.min(100, pct)) / 100, L = Math.PI * 96;
    return `<svg viewBox="0 0 220 122" aria-hidden="true"><path d="M14 112 A96 96 0 0 1 206 112" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="12" stroke-linecap="round"/><path d="M14 112 A96 96 0 0 1 206 112" fill="none" stroke="#D8A01E" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(L * p).toFixed(1)} ${L.toFixed(1)}"/></svg>`;
  },
  async band(f, d) {
    const el = $('#todayBand'); if (!el) return;
    const n0 = x => Math.round(x).toLocaleString('en-IN');
    const b = await Data.branch(f.branch); const pct = d.receivable ? d.rcv / d.receivable * 100 : 0;
    el.querySelector('.tb-meta').innerHTML = `<b>${esc(b ? b.code + ' - ' + b.name : f.branch)}</b><br>বিজনেস ডেট <b>${fmtD(f.date)}</b>${isFriday(f.date) ? ' (শুক্রবার — বন্ধ)' : ''}`;
    el.querySelector('.tb-sun').innerHTML = Dash.sun(pct) + `<div class="tb-fig"><b>${n0(d.rcv)}</b><span>আজকের আদায় • আদায়যোগ্য ${n0(d.receivable)}</span></div>`;
    el.querySelector('.tb-stats').innerHTML = [['হাতে নগদ', d.cash], ['আজ নগদ গ্রহণ', d.cashRcv], ['আজ নগদ প্রদান', d.cashPay], ['আজকের বকেয়া', Math.max(0, d.receivable - d.rcv), 'warn']].map(([l, v, c]) => `<div class="${c || ''}"><small>${l}</small><b>${n0(v)}</b></div>`).join('');
  },
  // আজকের ভাউচার তালিকা + অনুমোদনের অপেক্ষা
  async feed(f) {
    const el = $('#page-dashboard'); if (!el) return;
    const bs = await R.branchesFor(f); let vs = [];
    for (const b of bs) vs = vs.concat((await db.collection('vouchers').where('bd', '==', b + '_' + f.date).get()).docs.map(x => x.data()));
    const pend = vs.filter(v => v.status === 'pending').length; const pe = $('[data-pend]', el);
    if (pe) { pe.textContent = pend; pe.closest('.pend').classList.toggle('ok', !pend); pe.closest('.pend').onclick = pend ? () => App.go('authList') : null; pe.closest('.pend').style.cursor = pend ? 'pointer' : ''; }
    const cash = REF.GL.cash;
    const rows = vs.filter(v => v.status !== 'cancelled').sort((a, b) => ((b.on && b.on.seconds) || 0) - ((a.on && a.on.seconds) || 0)).slice(0, 12).map(v => {
      const c = (v.lines || []).filter(l => l.gl === cash); const inA = sum(c, l => num(l.dr)), outA = sum(c, l => num(l.cr));
      const t = v.on && v.on.seconds ? new Date(v.on.seconds * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      const amtTxt = inA || outA ? (inA >= outA ? `<span class="fa in">+${amt(inA - outA)}</span>` : `<span class="fa out">−${amt(outA - inA)}</span>`) : `<span class="fa">${amt(v.total)}</span>`;
      return `<div class="feed-it"><time>${t}</time><div style="min-width:0"><div class="ft">${esc(VT_NAME[v.type] || v.type || 'লেনদেন')}${v.status === 'pending' ? ' <span class="tag orange">অপেক্ষায়</span>' : ''}</div><div class="fd">${esc(v.narration || '')} — ${esc(v.byName || '')}</div></div>${amtTxt}</div>`;
    });
    $('.feed-list', el).innerHTML = rows.join('') || '<div class="feed-empty">আজ এখনো কোনো লেনদেন হয়নি।</div>';
  },
  async compute(f) {
    const bs = await R.branchesFor(f);
    const z = () => ({ gs: 0, ss: 0, fd: 0, rd: 0 });
    const d = { receivable: 0, rcv: 0, reg: 0, due: 0, adv: 0, exp: 0, disb: 0, depRcv: 0, depPay: 0, cashRcv: 0, cashPay: 0, income: 0, expense: 0, cash: 0,
      depRcvG: z(), depPayG: z(), sav: z(), loan: { total: 0, regular: 0, overdue: 0, expire: 0, advance: 0, cc: 0 }, loanInfo: { cnt: 0, expCnt: 0, disbAmt: 0, principal: 0, profit: 0 },
      emp: {}, members: { total: 0, active: 0, inactive: 0 }, samities: 0 };
    const lm = await Data.ledgerMap();
    let migProfit = 0;
    for (const b of bs) {
      const ff = { branch: b, employee: f.employee };
      const c = await R.snaps(ff, f.date);
      d.samities += Object.values(c.sm).filter(s => s.status !== 'closed' && (!f.employee || s.foId === f.employee)).length;
      const memRows = Object.entries(c.mem).filter(([id, r]) => !f.employee || c.fo(r[1]) === f.employee);
      d.members.total += memRows.length; d.members.active += memRows.filter(([, r]) => r[3] !== 'closed' && r[3] !== 'inactive').length; d.members.inactive += memRows.filter(([, r]) => r[3] === 'inactive').length;
      // Balance Migration / Opening Paid আজকের লেনদেন নয় (eKisti এর মতো বাদ)
      const isMig = t => t.tt === 'OPEN_PAID' || t.tt === 'OPEN_BAL' || /^Balance Migration/.test(t.narration || '');
      const tsAll = await R.txns(ff, f.date, f.date); const ts = tsAll.filter(t => !isMig(t));
      migProfit += sum(tsAll.filter(t => isMig(t) && t.kind === 'loan' && t.dc === 'C'), t => num(t.profit));
      const got = {}; ts.forEach(t => { if (t.kind === 'loan' && t.dc === 'C' && t.tt !== 'EMI_WAIVE') got[t.accNo] = (got[t.accNo] || 0) + num(t.amount); });
      c.list.forEach(s => {
        if (s.k === 'loan') {
          const g = got[s.accNo] || 0;
          // আজকের আদায়ের আগের অবস্থা
          const s0 = g ? { ...s, b: num(s.b) + g, pt: num(s.pt) - g, st: 'active' } : s;
          if (s0.st === 'closed') return;
          const { st: st0 } = R.loanSt(s0, f.date); const { st } = R.loanSt(s, f.date);
          const fo = c.fo(s.samity) || '—'; const e = d.emp[fo] = d.emp[fo] || { receivable: 0, rcv: 0 };
          const recv = Math.min(st0.outstanding, st0.todayInst);
          d.receivable += recv; e.receivable += recv;
          if (g) {
            if (st0.expired) d.exp += g;
            else { const dueR = Math.min(g, st0.overdue); const regR = Math.min(g - dueR, st0.todayInst); d.due += dueR; d.reg += regR; d.adv += Math.max(0, g - dueR - regR); }
            d.rcv += g; e.rcv += Math.min(g, recv);
          }
          if (s.st !== 'closed') {
            d.loanInfo.cnt++; d.loanInfo.disbAmt += num(s.pr); d.loanInfo.principal += st.principalOut; d.loanInfo.profit += st.profitOut;
            d.loan.total += st.outstanding;
            if (st.expired) { d.loan.expire += st.outstanding; d.loanInfo.expCnt++; } else { d.loan.overdue += st.overdue; d.loan.advance += st.advance; }
          }
        } else if (s.k === 'dep' && s.st !== 'closed') d.sav[DEP_GROUP(s.t)] += num(s.b);
      });
      ts.forEach(t => {
        const cl = R.cls(t);
        if (cl === 'disb') d.disb += num(t.amount);
        if (t.kind === 'dep' && t.tt !== 'PROFIT_POST') { if (t.dc === 'C') { d.depRcv += num(t.amount); d.depRcvG[DEP_GROUP(t.type)] += num(t.amount); } else { d.depPay += num(t.amount); d.depPayG[DEP_GROUP(t.type)] += num(t.amount); } }
      });
      // নগদ, আয়, ব্যয়: GL থেকে — শাখার হিসাব, কর্মচারী (ম্যানেজার নয়) দেখতে পারবে না
      if (!isBM()) continue;
      const gd = await db.collection('glDaily').doc(b + '_' + f.date).get(); const g = (gd.exists && gd.data().gl) || {};
      Object.entries(g).forEach(([code, x]) => { const L = lm[code] || {}; if (code.startsWith('111') || L.cashBank) { d.cashRcv += num(x.dr); d.cashPay += num(x.cr); } if (code.startsWith('3')) d.income += num(x.cr) - num(x.dr); if (code.startsWith('4')) d.expense += num(x.dr) - num(x.cr); });
      try { const up = await GLX.upto([b], f.date); d.cash += GLX.nat(REF.GL.cash, up[REF.GL.cash]); } catch (e) {}
    }
    d.income = Math.max(0, r2(d.income - migProfit));
    d.loan.regular = Math.max(0, d.loan.total - d.loan.overdue - d.loan.expire - d.loan.advance);
    return d;
  },
  async load(btn, force) {
    const el = $('#page-dashboard'); if (!el) return;
    return guard(btn, async () => {
      const f = UI.get($('.db-filter', el));
      if (!isBM()) f.employee = (App.user || {}).empId || '__none__'; // কর্মচারী শুধু নিজের ডেটা
      if (!isAdmin() && !((App.user || {}).flags || {}).controlling) f.btype = 'me';
      if (!f.branch) { $('.dash-out', el).innerHTML = '<div class="card"><div class="alert">প্রথমে "সেটিংস → প্রাথমিক সেটআপ" চালান এবং শাখা যোগ করুন।</div></div>'; return; }
      const key = 'dash_' + JSON.stringify(f); if (force) Cache.drop(key);
      $('.dash-out', el).innerHTML = '<div class="mini">লোড হচ্ছে...</div>';
      const d = await Cache.get(key, () => Dash.compute(f), 10 * 60000);
      const en = await R.empName(); const emps = await Data.employees('');
      const n0 = x => Math.round(x).toLocaleString('en-IN');
      const pct = d.receivable ? Math.min(100, r2(d.rcv / d.receivable * 100)) : 0;
      const card = (icon, color, label, val, lc) => `<div class="db-card"><span class="db-ic" style="background:${color}">${icon}</span><div><div class="db-l" style="color:${lc || '#555'}">${label}</div><div class="db-v" style="color:${lc || '#16a085'}">${n0(val)}</div></div></div>`;
      const legend = (rows) => `<div class="db-leg">${rows.map(([c, l, v]) => `<div><span><i style="background:${c}"></i>${l}</span><b>${n0(v)}</b></div>`).join('')}</div>`;
      const C = { reg: '#2ecc9a', od: '#e67e22', exp: '#c0392b', adv: '#8e44ad', cc: '#f1c40f', gs: '#8b5cf6', ss: '#1e3a8a', fd: '#10b981', rd: '#f6b94a' };
      const empList = Object.entries(d.emp).filter(([k]) => k !== '—').map(([k, v]) => { const e = emps.find(x => x.empId === k) || {}; return `<div class="db-emp"><span class="db-av">${e.photoUrl ? `<img src="${esc(e.photoUrl)}">` : '👤'}</span><div><b>${esc(e.name || k)}</b><div class="mini">${esc(e.designation || '')}</div></div><b class="db-pc">${v.receivable ? r2(v.rcv / v.receivable * 100).toFixed(2) : '0.00'}%</b></div>`; }).join('') || '<div class="mini">তথ্য নেই</div>';
      $('.dash-out', el).innerHTML = `<div class="db-grid">
        <div class="db-left">
          <div class="db-target"><div><b>${pct < 50 ? 'আজকের আদায় টার্গেট পূর্ণ করুন।' : 'আজকের আদায় চলছে।'}</b><div class="mini" style="color:#fff">${pct < 50 ? 'আপনার আজকের আদায় টার্গেট খুবই নিন্ম পর্যায়ে রয়েছে।' : 'আদায়ের হার ভালো আছে।'}</div><a href="#rptEmiCollect" style="color:#fff;font-weight:700">Click here</a></div><div class="db-ring" style="--p:${pct}">${pct}%</div></div>
          <div class="card"><div class="card-title">কর্মচারীর ঋণ আদায়ের হার</div>${empList}</div>
          <div class="card"><div class="card-title">ঋণ স্থিতি</div><div id="dbLoan"></div>${legend([[C.reg, 'Regular Term Loan', d.loan.regular], [C.od, 'Total Loan Overdue', d.loan.overdue], [C.exp, 'Total Expire Amount', d.loan.expire], [C.adv, 'অগ্রিম আদায়', d.loan.advance], [C.cc, 'CC', d.loan.cc]])}</div>
          <div class="card"><div class="card-title">ঋণ সংক্রান্ত তথ্য</div><div class="db-info">${[['Total Loan Account', d.loanInfo.cnt], ['মেয়াদ উত্তীর্ণ সংখ্যা', d.loanInfo.expCnt], ['বিতরণকৃত টাকার পরিমান', d.loanInfo.disbAmt], ['মোট আসল', d.loanInfo.principal], ['মোট লভ্যাংশ', d.loanInfo.profit]].map(([l, v]) => `<div><span>${l}</span><b>${n0(v)}</b></div>`).join('')}</div></div>
        </div>
        <div class="db-right">
          <div class="db-cards">
            ${card('💰', '#1d4ed8', 'আজকের ঋণ আদায়যোগ্য', d.receivable, '#1d4ed8')}${card('🧾', '#16a085', 'আজকের ঋণ আদায়', d.rcv)}${card('⚠️', '#e74c3c', 'আজকের ঋণ বকেয়া', Math.max(0, d.receivable - d.reg), '#e74c3c')}
            ${card('📗', '#16a085', 'Regular Recover', d.reg)}${card('📙', '#16a085', 'Due Recover', d.due)}${card('📘', '#16a085', 'Advance Recover', d.adv)}
            ${card('📕', '#16a085', 'Expire Recover', d.exp)}${card('$', '#0b1d51', 'Todays Disbursment', d.disb, '#0b1d51')}${card('🏦', '#8b5cf6', 'Todays Deposit Receive', d.depRcv)}
            ${card('↩️', '#e74c3c', 'Todays Deposit Payment', d.depPay, '#e74c3c')}${card('💵', '#16a085', 'Todays Cash Receive', d.cashRcv)}${card('💸', '#e74c3c', 'Todays Cash Payment', d.cashPay, '#e74c3c')}
            ${card('📈', '#16a085', 'Todays Income', d.income)}${card('📉', '#e74c3c', 'Todays Expense', d.expense, '#e74c3c')}${card('👛', '#0ea5e9', 'হাতে নগদ', d.cash, '#0b1d51')}
          </div>
          <div class="db-two">
            <div class="card"><div class="card-title" style="color:#16a085">আজকের সঞ্চয় আদায় <span style="float:right">${n0(d.depRcv)}</span></div><div id="dbDepRcv"></div>${legend(['gs', 'ss', 'fd', 'rd'].map(k => [C[k], DEP_GROUP_NAME[k], d.depRcvG[k]]))}</div>
            <div class="card"><div class="card-title" style="color:#e74c3c">আজকের সঞ্চয় ফেরত <span style="float:right">${n0(d.depPay)}</span></div><div id="dbDepPay"></div>${legend(['gs', 'ss', 'fd', 'rd'].map(k => [C[k], DEP_GROUP_NAME[k], d.depPayG[k]]))}</div>
          </div>
        </div>
      </div>
      <div class="db-bottom">
        <div class="card"><div class="card-title">সঞ্চয় স্থিতি</div><div id="dbSav"></div>${legend(['gs', 'ss', 'fd', 'rd'].map(k => [C[k], DEP_GROUP_NAME[k], d.sav[k]]))}</div>
        <div class="card"><div class="card-title">সদস্য তথ্য</div><div id="dbMem"></div>${legend([['#2ecc71', 'Active', d.members.active], ['#e74c3c', 'Inactive', d.members.inactive]])}</div>
        <div class="card"><div class="card-title">সমিতির তথ্য</div><div id="dbSam"></div></div>
      </div><div class="mini">তথ্য ১০ মিনিট ক্যাশ থাকে — নতুন তথ্যের জন্য "Refresh Dashboard" চাপুন।</div>`;
      Dash.draw(d, C);
    });
  },
  draw(d, C) {
    Dash.charts.forEach(c => { try { c.destroy(); } catch (e) {} }); Dash.charts = [];
    if (!window.ApexCharts) { window.addEventListener('load', () => window.ApexCharts && Dash.draw(d, C), { once: true }); return; }
    const tot = n => Math.round(n).toLocaleString('en-IN');
    const donut = (id, series, labels, colors, center) => { const c = new ApexCharts($(id), { chart: { type: 'donut', height: 260, fontFamily: 'Hind Siliguri' }, series: series.map(x => Math.max(0, Math.round(x))), labels, colors, legend: { show: false }, dataLabels: { enabled: true, formatter: v => v.toFixed(1) + '%' }, plotOptions: { pie: { donut: { size: '62%', labels: { show: true, total: { show: true, label: center, formatter: () => tot(sum(series)) } } } } } }); c.render(); Dash.charts.push(c); };
    const bars = (id, g, color) => { const c = new ApexCharts($(id), { chart: { type: 'bar', height: 200, toolbar: { show: false }, fontFamily: 'Hind Siliguri' }, series: [{ name: 'টাকা', data: ['gs', 'ss', 'fd', 'rd'].map(k => Math.round(g[k])) }], xaxis: { categories: ['GS', 'SS', 'FDR', 'DPS'] }, colors: [color], plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } }, dataLabels: { enabled: false } }); c.render(); Dash.charts.push(c); };
    donut('#dbLoan', [d.loan.regular, d.loan.overdue, d.loan.expire, d.loan.advance, d.loan.cc], ['Regular Term Loan', 'Total Loan Overdue', 'Total Expire Amount', 'অগ্রিম আদায়', 'CC'], [C.reg, C.od, C.exp, C.adv, C.cc], 'মোট ঋণের স্থিতি');
    bars('#dbDepRcv', d.depRcvG, '#16a085'); bars('#dbDepPay', d.depPayG, '#e74c3c');
    donut('#dbSav', ['gs', 'ss', 'fd', 'rd'].map(k => d.sav[k]), ['gs', 'ss', 'fd', 'rd'].map(k => DEP_GROUP_NAME[k]), [C.gs, C.ss, C.fd, C.rd], 'মোট সঞ্চয়');
    const pie = new ApexCharts($('#dbMem'), { chart: { type: 'radialBar', height: 260, fontFamily: 'Hind Siliguri' }, series: [d.members.total ? Math.round(d.members.active / d.members.total * 100) : 0], labels: ['Total Member'], colors: ['#7bd389'], plotOptions: { radialBar: { hollow: { size: '55%' }, dataLabels: { name: { show: true }, value: { formatter: () => d.members.total.toLocaleString('en-IN') } } } } }); pie.render(); Dash.charts.push(pie);
    const sam = new ApexCharts($('#dbSam'), { chart: { type: 'radialBar', height: 240, fontFamily: 'Hind Siliguri' }, series: [100], labels: ['Total'], colors: ['#38bdf8'], plotOptions: { radialBar: { hollow: { size: '60%' }, dataLabels: { name: { show: true }, value: { formatter: () => String(d.samities) } } } } }); sam.render(); Dash.charts.push(sam);
  },
};
