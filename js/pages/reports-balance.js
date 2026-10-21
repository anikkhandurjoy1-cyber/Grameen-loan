// ═══════════════════════════════════════════════════════════════
// ব্যালেন্স রিপোর্ট
// ═══════════════════════════════════════════════════════════════

// ─── সদস্য পাসবুক ───
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
    let html = UI.info([['সদস্য', esc(m.memberId + ' - ' + m.name)], ['পিতা/স্বামী', esc(m.father || m.spouse || '')], ['সমিতি', esc(m.samity)], ['মোবাইল', esc(m.mobile || '')], ['ভর্তির তারিখ', fmtD(m.joinDate)], ['ঠিকানা', esc(m.presentAddr || '')]]);
    for (const a of accs) html += `<h4 style="margin:12px 0 4px">${a.accNo} — ${typeFull(a.kind, a.type)}${a.status === 'closed' ? ' (Closed)' : ''}</h4>` + await accStatementHTML(a.accNo, from, upto);
    return { sub: f.alld === 'no' ? `${fmtD(f.from)} হতে ${fmtD(f.upto)}` : 'সকল তারিখ', html: html };
  },
});

// সদস্যভিত্তিক ব্যালেন্স সারাংশ
function memberBalances(list, date) {
  const by = {};
  list.forEach(s => {
    const r = by[s.m] = by[s.m] || { m: s.m, samity: s.samity, dep: {}, share: 0, depTot: 0, loanOut: 0, loanOd: 0, loanCnt: 0, expired: false };
    if (s.k === 'loan') { if (s.st === 'closed') return; const { st } = R.loanSt(s, date); r.loanOut += st.outstanding; r.loanOd += st.overdue; r.loanCnt++; if (st.expired) r.expired = true; }
    else if (s.k === 'share') { r.share += num(s.b); r.depTot += num(s.b); }
    else if (s.k === 'dep') { r.dep[s.t] = (r.dep[s.t] || 0) + num(s.b); r.depTot += num(s.b); }
  });
  return Object.values(by);
}
const depTypeCols = rows => { const ts = [...new Set(rows.flatMap(r => Object.keys(r.dep)))].sort(); return ts.map(t => ({ h: (REF.DEP[t] || {}).short || t, f: r => amt(r.dep[t] || 0), r: 1, sum: 1, v: r => r.dep[t] || 0 })); };

// ─── সদস্য ব্যালেন্স ───
ReportPage({
  id: 'rptMemberBalance', title: 'সদস্য ব্যালেন্স রিপোর্ট', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { k: 'bt', l: 'Balance Report Type', t: 'select', opts: [['all', 'All'], ['loan', 'Loan Member Only'], ['sav', 'Saving Member Only'], ['exp', 'Expired Loan Member Only']] }, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const c = await R.snaps(f, f.date);
    let rows = memberBalances(c.list, f.date).filter(r => f.bt === 'loan' ? r.loanCnt : f.bt === 'sav' ? !r.loanCnt : f.bt === 'exp' ? r.expired : true);
    rows.sort((a, b) => a.samity.localeCompare(b.samity) || a.m.localeCompare(b.m));
    return { sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([{ h: 'সমিতি', f: r => r.samity }, { h: 'সদস্য আইডি', f: r => r.m }, { h: 'নাম', f: r => R.name(c.mem, r.m) }, { h: 'মোবাইল', f: r => R.mobile(c.mem, r.m) }, ...depTypeCols(rows), { h: 'শেয়ার', f: r => amt(r.share), r: 1, sum: 1, v: r => r.share }, { h: 'মোট সঞ্চয়', f: r => amt(r.depTot), r: 1, sum: 1, v: r => r.depTot }, { h: 'ঋণ স্থিতি', f: r => amt(r.loanOut), r: 1, sum: 1, v: r => r.loanOut }, { h: 'বকেয়া', f: r => amt(r.loanOd), r: 1, sum: 1, v: r => r.loanOd }], rows) };
  },
});

// গ্রুপ (সমিতি/মাঠকর্মী) ব্যালেন্স
function groupBalance(c, date, keyFn, label) {
  const mb = memberBalances(c.list, date);
  const g = groupBy(mb, r => keyFn(r) || '—');
  const rows = Object.keys(g).sort().map(k => { const l = g[k]; const dep = {}; l.forEach(r => Object.entries(r.dep).forEach(([t, v]) => dep[t] = (dep[t] || 0) + v)); return { k, members: l.length, borrowers: l.filter(r => r.loanCnt).length, dep, share: sum(l, r => r.share), depTot: sum(l, r => r.depTot), loanOut: sum(l, r => r.loanOut), loanOd: sum(l, r => r.loanOd) }; });
  return UI.table([{ h: label.h, f: r => label.f(r.k) }, { h: 'সদস্য', f: r => r.members, r: 1, sum: 1, v: r => r.members }, { h: 'ঋণী', f: r => r.borrowers, r: 1, sum: 1, v: r => r.borrowers }, ...depTypeCols(rows), { h: 'শেয়ার', f: r => amt(r.share), r: 1, sum: 1, v: r => r.share }, { h: 'মোট সঞ্চয়', f: r => amt(r.depTot), r: 1, sum: 1, v: r => r.depTot }, { h: 'ঋণ স্থিতি', f: r => amt(r.loanOut), r: 1, sum: 1, v: r => r.loanOut }, { h: 'বকেয়া', f: r => amt(r.loanOd), r: 1, sum: 1, v: r => r.loanOd }], rows);
}
ReportPage({ id: 'rptSamityBalance', title: 'সমিতি ব্যালেন্স রিপোর্ট', landscape: true, filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Report Date' }], run: async f => { const c = await R.snaps(f, f.date); return { sub: 'তারিখ: ' + fmtD(f.date), html: groupBalance(c, f.date, r => r.samity, { h: 'সমিতি', f: k => k + ' - ' + esc((c.sm[k] || {}).name || '') }) }; } });
ReportPage({ id: 'rptEmpBalance', title: 'ফিল্ড অফিসার ভিত্তিক ব্যালেন্স', landscape: true, filters: [F.branch, F.employee, { ...F.date, l: 'Report Date' }], run: async f => { const c = await R.snaps(f, f.date); const en = await R.empName(); return { sub: 'তারিখ: ' + fmtD(f.date), html: groupBalance(c, f.date, r => c.fo(r.samity), { h: 'মাঠকর্মী', f: k => k === '—' ? '—' : en(k) }) }; } });

// ─── ঋণ ব্যালেন্স (সদস্য / সমিতি / মাঠকর্মী) ───
const LOAN_FILTER = { k: 'lt', l: 'Loan Type', t: 'select', opts: [['active', 'Active Accounts'], ['recv', 'Installment Receivable Only'], ['od', 'Installment Overdue Only'], ['rcv', 'Installment Receive Only'], ['exp', 'Expire Accounts Only'], ['closed', 'Closed Accounts Only'], ['all', 'All Accounts']] };
async function loanBalanceRows(f) {
  const c = await R.snaps(f, f.upto);
  const open = {}; (await Hist.snapsAt(f.branch, addDays(f.from, -1), f.samity)).forEach(s => open[s.accNo] = s);
  const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan');
  const rc = {}, ds = {}; ts.forEach(t => { if (t.dc === 'C') { const x = rc[t.accNo] = rc[t.accNo] || { a: 0, p: 0, pr: 0 }; x.a += num(t.amount); x.p += num(t.principal); x.pr += num(t.profit); } else if (t.tt === 'LOAN_DISB' || t.tt === 'STAFF_LOAN_DISB') ds[t.accNo] = (ds[t.accNo] || 0) + num(t.amount); });
  let rows = c.list.filter(s => s.k === 'loan' && (!f.ltype || s.t === f.ltype) && (!num(f.rate) || num(s.rt) === num(f.rate))).map(s => {
    const { st } = R.loanSt(s, f.upto); const o = open[s.accNo];
    return { s, st, open: o ? num(o.b) : 0, disb: ds[s.accNo] || 0, rcv: rc[s.accNo] || { a: 0, p: 0, pr: 0 }, close: num(s.b) };
  });
  const flt = { active: x => x.s.st !== 'closed', recv: x => x.s.st !== 'closed' && x.st.asonDue > 0, od: x => x.st.overdue > 0, rcv: x => x.rcv.a > 0, exp: x => x.st.expired, closed: x => x.s.st === 'closed', all: () => true }[f.lt || 'active'];
  rows = rows.filter(flt).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
  return { rows, c };
}
const loanBalFilters = extra => [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra];
const LB_COLS = [{ h: 'ওপেনিং স্থিতি', f: r => amt(r.open), r: 1, sum: 1, v: r => r.open }, { h: 'বিতরণ', f: r => amt(r.disb), r: 1, sum: 1, v: r => r.disb }, { h: 'আসল আদায়', f: r => amt(r.rp), r: 1, sum: 1, v: r => r.rp }, { h: 'মুনাফা আদায়', f: r => amt(r.rpr), r: 1, sum: 1, v: r => r.rpr }, { h: 'মোট আদায়', f: r => amt(r.ra), r: 1, sum: 1, v: r => r.ra }, { h: 'সমাপনী স্থিতি', f: r => amt(r.close), r: 1, sum: 1, v: r => r.close }, { h: 'বকেয়া', f: r => amt(r.od), r: 1, sum: 1, v: r => r.od }, { h: 'অগ্রিম', f: r => amt(r.adv), r: 1, sum: 1, v: r => r.adv }];
const lbFlat = x => ({ open: x.open, disb: x.disb, rp: x.rcv.p, rpr: x.rcv.pr, ra: x.rcv.a, close: x.close, od: x.st.overdue, adv: x.st.advance });
ReportPage({
  id: 'rptMemLoanBalance', title: 'সদস্য ঋণ ব্যালেন্স', landscape: true, fromDefault: 'month', filters: loanBalFilters([LOAN_FILTER, { k: 'rate', l: 'Profit Rate', t: 'number' }]),
  run: async f => { const { rows, c } = await loanBalanceRows(f); return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'বিতরণ তারিখ', f: x => fmtD(x.s.od) }, { h: 'ঋণের পরিমাণ', f: x => amt(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { h: 'হার%', f: x => x.s.rt || '', r: 1 }, { h: 'কিস্তি', f: x => amt(x.s.ia), r: 1 }, { h: 'মেয়াদ শেষ', f: x => fmtD(x.s.ed) }, ...LB_COLS.map(col => ({ ...col, f: x => col.f(lbFlat(x)), v: x => col.v(lbFlat(x)) }))], rows) }; },
});
function loanGroupPage(id, title, keyFn, head) {
  ReportPage({
    id, title, landscape: true, fromDefault: 'month', filters: loanBalFilters(id === 'rptEmpLoanBalance' ? [LOAN_FILTER] : []),
    run: async f => {
      const { rows, c } = await loanBalanceRows({ ...f, lt: f.lt || 'all' }); const en = await R.empName();
      const g = groupBy(rows, x => keyFn(x, c) || '—');
      const out = Object.keys(g).sort().map(k => { const l = g[k].map(lbFlat); const o = { k, cnt: g[k].filter(x => x.s.st !== 'closed').length }; LB_COLS.forEach((col, i) => { const key = ['open', 'disb', 'rp', 'rpr', 'ra', 'close', 'od', 'adv'][i]; o[key] = sum(l, r => r[key]); }); return o; });
      return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: head, f: r => r.k === '—' ? '—' : (id === 'rptEmpLoanBalance' ? en(r.k) : r.k + ' - ' + esc((c.sm[r.k] || {}).name || '')) }, { h: 'চলতি ঋণী', f: r => r.cnt, r: 1, sum: 1, v: r => r.cnt }, ...LB_COLS], out) };
    },
  });
}
loanGroupPage('rptSamityLoanBalance', 'সমিতি ভিত্তিক ঋণ স্থিতি', x => x.s.samity, 'সমিতি');
loanGroupPage('rptEmpLoanBalance', 'ফিল্ড অফিসার ভিত্তিক ঋণ স্থিতি', (x, c) => c.fo(x.s.samity), 'মাঠকর্মী');

// ─── মাস ভিত্তিক সঞ্চয় লেনদেন (বছর) ───
ReportPage({
  id: 'rptYearlyDep', title: 'মাস ভিত্তিক সঞ্চয় লেনদেন রিপোর্ট', landscape: true,
  filters: [F.branch, F.samity, DEP_TYPE_F, F.employee, F.member, { k: 'year', l: 'Transaction Year', t: 'number', v: new Date().getFullYear() }],
  run: async f => {
    const y = String(parseInt(f.year) || new Date().getFullYear());
    const c = await R.snaps(f, y + '-12-31' < today() ? y + '-12-31' : today());
    const ts = (await R.txns(f, y + '-01-01', y + '-12-31')).filter(t => t.kind === 'dep' && (!f.dtype || t.type === f.dtype));
    const by = {}; ts.forEach(t => { const r = by[t.accNo] = by[t.accNo] || {}; const mo = Number(t.date.slice(5, 7)); r[mo] = (r[mo] || 0) + num(t.delta); });
    const rows = c.list.filter(s => s.k === 'dep' && (!f.dtype || s.t === f.dtype) && (by[s.accNo] || s.st !== 'closed')).map(s => ({ s, mo: by[s.accNo] || {} })).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
    return { sub: 'বছর: ' + y + ' (নীট জমা)', html: UI.table([{ h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'ধরন', f: x => typeName('dep', x.s.t) }, ...MONTHS.map((mn, i) => ({ h: mn.slice(0, 3), f: x => x.mo[i + 1] ? amt(x.mo[i + 1]) : '', r: 1, sum: 1, v: x => x.mo[i + 1] || 0 })), { h: 'মোট', f: x => amt(sum(Object.values(x.mo))), r: 1, sum: 1, v: x => sum(Object.values(x.mo)) }, { h: 'স্থিতি', f: x => amt(x.s.b), r: 1, sum: 1, v: x => x.s.b }], rows) };
  },
});

// ─── ডিপোজিট লাভ ব্যালেন্স ───
ReportPage({
  id: 'rptDepProfitBal', title: 'ডিপোজিট লাভ ব্যালেন্স', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, DEP_TYPE_F, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'dep' && ['PROFIT_POST', 'PROFIT_PAY'].includes(t.tt));
    const by = {}; ts.forEach(t => { const r = by[t.accNo] = by[t.accNo] || { post: 0, pay: 0 }; if (t.tt === 'PROFIT_POST') r.post += num(t.amount); else r.pay += num(t.amount); });
    const rows = c.list.filter(s => s.k === 'dep' && (!f.dtype || s.t === f.dtype) && by[s.accNo]).map(s => ({ s, ...by[s.accNo] }));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'ধরন', f: x => typeName('dep', x.s.t) }, { h: 'স্থিতি', f: x => amt(x.s.b), r: 1, sum: 1, v: x => x.s.b }, { h: 'মুনাফা জমা (পোস্ট)', f: x => amt(x.post), r: 1, sum: 1, v: x => x.post }, { h: 'মুনাফা প্রদান (নগদ)', f: x => amt(x.pay), r: 1, sum: 1, v: x => x.pay }, { h: 'মোট মুনাফা', f: x => amt(x.post + x.pay), r: 1, sum: 1, v: x => x.post + x.pay }], rows) };
  },
});

// ─── জিরো ট্রানজেকশন ───
ReportPage({
  id: 'rptZeroTxn', title: 'জিরো ট্রানজেকশন রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, { k: 'kind', l: 'Account Type', t: 'select', opts: KIND_OPTS }, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const has = new Set((await R.txns(f, f.from, f.upto)).map(t => t.accNo));
    const rows = c.list.filter(s => s.st !== 'closed' && kindMatch(f, s) && !has.has(s.accNo) && (!s.od || s.od < f.from)).sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)} — কোনো লেনদেন হয়নি`, html: UI.table([{ h: 'সমিতি', f: s => s.samity }, { h: 'সদস্য', f: s => s.m + ' - ' + R.name(c.mem, s.m) }, { h: 'মোবাইল', f: s => R.mobile(c.mem, s.m) }, { h: 'হিসাব', f: s => s.accNo }, { h: 'ধরন', f: s => typeName(s.k, s.t) }, { h: 'খোলার তারিখ', f: s => fmtD(s.od) }, { h: 'স্থিতি', f: s => amt(s.b), r: 1, sum: 1, v: s => s.b }], rows) };
  },
});
