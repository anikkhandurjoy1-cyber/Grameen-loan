// ═══════════════════════════════════════════════════════════════
// ব্যালেন্স রিপোর্ট — eKisti এর হুবহু কলাম
// ═══════════════════════════════════════════════════════════════

// ─── সদস্য পাসবুক (Member Passbook) ───
ReportPage({
  id: 'rptPassbook', title: 'সদস্য পাসবুক',
  filters: [F.branch, { ...F.member, req: 1 }, { k: 'dacc', l: 'Deposit Account', t: 'select' }, { k: 'lacc', l: 'Loan Account', t: 'select' }, F.from, F.upto, { k: 'alld', l: 'All Date', t: 'select', opts: [['yes', 'Yes'], ['no', 'No']] }, { k: 'ast', l: 'Account Status', t: 'select', opts: [['active', 'Active'], ['closed', 'Closed'], ['all', 'All Account']] }],
  init: async (el, f) => {
    const load = async () => {
      const mid = UI.el(f, 'member').dataset.val; const list = mid ? await Data.accountsOf(UI.el(f, 'branch').value, mid) : [];
      UI.fill(UI.el(f, 'dacc'), list.filter(a => a.kind !== 'loan'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type), '— সব —');
      UI.fill(UI.el(f, 'lacc'), list.filter(a => a.kind === 'loan'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type), '— সব —');
    };
    UI.el(f, 'member').addEventListener('picked', load);
    const p = App._params || {}; if (p.member) { const m = UI.el(f, 'member'); m.value = p.member; m.dispatchEvent(new Event('change')); }
  },
  run: async f => {
    const m = await Data.member(f.member); if (!m) fail('সদস্য পাওয়া যায়নি');
    let accs = (await Data.accountsOf(f.branch, f.member)).filter(a => a.status !== 'cancelled' && (f.ast === 'all' || (f.ast === 'closed' ? a.status === 'closed' : a.status !== 'closed')));
    if (f.dacc || f.lacc) accs = accs.filter(a => a.accNo === f.dacc || a.accNo === f.lacc);
    const from = f.alld === 'no' ? f.from : '2000-01-01', upto = f.alld === 'no' ? f.upto : '2999-12-31';
    const sam = await Data.samity(m.samity);
    let html = `<h4 style="margin:4px 0">Member Details</h4>` + UI.info([['Member ID', esc(m.memberId)], ['Member Name', esc(m.name)], ['Father Name', esc(m.father || m.spouse || '')], ['Phone Number', esc(m.mobile || '')], ['Samity Name', esc((m.samity || '').slice(-4) + ' - ' + ((sam || {}).name || ''))], ['Present Address', esc(m.presentAddr || '')], ['Permanent Address', esc(m.permAddr || '')], ['Admission Date', fmtD(m.joinDate)]]);
    for (const a of accs) html += `<h4 style="margin:12px 0 4px">${a.accNo} — ${typeFull(a.kind, a.type)}${a.status === 'closed' ? ' (Closed)' : ''}</h4>` + await accStatementHTML(a.accNo, from, upto);
    return { title: 'Member Passbook', info: [], noSig: true, html };
  },
});

// সদস্যভিত্তিক সঞ্চয়/ঋণ ব্যালেন্স (eKisti: সিকিউরিটি, সাধারণ, শেয়ার, ডিপিএস, এফডিআর / মেয়াদী, এককালীন)
function memberBalances(list, date) {
  const by = {};
  list.forEach(s => {
    const r = by[s.m] = by[s.m] || { m: s.m, samity: s.samity, SS: 0, GS: 0, Share: 0, DPS: 0, FDR: 0, dep: 0, term: 0, single: 0, loan: 0, od: 0, loanCnt: 0, expired: false };
    if (s.k === 'loan') { if (s.st === 'closed') return; const { st } = R.loanSt(s, date); if (s.fq === 'S' || s.fq === 'C') r.single += st.outstanding; else r.term += st.outstanding; r.loan += st.outstanding; r.od += st.overdue; r.loanCnt++; if (st.expired) r.expired = true; }
    else if (s.k === 'dep' || s.k === 'share') { if (s.st === 'closed') return; const b = BUCKET(s.k, s.t); r[b] += num(s.b); r.dep += num(s.b); }
  });
  return Object.values(by).map(r => ({ ...r, plus: Math.max(0, r2(r.dep - r.loan)), minus: Math.max(0, r2(r.loan - r.dep)) }));
}
const balCols = (Dep, Loan, Mem, labels) => [
  ...[['SS', labels[0]], ['GS', labels[1]], ['Share', labels[2]], ['DPS', labels[3]], ['FDR', labels[4]]].map(([k, h]) => ({ g: Dep, h, f: r => n2(r[k]), r: 1, sum: 1, v: r => r[k] })), { g: Dep, h: labels[5], f: r => n2(r.dep), r: 1, sum: 1, v: r => r.dep },
  { g: Loan, h: labels[6], f: r => n2(r.term), r: 1, sum: 1, v: r => r.term }, { g: Loan, h: labels[7], f: r => n2(r.single), r: 1, sum: 1, v: r => r.single }, { g: Loan, h: labels[8], f: r => n2(r.loan), r: 1, sum: 1, v: r => r.loan },
  { g: Mem, h: labels[9], f: r => n2(r.plus), r: 1, sum: 1, v: r => r.plus }, { g: Mem, h: labels[10], f: r => n2(r.minus), r: 1, sum: 1, v: r => r.minus }];
const BN_LBL = ['সিকিউরিটি', 'সাধারণ', 'শেয়ার', 'ডিপিএস', 'এফডিআর', 'মোট', 'মেয়াদী', 'চলমান', 'মোট', 'প্লাস', 'মাইনাস'];
const EN_LBL = ['Security', 'General', 'Share', 'DPS', 'FDR', 'Total', 'Term', 'Continuous', 'Total', 'Plus', 'Minus'];
function groupSum(rows, keyFn) {
  const g = groupBy(rows, r => keyFn(r) || '—');
  return Object.keys(g).sort().map(k => { const o = { k, cnt: g[k].length }; ['SS', 'GS', 'Share', 'DPS', 'FDR', 'dep', 'term', 'single', 'loan', 'od'].forEach(x => o[x] = sum(g[k], r => r[x])); o.plus = Math.max(0, r2(o.dep - o.loan)); o.minus = Math.max(0, r2(o.loan - o.dep)); return o; });
}
const shortSam = (sm, k) => esc((k || '').slice(-4));
const officer = (en, id) => esc((en(id) || '').replace(/^\d+ - /, ''));

// ─── সদস্য ব্যালেন্স (Member Balance Report) ───
ReportPage({
  id: 'rptMemberBalance', title: 'সদস্য ব্যালেন্স রিপোর্ট', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { k: 'bt', l: 'Balance Report Type', t: 'select', opts: [['all', 'All'], ['loan', 'Loan Member Only'], ['sav', 'Saving Member Only'], ['exp', 'Expired Loan Member Only']] }, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const c = await R.snaps(f, f.date); const en = await R.empName();
    const rows = memberBalances(c.list, f.date).filter(r => f.bt === 'loan' ? r.loanCnt : f.bt === 'sav' ? !r.loanCnt : f.bt === 'exp' ? r.expired : true).sort((a, b) => a.samity.localeCompare(b.samity) || a.m.localeCompare(b.m));
    return { title: 'Member Balance Report', html: UI.table([SL, { g: 'সমিতি ডিটেল', h: 'কোড', f: r => shortSam(c.sm, r.samity) }, { g: 'সমিতি ডিটেল', h: 'নাম', f: r => esc((c.sm[r.samity] || {}).name || '') }, { g: 'সমিতি ডিটেল', h: 'আফিসার', f: r => officer(en, c.fo(r.samity)) }, { g: 'সদস্য ডিটেল', h: 'আইডি', f: r => r.m }, { g: 'সদস্য ডিটেল', h: 'নাম', f: r => R.name(c.mem, r.m) },
      ...balCols('সঞ্চয়', 'লোন', 'সদস্য ব্যালেন্স', ['সিকিউরিটি', 'সাধারন', 'শেয়ার', 'ডি পি এস', 'এফ ডি আর', 'মোট', 'মেয়াদী', 'এককালীন', 'মোট', 'প্লাস', 'মাইনাস'])], rows) };
  },
});
ReportPage({
  id: 'rptSamityBalance', title: 'সমিতি ব্যালেন্স রিপোর্ট', landscape: true, filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Report Date' }],
  run: async f => { const c = await R.snaps(f, f.date); const en = await R.empName(); const rows = groupSum(memberBalances(c.list, f.date), r => r.samity);
    return { title: 'Samity Wise Outstanding Balance Report', html: UI.table([SL, { g: 'সমিতি ডিটেল', h: 'কোড', f: r => shortSam(c.sm, r.k) }, { g: 'সমিতি ডিটেল', h: 'নাম', f: r => esc((c.sm[r.k] || {}).name || '') }, { g: 'সমিতি ডিটেল', h: 'অফিসার', f: r => officer(en, c.fo(r.k)) }, ...balCols('ডিপোজিট', 'লোন', 'সদস্য ব্যালেন্স', BN_LBL)], rows) }; },
});
ReportPage({
  id: 'rptEmpBalance', title: 'ফিল্ড অফিসার ভিত্তিক ব্যালেন্স', landscape: true, filters: [F.branch, F.employee, { ...F.date, l: 'Report Date' }],
  run: async f => { const c = await R.snaps(f, f.date); const en = await R.empName(); const rows = groupSum(memberBalances(c.list, f.date), r => c.fo(r.samity));
    return { title: 'Employee Wise Outstanding Balance Report', html: UI.table([SL, { h: 'Officer Name', f: r => r.k === '—' ? '—' : officer(en, r.k) }, ...balCols('Deposit', 'Loan', 'Member Balance', EN_LBL)], rows) }; },
});

// ─── ঋণ ব্যালেন্স (Member / Samity / Employee Wise Loan Balance) ───
const LOAN_FILTER = { k: 'lt', l: 'Loan Type', t: 'select', opts: [['active', 'Active Accounts'], ['recv', 'Installment Receivable Only'], ['od', 'Installment Overdue Only'], ['rcv', 'Installment Receive Only'], ['exp', 'Expire Accounts Only'], ['closed', 'Closed Accounts Only'], ['all', 'All Accounts']] };
async function loanBalanceRows(f) {
  const c = await R.snaps(f, f.upto);
  const open = {}; (await Hist.snapsAt(f.branch, addDays(f.from, -1), f.samity)).forEach(s => open[s.accNo] = s);
  const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan');
  const rc = {}; ts.forEach(t => { if (t.dc === 'C' && t.tt !== 'EMI_WAIVE') { const x = rc[t.accNo] = rc[t.accNo] || { a: 0, p: 0, pr: 0 }; x.a += num(t.amount); x.p += num(t.principal); x.pr += num(t.profit); } });
  const split = (s, v) => { const tr = num(s.tr) || 1; const p = r2(v * num(s.pr) / tr); return { t: r2(v), p, pr: r2(v - p) }; };
  let rows = c.list.filter(s => s.k === 'loan' && (!f.ltype || s.t === f.ltype) && (!num(f.rate) || num(s.rt) === num(f.rate))).map(s => {
    const { st, l } = R.loanSt(s, f.upto); const o = open[s.accNo];
    const ob = o ? { t: num(o.b), p: r2(num(o.pr) - num(o.pp)), pr: r2(num(o.pf) - num(o.ppr)) } : { t: 0, p: 0, pr: 0 };
    const due = split(s, sum(Loan.schedule(l).filter(x => x.date >= f.from && x.date <= f.upto), x => x.amount));
    const g = rc[s.accNo] || { a: 0, p: 0, pr: 0 };
    return { s, st, open: ob, due, paid: { t: r2(g.a), p: r2(g.p), pr: r2(g.pr) }, od: split(s, st.overdue), close: { t: num(s.b), p: st.principalOut, pr: st.profitOut } };
  });
  const flt = { active: x => x.s.st !== 'closed', recv: x => x.s.st !== 'closed' && x.st.asonDue > 0, od: x => x.st.overdue > 0, rcv: x => x.paid.t > 0, exp: x => x.st.expired, closed: x => x.s.st === 'closed', all: () => true }[f.lt || 'active'];
  rows = rows.filter(flt).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
  return { rows, c };
}
const loanBalFilters = extra => [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra];
const TPP = (G, key) => [['t', 'Total'], ['p', 'Principal'], ['pr', 'Profit']].map(([k, h]) => ({ g: G, h, f: r => n2(r[key][k]), r: 1, sum: 1, v: r => r[key][k] }));
const LB5 = (dueLabel) => [...TPP('Opening Balance', 'open'), ...TPP(dueLabel, 'due'), ...TPP('Installment Paid', 'paid'), ...TPP('Overdue', 'od'), ...TPP('Closing Balance', 'close')];
const FREQ_EN = { D: 'Daily', W: 'Weekly', M: 'Monthly', F: 'Fortnightly', Q: 'Quarterly', H: 'Half Yearly', Y: 'Yearly', S: 'Single', C: 'At Maturity' };
ReportPage({
  id: 'rptMemLoanBalance', title: 'সদস্য ঋণ ব্যালেন্স', landscape: true, fromDefault: 'month', filters: loanBalFilters([LOAN_FILTER, { k: 'rate', l: 'Profit Rate', t: 'number' }]),
  run: async f => { const { rows, c } = await loanBalanceRows(f);
    return { title: 'Member Loan Balance', html: UI.table([SL, { g: 'Member Details', h: 'ID', f: x => x.s.m }, { g: 'Member Details', h: 'Name', f: x => R.name(c.mem, x.s.m) }, { h: 'Phone', f: x => R.mobile(c.mem, x.s.m) }, { h: 'AC', f: x => x.s.accNo }, { h: 'Inst Amount', f: x => n2(x.s.ia), r: 1 }, { h: 'Inst Freq', f: x => FREQ_EN[x.s.fq] || x.s.fq }, { h: 'Inst No', f: x => x.st.sch.length, r: 1 }, { h: 'Disb Date', f: x => fmtD(x.s.od) }, { h: 'Loan Amount', f: x => n2(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, ...LB5('Installment Receivable')], rows) }; },
});
function loanGroupPage(id, title, keyFn, head, ptitle) {
  ReportPage({
    id, title, landscape: true, fromDefault: 'month', filters: loanBalFilters(id === 'rptEmpLoanBalance' ? [LOAN_FILTER] : []),
    run: async f => {
      const { rows, c } = await loanBalanceRows({ ...f, lt: f.lt || 'all' }); const en = await R.empName();
      const g = groupBy(rows, x => keyFn(x, c) || '—');
      const out = Object.keys(g).sort().map(k => { const l = g[k]; const o = { k, cnt: l.filter(x => x.s.st !== 'closed').length, ia: sum(l, x => x.s.ia), pr: sum(l, x => x.s.pr) }; ['open', 'due', 'paid', 'od', 'close'].forEach(key => { o[key] = { t: sum(l, x => x[key].t), p: sum(l, x => x[key].p), pr: sum(l, x => x[key].pr) }; }); return o; });
      const first = id === 'rptEmpLoanBalance' ? [{ h: 'Employee Name', f: r => r.k === '—' ? '—' : officer(en, r.k) }, { h: 'Count', f: r => r.cnt, r: 1, sum: 1, int: 1, v: r => r.cnt }] : [{ h: 'Samity Details', f: r => esc(r.k.slice(-4) + ' - ' + ((c.sm[r.k] || {}).name || '')) }, { h: 'Total Loan', f: r => r.cnt, r: 1, sum: 1, int: 1, v: r => r.cnt }];
      return { title: ptitle, html: UI.table([SL, ...first, { h: 'Inst Amount', f: r => n2(r.ia), r: 1, sum: 1, v: r => r.ia }, { h: 'Loan Amount', f: r => n2(r.pr), r: 1, sum: 1, v: r => r.pr }, ...LB5('Installment Due')], out) };
    },
  });
}
loanGroupPage('rptSamityLoanBalance', 'সমিতি ভিত্তিক ঋণ স্থিতি', x => x.s.samity, 'সমিতি', 'Samity Wise Loan Balance');
loanGroupPage('rptEmpLoanBalance', 'ফিল্ড অফিসার ভিত্তিক ঋণ স্থিতি', (x, c) => c.fo(x.s.samity), 'মাঠকর্মী', 'Employee Wise Loan Balance');

// ─── মাস ভিত্তিক সঞ্চয় লেনদেন (Monthly Deposit Account Transaction Report) ───
ReportPage({
  id: 'rptYearlyDep', title: 'মাস ভিত্তিক সঞ্চয় লেনদেন রিপোর্ট', landscape: true,
  filters: [F.branch, F.samity, DEP_TYPE_F, F.employee, F.member, { k: 'year', l: 'Transaction Year', t: 'number', v: new Date().getFullYear() }],
  run: async f => {
    const y = String(parseInt(f.year) || new Date().getFullYear());
    const c = await R.snaps(f, y + '-12-31' < today() ? y + '-12-31' : today());
    const ts = (await R.txns(f, y + '-01-01', y + '-12-31')).filter(t => (t.kind === 'dep' || t.kind === 'share') && (!f.dtype || t.type === f.dtype));
    const by = {}; ts.forEach(t => { const r = by[t.accNo] = by[t.accNo] || {}; const mo = Number(t.date.slice(5, 7)); const k = (t.dc === 'C' ? 'd' : 'w') + mo; r[k] = (r[k] || 0) + num(t.amount); });
    const rows = c.list.filter(s => (s.k === 'dep' || s.k === 'share') && (!f.dtype || s.t === f.dtype) && (by[s.accNo] || s.st !== 'closed')).map(s => { const mo = by[s.accNo] || {}; return { s, mo, dT: sum(MONTHS.map((x, i) => mo['d' + (i + 1)] || 0)), wT: sum(MONTHS.map((x, i) => mo['w' + (i + 1)] || 0)) }; }).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
    return { title: 'Monthly Deposit Account Transaction Report', info: [['Reporting Year', y], ['Branch Name', esc((await Data.branch(f.branch) || {}).name || '')], ['Branch Address', esc((await Data.branch(f.branch) || {}).address || '')]],
      html: UI.table([SL, { h: 'ID', f: x => x.s.m }, { h: 'Name', f: x => R.name(c.mem, x.s.m) }, { h: 'AC Type', f: x => esc(typeFull(x.s.k, x.s.t).replace(/^\w+ - /, '')) }, ...MONTHS.flatMap((mn, i) => [{ g: mn, h: 'DEP', f: x => n2(x.mo['d' + (i + 1)]), r: 1, sum: 1, v: x => x.mo['d' + (i + 1)] || 0 }, { g: mn, h: 'WIT', f: x => n2(x.mo['w' + (i + 1)]), r: 1, sum: 1, v: x => x.mo['w' + (i + 1)] || 0 }]), { g: 'Total', h: 'DEP', f: x => n2(x.dT), r: 1, sum: 1, v: x => x.dT }, { g: 'Total', h: 'WIT', f: x => n2(x.wT), r: 1, sum: 1, v: x => x.wT }], rows) };
  },
});

// ─── ডিপোজিট লাভ ব্যালেন্স (Member Deposit Profit Report) ───
ReportPage({
  id: 'rptDepProfitBal', title: 'ডিপোজিট লাভ ব্যালেন্স', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, DEP_TYPE_F, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'dep' && ['PROFIT_POST', 'PROFIT_PAY'].includes(t.tt));
    const by = {}; ts.forEach(t => { const r = by[t.accNo] = by[t.accNo] || { post: 0, pay: 0 }; if (t.tt === 'PROFIT_POST') r.post += num(t.amount); else r.pay += num(t.amount); });
    const rows = c.list.filter(s => s.k === 'dep' && (!f.dtype || s.t === f.dtype) && by[s.accNo]).map(s => ({ s, payable: by[s.accNo].post + by[s.accNo].pay, pay: by[s.accNo].pay + by[s.accNo].post }));
    return { title: 'Member Deposit Profit Report', html: UI.table([SL, { h: 'ID', f: x => x.s.m }, { h: 'Name', f: x => R.name(c.mem, x.s.m) }, { h: 'Account Type', f: x => esc(typeFull('dep', x.s.t).replace(/^\w+ - /, '')) }, { h: 'Account ID', f: x => x.s.accNo }, { h: 'Payable', f: x => n2(x.payable), r: 1, sum: 1, v: x => x.payable }, { h: 'Payment', f: x => n2(x.pay), r: 1, sum: 1, v: x => x.pay }, { h: 'Payment Due', f: x => n2(x.payable - x.pay), r: 1, sum: 1, v: x => x.payable - x.pay }], rows) };
  },
});

// ─── জিরো ট্রানজেকশন (Zero Transaction Report) ───
ReportPage({
  id: 'rptZeroTxn', title: 'জিরো ট্রানজেকশন রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, { k: 'kind', l: 'Account Type', t: 'select', opts: KIND_OPTS }, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const has = new Set((await R.txns(f, f.from, f.upto)).map(t => t.accNo));
    const lastT = {}; (await R.txns(f, addDays(f.from, -180), addDays(f.from, -1))).forEach(t => { if (!lastT[t.accNo] || t.date > lastT[t.accNo]) lastT[t.accNo] = t.date; });
    const rows = c.list.filter(s => s.st !== 'closed' && kindMatch(f, s) && !has.has(s.accNo) && (!s.od || s.od < f.from)).sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    return { title: 'Zero Transaction Report', html: UI.table([SL, { g: 'Samity Details', h: 'Code', f: s => shortSam(c.sm, s.samity) }, { g: 'Samity Details', h: 'Name', f: s => esc((c.sm[s.samity] || {}).name || '') }, { g: 'Member Details', h: 'ID', f: s => s.m }, { g: 'Member Details', h: 'Name', f: s => R.name(c.mem, s.m) }, { g: 'Member Details', h: 'Phone', f: s => R.mobile(c.mem, s.m) }, { g: 'Account Details', h: 'AC Type', f: s => s.k === 'share' ? 'Share Accounts' : esc(typeFull(s.k, s.t).replace(/^\w+ - /, '')) }, { g: 'Account Details', h: 'Last Transaction Date', f: s => fmtD(lastT[s.accNo] || '') }, { g: 'Account Details', h: 'Balance', f: s => n2(s.b), r: 1, sum: 1, v: s => s.b }], rows) };
  },
});
