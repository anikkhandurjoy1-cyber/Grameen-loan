// ═══════════════════════════════════════════════════════════════
// TX — লেনদেন বিল্ডার (ডিপোজিট / লোন / শেয়ার / অন্যান্য)
// প্রতিটি ফাংশন {lines, txns, accOps} অংশ ফেরত দেয়; Tx.post() এক ভাউচারে পোস্ট করে
// ═══════════════════════════════════════════════════════════════
const Tx = {
  // একাউন্ট লোড (ভ্যালিডেশন সহ)
  async acc(accNo) { const a = await Data.account(accNo); if (!a) fail('একাউন্ট পাওয়া যায়নি: ' + accNo); return a; },
  async foOf(samity) { if (!samity) return ''; const s = await Data.samity(samity); return (s && s.foId) || ''; },
  base(a, tt, amount, dc, extra = {}) { return { accNo: a.accNo, kind: a.kind, type: a.type, memberId: a.memberId || '', samity: a.samity || '', foId: a._fo || '', tt, amount: r2(amount), dc, ...extra }; },
  async profile(accNo) { const d = await db.collection('tranProfiles').doc(accNo).get(); return d.exists && d.data().status !== 'Inactive' ? d.data() : null; },

  // ── ডিপোজিট/শেয়ার/অন্যান্য একাউন্টে জমা (Credit) ──
  async credit(a, amount, opts = {}) {
    amount = r2(amount); if (amount <= 0) fail('পরিমাণ দিন');
    if (a.status === 'closed') fail('একাউন্ট ক্লোজড: ' + a.accNo);
    if (a.block && a.block.dep) fail('এই একাউন্টে জমা ব্লক করা আছে');
    const prof = opts.skipProfile ? null : await Tx.profile(a.accNo);
    if (prof && prof.maxCr && amount > num(prof.maxCr)) fail('লেনদেন প্রোফাইল: সর্বোচ্চ জমা ' + tk(prof.maxCr));
    a._fo = a._fo || await Tx.foOf(a.samity);
    const gl = Eng.productGl(a.kind, a.type);
    return {
      lines: [{ gl, cr: amount, accNo: a.accNo }, opts.contraGl === null ? null : { gl: opts.contraGl || REF.GL.cash, dr: amount }].filter(Boolean),
      txns: [Tx.base(a, opts.tt || (a.kind === 'share' ? 'SHARE_RCV' : a.kind === 'other' ? 'OTHER_RCV' : 'DEP_RCV'), amount, 'C', { docNo: opts.docNo || '', narration: opts.narration || '' })],
      accOps: [{ accNo: a.accNo, samity: a.samity, inc: { balance: amount, totCr: amount }, snapInc: { b: amount, tc: amount } }],
    };
  },
  // ── ডিপোজিট/শেয়ার/অন্যান্য একাউন্ট থেকে উত্তোলন (Debit) ──
  async debit(a, amount, opts = {}) {
    amount = r2(amount); if (amount <= 0) fail('পরিমাণ দিন');
    if (a.status === 'closed') fail('একাউন্ট ক্লোজড: ' + a.accNo);
    if (a.block && a.block.wd && !opts.ignoreBlock) fail('এই একাউন্টে উত্তোলন ব্লক করা আছে');
    const blocked = opts.ignoreBlock ? 0 : num(a.block && a.block.amount);
    const avail = r2(num(a.balance) - blocked);
    if (!opts.allowNegative && amount > avail + 0.001) fail(`পর্যাপ্ত ব্যালেন্স নেই (উত্তোলনযোগ্য ${tk(avail)}${blocked ? ', ব্লক ' + tk(blocked) : ''})`);
    if (a.kind === 'dep' && !opts.closing && !opts.internal && REF.DEP[a.type] && !REF.DEP[a.type].payAllowed) fail(REF.DEP[a.type].name + ' থেকে মেয়াদের আগে উত্তোলন করা যায় না — ক্লোজিং ব্যবহার করুন');
    const prof = opts.skipProfile ? null : await Tx.profile(a.accNo);
    if (prof) {
      if (prof.maxDr && amount > num(prof.maxDr)) fail('লেনদেন প্রোফাইল: সর্বোচ্চ উত্তোলন ' + tk(prof.maxDr));
      if (prof.maxDrPct && amount > num(a.balance) * num(prof.maxDrPct) / 100) fail(`লেনদেন প্রোফাইল: ব্যালেন্সের সর্বোচ্চ ${prof.maxDrPct}% উত্তোলন`);
      if (prof.minBal && num(a.balance) - amount < num(prof.minBal)) fail('লেনদেন প্রোফাইল: ন্যূনতম ব্যালেন্স ' + tk(prof.minBal));
    }
    a._fo = a._fo || await Tx.foOf(a.samity);
    const gl = Eng.productGl(a.kind, a.type);
    return {
      lines: [{ gl, dr: amount, accNo: a.accNo }, opts.contraGl === null ? null : { gl: opts.contraGl || REF.GL.cash, cr: amount }].filter(Boolean),
      txns: [Tx.base(a, opts.tt || (a.kind === 'share' ? 'SHARE_PAY' : a.kind === 'other' ? 'OTHER_PAY' : 'DEP_PAY'), amount, 'D', { docNo: opts.docNo || '', narration: opts.narration || '' })],
      accOps: [{ accNo: a.accNo, samity: a.samity, inc: { balance: -amount, totDr: amount }, snapInc: { b: -amount, td: amount } }],
    };
  },
  // ── ঋণের কিস্তি আদায় ──
  // opts: {principal, profit, penalty} ম্যানুয়াল ভাগ; না দিলে অটো ভাগ
  async loanReceive(l, amount, opts = {}) {
    amount = r2(amount);
    if (l.status === 'closed') fail('ঋণ একাউন্ট ক্লোজড');
    const out = r2(num(l.balance));
    let principal, profit;
    if (opts.principal != null || opts.profit != null) {
      principal = r2(opts.principal || 0); profit = r2(opts.profit || 0);
      if (principal > r2(num(l.principal) - num(l.paidP)) + 0.001) fail('আসল বকেয়ার চেয়ে বেশি');
      if (profit > r2(num(l.profit) - num(l.paidPr)) + 0.001) fail('মুনাফা বকেয়ার চেয়ে বেশি');
      amount = r2(principal + profit);
    } else {
      if (amount > out + 0.001) fail('বকেয়ার (' + tk(out) + ') চেয়ে বেশি জমা দেওয়া যাবে না');
      ({ principal, profit } = Loan.split(l, amount));
    }
    const penalty = r2(opts.penalty || 0);
    if (amount <= 0 && penalty <= 0) fail('পরিমাণ দিন');
    l._fo = l._fo || await Tx.foOf(l.samity);
    const prod = REF.LOAN[l.type] || REF.LOAN['3001'];
    const total = r2(amount + penalty);
    const newOut = r2(out - amount);
    const closing = newOut <= 0.001;
    const set = closing ? { status: 'closed', closeDate: opts.date || '' } : null;
    return {
      // eKisti: ঋণ হিসাবে (আসল+মুনাফা) ক্রেডিট; Profit Receivable ডেবিট → সার্ভিস চার্জ আয় ক্রেডিট
      lines: [opts.contraGl === null ? null : { gl: opts.contraGl || REF.GL.cash, dr: total }, { gl: prod.gl, cr: r2(principal + profit), accNo: l.accNo }, { gl: prod.recGl, dr: profit, memo: 'Installment Profit Adjustment' }, { gl: prod.incGl, cr: profit, accNo: l.accNo }, { gl: REF.GL.penalty, cr: penalty, accNo: l.accNo }].filter(Boolean),
      txns: [Tx.base(l, opts.tt || 'EMI_RCV', amount, 'C', { principal, profit, penalty, docNo: opts.docNo || '', narration: opts.narration || '', outAfter: newOut })],
      accOps: [{ accNo: l.accNo, samity: l.samity, inc: { balance: -amount, paidP: principal, paidPr: profit, paidPen: penalty, paidTotal: amount, penDue: -Math.min(penalty, num(l.penDue)) }, snapInc: { b: -amount, pp: principal, ppr: profit, pt: amount }, set: set ? { ...set, lastPayDate: opts.date } : { lastPayDate: opts.date }, snapSet: closing ? { st: 'closed', cd: opts.date } : null, undoSet: closing ? { status: 'active' } : null }],
    };
  },
  merge(parts) { return { lines: parts.flatMap(p => p.lines), txns: parts.flatMap(p => p.txns), accOps: parts.flatMap(p => p.accOps) }; },
  async post(branch, date, type, narration, parts, extra = {}) {
    const m = Tx.merge(parts);
    // একই লেজারের নগদ লাইন একত্র
    const agg = {}; const lines = [];
    m.lines.forEach(l => { if (!l.accNo && !l.memo) { const k = l.gl; agg[k] = agg[k] || { gl: k, dr: 0, cr: 0 }; agg[k].dr += num(l.dr); agg[k].cr += num(l.cr); } else lines.push(l); });
    Object.values(agg).forEach(x => { const net = r2(x.dr - x.cr); if (net > 0) lines.push({ gl: x.gl, dr: net }); else if (net < 0) lines.push({ gl: x.gl, cr: -net }); });
    return Eng.post({ branch, date, type, narration, lines, txns: m.txns, accOps: m.accOps, ...extra });
  },
};
// snap / account → ঋণ অবজেক্ট (Loan.status এর জন্য)
Loan.fromSnap = s => ({ accNo: s.accNo, memberId: s.m, samity: s.samity, type: s.t, principal: num(s.pr), profit: num(s.pf), totalRepay: num(s.tr), instAmount: num(s.ia), lastInst: num(s.li), actualN: num(s.an), freq: s.fq, firstDate: s.fd, expDate: s.ed, openDate: s.od, paidP: num(s.pp), paidPr: num(s.ppr), paidTotal: num(s.pt), balance: num(s.b), status: s.st, rate: num(s.rt), closeDate: s.cd });
Loan.snapOf = l => ({ m: l.memberId, k: 'loan', t: l.type, b: num(l.balance), pr: num(l.principal), pf: num(l.profit), tr: num(l.totalRepay), ia: num(l.instAmount), li: num(l.lastInst), an: num(l.actualN), fq: l.freq, fd: l.firstDate, ed: l.expDate, od: l.openDate, pp: num(l.paidP), ppr: num(l.paidPr), pt: num(l.paidTotal), rt: num(l.rate), bs: num(l.base), st: l.status || 'active' });
const DepSnap = a => ({ m: a.memberId || '', k: a.kind, t: a.type, b: num(a.balance), tc: num(a.totCr), td: num(a.totDr), ia: num(a.instAmount), fq: a.freq || '', od: a.openDate, md: a.maturityDate || '', st: a.status || 'active' });
// নতুন একাউন্ট নম্বর: সদস্য আইডি + ২ ডিজিট ক্রম
async function newAccNo(branch, memberId) {
  Cache.drop('aidx_' + branch);
  const list = await Data.accountsOf(branch, memberId);
  let n = list.filter(a => a.accNo.startsWith(memberId) && a.accNo.length === memberId.length + 2).length + 1;
  const ex = new Set(list.map(a => a.accNo));
  let acc = memberId + pad(n, 2);
  while (ex.has(acc)) { n++; acc = memberId + pad(n, 2); }
  return acc;
}
