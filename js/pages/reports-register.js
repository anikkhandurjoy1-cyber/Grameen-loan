// ═══════════════════════════════════════════════════════════════
// ডিপোজিট রেজিস্টার, লোন রেজিস্টার, MIS রেজিস্টার
// ═══════════════════════════════════════════════════════════════
const ACC_STATUS_F = { k: 'ast', l: 'Account Status', t: 'select', opts: [['open', 'All Open Only'], ['closedUpto', 'Upto Date Closed Only'], ['openBetween', 'Open From and Upto Date'], ['closedBetween', 'Closed From and Upto Date'], ['matBetween', 'Maturity Date Between'], ['openUpto', 'Upto Date Open Only']] };
const regFilters = (typeF, extra = []) => [F.branch, typeF, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra];
// শাখার একাউন্ট ডক (ধরন অনুযায়ী) — রেজিস্টারের জন্য পূর্ণ তথ্য
async function accDocs(f, kind, types) {
  let q = db.collection('accounts').where('branch', '==', f.branch).where('kind', '==', kind);
  let rows = (await q.get()).docs.map(d => d.data());
  if (types) rows = rows.filter(a => types.includes(a.type));
  const sm = await R.sams(f.branch);
  return rows.filter(a => a.status !== 'cancelled' && (!f.samity || a.samity === f.samity) && (!f.member || a.memberId === f.member) && (!f.employee || (sm[a.samity] || {}).foId === f.employee));
}
function statusFilter(ast, a, from, upto) {
  const cd = a.closeDate || '', od = a.openDate || '', md = a.maturityDate || a.expDate || '';
  const closedBy = d => a.status === 'closed' && cd && cd <= d;
  return {
    open: () => a.status !== 'closed', closedUpto: () => closedBy(upto), openBetween: () => od >= from && od <= upto,
    closedBetween: () => a.status === 'closed' && cd >= from && cd <= upto, matBetween: () => md >= from && md <= upto, openUpto: () => od <= upto && !closedBy(upto),
  }[ast || 'open']();
}
function depRegister(id, title, dtypes) {
  const types = Object.entries(REF.DEP).filter(([, d]) => dtypes.includes(d.dtype)).map(([c]) => c);
  ReportPage({
    id, title, landscape: true, fromDefault: 'month',
    filters: regFilters({ k: 'dtype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...types.map(c => [c, c + ' - ' + REF.DEP[c].name])] }, [ACC_STATUS_F]),
    run: async f => {
      const mem = await Data.memberIdx(f.branch);
      const rows = (await accDocs(f, 'dep', f.dtype ? [f.dtype] : types)).filter(a => statusFilter(f.ast, a, f.from, f.upto)).sort((a, b) => (a.samity + a.accNo).localeCompare(b.samity + b.accNo));
      const isRD = dtypes.includes('RD'), isFD = dtypes.includes('FD');
      return {
        sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([
          { h: 'SL', f: a => rows.indexOf(a) + 1 }, { h: 'সমিতি', f: a => a.samity }, { h: 'সদস্য', f: a => a.memberId + ' - ' + R.name(mem, a.memberId) }, { h: 'হিসাব', f: a => a.accNo }, { h: 'ধরন', f: a => typeName('dep', a.type) },
          { h: 'খোলার তারিখ', f: a => fmtD(a.openDate) }, isRD ? { h: 'কিস্তি', f: a => amt(a.instAmount), r: 1 } : null, isRD ? { h: 'মেয়াদ (মাস)', f: a => a.months || (REF.DEP[a.type] || {}).n || '', r: 1 } : null,
          { h: 'হার%', f: a => a.rate || '', r: 1 }, isFD || isRD ? { h: 'মেয়াদপূর্তি', f: a => fmtD(a.maturityDate) } : null,
          { h: 'মোট জমা', f: a => amt(a.totCr), r: 1, sum: 1, v: a => a.totCr }, { h: 'মোট উত্তোলন', f: a => amt(a.totDr), r: 1, sum: 1, v: a => a.totDr }, { h: 'স্থিতি', f: a => amt(a.balance), r: 1, sum: 1, v: a => a.balance },
          { h: 'অবস্থা', f: a => a.status === 'closed' ? 'Closed ' + fmtD(a.closeDate) : 'Active' },
        ].filter(Boolean), rows),
      };
    },
  });
}
depRegister('rptFdrReg', 'এফ ডি আর রেজিস্টার রিপোর্ট', ['FD']);
depRegister('rptDpsReg', 'ডি পি এস রেজিস্টার রিপোর্ট', ['RD']);
depRegister('rptSbReg', 'সেভিংস রেজিস্টার রিপোর্ট', ['SB']);

// লেনদেন-ভিত্তিক রেজিস্টার
function txnRegister(id, title, pick, filters, opts = {}) {
  ReportPage({
    id, title, landscape: true, fromDefault: 'month', filters,
    run: async (f, mode) => {
      const mem = await Data.memberIdx(f.branch);
      let ts = (await R.txns(f, f.from, f.upto)).filter(t => pick(t, f)).sort((a, b) => (a.date + a.samity + a.accNo).localeCompare(b.date + b.samity + b.accNo));
      if (mode === 'month') {
        const g = groupBy(ts, t => t.date.slice(0, 7));
        return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)} — মাসভিত্তিক`, html: UI.table([{ h: 'মাস', f: r => r.k }, { h: 'সংখ্যা', f: r => r.n, r: 1, sum: 1, v: r => r.n }, { h: 'আসল', f: r => amt(r.p), r: 1, sum: 1, v: r => r.p }, { h: 'মুনাফা', f: r => amt(r.pr), r: 1, sum: 1, v: r => r.pr }, { h: 'মোট', f: r => amt(r.a), r: 1, sum: 1, v: r => r.a }], Object.keys(g).sort().map(k => ({ k, n: g[k].length, p: sum(g[k], t => t.principal), pr: sum(g[k], t => t.profit), a: sum(g[k], t => t.amount) }))) };
      }
      return {
        sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([
          { h: 'তারিখ', f: t => fmtD(t.date) }, { h: 'সমিতি', f: t => t.samity || '' }, { h: 'সদস্য', f: t => (t.memberId || '') + ' - ' + R.name(mem, t.memberId) }, { h: 'হিসাব', f: t => t.accNo }, { h: 'ধরন', f: t => typeName(t.kind, t.type) },
          { h: 'বিবরণ', f: t => esc((TT_NAME[t.tt] || t.tt) + (t.narration ? ' — ' + t.narration : '')) }, { h: 'ডক নং', f: t => esc(t.docNo || '') },
          opts.loan ? { h: 'আসল', f: t => amt(t.principal), r: 1, sum: 1, v: t => t.principal } : null, opts.loan ? { h: 'মুনাফা', f: t => amt(t.profit), r: 1, sum: 1, v: t => t.profit } : null,
          { h: 'পরিমাণ', f: t => amt(t.amount), r: 1, sum: 1, v: t => t.amount }, { h: 'ভাউচার', f: t => t.vno }, { h: 'ইউজার', f: t => esc(t.byName || '') },
        ].filter(Boolean), ts),
      };
    },
    buttons: opts.buttons,
  });
}
const baseF = [F.branch, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }];
txnRegister('rptDepRcvReg', 'ডিপোজিট কালেকশন রেজিস্টার', t => (t.kind === 'dep' || t.kind === 'share') && t.dc === 'C' && t.tt !== 'PROFIT_POST', baseF);
txnRegister('rptDepPayReg', 'সঞ্চয় ফেরত রেজিস্টার', t => (t.kind === 'dep' || t.kind === 'share') && t.dc === 'D', baseF);
txnRegister('rptProfitPayReg', 'লভ্যাংশ প্রদান রেজিস্টার', (t, f) => t.kind === 'dep' && ['PROFIT_POST', 'PROFIT_PAY'].includes(t.tt) && (!f.dtype || t.type === f.dtype), regFilters(DEP_TYPE_F));
txnRegister('rptLoanCollReg', 'লোন কালেকশন রেজিস্টার', (t, f) => t.kind === 'loan' && t.dc === 'C' && t.tt !== 'EMI_WAIVE' && (!f.ltype || t.type === f.ltype), regFilters(LOAN_TYPE_F), { loan: 1, buttons: [['🖨️ Month Wise Collection', 'month']] });
txnRegister('rptWaiver', 'ঋণ মওকুফ রিপোর্ট', (t, f) => t.kind === 'loan' && (t.tt === 'EMI_WAIVE' || t.tt === 'LOAN_WAIVER') && (!f.ltype || t.type === f.ltype), regFilters(LOAN_TYPE_F), { loan: 1 });

// ─── ডিপিএস টার্গেট বনাম সংগ্রহ ───
ReportPage({
  id: 'rptDpsDueVsColl', title: 'ডিপিএস টার্গেট বনাম সংগ্রহ', landscape: true, fromDefault: 'month',
  filters: regFilters({ k: 'dtype', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...Object.entries(REF.DEP).filter(([, d]) => d.dtype === 'RD').map(([c, d]) => [c, c + ' - ' + d.name])] }),
  run: async f => {
    const mem = await Data.memberIdx(f.branch);
    const rd = Object.entries(REF.DEP).filter(([, d]) => d.dtype === 'RD').map(([c]) => c);
    const accs = (await accDocs(f, 'dep', f.dtype ? [f.dtype] : rd)).filter(a => a.status !== 'closed' || a.closeDate >= f.from);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'dep' && t.dc === 'C' && t.tt !== 'PROFIT_POST');
    const got = {}; ts.forEach(t => got[t.accNo] = (got[t.accNo] || 0) + num(t.amount));
    const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
    const rows = accs.map(a => {
      const n = num(a.months) || (REF.DEP[a.type] || {}).n || 0;
      const dueTill = Math.min(n, monthsBetween(a.openDate, f.upto) + 1);
      const target = r2(Math.max(0, dueTill) * num(a.instAmount));
      const periodDue = r2(Math.max(0, Math.min(n, monthsBetween(a.openDate, f.upto) + 1) - Math.max(0, monthsBetween(a.openDate, f.from))) * num(a.instAmount));
      return { a, target, periodDue, got: got[a.accNo] || 0, short: r2(Math.max(0, target - num(a.balance))) };
    }).sort((x, y) => (x.a.samity + x.a.accNo).localeCompare(y.a.samity + y.a.accNo));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: x => x.a.samity }, { h: 'সদস্য', f: x => x.a.memberId + ' - ' + R.name(mem, x.a.memberId) }, { h: 'হিসাব', f: x => x.a.accNo }, { h: 'খোলার তারিখ', f: x => fmtD(x.a.openDate) }, { h: 'কিস্তি', f: x => amt(x.a.instAmount), r: 1 }, { h: 'সময়ের টার্গেট', f: x => amt(x.periodDue), r: 1, sum: 1, v: x => x.periodDue }, { h: 'সংগ্রহ', f: x => amt(x.got), r: 1, sum: 1, v: x => x.got }, { h: 'মোট টার্গেট (আজ পর্যন্ত)', f: x => amt(x.target), r: 1, sum: 1, v: x => x.target }, { h: 'স্থিতি', f: x => amt(x.a.balance), r: 1, sum: 1, v: x => x.a.balance }, { h: 'ঘাটতি', f: x => amt(x.short), r: 1, sum: 1, v: x => x.short }], rows) };
  },
});

// ─── বিতরণ রেজিস্টার ───
ReportPage({
  id: 'rptDisbReg', title: 'বিতরণ রেজিস্টার', landscape: true, fromDefault: 'month',
  filters: [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { k: 'freq', l: 'Installment Frequency', t: 'select', opts: [['', 'Select'], ['D', 'D-Daily'], ['W', 'W-Weekly'], ['M', 'M-Monthly'], ['Q', 'Q-Quarterly'], ['H', 'H-Half Yearly'], ['Y', 'Y-Yearly']] }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'dom', l: 'Disbursement Day of Month', t: 'number' }, { k: 'otype', l: 'EMI Opening Type', t: 'select', opts: [['', 'All'], ['new', 'New Opening'], ['res', 'Reschedule']] }],
  run: async f => {
    const mem = await Data.memberIdx(f.branch);
    const rows = (await accDocs(f, 'loan')).filter(a => a.openDate >= f.from && a.openDate <= f.upto && (!f.ltype || a.type === f.ltype) && (!f.freq || a.freq === f.freq) && (!num(f.dom) || Number(a.openDate.slice(8)) === num(f.dom)) && (!f.otype || (f.otype === 'res' ? !!a.rescheduled : !a.rescheduled))).sort((a, b) => (a.openDate + a.accNo).localeCompare(b.openDate + b.accNo));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'বিতরণ তারিখ', f: a => fmtD(a.openDate) }, { h: 'সমিতি', f: a => a.samity }, { h: 'সদস্য', f: a => a.memberId + ' - ' + R.name(mem, a.memberId) }, { h: 'হিসাব', f: a => a.accNo }, { h: 'উদ্দেশ্য', f: a => esc(a.purposeName || '') }, { h: 'কিস্তির ধরন', f: a => a.freq }, { h: 'কিস্তি সংখ্যা', f: a => a.n, r: 1 }, { h: 'হার%', f: a => a.rate, r: 1 }, { h: 'ঋণ', f: a => amt(a.principal), r: 1, sum: 1, v: a => a.principal }, { h: 'মুনাফা', f: a => amt(a.profit), r: 1, sum: 1, v: a => a.profit }, { h: 'মোট', f: a => amt(a.totalRepay), r: 1, sum: 1, v: a => a.totalRepay }, { h: 'কিস্তি', f: a => amt(a.instAmount), r: 1 }, { h: '১ম কিস্তি', f: a => fmtD(a.firstDate) }, { h: 'মেয়াদ শেষ', f: a => fmtD(a.expDate) }], rows) };
  },
});

// ─── বিতরণ এবং কালেকশন রেজিস্টার ───
ReportPage({
  id: 'rptDisbCollReg', title: 'বিতরণ এবং কালেকশন রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F, [ACC_STATUS_F]),
  run: async f => {
    const mem = await Data.memberIdx(f.branch);
    const accs = (await accDocs(f, 'loan')).filter(a => (!f.ltype || a.type === f.ltype) && statusFilter(f.ast, a, f.from, f.upto));
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan' && t.dc === 'C');
    const got = {}; ts.forEach(t => { const g = got[t.accNo] = got[t.accNo] || { a: 0, p: 0, pr: 0 }; g.a += num(t.amount); g.p += num(t.principal); g.pr += num(t.profit); });
    const rows = accs.map(a => ({ a, g: got[a.accNo] || { a: 0, p: 0, pr: 0 } })).sort((x, y) => (x.a.samity + x.a.accNo).localeCompare(y.a.samity + y.a.accNo));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: x => x.a.samity }, { h: 'সদস্য', f: x => x.a.memberId + ' - ' + R.name(mem, x.a.memberId) }, { h: 'হিসাব', f: x => x.a.accNo }, { h: 'বিতরণ তারিখ', f: x => fmtD(x.a.openDate) }, { h: 'ঋণ', f: x => amt(x.a.principal), r: 1, sum: 1, v: x => x.a.principal }, { h: 'মোট পরিশোধযোগ্য', f: x => amt(x.a.totalRepay), r: 1, sum: 1, v: x => x.a.totalRepay }, { h: 'সময়ে আসল আদায়', f: x => amt(x.g.p), r: 1, sum: 1, v: x => x.g.p }, { h: 'সময়ে মুনাফা আদায়', f: x => amt(x.g.pr), r: 1, sum: 1, v: x => x.g.pr }, { h: 'মোট আদায় (সব সময়)', f: x => amt(x.a.paidTotal), r: 1, sum: 1, v: x => x.a.paidTotal }, { h: 'স্থিতি', f: x => amt(x.a.balance), r: 1, sum: 1, v: x => x.a.balance }, { h: 'অবস্থা', f: x => x.a.status === 'closed' ? 'Closed ' + fmtD(x.a.closeDate) : 'Active' }], rows) };
  },
});

// ─── সম্পূর্ণ পরিশোধিত ঋণ ───
ReportPage({
  id: 'rptFullyPaid', title: 'সম্পূর্ণ পরিশোধিত ঋণ রেজিস্টার', landscape: true, fromDefault: 'month', filters: regFilters(LOAN_TYPE_F),
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const rows = c.list.filter(s => s.k === 'loan' && s.st === 'closed' && s.cd >= f.from && s.cd <= f.upto && (!f.ltype || s.t === f.ltype)).sort((a, b) => (a.cd + a.accNo).localeCompare(b.cd + b.accNo));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: s => s.samity }, { h: 'সদস্য', f: s => s.m + ' - ' + R.name(c.mem, s.m) }, { h: 'হিসাব', f: s => s.accNo }, { h: 'বিতরণ তারিখ', f: s => fmtD(s.od) }, { h: 'মেয়াদ শেষ', f: s => fmtD(s.ed) }, { h: 'পরিশোধের তারিখ', f: s => fmtD(s.cd) }, { h: 'ঋণ', f: s => amt(s.pr), r: 1, sum: 1, v: s => s.pr }, { h: 'মুনাফা', f: s => amt(s.pf), r: 1, sum: 1, v: s => s.pf }, { h: 'মোট আদায়', f: s => amt(s.pt), r: 1, sum: 1, v: s => s.pt }, { h: 'সময়মত?', f: s => s.cd <= s.ed ? 'হ্যাঁ' : 'মেয়াদোত্তীর্ণ' }], rows) };
  },
});

// ─── ঋণ আদায়ের বিস্তারিত (Recovery) ───
ReportPage({
  id: 'rptRecovery', title: 'ঋণ আদায়ের বিস্তারিত', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'rt', l: 'Recovery Type', t: 'select', opts: [['all', 'All'], ['rcv', 'Total Receive'], ['tod', 'Total Overdue'], ['reg', 'Regular Recovery'], ['cur', 'Current Due Recovery'], ['exp', 'Expire Due Recovery'], ['adv', 'Advance Recovery'], ['new', 'Newly Due']] }],
  run: async f => {
    const c = await R.snaps(f, f.upto);
    const open = {}; (await Hist.snapsAt(f.branch, addDays(f.from, -1), f.samity)).forEach(s => open[s.accNo] = s);
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => t.kind === 'loan' && t.dc === 'C' && t.tt !== 'EMI_WAIVE');
    const got = {}; ts.forEach(t => got[t.accNo] = (got[t.accNo] || 0) + num(t.amount));
    let rows = c.list.filter(s => s.k === 'loan' && (s.st !== 'closed' || got[s.accNo])).map(s => {
      const o = open[s.accNo];
      const stO = o ? R.loanSt(o, addDays(f.from, -1)).st : { asonDue: 0, overdue: 0, cumDue: 0, expired: false };
      const stC = R.loanSt(s, f.upto).st;
      const l = R.loanSt(s, f.upto).l;
      const periodDue = r2(sum(Loan.schedule(l).filter(x => x.date >= f.from && x.date <= f.upto), x => x.amount));
      const g = got[s.accNo] || 0;
      const odRec = Math.min(g, stO.asonDue);
      const curRec = Math.min(g - odRec, periodDue);
      const advRec = r2(Math.max(0, g - odRec - curRec));
      return { s, g, odOpen: stO.asonDue, periodDue, odRec: r2(odRec), curRec: r2(curRec), advRec, expRec: stO.expired ? r2(odRec) : 0, odClose: stC.overdue, newDue: r2(Math.max(0, stC.asonDue - stO.asonDue)) };
    });
    const pick = { all: () => true, rcv: x => x.g > 0, tod: x => x.odClose > 0, reg: x => x.curRec > 0, cur: x => x.odRec > 0 && !x.expRec, exp: x => x.expRec > 0, adv: x => x.advRec > 0, new: x => x.newDue > 0 }[f.rt || 'all'];
    rows = rows.filter(pick).sort((a, b) => (a.s.samity + a.s.accNo).localeCompare(b.s.samity + b.s.accNo));
    const rate = sum(rows, x => x.odOpen + x.periodDue) ? r2(sum(rows, x => x.odRec + x.curRec) / sum(rows, x => x.odOpen + x.periodDue) * 100) : 0;
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)} | আদায়ের হার (OTR): ${rate}%`, html: UI.table([{ h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'প্রারম্ভিক বকেয়া', f: x => amt(x.odOpen), r: 1, sum: 1, v: x => x.odOpen }, { h: 'সময়ের প্রাপ্য', f: x => amt(x.periodDue), r: 1, sum: 1, v: x => x.periodDue }, { h: 'মোট আদায়', f: x => amt(x.g), r: 1, sum: 1, v: x => x.g }, { h: 'বকেয়া আদায়', f: x => amt(x.odRec), r: 1, sum: 1, v: x => x.odRec }, { h: 'নিয়মিত আদায়', f: x => amt(x.curRec), r: 1, sum: 1, v: x => x.curRec }, { h: 'অগ্রিম আদায়', f: x => amt(x.advRec), r: 1, sum: 1, v: x => x.advRec }, { h: 'মেয়াদোত্তীর্ণ আদায়', f: x => amt(x.expRec), r: 1, sum: 1, v: x => x.expRec }, { h: 'সমাপনী বকেয়া', f: x => amt(x.odClose), r: 1, sum: 1, v: x => x.odClose }], rows) };
  },
});

// ─── ঋণ ক্ষয় সঞ্চিতি (LLP) ও অবলোপন ───
const LLP_CLASS = [['Standard', 0, 1], ['Watchful', 1, 5], ['Substandard', 31, 25], ['Doubtful', 181, 75], ['Bad/Loss', 366, 100]];
function llpRows(c, f) {
  return c.list.filter(s => s.k === 'loan' && s.st !== 'closed' && (!f.ltype || s.t === f.ltype) && (!f.freq || s.fq === f.freq)).map(s => {
    const { st, l } = R.loanSt(s, f.date);
    // সবচেয়ে পুরোনো অপরিশোধিত কিস্তির তারিখ থেকে বকেয়া দিন
    let paid = r2(num(l.paidTotal) - num(l.base)), oldest = null;
    for (const x of st.sch) { if (paid >= x.amount - 0.01) { paid -= x.amount; continue; } if (x.date < f.date) oldest = x.date; break; }
    const days = oldest ? daysBetween(oldest, f.date) : 0;
    const cls = [...LLP_CLASS].reverse().find(c => days >= c[1]) || LLP_CLASS[0];
    const base = st.principalOut;
    return { s, st, days, cls: cls[0], pct: cls[2], base, prov: r2(base * cls[2] / 100) };
  });
}
const llpFilters = [F.branch, LOAN_TYPE_F, F.samity, F.employee, F.member, { k: 'freq', l: 'Installment Frequency', t: 'select', opts: [['', 'Select'], ['D', 'D-Daily'], ['W', 'W-Weekly'], ['M', 'M-Monthly'], ['Q', 'Q-Quarterly'], ['H', 'H-Half Yearly'], ['Y', 'Y-Yearly']] }, { ...F.date, l: 'Report Date' }, { k: 'rn', l: 'Report Name', t: 'select', opts: [['details', 'Details'], ['summary', 'Summary']] }];
ReportPage({
  id: 'rptLLP', title: 'ঋণ ক্ষয় সঞ্চিতি (LLP)', landscape: true, filters: llpFilters,
  run: async f => {
    const c = await R.snaps(f, f.date); const rows = llpRows(c, f).sort((a, b) => b.days - a.days);
    const g = groupBy(rows, r => r.cls);
    const summary = UI.table([{ h: 'শ্রেণি', f: r => r[0] }, { h: 'বকেয়া দিন', f: r => r[1] + '+' }, { h: 'সঞ্চিতি %', f: r => r[2] + '%', r: 1 }, { h: 'হিসাব', f: r => (g[r[0]] || []).length, r: 1, sum: 1, v: r => (g[r[0]] || []).length }, { h: 'আসল স্থিতি', f: r => amt(sum(g[r[0]] || [], x => x.base)), r: 1, sum: 1, v: r => sum(g[r[0]] || [], x => x.base) }, { h: 'সঞ্চিতি', f: r => amt(sum(g[r[0]] || [], x => x.prov)), r: 1, sum: 1, v: r => sum(g[r[0]] || [], x => x.prov) }], LLP_CLASS);
    if (f.rn === 'summary') return { sub: 'তারিখ: ' + fmtD(f.date), html: summary };
    return { sub: 'তারিখ: ' + fmtD(f.date), html: summary + '<br>' + UI.table([{ h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'মেয়াদ শেষ', f: x => fmtD(x.s.ed) }, { h: 'বকেয়া', f: x => amt(x.st.overdue), r: 1, sum: 1, v: x => x.st.overdue }, { h: 'বকেয়া দিন', f: x => x.days, r: 1 }, { h: 'শ্রেণি', f: x => x.cls }, { h: 'আসল স্থিতি', f: x => amt(x.base), r: 1, sum: 1, v: x => x.base }, { h: '%', f: x => x.pct, r: 1 }, { h: 'সঞ্চিতি', f: x => amt(x.prov), r: 1, sum: 1, v: x => x.prov }], rows) };
  },
});
ReportPage({
  id: 'rptWriteOff', title: 'ঋণ অবলোপন তালিকা', landscape: true, filters: llpFilters,
  run: async f => {
    const c = await R.snaps(f, f.date);
    const rows = llpRows(c, f).filter(x => x.cls === 'Bad/Loss' || x.s.st === 'writeoff').sort((a, b) => b.days - a.days);
    return { sub: 'তারিখ: ' + fmtD(f.date) + ' — ৩৬৫ দিনের বেশি বকেয়া (অবলোপনযোগ্য)', html: UI.table([{ h: 'সমিতি', f: x => x.s.samity }, { h: 'সদস্য', f: x => x.s.m + ' - ' + R.name(c.mem, x.s.m) }, { h: 'মোবাইল', f: x => R.mobile(c.mem, x.s.m) }, { h: 'হিসাব', f: x => x.s.accNo }, { h: 'বিতরণ', f: x => fmtD(x.s.od) }, { h: 'মেয়াদ শেষ', f: x => fmtD(x.s.ed) }, { h: 'ঋণ', f: x => amt(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { h: 'আসল স্থিতি', f: x => amt(x.base), r: 1, sum: 1, v: x => x.base }, { h: 'মুনাফা স্থিতি', f: x => amt(x.st.profitOut), r: 1, sum: 1, v: x => x.st.profitOut }, { h: 'বকেয়া দিন', f: x => x.days, r: 1 }], rows) };
  },
});

// ═══════════ MIS রেজিস্টার ═══════════
async function memberDocs(f) {
  let q = db.collection('members').where('branch', '==', f.branch);
  if (f.samity) q = db.collection('members').where('samity', '==', f.samity);
  const sm = await R.sams(f.branch);
  return (await q.get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(m => (!f.member || m.memberId === f.member) && (!f.employee || (sm[m.samity] || {}).foId === f.employee));
}
ReportPage({
  id: 'rptAdmission', title: 'ভর্তি রেজিস্টার', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'ms', l: 'Member Status', t: 'select', opts: [['', 'Choose'], ['active', 'Active'], ['inactive', 'Inactive'], ['closed', 'Closed']] }, { k: 'village', l: 'গ্রাম/ঠিকানা (খুঁজুন)', t: 'text' }],
  run: async f => {
    const rows = (await memberDocs(f)).filter(m => m.joinDate >= f.from && m.joinDate <= f.upto && (!f.ms || (m.status || 'active') === f.ms) && (!f.village || String(m.presentAddr || m.permAddr || '').includes(f.village))).sort((a, b) => (a.joinDate + a.memberId).localeCompare(b.joinDate + b.memberId));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)} — মোট ${rows.length} জন`, html: UI.table([{ h: 'SL', f: m => rows.indexOf(m) + 1 }, { h: 'ভর্তির তারিখ', f: m => fmtD(m.joinDate) }, { h: 'সমিতি', f: m => m.samity }, { h: 'সদস্য আইডি', f: m => m.memberId }, { h: 'নাম', f: m => esc(m.name) }, { h: 'পিতা/স্বামী', f: m => esc(m.father || m.spouse || '') }, { h: 'মোবাইল', f: m => esc(m.mobile || '') }, { h: 'NID', f: m => esc(m.nid || '') }, { h: 'ঠিকানা', f: m => esc(m.presentAddr || '') }, { h: 'ভর্তি ফি', f: m => amt(m.admitFee || 0), r: 1, sum: 1, v: m => m.admitFee || 0 }, { h: 'অবস্থা', f: m => m.status || 'active' }], rows) };
  },
});
ReportPage({
  id: 'rptSomobayMember', title: 'সমবায় সদস্য রেজিস্টার', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const ms = (await memberDocs(f)).filter(m => (m.joinDate || '') <= f.date).sort((a, b) => a.memberId.localeCompare(b.memberId));
    const c = await R.snaps(f, f.date); const share = {}; c.list.forEach(s => { if (s.k === 'share') share[s.m] = (share[s.m] || 0) + num(s.b); });
    return { sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([{ h: 'ক্রমিক', f: m => ms.indexOf(m) + 1 }, { h: 'সদস্য নং', f: m => m.memberId }, { h: 'ভর্তির তারিখ', f: m => fmtD(m.joinDate) }, { h: 'নাম', f: m => esc(m.name) }, { h: 'পিতা/স্বামী', f: m => esc(m.father || m.spouse || '') }, { h: 'মাতা', f: m => esc(m.mother || '') }, { h: 'ঠিকানা', f: m => esc(m.permAddr || m.presentAddr || '') }, { h: 'পেশা', f: m => esc(m.profession || '') }, { h: 'জন্ম তারিখ', f: m => fmtD(m.dob) }, { h: 'নমিনি', f: m => esc((m.nomName || '') + (m.nomRelation ? ' (' + m.nomRelation + ')' : '')) }, { h: 'শেয়ার', f: m => amt(share[m.memberId] || 0), r: 1, sum: 1, v: m => share[m.memberId] || 0 }, { h: 'সদস্যপদ বাতিল', f: m => m.status === 'closed' ? fmtD(m.closeDate) : '' }, { h: 'স্বাক্ষর', f: () => '' }], ms) };
  },
});

// পর্যায়ক্রমিক অগ্রগতি / সমিতি পারফরম্যান্স
async function progressRows(f, grp) {
  const bs = await R.branchesFor(f); const out = {};
  const lab = await R.glabel(grp, bs);
  for (const b of bs) {
    const ff = { ...f, branch: b };
    const c = await R.snaps(ff, f.upto); const o = {}; (await Hist.snapsAt(b, addDays(f.from, -1), f.samity)).forEach(s => o[s.accNo] = s);
    const ts = (await R.txns(ff, f.from, f.upto)).filter(t => !R.isTrf(t));
    const key = (samity, m) => grp === 'branch' ? b : grp === 'center' ? samity : grp === 'employee' ? c.fo(samity) || '—' : m;
    const row = k => out[k] = out[k] || { k, memO: new Set(), memC: new Set(), borO: new Set(), borC: new Set(), disbN: 0, disb: 0, rcv: 0, rcvP: 0, loanO: 0, loanC: 0, od: 0, savO: 0, savC: 0, depRcv: 0, depPay: 0, due: 0 };
    Object.values(o).forEach(s => { if (f.employee && c.fo(s.samity) !== f.employee) return; const r = row(key(s.samity, s.m)); if (s.st !== 'closed') { r.memO.add(s.m); if (s.k === 'loan') { r.borO.add(s.m); r.loanO += f.sc === 'without' ? r2(num(s.pr) - num(s.pp)) : num(s.b); } else r.savO += num(s.b); } });
    c.list.forEach(s => { const r = row(key(s.samity, s.m)); if (s.st !== 'closed') { r.memC.add(s.m); if (s.k === 'loan') { const { st, l } = R.loanSt(s, f.upto); r.borC.add(s.m); r.loanC += f.sc === 'without' ? st.principalOut : num(s.b); r.od += st.overdue; r.due += sum(Loan.schedule(l).filter(x => x.date >= f.from && x.date <= f.upto), x => x.amount); } else r.savC += num(s.b); } });
    ts.forEach(t => { const r = row(key(t.samity, t.memberId)); const cl = R.cls(t); if (cl === 'disb') { r.disbN++; r.disb += num(t.amount); } if (cl === 'loanRcv') { r.rcv += num(t.amount); r.rcvP += num(t.principal); } if (cl === 'depRcv') r.depRcv += num(t.amount); if (cl === 'depPay') r.depPay += num(t.amount); });
  }
  return { rows: Object.values(out).sort((a, b) => String(a.k).localeCompare(String(b.k))), lab };
}
ReportPage({
  id: 'rptPeriodProgress', title: 'পর্যায়ক্রমিক অগ্রগতি রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, F.samity, F.employee, { ...R.GROUP, opts: [['center', 'Center'], ['branch', 'Branch'], ['employee', 'Employee'], ['member', 'Member']] }, { k: 'sc', l: 'Service Charge', t: 'select', opts: [['with', 'With Service Charge'], ['without', 'Without Service Charge']] }],
  run: async f => {
    const { rows, lab } = await progressRows(f, f.grp || 'center');
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'গ্রুপ', f: r => r.k === '—' ? '—' : lab(r.k) }, { h: 'সদস্য (শুরু)', f: r => r.memO.size, r: 1, sum: 1, v: r => r.memO.size }, { h: 'সদস্য (শেষ)', f: r => r.memC.size, r: 1, sum: 1, v: r => r.memC.size }, { h: 'ঋণী (শুরু)', f: r => r.borO.size, r: 1, sum: 1, v: r => r.borO.size }, { h: 'ঋণী (শেষ)', f: r => r.borC.size, r: 1, sum: 1, v: r => r.borC.size }, { h: 'বিতরণ সংখ্যা', f: r => r.disbN, r: 1, sum: 1, v: r => r.disbN }, { h: 'বিতরণ', f: r => amt(r.disb), r: 1, sum: 1, v: r => r.disb }, { h: 'আদায়', f: r => amt(f.sc === 'without' ? r.rcvP : r.rcv), r: 1, sum: 1, v: r => f.sc === 'without' ? r.rcvP : r.rcv }, { h: 'ঋণ স্থিতি (শুরু)', f: r => amt(r.loanO), r: 1, sum: 1, v: r => r.loanO }, { h: 'ঋণ স্থিতি (শেষ)', f: r => amt(r.loanC), r: 1, sum: 1, v: r => r.loanC }, { h: 'বকেয়া', f: r => amt(r.od), r: 1, sum: 1, v: r => r.od }, { h: 'সঞ্চয় (শুরু)', f: r => amt(r.savO), r: 1, sum: 1, v: r => r.savO }, { h: 'সঞ্চয় জমা', f: r => amt(r.depRcv), r: 1, sum: 1, v: r => r.depRcv }, { h: 'সঞ্চয় ফেরত', f: r => amt(r.depPay), r: 1, sum: 1, v: r => r.depPay }, { h: 'সঞ্চয় (শেষ)', f: r => amt(r.savC), r: 1, sum: 1, v: r => r.savC }], rows) };
  },
});
ReportPage({
  id: 'rptSamityPerformance', title: 'সমিতি পারফরম্যান্স রিপোর্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, F.btype, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const { rows, lab } = await progressRows(f, 'center');
    const pct = (a, b) => b ? r2(a / b * 100) + '%' : '—';
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'সমিতি', f: r => lab(r.k) }, { h: 'সদস্য', f: r => r.memC.size, r: 1, sum: 1, v: r => r.memC.size }, { h: 'ঋণী', f: r => r.borC.size, r: 1, sum: 1, v: r => r.borC.size }, { h: 'ঋণ স্থিতি', f: r => amt(r.loanC), r: 1, sum: 1, v: r => r.loanC }, { h: 'সময়ের প্রাপ্য', f: r => amt(r.due), r: 1, sum: 1, v: r => r.due }, { h: 'আদায়', f: r => amt(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { h: 'আদায়ের হার', f: r => pct(r.rcv, r.due), r: 1 }, { h: 'বকেয়া', f: r => amt(r.od), r: 1, sum: 1, v: r => r.od }, { h: 'PAR %', f: r => pct(r.od, r.loanC), r: 1 }, { h: 'সঞ্চয় স্থিতি', f: r => amt(r.savC), r: 1, sum: 1, v: r => r.savC }, { h: 'সঞ্চয়/ঋণ', f: r => pct(r.savC, r.loanC), r: 1 }], rows) };
  },
});
