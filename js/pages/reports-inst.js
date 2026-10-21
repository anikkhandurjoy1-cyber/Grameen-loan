// ═══════════════════════════════════════════════════════════════
// কিস্তি রিপোর্ট সমূহ + রিপোর্টের সাধারণ হেল্পার (R)
// ═══════════════════════════════════════════════════════════════
const R = {
  // শাখার সমিতি ম্যাপ + FO
  async sams(branch) { const m = {}; (await Data.samities(branch)).forEach(s => m[s.code] = s); return m; },
  // as-of snapshot (ফিল্টার সহ)
  async snaps(f, date) {
    const [snaps, mem, sm] = await Promise.all([Hist.snapsAt(f.branch, date, f.samity), Data.memberIdx(f.branch), R.sams(f.branch)]);
    const fo = s => (sm[s] || {}).foId || '';
    return { list: snaps.filter(s => (!f.employee || fo(s.samity) === f.employee) && (!f.member || s.m === f.member)), mem, sm, fo };
  },
  // তারিখ সীমার লেনদেন (একাধিক শাখা সাপোর্ট)
  async txns(f, from, upto, branches) {
    const bs = branches || [f.branch]; let out = [];
    for (const b of bs) out = out.concat((await db.collection('txns').where('bd', '>=', b + '_' + from).where('bd', '<=', b + '_' + upto).get()).docs.map(d => d.data()));
    return out.filter(t => !t.cancelled && (!f.samity || t.samity === f.samity) && (!f.employee || t.foId === f.employee) && (!f.member || t.memberId === f.member) && (!f.user || t.by === f.user));
  },
  name: (mem, id) => esc((mem[id] || [])[0] || ''),
  father: (mem, id) => esc((mem[id] || [])[4] || ''),
  mobile: (mem, id) => esc((mem[id] || [])[2] || ''),
  isTrf: t => ['EMI_TRF', 'DEP_TRF_IN', 'DEP_TRF_OUT', 'PROFIT_POST', 'LOAN_DISB_TRF', 'JV'].includes(t.tt),
  // লেনদেনের শ্রেণি
  cls(t) {
    if (t.kind === 'loan') {
      if (t.dc === 'C') return 'loanRcv';
      if (t.tt === 'LOAN_DISB' || t.tt === 'STAFF_LOAN_DISB') return 'disb';
      return 'loanOther';
    }
    if (t.kind === 'dep' || t.kind === 'share') return t.dc === 'C' ? (t.tt === 'PROFIT_POST' ? 'profitPost' : 'depRcv') : 'depPay';
    if (t.kind === 'fee') return 'fee';
    return 'other';
  },
  loanOf: s => Loan.fromSnap(s),
  // ঋণের as-of অবস্থা
  loanSt(s, date) { const l = Loan.fromSnap(s); l.base = num(s.bs); return { l, st: Loan.status(l, date) }; },
  // সমিতির মিটিং তারিখ (মাসের ভিতর)
  meetDates(sam, month) {
    const first = month + '-01', last = ymd(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    const out = [];
    if (sam && sam.day) { for (let d = first; d <= last; d = addDays(d, 1)) if (WEEKDAYS[parseD(d).getDay()] === sam.day) out.push(d); }
    else if (sam && sam.dateOfMonth) { const d = month + '-' + pad(Math.min(Number(sam.dateOfMonth), Number(last.slice(8))), 2); out.push(d); }
    return out.length ? out : [first, addDays(first, 7), addDays(first, 14), addDays(first, 21)];
  },
  // গ্রুপিং অপশন
  GROUP: { k: 'grp', l: 'Report Group', t: 'select', opts: [['member', 'Member'], ['branch', 'Branch'], ['center', 'Center'], ['employee', 'Employee']] },
  SHEET: { k: 'sheet', l: 'Sheet Type', t: 'select', opts: [['blank', 'Blank Sheet'], ['target', 'Target Sheet'], ['data', 'With Data']] },
  async empName(branch) { const m = {}; (await Data.employees('')).forEach(e => m[e.empId] = e.name); return id => id ? id + ' - ' + esc(m[id] || '') : '—'; },
  async branchesFor(f) { if (!f.btype || f.btype === 'me') return [f.branch]; const all = (await Data.branches()).map(b => b.code); const allowed = allowedBranches(); const list = allowed ? all.filter(c => allowed.includes(c)) : all; return f.btype === 'others' ? list.filter(c => c !== f.branch) : list; },
  // গ্রুপ কী
  gkey(grp, t, fo) { return grp === 'branch' ? t.branch : grp === 'center' ? t.samity : grp === 'employee' ? (t.foId || fo || '') : t.memberId; },
  async glabel(grp, branches) {
    const en = await R.empName(); const sm = {}; for (const b of branches) Object.assign(sm, await R.sams(b));
    const bm = {}; (await Data.branches()).forEach(b => bm[b.code] = b.name);
    const mem = {}; for (const b of branches) Object.assign(mem, await Data.memberIdx(b));
    return k => grp === 'branch' ? k + ' - ' + esc(bm[k] || '') : grp === 'center' ? k + ' - ' + esc((sm[k] || {}).name || '') : grp === 'employee' ? en(k) : k + ' - ' + R.name(mem, k);
  },
  userOpts: async (el, f) => { const e = UI.el(f, 'user'); if (!e) return; const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })); UI.fill(e, us, u => u.id, u => u.userId || u.email, '— সব —'); },
};
const USER_F = { k: 'user', l: 'User Name', t: 'select', opts: [['', '— সব —']] };
const TRF_F = { k: 'trf', l: 'Show Transfer Transaction', t: 'select', opts: [['yes', 'Yes'], ['no', 'No']] };
const LOAN_TYPE_F = { k: 'ltype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...Object.entries(REF.LOAN).map(([c, d]) => [c, c + ' - ' + d.name])] };
const DEP_TYPE_F = { k: 'dtype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...Object.entries(REF.DEP).map(([c, d]) => [c, c + ' - ' + d.name])] };

// ─── কালেকশন শীট (মাসিক) ───
function collSheetHTML(rows, dates, sheet, extra, mem) {
  const dcol = dates.map(d => ({ h: fmtD(d).slice(0, 5), f: r => sheet === 'data' ? ((r.by[d] || 0) ? amt(r.by[d]) : '') : '', r: 1 }));
  const blankRows = Array.from({ length: Math.max(0, parseInt(extra) || 0) }, () => ({ blank: 1, by: {} }));
  const all = rows.concat(blankRows);
  const cols = [
    { h: 'SL', f: r => r.blank ? '' : r.sl }, { h: 'সদস্য আইডি', f: r => r.blank ? '&nbsp;' : r.m }, { h: 'নাম', f: r => r.blank ? '' : R.name(mem, r.m) },
    { h: 'সঞ্চয় স্থিতি', f: r => r.blank ? '' : amt(r.sav), r: 1 }, { h: 'সঞ্চয় কিস্তি', f: r => r.blank || sheet === 'blank' ? '' : amt(r.savInst), r: 1 },
    { h: 'ঋণ হিসাব', f: r => r.blank ? '' : r.loanAcc || '' }, { h: 'বিতরণ', f: r => r.blank || !r.loanAcc ? '' : amt(r.disb), r: 1 },
    { h: 'কিস্তি', f: r => r.blank || !r.loanAcc || sheet === 'blank' ? '' : amt(r.inst), r: 1 }, { h: 'ঋণ স্থিতি', f: r => r.blank || !r.loanAcc ? '' : amt(r.out), r: 1 },
    { h: 'বকেয়া', f: r => r.blank || !r.loanAcc ? '' : amt(r.od), r: 1 }, ...dcol, { h: 'মোট', f: r => sheet === 'data' && !r.blank ? amt(sum(Object.values(r.by))) : '', r: 1 },
  ];
  return UI.table(cols, all, { cls: 'sheet' });
}
async function collSheetRows(f, date, month) {
  const c = await R.snaps(f, date);
  const by = {};
  c.list.forEach(s => {
    if (s.st === 'closed') return;
    const r = by[s.m] = by[s.m] || { m: s.m, samity: s.samity, sav: 0, savInst: 0, loanAcc: '', disb: 0, inst: 0, out: 0, od: 0, by: {} };
    if (s.k === 'dep' || s.k === 'share') { r.sav += num(s.b); r.savInst += num(s.ia); }
    if (s.k === 'loan') { const { st } = R.loanSt(s, date); r.loanAcc = r.loanAcc ? r.loanAcc + ', ' + s.accNo : s.accNo; r.disb += num(s.pr); r.inst += num(s.ia); r.out += st.outstanding; r.od += st.overdue; }
  });
  if (month) {
    const ts = await R.txns(f, month + '-01', month + '-31');
    ts.filter(t => t.dc === 'C' && t.memberId && by[t.memberId] && !R.isTrf(t)).forEach(t => { const r = by[t.memberId]; r.by[t.date] = (r.by[t.date] || 0) + num(t.amount) + num(t.penalty); });
  }
  const rows = Object.values(by).sort((a, b) => a.samity.localeCompare(b.samity) || a.m.localeCompare(b.m));
  rows.forEach((r, i) => r.sl = i + 1);
  return { rows, c };
}
ReportPage({
  id: 'rptCollSheet', title: 'কালেকশন শীট', landscape: true,
  filters: [F.branch, { ...F.samity, req: 1 }, { ...F.date, l: 'Report Date' }, R.SHEET, { k: 'extra', l: 'Extra Row', t: 'number', v: 5 }],
  run: async f => {
    if (!f.samity) fail('সমিতি বাছাই করুন');
    const month = f.date.slice(0, 7);
    const { rows, c } = await collSheetRows(f, f.date, f.sheet === 'data' ? month : null);
    const sam = c.sm[f.samity];
    const dates = R.meetDates(sam, month);
    if (f.sheet === 'data') rows.forEach(r => Object.keys(r.by).forEach(d => { if (!dates.includes(d)) dates.push(d); }));
    dates.sort();
    const en = await R.empName();
    return { sub: `সমিতি: ${f.samity} - ${esc(sam ? sam.name : '')} | মাস: ${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)} | মাঠকর্মী: ${en(sam && sam.foId)} | বার: ${esc(sam && sam.day ? WEEKDAYS_BN[sam.day] : '')}`, html: collSheetHTML(rows, dates, f.sheet, f.extra, c.mem) };
  },
});

// ─── সঞ্চয় কালেকশন শীট (১ দিনের) ───
ReportPage({
  id: 'rptDepCollSheet', title: 'সঞ্চয় কালেকশন শীট (১ দিনের)', landscape: true,
  filters: [F.branch, F.samity, { ...F.date, l: 'Report Date' }, R.SHEET],
  run: async f => {
    const c = await R.snaps(f, f.date);
    const got = {}; (await R.txns(f, f.date, f.date)).filter(t => t.kind === 'dep' || t.kind === 'share').forEach(t => { got[t.accNo] = got[t.accNo] || { c: 0, d: 0 }; got[t.accNo][t.dc === 'C' ? 'c' : 'd'] += num(t.amount); });
    // আজকের লেনদেনের আগের স্থিতি
    const accs = c.list.filter(s => (s.k === 'dep' || s.k === 'share') && (s.st !== 'closed' || got[s.accNo])).map(s => ({ ...s, b: r2(num(s.b) - ((got[s.accNo] || {}).c || 0) + ((got[s.accNo] || {}).d || 0)) })).sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    if (f.sheet !== 'data') Object.keys(got).forEach(k => delete got[k]);
    const g = groupBy(accs, s => s.samity); let html = '';
    for (const [sc, list] of Object.entries(g)) {
      html += `<h4 style="margin:8px 0 2px">সমিতি: ${sc} - ${esc((c.sm[sc] || {}).name || '')}</h4>` + UI.table([
        { h: 'SL', f: s => list.indexOf(s) + 1 }, { h: 'সদস্য আইডি', f: s => s.m }, { h: 'নাম', f: s => R.name(c.mem, s.m) }, { h: 'হিসাব নং', f: s => s.accNo }, { h: 'ধরন', f: s => typeName(s.k, s.t) },
        { h: 'পূর্বের স্থিতি', f: s => amt(s.b), r: 1, sum: 1, v: s => s.b }, { h: 'কিস্তি (টার্গেট)', f: s => f.sheet === 'blank' ? '' : amt(s.ia), r: 1, sum: f.sheet !== 'blank', v: s => s.ia },
        { h: 'জমা', f: s => f.sheet === 'data' && got[s.accNo] ? amt(got[s.accNo].c) : '', r: 1, sum: f.sheet === 'data', v: s => (got[s.accNo] || {}).c || 0 },
        { h: 'উত্তোলন', f: s => f.sheet === 'data' && got[s.accNo] ? amt(got[s.accNo].d) : '', r: 1, sum: f.sheet === 'data', v: s => (got[s.accNo] || {}).d || 0 }, { h: 'স্বাক্ষর', f: () => '' }], list);
    }
    return { sub: 'তারিখ: ' + fmtD(f.date), html: html || '<div class="mini">কোনো হিসাব নেই</div>' };
  },
});

// ─── লোন কালেকশন শীট (১ দিনের) — ১ ও ২ ───
function loanSheetPage(id, title, two) {
  ReportPage({
    id, title, landscape: true,
    filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Report Date' }, R.SHEET],
    run: async f => {
      const c = await R.snaps(f, f.date);
      const got = {}; (await R.txns(f, f.date, f.date)).filter(t => t.kind === 'loan' && t.dc === 'C').forEach(t => { const g = got[t.accNo] = got[t.accNo] || { a: 0, p: 0, pr: 0, pen: 0 }; g.a += num(t.amount); g.p += num(t.principal); g.pr += num(t.profit); g.pen += num(t.penalty); });
      // আজকের আদায়ের আগের অবস্থা
      const before = s => { const g = got[s.accNo]; if (!g) return s; return { ...s, b: r2(num(s.b) + g.a), pt: r2(num(s.pt) - g.a), pp: r2(num(s.pp) - g.p), ppr: r2(num(s.ppr) - g.pr), st: 'active' }; };
      const loans = c.list.filter(s => s.k === 'loan' && (s.st !== 'closed' || got[s.accNo])).map(s => { const sb = before(s); return { s: sb, ...R.loanSt(sb, f.date) }; }).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
      if (f.sheet !== 'data') Object.keys(got).forEach(k => delete got[k]);
      const D = f.sheet === 'data', B = f.sheet === 'blank';
      const cols = [
        { h: 'SL', f: x => loans.indexOf(x) + 1 }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'বিতরণ তারিখ', f: x => fmtD(x.s.od) },
        { h: 'বিতরণ', f: x => amt(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { h: 'মোট ঋণ', f: x => amt(x.s.tr), r: 1, sum: 1, v: x => x.s.tr }, { h: 'কিস্তি', f: x => amt(x.s.ia), r: 1 },
        { h: 'আদায়', f: x => amt(x.st.paid), r: 1, sum: 1, v: x => x.st.paid }, { h: 'স্থিতি', f: x => amt(x.st.outstanding), r: 1, sum: 1, v: x => x.st.outstanding },
        { h: 'বকেয়া', f: x => amt(x.st.overdue), r: 1, sum: 1, v: x => x.st.overdue }, { h: 'আজকের প্রাপ্য', f: x => B ? '' : amt(Math.min(x.st.outstanding, x.st.asonDue || x.st.todayInst)), r: 1, sum: !B, v: x => Math.min(x.st.outstanding, x.st.asonDue || x.st.todayInst) },
      ];
      if (two) cols.push({ h: 'আসল আদায়', f: x => D && got[x.s.accNo] ? amt(got[x.s.accNo].p) : '', r: 1, sum: D, v: x => (got[x.s.accNo] || {}).p || 0 }, { h: 'মুনাফা আদায়', f: x => D && got[x.s.accNo] ? amt(got[x.s.accNo].pr) : '', r: 1, sum: D, v: x => (got[x.s.accNo] || {}).pr || 0 });
      cols.push({ h: 'আদায় (আজ)', f: x => D && got[x.s.accNo] ? amt(got[x.s.accNo].a) : '', r: 1, sum: D, v: x => (got[x.s.accNo] || {}).a || 0 }, { h: 'জরিমানা', f: x => D && got[x.s.accNo] ? amt(got[x.s.accNo].pen) : '', r: 1 }, { h: 'স্বাক্ষর', f: () => '' });
      return { sub: 'তারিখ: ' + fmtD(f.date), html: UI.table(cols, loans) };
    },
  });
}
loanSheetPage('rptLoanCollSheet', 'লোন কালেকশন শীট (১ দিনের)', false);
loanSheetPage('rptLoanCollSheet2', 'Loan Collection Sheet Two', true);

// ─── কালেকশন বিস্তারিত ───
function collDetailsHTML(ts, mem) {
  ts.sort((a, b) => (a.date + a.samity + a.memberId).localeCompare(b.date + b.samity + b.memberId));
  return UI.table([
    { h: 'তারিখ', f: t => fmtD(t.date) }, { h: 'সমিতি', f: t => t.samity || '' }, { h: 'সদস্য', f: t => (t.memberId || '') + ' - ' + R.name(mem, t.memberId) }, { h: 'হিসাব', f: t => t.accNo || '' },
    { h: 'বিবরণ', f: t => esc(TT_NAME[t.tt] || t.tt) }, { h: 'সঞ্চয় জমা', f: t => R.cls(t) === 'depRcv' ? amt(t.amount) : '', r: 1, sum: 1, v: t => R.cls(t) === 'depRcv' ? t.amount : 0 },
    { h: 'সঞ্চয় ফেরত', f: t => R.cls(t) === 'depPay' ? amt(t.amount) : '', r: 1, sum: 1, v: t => R.cls(t) === 'depPay' ? t.amount : 0 },
    { h: 'আসল', f: t => R.cls(t) === 'loanRcv' ? amt(t.principal) : '', r: 1, sum: 1, v: t => R.cls(t) === 'loanRcv' ? t.principal : 0 },
    { h: 'মুনাফা', f: t => R.cls(t) === 'loanRcv' ? amt(t.profit) : '', r: 1, sum: 1, v: t => R.cls(t) === 'loanRcv' ? t.profit : 0 },
    { h: 'জরিমানা', f: t => num(t.penalty) ? amt(t.penalty) : '', r: 1, sum: 1, v: t => t.penalty || 0 }, { h: 'ফি', f: t => R.cls(t) === 'fee' ? amt(t.amount) : '', r: 1, sum: 1, v: t => R.cls(t) === 'fee' ? t.amount : 0 },
    { h: 'ইউজার', f: t => esc(t.byName || '') },
  ], ts);
}
const collFilters = (extra = []) => [F.branch, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra, USER_F];
ReportPage({
  id: 'rptCollDetails', title: 'কালেকশন বিস্তারিত রিপোর্ট', landscape: true, filters: collFilters([TRF_F]), init: R.userOpts,
  run: async f => { const mem = await Data.memberIdx(f.branch); const ts = (await R.txns(f, f.from, f.upto)).filter(t => ['depRcv', 'depPay', 'loanRcv', 'fee'].includes(R.cls(t)) && (f.trf !== 'no' || !R.isTrf(t))); return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: collDetailsHTML(ts, mem) }; },
});

// ─── কালেকশন সামারী (তারিখভিত্তিক) ───
function summarize(ts) {
  const o = { depRcv: 0, depPay: 0, p: 0, pr: 0, pen: 0, fee: 0, disb: 0 };
  ts.forEach(t => { const c = R.cls(t); if (c === 'depRcv') o.depRcv += num(t.amount); if (c === 'depPay') o.depPay += num(t.amount); if (c === 'loanRcv') { o.p += num(t.principal); o.pr += num(t.profit); } o.pen += num(t.penalty); if (c === 'fee') o.fee += num(t.amount); if (c === 'disb') o.disb += num(t.amount); });
  o.loan = r2(o.p + o.pr); o.net = r2(o.depRcv + o.loan + o.pen + o.fee - o.depPay); return o;
}
const SUM_COLS = [{ h: 'সঞ্চয় জমা', f: r => amt(r.depRcv), r: 1, sum: 1, v: r => r.depRcv }, { h: 'সঞ্চয় ফেরত', f: r => amt(r.depPay), r: 1, sum: 1, v: r => r.depPay }, { h: 'ঋণ বিতরণ', f: r => amt(r.disb), r: 1, sum: 1, v: r => r.disb }, { h: 'আসল আদায়', f: r => amt(r.p), r: 1, sum: 1, v: r => r.p }, { h: 'মুনাফা আদায়', f: r => amt(r.pr), r: 1, sum: 1, v: r => r.pr }, { h: 'মোট ঋণ আদায়', f: r => amt(r.loan), r: 1, sum: 1, v: r => r.loan }, { h: 'জরিমানা', f: r => amt(r.pen), r: 1, sum: 1, v: r => r.pen }, { h: 'ফি', f: r => amt(r.fee), r: 1, sum: 1, v: r => r.fee }, { h: 'নীট আদায়', f: r => amt(r.net), r: 1, sum: 1, v: r => r.net }];
ReportPage({
  id: 'rptCollSummary', title: 'কালেকশন সামারী রিপোর্ট', landscape: true, filters: collFilters(), init: R.userOpts,
  run: async f => { const g = groupBy((await R.txns(f, f.from, f.upto)).filter(t => !R.isTrf(t)), t => t.date); const rows = Object.keys(g).sort().map(d => ({ d, ...summarize(g[d]) })); return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'তারিখ', f: r => fmtD(r.d) }, ...SUM_COLS], rows) }; },
});

// ─── গ্রুপভিত্তিক সামারি (সঞ্চয় ও ঋণ আদায় সামারি / ফিল্ড অফিসার / DCR) ───
async function groupSummary(f, grpDefault) {
  const grp = f.grp || grpDefault; const bs = await R.branchesFor(f);
  const ts = (await R.txns({ ...f, branch: bs[0] }, f.from, f.upto, bs)).filter(t => !R.isTrf(t));
  const sm = {}; for (const b of bs) Object.assign(sm, await R.sams(b));
  const g = groupBy(ts, t => R.gkey(grp, t, (sm[t.samity] || {}).foId) || '—');
  const lab = await R.glabel(grp, bs);
  const rows = Object.keys(g).sort().map(k => ({ k, ...summarize(g[k]), cnt: new Set(g[k].map(t => t.memberId).filter(Boolean)).size }));
  return UI.table([{ h: { member: 'সদস্য', branch: 'শাখা', center: 'সমিতি', employee: 'মাঠকর্মী' }[grp], f: r => r.k === '—' ? '—' : lab(r.k) }, { h: 'সদস্য সংখ্যা', f: r => r.cnt, r: 1, sum: 1, v: r => r.cnt }, ...SUM_COLS], rows);
}
ReportPage({ id: 'rptCollSumDepInv', title: 'সঞ্চয় ও ঋণ আদায় সামারি', landscape: true, filters: [F.branch, F.btype, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, USER_F, R.GROUP], init: R.userOpts, run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: await groupSummary(f, 'member') }) });
ReportPage({ id: 'rptFieldOfficer', title: 'ফিল্ড অফিসার রিপোর্ট', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, F.samity, F.employee, { ...R.GROUP, opts: [['employee', 'Employee'], ['center', 'Center'], ['member', 'Member'], ['branch', 'Branch']] }], run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: await groupSummary(f, 'employee') }) });
ReportPage({ id: 'rptDCR', title: '(ডি সি আর) সমিতিভিত্তিক লেনদেন সামারি', landscape: true, filters: [F.branch, F.btype, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }], run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: await groupSummary({ ...f, grp: 'center' }, 'center') }) });

// ─── ঋণ কালেকশন বিবরণ (রিপোর্টিং টাইপ সহ) ───
ReportPage({
  id: 'rptEmiCollect', title: 'ঋণ কালেকশন বিবরণ', landscape: true,
  filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Collection Date', req: 1 }, { k: 'rt', l: 'Reporting Type', t: 'select', opts: [['inst', 'Todays Installment'], ['od', 'Todays Overdue'], ['adv', 'Todays Advance'], ['center', 'Todays Center'], ['coll', 'Todays All Collection'], ['tod', 'Total Overdue'], ['tadv', 'Total Advance'], ['exp', 'All Expire'], ['all', 'All']] }],
  run: async f => {
    const c = await R.snaps(f, f.date);
    const prev = {}; (await R.snaps(f, addDays(f.date, -1))).list.forEach(s => prev[s.accNo] = s);
    const ts = (await R.txns(f, f.date, f.date)).filter(t => t.kind === 'loan' && t.dc === 'C');
    const got = {}; ts.forEach(t => got[t.accNo] = r2((got[t.accNo] || 0) + num(t.amount)));
    const day = WEEKDAYS[parseD(f.date).getDay()];
    let rows = c.list.filter(s => s.k === 'loan').map(s => { const p = prev[s.accNo] || s; const b = R.loanSt(p, f.date); return { s, ...b, got: got[s.accNo] || 0 }; });
    const pick = {
      inst: x => x.st.todayInst > 0 && x.s.st !== 'closed', od: x => x.st.overdue > 0 && x.got > 0, adv: x => x.got > 0 && x.got > x.st.asonDue, center: x => (c.sm[x.s.samity] || {}).day === day && x.s.st !== 'closed',
      coll: x => x.got > 0, tod: x => x.st.overdue > 0, tadv: x => x.st.advance > 0, exp: x => x.st.expired, all: x => x.s.st !== 'closed' || x.got > 0,
    }[f.rt] || (() => true);
    rows = rows.filter(pick).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
    return {
      sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([
        { h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'মোবাইল', f: x => R.mobile(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo },
        { h: 'বিতরণ', f: x => amt(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { h: 'কিস্তি', f: x => amt(x.s.ia), r: 1 }, { h: 'মেয়াদ শেষ', f: x => fmtD(x.s.ed) },
        { h: 'আজকের কিস্তি', f: x => amt(x.st.todayInst), r: 1, sum: 1, v: x => x.st.todayInst }, { h: 'বকেয়া', f: x => amt(x.st.overdue), r: 1, sum: 1, v: x => x.st.overdue },
        { h: 'অগ্রিম', f: x => amt(x.st.advance), r: 1, sum: 1, v: x => x.st.advance }, { h: 'আজ আদায়', f: x => amt(x.got), r: 1, sum: 1, v: x => x.got }, { h: 'স্থিতি', f: x => amt(Math.max(0, x.st.outstanding - x.got)), r: 1, sum: 1, v: x => Math.max(0, x.st.outstanding - x.got) },
      ], rows),
    };
  },
});

// ─── লক্ষ্য বনাম অর্জন ───
ReportPage({
  id: 'rptTarget', title: 'লক্ষ্য বনাম অর্জন', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const c = await R.snaps(f, addDays(f.date, -1));
    const ts = await R.txns(f, f.date, f.date);
    const got = {}; ts.forEach(t => { if (t.dc === 'C' && (t.kind === 'loan' || t.kind === 'dep' || t.kind === 'share') && !R.isTrf(t)) got[t.accNo] = (got[t.accNo] || 0) + num(t.amount); });
    const day = WEEKDAYS[parseD(f.date).getDay()];
    const by = {};
    c.list.filter(s => s.st !== 'closed').forEach(s => {
      const sam = c.sm[s.samity] || {}; const meet = !sam.day || sam.day === day || (s.fq === 'D');
      const r = by[s.samity] = by[s.samity] || { k: s.samity, lt: 0, la: 0, dt: 0, da: 0 };
      if (s.k === 'loan') { const { st } = R.loanSt(s, f.date); r.lt += Math.min(st.outstanding, st.asonDue); r.la += got[s.accNo] || 0; }
      else { if (meet) r.dt += num(s.ia); r.da += got[s.accNo] || 0; }
    });
    const rows = Object.values(by).sort((a, b) => a.k.localeCompare(b.k));
    const pct = (a, t) => t ? (r2(a / t * 100)) + '%' : '—';
    return {
      sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([{ h: 'সমিতি', f: r => r.k + ' - ' + esc((c.sm[r.k] || {}).name || '') }, { h: 'ঋণ লক্ষ্য', f: r => amt(r.lt), r: 1, sum: 1, v: r => r.lt }, { h: 'ঋণ অর্জন', f: r => amt(r.la), r: 1, sum: 1, v: r => r.la }, { h: 'ঋণ %', f: r => pct(r.la, r.lt), r: 1 },
        { h: 'সঞ্চয় লক্ষ্য', f: r => amt(r.dt), r: 1, sum: 1, v: r => r.dt }, { h: 'সঞ্চয় অর্জন', f: r => amt(r.da), r: 1, sum: 1, v: r => r.da }, { h: 'সঞ্চয় %', f: r => pct(r.da, r.dt), r: 1 }], rows),
    };
  },
});

// ─── কালেকশন টপশিট (তারিখভিত্তিক, প্রোডাক্ট কলাম) ───
ReportPage({
  id: 'rptTopsheet', title: 'কালেকশন টপশিট', landscape: true, filters: collFilters(), init: R.userOpts,
  run: async f => {
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.dc === 'C' && ['dep', 'share', 'loan'].includes(t.kind) && !R.isTrf(t));
    const types = [...new Set(ts.map(t => t.kind + ':' + t.type))].sort();
    const g = groupBy(ts, t => t.date);
    const rows = Object.keys(g).sort().map(d => { const r = { d, tot: 0 }; g[d].forEach(t => { const k = t.kind + ':' + t.type; r[k] = (r[k] || 0) + num(t.amount); r.tot += num(t.amount) + num(t.penalty); r.pen = (r.pen || 0) + num(t.penalty); }); return r; });
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'তারিখ', f: r => fmtD(r.d) }, ...types.map(k => { const [kd, tp] = k.split(':'); return { h: typeName(kd, tp), f: r => amt(r[k] || 0), r: 1, sum: 1, v: r => r[k] || 0 }; }), { h: 'জরিমানা', f: r => amt(r.pen || 0), r: 1, sum: 1, v: r => r.pen || 0 }, { h: 'মোট', f: r => amt(r.tot), r: 1, sum: 1, v: r => r.tot }], rows) };
  },
});
