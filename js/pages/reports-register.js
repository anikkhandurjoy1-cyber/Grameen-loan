// ═══════════════════════════════════════════════════════════════
// ডিপোজিট রেজিস্টার, লোন রেজিস্টার, MIS রেজিস্টার — eKisti এর হুবহু কলাম
// ═══════════════════════════════════════════════════════════════
const ACC_STATUS_F = { k: 'ast', l: 'Account Status', t: 'select', opts: [['open', 'All Open Only'], ['closedUpto', 'Upto Date Closed Only'], ['openBetween', 'Open From and Upto Date'], ['closedBetween', 'Closed From and Upto Date'], ['matBetween', 'Maturity Date Between'], ['openUpto', 'Upto Date Open Only']] };
const regFilters = (typeF, extra = []) => [F.branch, typeF, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra];
async function accDocs(f, kind, types) {
  let rows = (await db.collection('accounts').where('branch', '==', f.branch).where('kind', '==', kind).get()).docs.map(d => d.data());
  if (types) rows = rows.filter(a => types.includes(a.type));
  const sm = await R.sams(f.branch);
  return rows.filter(a => a.status !== 'cancelled' && (!f.samity || a.samity === f.samity) && (!f.member || a.memberId === f.member) && (!f.employee || (sm[a.samity] || {}).foId === f.employee));
}
function statusFilter(ast, a, from, upto) {
  const cd = a.closeDate || '', od = a.openDate || '', md = a.maturityDate || a.expDate || '';
  const closedBy = d => a.status === 'closed' && cd && cd <= d;
  return { open: () => a.status !== 'closed', closedUpto: () => closedBy(upto), openBetween: () => od >= from && od <= upto, closedBetween: () => a.status === 'closed' && cd >= from && cd <= upto, matBetween: () => md >= from && md <= upto, openUpto: () => od <= upto && !closedBy(upto) }[ast || 'open']();
}
// সাধারণ কলাম ব্লক
const memCols = (mem, g = 'Member', three = true, labels = ['ID', 'Name', three === 'phone' ? 'Phone' : 'Mobile']) => [{ g, h: labels[0], f: x => x.memberId }, { g, h: labels[1], f: x => R.name(mem, x.memberId) }, ...(three ? [{ g, h: labels[2], f: x => R.mobile(mem, x.memberId) }] : [])];
const samCols = (sm, g = 'Samity', labels = ['Code', 'Name']) => [{ g, h: labels[0], f: x => esc((x.samity || '').slice(-4)) }, { g, h: labels[1], f: x => esc((sm[x.samity] || {}).name || '') }];
const typeShort = (kind, type) => kind === 'share' ? 'Share Accounts' : esc(typeName(kind, type));

// ─── FDR / DPS / Savings Register ───
function depRegister(id, title, dtypes, ptitle) {
  const types = Object.entries(REF.DEP).filter(([, d]) => dtypes.includes(d.dtype)).map(([c]) => c);
  ReportPage({
    id, title, landscape: true, fromDefault: 'month',
    filters: regFilters({ k: 'dtype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...types.map(c => [c, c + ' - ' + REF.DEP[c].name])] }, [ACC_STATUS_F]),
    run: async f => {
      const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
      const rows = (await accDocs(f, 'dep', f.dtype ? [f.dtype] : types)).filter(a => statusFilter(f.ast, a, f.from, f.upto)).map(a => ({ ...a, memberId: a.memberId })).sort((a, b) => (a.samity + a.accNo).localeCompare(b.samity + b.accNo));
      const A = 'Account Details', isFD = dtypes.includes('FD'), isRD = dtypes.includes('RD');
      const cols = isFD
        ? [SL, ...memCols(mem, 'সদস্য', true, ['আইডি', 'নাম', 'মোবাইল']), ...samCols(sm, 'সমিতি', ['কোড', 'নাম']), { g: 'একাউন্ট ডিটেল', h: 'একাউন্টের ধরন', f: a => typeShort('dep', a.type) }, { g: 'একাউন্ট ডিটেল', h: 'একাউন্ট আইডি', f: a => a.accNo }, { g: 'একাউন্ট ডিটেল', h: 'ওপেনিং তারিখ', f: a => fmtD(a.openDate) }, { g: 'একাউন্ট ডিটেল', h: 'মেচিউরিটি তারিখ', f: a => fmtD(a.maturityDate) }, { g: 'একাউন্ট ডিটেল', h: 'এফডিআর পরিমাণ', f: a => n2(a.balance), r: 1, sum: 1, v: a => a.balance }, { g: 'একাউন্ট ডিটেল', h: 'লাভের হার', f: a => n2(a.rate), r: 1 }, { g: 'একাউন্ট ডিটেল', h: 'প্রদেয় লাভ', f: a => n2(a.profitPayable), r: 1, sum: 1, v: a => a.profitPayable || 0 }, { g: 'একাউন্ট ডিটেল', h: 'লাভ পেমেন্ট', f: a => n2(a.profitPaid), r: 1, sum: 1, v: a => a.profitPaid || 0 }, { g: 'একাউন্ট ডিটেল', h: 'শেষ লাভ পেমেন্ট তারিখ', f: a => fmtD(a.lastProfitDate) }, { g: 'একাউন্ট ডিটেল', h: 'ক্লোজিং তারিখ', f: a => fmtD(a.closeDate) }, { g: 'একাউন্ট ডিটেল', h: 'ইউজার', f: a => esc(a.createdBy || '') }]
        : [SL, ...memCols(mem), ...samCols(sm), { g: A, h: 'Account Type', f: a => typeShort('dep', a.type) }, { g: A, h: 'Account ID', f: a => a.accNo }, { g: A, h: 'Opening Date', f: a => fmtD(a.openDate) }, ...(isRD ? [{ g: A, h: 'Maturity Date', f: a => fmtD(a.maturityDate) }, { g: A, h: 'Inst Amount', f: a => n2(a.instAmount), r: 1, sum: 1, v: a => a.instAmount }] : []), { g: A, h: 'Balance', f: a => n2(a.balance), r: 1, sum: 1, v: a => a.balance }, { g: A, h: 'Profit Rate', f: a => n2(a.rate), r: 1 }, { g: A, h: 'Profit Payable', f: a => n2(a.profitPayable), r: 1, sum: 1, v: a => a.profitPayable || 0 }, { g: A, h: 'Profit Payment', f: a => n2(a.profitPaid), r: 1, sum: 1, v: a => a.profitPaid || 0 }, { g: A, h: 'Last Profit Payment Date', f: a => fmtD(a.lastProfitDate) }, { g: A, h: 'Closing Date', f: a => fmtD(a.closeDate) }, { g: A, h: 'User', f: a => esc(a.createdBy || '') }];
      return { title: ptitle, html: UI.table(cols, rows) };
    },
  });
}
depRegister('rptFdrReg', 'এফ ডি আর রেজিস্টার রিপোর্ট', ['FD'], 'FDR Register Report');
depRegister('rptDpsReg', 'ডি পি এস রেজিস্টার রিপোর্ট', ['RD'], 'DPS Register Report');
depRegister('rptSbReg', 'সেভিংস রেজিস্টার রিপোর্ট', ['SB'], 'Savings Register Report');

// লেনদেনের আগে/পরে ব্যালেন্স (as-of snapshot থেকে পিছনে হেঁটে)
async function withBalances(f, ts) {
  const snaps = await Hist.snapsAt(f.branch, f.upto, f.samity); const bal = {}; snaps.forEach(s => bal[s.accNo] = num(s.b));
  const sorted = ts.slice().sort((a, b) => (b.date + b.vno).localeCompare(a.date + a.vno));
  sorted.forEach(t => { const close = bal[t.accNo] || 0; t._close = close; t._open = r2(close - num(t.delta)); bal[t.accNo] = t._open; });
  return ts;
}
const baseF = [F.branch, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }];

// ─── Deposit Receive / Payment Report ───
ReportPage({
  id: 'rptDepRcvReg', title: 'ডিপোজিট কালেকশন রেজিস্টার', landscape: true, fromDefault: 'month', filters: baseF,
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const ts = await withBalances(f, (await R.txns(f, f.from, f.upto)).filter(t => (t.kind === 'dep' || t.kind === 'share') && t.dc === 'C' && t.tt !== 'PROFIT_POST'));
    ts.sort((a, b) => (a.date + a.samity + a.memberId).localeCompare(b.date + b.samity + b.memberId));
    const D = 'Receive Details', trf = t => R.isTrf(t);
    return { title: 'Deposit Receive Report', html: UI.table([SL, ...memCols(mem, 'Member', false), ...samCols(sm), { g: D, h: 'Date', f: t => fmtD(t.date) }, { g: D, h: 'Opening', f: t => n2(t._open), r: 1, sum: 1, v: t => t._open }, { g: D, h: 'Transfer', f: t => trf(t) ? n2(t.amount) : n2(0), r: 1, sum: 1, v: t => trf(t) ? t.amount : 0 }, { g: D, h: 'Total Receive', f: t => n2(t.amount), r: 1, sum: 1, v: t => t.amount }, { g: D, h: 'Closing', f: t => n2(t._close), r: 1, sum: 1, v: t => t._close }, { g: D, h: 'User', f: t => esc(t.byName || '') }], ts) };
  },
});
ReportPage({
  id: 'rptDepPayReg', title: 'সঞ্চয় ফেরত রেজিস্টার', landscape: true, fromDefault: 'month', filters: baseF,
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const ts = await withBalances(f, (await R.txns(f, f.from, f.upto)).filter(t => (t.kind === 'dep' || t.kind === 'share') && t.dc === 'D'));
    ts.sort((a, b) => (a.date + a.samity + a.memberId).localeCompare(b.date + b.samity + b.memberId));
    const D = 'Payment Details', full = t => t.tt === 'DEP_CLOSE', trf = t => R.isTrf(t);
    return { title: 'Deposit Payment Report', html: UI.table([SL, ...memCols(mem, 'Member', false), ...samCols(sm), { g: D, h: 'Date', f: t => fmtD(t.date) }, { g: D, h: 'Opening', f: t => n2(t._open), r: 1, sum: 1, v: t => t._open }, { g: D, h: 'Full Refund', f: t => full(t) ? n2(t.amount) : n2(0), r: 1, sum: 1, v: t => full(t) ? t.amount : 0 }, { g: D, h: 'Partial Refund', f: t => !full(t) && !trf(t) ? n2(t.amount) : n2(0), r: 1, sum: 1, v: t => !full(t) && !trf(t) ? t.amount : 0 }, { g: D, h: 'Transfer', f: t => trf(t) ? n2(t.amount) : n2(0), r: 1, sum: 1, v: t => trf(t) ? t.amount : 0 }, { g: D, h: 'Total Payment', f: t => n2(t.amount), r: 1, sum: 1, v: t => t.amount }, { g: D, h: 'Closing', f: t => n2(t._close), r: 1, sum: 1, v: t => t._close }, { g: D, h: 'User', f: t => esc(t.byName || '') }], ts) };
  },
});
// ─── Deposit Profit Payment Register ───
ReportPage({
  id: 'rptProfitPayReg', title: 'লভ্যাংশ প্রদান রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(DEP_TYPE_F),
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'dep' && ['PROFIT_POST', 'PROFIT_PAY'].includes(t.tt) && (!f.dtype || t.type === f.dtype)).sort((a, b) => (a.date + a.accNo).localeCompare(b.date + b.accNo));
    const A = 'Account Details';
    return { title: 'Deposit Profit Payment Register', html: UI.table([SL, ...memCols(mem, 'Member', 'phone', ['ID', 'Name', 'Phone']), ...samCols(sm), { g: A, h: 'Account ID', f: t => t.accNo }, { g: A, h: 'Account Type', f: t => typeShort('dep', t.type) }, { g: A, h: 'Payment Date', f: t => fmtD(t.date) }, { g: A, h: 'Date Details', f: t => esc(t.narration || (t.tt === 'PROFIT_POST' ? 'Profit Posting' : 'Profit Payment')) }, { g: A, h: 'Total Payment', f: t => n2(t.amount), r: 1, sum: 1, v: t => t.amount }, { g: A, h: 'Payment By', f: t => esc(t.byName || '') }], ts) };
  },
});
// ─── DPS Target VS Collection ───
ReportPage({
  id: 'rptDpsDueVsColl', title: 'ডিপিএস টার্গেট বনাম সংগ্রহ', landscape: true, fromDefault: 'month',
  filters: regFilters({ k: 'dtype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...Object.entries(REF.DEP).filter(([, d]) => d.dtype === 'RD').map(([c, d]) => [c, c + ' - ' + d.name])] }),
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const rd = Object.entries(REF.DEP).filter(([, d]) => d.dtype === 'RD').map(([c]) => c);
    const accs = (await accDocs(f, 'dep', f.dtype ? [f.dtype] : rd)).filter(a => a.status !== 'closed' || a.closeDate >= f.from);
    const got = {}; (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'dep' && t.dc === 'C' && t.tt !== 'PROFIT_POST').forEach(t => got[t.accNo] = (got[t.accNo] || 0) + num(t.amount));
    const mb = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
    const rows = accs.map(a => { const n = num(a.months) || (REF.DEP[a.type] || {}).n || 0; const due = Math.max(0, Math.min(n, mb(a.openDate, f.upto) + 1) - Math.max(0, mb(a.openDate, f.from))); const target = r2(due * num(a.instAmount)); const g = got[a.accNo] || 0; return { ...a, target, got: g, od: Math.max(0, r2(target - g)) }; }).sort((x, y) => (x.samity + x.accNo).localeCompare(y.samity + y.accNo));
    const A = 'Account Details';
    return { title: 'DPS Target VS Collection', html: UI.table([SL, ...memCols(mem), ...samCols(sm), { g: A, h: 'Account Type', f: a => typeShort('dep', a.type) }, { g: A, h: 'Account ID', f: a => a.accNo }, { g: A, h: 'Inst Amount', f: a => n2(a.instAmount), r: 1 }, { g: A, h: 'Target', f: a => n2(a.target), r: 1, sum: 1, v: a => a.target }, { g: A, h: 'Collection', f: a => n2(a.got), r: 1, sum: 1, v: a => a.got }, { g: A, h: 'Overdue', f: a => n2(a.od), r: 1, sum: 1, v: a => a.od }], rows) };
  },
});

// ─── Loan Installment Receive Report ───
ReportPage({
  id: 'rptLoanCollReg', title: 'লোন কালেকশন রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F), buttons: [['🖨️ Month Wise Collection', 'month']],
  run: async (f, mode) => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const ts = await withBalances(f, (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan' && t.dc === 'C' && t.tt !== 'EMI_WAIVE' && (!f.ltype || t.type === f.ltype)));
    ts.forEach(t => { t._open = Math.abs(t._open); t._close = Math.abs(t._close); });
    if (mode === 'month') { const g = groupBy(ts, t => t.date.slice(0, 7)); return { title: 'Loan Installment Receive Report (Month Wise)', html: UI.table([SL, { h: 'Month', f: r => MONTHS[Number(r.k.slice(5, 7)) - 1] + ' ' + r.k.slice(0, 4) }, { h: 'Count', f: r => r.n, r: 1, sum: 1, int: 1, v: r => r.n }, { h: 'মোট আদায়', f: r => n2(r.a), r: 1, sum: 1, v: r => r.a }, { h: 'মূলধন', f: r => n2(r.p), r: 1, sum: 1, v: r => r.p }, { h: 'লাভ', f: r => n2(r.pr), r: 1, sum: 1, v: r => r.pr }, { h: 'চার্জ', f: r => n2(r.c), r: 1, sum: 1, v: r => r.c }], Object.keys(g).sort().map(k => ({ k, n: g[k].length, a: sum(g[k], t => t.amount), p: sum(g[k], t => t.principal), pr: sum(g[k], t => t.profit), c: sum(g[k], t => t.penalty) }))) }; }
    ts.sort((a, b) => (a.date + a.samity + a.memberId).localeCompare(b.date + b.samity + b.memberId));
    const D = 'আদায়ের ডিটেল';
    return { title: 'Loan Installment Receive Report', html: UI.table([SL, ...memCols(mem, 'সদস্য', false, ['আইডি', 'নাম']), ...samCols(sm, 'সমিতি', ['কোড', 'নাম']), { g: D, h: 'তারিখ', f: t => fmtD(t.date) }, { g: D, h: 'ওপেনিং', f: t => n2(t._open), r: 1 }, { g: D, h: 'মোট আদায়', f: t => n2(t.amount), r: 1, sum: 1, v: t => t.amount }, { g: D, h: 'মূলধন', f: t => n2(t.principal), r: 1, sum: 1, v: t => t.principal }, { g: D, h: 'লাভ', f: t => n2(t.profit), r: 1, sum: 1, v: t => t.profit }, { g: D, h: 'চার্জ', f: t => n2(t.penalty), r: 1, sum: 1, v: t => t.penalty || 0 }, { g: D, h: 'ক্লোজিং', f: t => n2(t._close), r: 1 }, { g: D, h: 'ইউজার', f: t => esc(t.byName || '') }], ts) };
  },
});
// ─── Loan Waiver Report ───
ReportPage({
  id: 'rptWaiver', title: 'ঋণ মওকুফ রিপোর্ট', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F),
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan' && (t.tt === 'EMI_WAIVE' || t.tt === 'LOAN_WAIVER') && (!f.ltype || t.type === f.ltype)).sort((a, b) => a.date.localeCompare(b.date));
    const D = 'Details';
    return { title: 'Loan Waiver Report', html: UI.table([SL, ...memCols(mem, 'Member', 'phone', ['ID', 'Name', 'Phone']), ...samCols(sm), { g: D, h: 'Date', f: t => fmtD(t.date) }, { g: D, h: 'Principal Waive', f: t => n2(t.principal), r: 1, sum: 1, v: t => t.principal }, { g: D, h: 'Profit Waive', f: t => n2(t.profit), r: 1, sum: 1, v: t => t.profit }, { g: D, h: 'Charge Waive', f: t => n2(t.penalty), r: 1, sum: 1, v: t => t.penalty || 0 }, { g: D, h: 'Total Waive', f: t => n2(num(t.amount) + num(t.penalty)), r: 1, sum: 1, v: t => num(t.amount) + num(t.penalty) }, { g: D, h: 'Comment', f: t => esc(t.narration || '') }, { g: D, h: 'User', f: t => esc(t.byName || '') }], ts) };
  },
});

// ─── Loan Disbursement Register ───
ReportPage({
  id: 'rptDisbReg', title: 'বিতরণ রেজিস্টার', landscape: true, fromDefault: 'month',
  filters: [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { k: 'freq', l: 'Installment Frequency', t: 'select', opts: [['', 'Select'], ['D', 'D-Daily'], ['W', 'W-Weekly'], ['M', 'M-Monthly'], ['Q', 'Q-Quarterly'], ['H', 'H-Half Yearly'], ['Y', 'Y-Yearly']] }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'dom', l: 'Disbursement Day of Month', t: 'number' }, { k: 'otype', l: 'EMI Opening Type', t: 'select', opts: [['', 'All'], ['new', 'New Opening'], ['res', 'Reschedule']] }],
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const rows = (await accDocs(f, 'loan')).filter(a => a.openDate >= f.from && a.openDate <= f.upto && (!f.ltype || a.type === f.ltype) && (!f.freq || a.freq === f.freq) && (!num(f.dom) || Number(a.openDate.slice(8)) === num(f.dom)) && (!f.otype || (f.otype === 'res' ? !!a.rescheduled : !a.rescheduled))).sort((a, b) => (a.openDate + a.accNo).localeCompare(b.openDate + b.accNo));
    const cyc = {}; rows.forEach(a => cyc[a.accNo] = 0);
    const all = await accDocs({ ...f, samity: '', employee: '' }, 'loan'); const cnt = {}; all.sort((a, b) => a.openDate.localeCompare(b.openDate)).forEach(a => { cnt[a.memberId] = (cnt[a.memberId] || 0) + 1; cyc[a.accNo] = cnt[a.memberId]; });
    const T = 'তারিখ', L = 'ঋণের বিস্তারিত';
    return { title: 'Loan Disbursement Register', html: UI.table([SL, { g: 'সদস্য', h: 'আইডি', f: a => a.memberId }, { g: 'সদস্য', h: 'নাম', f: a => R.name(mem, a.memberId) }, { g: 'সদস্য', h: 'পিতা', f: a => R.father(mem, a.memberId) }, { g: 'সদস্য', h: 'মোবাইল', f: a => R.mobile(mem, a.memberId) }, ...samCols(sm, 'সমিতি', ['কোড', 'নাম']),
      { g: T, h: 'বিতরণ', f: a => fmtD(a.openDate) }, { g: T, h: 'রিপে', f: a => fmtD(a.firstDate) }, { g: T, h: 'মেয়াদ উওীর্ণ', f: a => fmtD(a.expDate) },
      { g: L, h: 'ঋণের আইডি', f: a => a.accNo }, { g: L, h: 'বিতরণের পরিমাণ', f: a => n2(a.principal), r: 1, sum: 1, v: a => a.principal }, { g: L, h: 'মুনাফার হার', f: a => n2(a.rate), r: 1 }, { g: L, h: 'মোট পরিশোধ', f: a => n2(a.totalRepay), r: 1, sum: 1, v: a => a.totalRepay }, { g: L, h: 'কিস্তির পরিমাণ', f: a => n2(a.instAmount), r: 1, sum: 1, v: a => a.instAmount },
      { g: L, h: 'FormFee', f: a => n2((a.fees || {}).form), r: 1, sum: 1, v: a => num((a.fees || {}).form) }, { g: L, h: 'InsFee', f: a => n2((a.fees || {}).risk), r: 1, sum: 1, v: a => num((a.fees || {}).risk) }, { g: L, h: 'DocFee', f: a => n2((a.fees || {}).doc), r: 1, sum: 1, v: a => num((a.fees || {}).doc) }, { g: L, h: 'সিস্টেম', f: a => FREQ_EN[a.freq] || a.freq }, { g: L, h: 'কিস্তি', f: a => a.n, r: 1 }, { g: L, h: 'ঋণ নং', f: a => cyc[a.accNo] || 1, r: 1 }, { g: L, h: 'ব্যবহারকারী', f: a => esc(a.createdBy || '') }], rows) };
  },
});
// ─── Loan Disbursement & Collection Register ───
ReportPage({
  id: 'rptDisbCollReg', title: 'বিতরণ এবং কালেকশন রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F, [ACC_STATUS_F]),
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const accs = (await accDocs(f, 'loan')).filter(a => (!f.ltype || a.type === f.ltype) && statusFilter(f.ast, a, f.from, f.upto));
    const got = {}; (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan' && t.dc === 'C').forEach(t => { const g = got[t.accNo] = got[t.accNo] || { p: 0, pr: 0, w: 0, pen: 0 }; if (t.tt === 'EMI_WAIVE') g.w += num(t.amount); else { g.p += num(t.principal); g.pr += num(t.profit); } g.pen += num(t.penalty); });
    const rows = accs.map(a => ({ ...a, g: got[a.accNo] || { p: 0, pr: 0, w: 0, pen: 0 } })).sort((x, y) => (x.samity + x.accNo).localeCompare(y.samity + y.accNo));
    const D = 'Disbursement Details', C = 'Collection Details';
    return { title: 'Loan Disbursement & Collection Register', html: UI.table([SL, ...memCols(mem, 'Member', false), ...samCols(sm), { g: D, h: 'Date', f: a => fmtD(a.openDate) }, { g: D, h: 'Principal', f: a => n2(a.principal), r: 1, sum: 1, v: a => a.principal }, { g: D, h: 'Profit', f: a => n2(a.profit), r: 1, sum: 1, v: a => a.profit }, { g: D, h: 'Total', f: a => n2(a.totalRepay), r: 1, sum: 1, v: a => a.totalRepay }, { g: D, h: 'Rate', f: a => n2(a.rate), r: 1 }, { g: D, h: 'Loan No', f: a => a.accNo },
      { g: C, h: 'Principal', f: a => n2(a.g.p), r: 1, sum: 1, v: a => a.g.p }, { g: C, h: 'Profit', f: a => n2(a.g.pr), r: 1, sum: 1, v: a => a.g.pr }, { g: C, h: 'Waiver', f: a => n2(a.g.w), r: 1, sum: 1, v: a => a.g.w }, { g: C, h: 'Penalty', f: a => n2(a.g.pen), r: 1, sum: 1, v: a => a.g.pen }, { g: C, h: 'Total', f: a => n2(a.g.p + a.g.pr + a.g.w + a.g.pen), r: 1, sum: 1, v: a => a.g.p + a.g.pr + a.g.w + a.g.pen }], rows) };
  },
});
// ─── Fully Paid Loan Register ───
ReportPage({
  id: 'rptFullyPaid', title: 'সম্পূর্ণ পরিশোধিত ঋণ রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F),
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch);
    const accs = (await accDocs(f, 'loan')).filter(a => a.status === 'closed' && a.closeDate >= f.from && a.closeDate <= f.upto && (!f.ltype || a.type === f.ltype)).sort((a, b) => (a.closeDate + a.accNo).localeCompare(b.closeDate + b.accNo));
    const D = 'Disbursement Details', P = 'Payment Details';
    return { title: 'Fully Paid Loan Register', html: UI.table([SL, ...memCols(mem, 'Member', false), ...samCols(sm), { g: D, h: 'Date', f: a => fmtD(a.openDate) }, { g: D, h: 'Principal', f: a => n2(a.principal), r: 1, sum: 1, v: a => a.principal }, { g: D, h: 'Profit', f: a => n2(a.profit), r: 1, sum: 1, v: a => a.profit }, { g: D, h: 'Total', f: a => n2(a.totalRepay), r: 1, sum: 1, v: a => a.totalRepay }, { g: D, h: 'Rate', f: a => n2(a.rate), r: 1 }, { g: D, h: 'Loan No', f: a => a.accNo },
      { g: P, h: 'Date', f: a => fmtD(a.closeDate) }, { g: P, h: 'Principal', f: a => n2(num(a.paidP) - num(a.wvP)), r: 1, sum: 1, v: a => num(a.paidP) - num(a.wvP) }, { g: P, h: 'Profit', f: a => n2(num(a.paidPr) - num(a.wvPr)), r: 1, sum: 1, v: a => num(a.paidPr) - num(a.wvPr) }, { g: P, h: 'Waiver', f: a => n2(num(a.wvP) + num(a.wvPr)), r: 1, sum: 1, v: a => num(a.wvP) + num(a.wvPr) }, { g: P, h: 'Penalty', f: a => n2(a.paidPen), r: 1, sum: 1, v: a => num(a.paidPen) }, { g: P, h: 'Total', f: a => n2(num(a.paidTotal) - num(a.wvP) - num(a.wvPr) + num(a.paidPen)), r: 1, sum: 1, v: a => num(a.paidTotal) - num(a.wvP) - num(a.wvPr) + num(a.paidPen) }], accs) };
  },
});

// ─── Loan Recovery Details Report ───
ReportPage({
  id: 'rptRecovery', title: 'ঋণ আদায়ের বিস্তারিত', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'rt', l: 'Recovery Type', t: 'select', opts: [['all', 'All'], ['rcv', 'Total Receive'], ['tod', 'Total Overdue'], ['reg', 'Regular Recovery'], ['cur', 'Current Due Recovery'], ['exp', 'Expire Due Recovery'], ['adv', 'Advance Recovery'], ['new', 'Newly Due']] }],
  run: async f => {
    const rec = await R.recovery(f, f.from, f.upto);
    const pick = { all: () => true, rcv: x => x.got.a > 0, tod: x => x.st.overdue > 0, reg: x => x.reg > 0, cur: x => x.due > 0, exp: x => x.exp > 0, adv: x => x.adv > 0, new: x => x.st.asonDue > x.odOpen }[f.rt || 'all'];
    const rows = rec.rows.filter(pick).sort((a, b) => (a.s.samity + a.s.accNo).localeCompare(b.s.samity + b.s.accNo));
    return { title: 'Loan Recovery Details Report', html: UI.table([SL, { g: 'Samity Details', h: 'কোড', f: x => esc(x.s.samity.slice(-4)) }, { g: 'Samity Details', h: 'Name', f: x => esc((rec.sm[x.s.samity] || {}).name || '') }, { g: 'Member Details', h: 'ID', f: x => x.s.m }, { g: 'Member Details', h: 'Name', f: x => R.name(rec.mem, x.s.m) }, { h: 'Phone', f: x => R.mobile(rec.mem, x.s.m) }, { h: 'AC', f: x => x.s.accNo }, { h: 'কিস্তির পরিমান', f: x => n2(x.s.ia), r: 1 }, { h: 'কিস্তির ধরন', f: x => FREQ_EN[x.s.fq] || x.s.fq }, { h: 'Inst No', f: x => x.st.sch.length, r: 1 }, { h: 'বিতরন তারিখ', f: x => fmtD(x.s.od) }, { h: 'Loan Amount', f: x => n2(x.s.tr), r: 1 },
      { h: 'মোট আদায়যোগ্য', f: x => n2(x.receivable + x.odOpen), r: 1, sum: 1, v: x => x.receivable + x.odOpen }, { h: 'সর্বমোট আদায়', f: x => n2(x.got.a), r: 1, sum: 1, v: x => x.got.a }, { h: 'আজকের বকেয়া', f: x => n2(x.st.overdue), r: 1, sum: 1, v: x => x.st.overdue }, { h: 'আজকের চলতি আদায়', f: x => n2(x.reg), r: 1, sum: 1, v: x => x.reg }, { h: 'বকেয়া আদায়', f: x => n2(x.due), r: 1, sum: 1, v: x => x.due }, { h: 'মেয়াদ উত্তীর্ন আদায়', f: x => n2(x.exp), r: 1, sum: 1, v: x => x.exp }, { h: 'অগ্রিম আদায়', f: x => n2(x.adv), r: 1, sum: 1, v: x => x.adv }], rows) };
  },
});

// ─── LLP (Loan Loss Provisioning) ও Write-off ───
const LLP_CLASS = [['Good Loan', 0, 1], ['Watchful', 1, 5], ['Sub-Standard', 31, 25], ['Doubtful', 181, 75], ['Bad Loan', 366, 100]];
function llpRows(c, f) {
  return c.list.filter(s => s.k === 'loan' && s.st !== 'closed' && (!f.ltype || s.t === f.ltype) && (!f.freq || s.fq === f.freq)).map(s => {
    const { st, l } = R.loanSt(s, f.date);
    let paid = r2(num(l.paidTotal) - num(l.base)), oldest = null;
    for (const x of st.sch) { if (paid >= x.amount - 0.01) { paid -= x.amount; continue; } if (x.date < f.date) oldest = x.date; break; }
    const days = oldest ? daysBetween(oldest, f.date) : 0;
    const cls = [...LLP_CLASS].reverse().find(k => days >= k[1]) || LLP_CLASS[0];
    return { s, st, days, cls: cls[0], pct: cls[2], prov: r2(st.principalOut * cls[2] / 100) };
  });
}
const llpFilters = [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { k: 'freq', l: 'Installment Frequency', t: 'select', opts: [['', 'Select'], ['D', 'D-Daily'], ['W', 'W-Weekly'], ['M', 'M-Monthly'], ['Q', 'Q-Quarterly'], ['H', 'H-Half Yearly'], ['Y', 'Y-Yearly']] }, { ...F.date, l: 'Report Date' }, { k: 'rn', l: 'Report Name', t: 'select', opts: [['member', 'Member Wise LLP'], ['employee', 'Field Officer Wise LLP'], ['branch', 'Branch Wise LLP']] }];
const llpClassCols = [...LLP_CLASS.map(([n]) => ({ g: 'Loan Classification', h: n, f: x => n2(x.cls === n ? x.st.outstanding : (x.byCls || {})[n] || 0), r: 1, sum: 1, v: x => x.cls === n ? x.st.outstanding : (x.byCls || {})[n] || 0 })), { g: 'Loan Classification', h: 'LLP', f: x => n2(x.prov), r: 1, sum: 1, v: x => x.prov }];
function llpPage(id, title, onlyBad, ptitle) {
  ReportPage({
    id, title, landscape: true, filters: llpFilters,
    run: async f => {
      const c = await R.snaps(f, f.date); const en = await R.empName();
      let rows = llpRows(c, f).filter(x => !onlyBad || x.cls === 'Bad Loan' || x.s.st === 'writeoff').sort((a, b) => (a.s.samity + a.s.accNo).localeCompare(b.s.samity + b.s.accNo));
      const LD = 'Loan Details';
      if (f.rn && f.rn !== 'member') {
        const g = groupBy(rows, x => f.rn === 'branch' ? f.branch : c.fo(x.s.samity) || '—');
        rows = Object.keys(g).sort().map(k => { const l = g[k]; const byCls = {}; LLP_CLASS.forEach(([n]) => byCls[n] = sum(l.filter(x => x.cls === n), x => x.st.outstanding)); return { k, cnt: l.length, pr: sum(l, x => x.s.pr), pOut: sum(l, x => x.st.principalOut), prOut: sum(l, x => x.st.profitOut), out: sum(l, x => x.st.outstanding), byCls, prov: sum(l, x => x.prov), cls: '', st: { outstanding: 0 } }; });
        return { title: ptitle.replace('Member', f.rn === 'branch' ? 'Branch' : 'Field Officer'), html: UI.table([SL, { h: f.rn === 'branch' ? 'Branch' : 'Field Officer', f: r => f.rn === 'branch' ? r.k : (r.k === '—' ? '—' : officer(en, r.k)) }, { g: LD, h: 'Loan Count', f: r => r.cnt, r: 1, sum: 1, int: 1, v: r => r.cnt }, { g: LD, h: 'Disb Amount', f: r => n2(r.pr), r: 1, sum: 1, v: r => r.pr }, { g: LD, h: 'Principal Outstanding', f: r => n2(r.pOut), r: 1, sum: 1, v: r => r.pOut }, { g: LD, h: 'Profit Outstanding', f: r => n2(r.prOut), r: 1, sum: 1, v: r => r.prOut }, { g: LD, h: 'Total Outstanding', f: r => n2(r.out), r: 1, sum: 1, v: r => r.out }, ...llpClassCols], rows) };
      }
      return { title: ptitle, html: UI.table([SL, { g: 'Member', h: 'ID', f: x => x.s.m }, { g: 'Member', h: 'Name', f: x => R.name(c.mem, x.s.m) }, { g: 'Samity', h: 'Code', f: x => esc(x.s.samity.slice(-4)) }, { g: 'Samity', h: 'Name', f: x => esc((c.sm[x.s.samity] || {}).name || '') },
        { g: LD, h: 'Loan ID', f: x => x.s.accNo }, { g: LD, h: 'Disb Amount', f: x => n2(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { g: LD, h: 'Disburse Date', f: x => fmtD(x.s.od) }, { g: LD, h: 'Expire Date', f: x => fmtD(x.s.ed) }, { g: LD, h: 'Principal Outstanding', f: x => n2(x.st.principalOut), r: 1, sum: 1, v: x => x.st.principalOut }, { g: LD, h: 'Profit Outstanding', f: x => n2(x.st.profitOut), r: 1, sum: 1, v: x => x.st.profitOut }, { g: LD, h: 'Total Outstanding', f: x => n2(x.st.outstanding), r: 1, sum: 1, v: x => x.st.outstanding }, ...llpClassCols], rows) };
    },
  });
}
llpPage('rptLLP', 'ঋণ ক্ষয় সঞ্চিতি (LLP)', false, 'Member Wise Loan Loss Provisioning');
llpPage('rptWriteOff', 'ঋণ অবলোপন তালিকা', true, 'Written Off Register');

// ═══════════ MIS রেজিস্টার ═══════════
async function memberDocs(f) {
  const q = f.samity ? db.collection('members').where('samity', '==', f.samity) : db.collection('members').where('branch', '==', f.branch);
  const sm = await R.sams(f.branch);
  return (await q.get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(m => (!f.member || m.memberId === f.member) && (!f.employee || (sm[m.samity] || {}).foId === f.employee));
}
const ageOf = (dob, d) => dob ? Math.floor(daysBetween(dob, d) / 365.25) : '';
ReportPage({
  id: 'rptAdmission', title: 'ভর্তি রেজিস্টার', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'ms', l: 'Member Status', t: 'select', opts: [['', 'Choose'], ['active', 'Active'], ['inactive', 'Inactive'], ['closed', 'Closed']] }, { k: 'village', l: 'Location (গ্রাম/ঠিকানা)', t: 'text' }],
  run: async f => {
    const rows = (await memberDocs(f)).filter(m => m.joinDate >= f.from && m.joinDate <= f.upto && (!f.ms || (m.status || 'active') === f.ms) && (!f.village || String(m.presentAddr || m.permAddr || '').includes(f.village))).sort((a, b) => (a.joinDate + a.memberId).localeCompare(b.joinDate + b.memberId));
    const G = 'Member Information';
    return { title: 'Admission Register Report', html: UI.table([SL, ...[['ID', m => m.memberId], ['Name', m => esc(m.name)], ['Reference', m => esc(m.reference || '')], ['Father Name', m => esc(m.father || '')], ['Mother Name', m => esc(m.mother || '')], ['Gender', m => esc(m.sex || '')], ['National ID', m => esc(m.nid || '')], ['Location', m => esc(m.village || '')], ['Present Address', m => esc(m.presentAddr || '')], ['Phone', m => esc(m.mobile || '')], ['Admission Date', m => fmtD(m.joinDate)], ['Education', m => esc(m.education || '')], ['Age', m => ageOf(m.dob, f.upto)], ['Status', m => (m.status || 'active').replace(/^./, c => c.toUpperCase())], ['Monthly Income', m => n2(m.income)]].map(([h, fn]) => ({ g: G, h, f: fn, r: h === 'Monthly Income' }))], rows) };
  },
});
ReportPage({
  id: 'rptSomobayMember', title: 'সমবায় সদস্য রেজিস্টার', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const ms = (await memberDocs(f)).filter(m => (m.joinDate || '') <= f.date && m.status !== 'closed').sort((a, b) => a.memberId.localeCompare(b.memberId));
    const c = await R.snaps(f, f.date); const bal = {}; c.list.forEach(s => { const b = bal[s.m] = bal[s.m] || { sh: 0, sv: 0, ln: 0 }; if (s.st === 'closed') return; if (s.k === 'share') b.sh += num(s.b); else if (s.k === 'dep') b.sv += num(s.b); else if (s.k === 'loan') b.ln += num(s.b); });
    const B = m => bal[m.memberId] || { sh: 0, sv: 0, ln: 0 };
    return { title: `সদস্য তালিকা, তারিখ : ${fmtD(f.date)}`, info: [['রেজি: নং', esc(App.org.reg)], ['তারিখ', fmtD(f.date)], ['ঠিকানা', esc(App.org.address)]],
      html: UI.table([SL, { h: 'সদস্য নং', f: m => m.memberId }, { h: 'নাম', f: m => esc(m.name) }, { h: 'NID নং:', f: m => esc(m.nid || '') }, { h: 'NID Length', f: m => (m.nid || '').length || '' }, { h: 'Birth C. No.', f: m => esc(m.birthId || '') }, { h: 'জন্ম তারিখ', f: m => fmtD(m.dob) }, { h: 'নাম English', f: m => esc(m.nameEn || '') }, { h: 'পিতার নাম', f: m => esc(m.father || '') }, { h: 'মাতার নাম', f: m => esc(m.mother || '') }, { h: 'মোবাইল নং', f: m => esc(m.mobile || '') }, { h: 'লিঙ্গ', f: m => esc(m.sex || '') }, { h: 'শিক্ষাগত যোগ্যতা', f: m => esc(m.education || '') }, { h: 'পেশা', f: m => esc(m.profession || '') }, { h: 'বৈবাহিক অবস্থা', f: m => esc(m.marital || '') }, { h: 'স্বামী/স্ত্রী নাম', f: m => esc(m.spouse || '') }, { h: 'ধর্ম', f: m => esc(m.religion || '') }, { h: 'সদস্য ভর্তির তারিখ', f: m => fmtD(m.joinDate) },
        { h: 'শেয়ার', f: m => n2(B(m).sh), r: 1, sum: 1, v: m => B(m).sh }, { h: 'সঞ্চয়', f: m => n2(B(m).sv), r: 1, sum: 1, v: m => B(m).sv }, { h: 'ঋণ ব্যালান্স', f: m => n2(B(m).ln), r: 1, sum: 1, v: m => B(m).ln }], ms) };
  },
});

// ─── সমিতি পারফরম্যান্স (Samity Performance Report) ও পর্যায়ক্রমিক অগ্রগতি ───
async function perfRows(f, grp) {
  const bs = await R.branchesFor(f); const out = {};
  for (const b of bs) {
    const ff = { ...f, branch: b };
    const o = await R.snaps(ff, addDays(f.from, -1)); const c = await R.snaps(ff, f.upto);
    const rec = await R.recovery(ff, f.from, f.upto);
    const ts = (await R.txns(ff, f.from, f.upto)).filter(t => !R.isTrf(t));
    const key = (samity, m) => grp === 'branch' ? b : grp === 'center' ? samity : grp === 'employee' ? c.fo(samity) || '—' : m;
    const z = () => ({ mem: new Set(), dep: 0, ln: 0, lb: 0, ld: 0, en: 0, ea: 0 });
    const row = k => out[k] = out[k] || { k, b0: z(), b1: z(), inOut: 0, depNet: 0, dn: 0, da: 0, due: 0, rcv: 0, dueRec: 0, adv: 0, newMem: 0, outMem: 0 };
    const fill = (snap, side, date) => snap.list.forEach(s => { if (s.st === 'closed') return; const r = row(key(s.samity, s.m))[side]; r.mem.add(s.m); if (s.k === 'loan') { const { st } = R.loanSt(s, date); r.ln++; r.lb += f.sc === 'without' ? st.principalOut : st.outstanding; r.ld += st.overdue; if (st.expired) { r.en++; r.ea += st.outstanding; } } else r.dep += num(s.b); });
    fill(o, 'b0', addDays(f.from, -1)); fill(c, 'b1', f.upto);
    ts.forEach(t => { const r = row(key(t.samity, t.memberId)); const cl = R.cls(t); if (cl === 'disb') { r.dn++; r.da += num(t.amount); } if (cl === 'depRcv') r.depNet += num(t.amount); if (cl === 'depPay') r.depNet -= num(t.amount); });
    rec.rows.forEach(x => { const r = row(key(x.s.samity, x.s.m)); r.due += x.receivable; r.rcv += f.sc === 'without' ? x.got.p : x.got.a; r.dueRec += x.due + x.exp; r.adv += x.adv; });
  }
  Object.values(out).forEach(r => { r.newMem = [...r.b1.mem].filter(m => !r.b0.mem.has(m)).length; r.outMem = [...r.b0.mem].filter(m => !r.b1.mem.has(m)).length; });
  return { rows: Object.values(out).sort((a, b) => String(a.k).localeCompare(String(b.k))), lab: await R.glabel(grp, bs) };
}
const perfCols = (lab, first) => {
  const blk = (g, side) => [{ g, h: 'Member', f: r => r[side].mem.size, r: 1, sum: 1, int: 1, v: r => r[side].mem.size }, { g, h: 'Deposit Balance', f: r => n2(r[side].dep), r: 1, sum: 1, v: r => r[side].dep }, { g, h: 'Loan NO', f: r => r[side].ln, r: 1, sum: 1, int: 1, v: r => r[side].ln }, { g, h: 'Loan Balance', f: r => n2(r[side].lb), r: 1, sum: 1, v: r => r[side].lb }, { g, h: 'Loan Due', f: r => n2(r[side].ld), r: 1, sum: 1, v: r => r[side].ld }, { g, h: 'Exp NO', f: r => r[side].en, r: 1, sum: 1, int: 1, v: r => r[side].en }, { g, h: 'Exp Amount', f: r => n2(r[side].ea), r: 1, sum: 1, v: r => r[side].ea }];
  const D = 'During this period';
  return [SL, ...first, ...blk('At The Beginning', 'b0'), { g: D, h: 'IN (Out)', f: r => `${r.newMem} (${r.outMem})`, r: 1 }, { g: D, h: 'Deposit Balance', f: r => n2(r.depNet), r: 1, sum: 1, v: r => r.depNet }, { g: D, h: 'Disb NO', f: r => r.dn, r: 1, sum: 1, int: 1, v: r => r.dn }, { g: D, h: 'Disb Amount', f: r => n2(r.da), r: 1, sum: 1, v: r => r.da }, { g: D, h: 'Inst Due', f: r => n2(r.due), r: 1, sum: 1, v: r => r.due }, { g: D, h: 'Inst Receive', f: r => n2(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { g: D, h: 'Recove PCT', f: r => r.due ? (Math.min(r.rcv, r.due) / r.due * 100).toFixed(2) : '0.00', r: 1 }, { g: D, h: 'Due Recov', f: r => n2(r.dueRec), r: 1, sum: 1, v: r => r.dueRec }, { g: D, h: 'Advance Recov', f: r => n2(r.adv), r: 1, sum: 1, v: r => r.adv }, ...blk('End of Period', 'b1')];
};
ReportPage({
  id: 'rptSamityPerformance', title: 'সমিতি পারফরম্যান্স রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.btype, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => { const { rows } = await perfRows(f, 'center'); const sm = await R.sams(f.branch);
    return { title: 'Samity Performance Report', html: UI.table(perfCols(null, [{ g: 'Samity', h: 'Code', f: r => esc(String(r.k).slice(-4)) }, { g: 'Samity', h: 'Name', f: r => esc((sm[r.k] || {}).name || '') }]), rows) }; },
});
ReportPage({
  id: 'rptPeriodProgress', title: 'পর্যায়ক্রমিক অগ্রগতি রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, F.samity, F.employee, { ...R.GROUP, opts: [['center', 'Center'], ['branch', 'Branch'], ['employee', 'Employee'], ['member', 'Member']] }, { k: 'sc', l: 'Service Charge', t: 'select', opts: [['with', 'With Service Charge'], ['without', 'Without Service Charge']] }],
  run: async f => { const grp = f.grp || 'center'; const { rows, lab } = await perfRows(f, grp);
    return { title: 'Periodical Progress Report', html: UI.table(perfCols(lab, [{ h: { center: 'Samity', branch: 'Branch', employee: 'Field Officer', member: 'Member' }[grp], f: r => r.k === '—' ? '—' : lab(r.k) }]), rows) }; },
});
