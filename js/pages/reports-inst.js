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

// ═══ eKisti রিপোর্টের সাধারণ হিসাব ═══
// সঞ্চয় বাকেট: GS / SS / DPS / FDR / Share
const BUCKET = (kind, type) => { if (kind === 'share') return 'Share'; const d = REF.DEP[type] || {}; return d.dtype === 'FD' ? 'FDR' : d.dtype === 'RD' ? 'DPS' : (type === '2002' || d.comp) ? 'SS' : 'GS'; };
const BUCKETS = ['GS', 'SS', 'DPS', 'FDR', 'Share'];
const FEE_GL = { admission: ['32000003'], passbook: ['32000006'], closing: ['32000005'], form: ['32000001'], insurance: ['28000001'], document: ['32000002', '32000008'], health: ['32000010'], cheque: ['32000011'], penalty: ['32000007'], others: ['32000009', '32000012'] };
const FEE_OF = gl => Object.keys(FEE_GL).find(k => FEE_GL[k].includes(gl));
const SL = { h: 'ক্রমিক নং', sl: 1 };
const n2 = v => amt(v || 0);
Object.assign(R, {
  // ভাউচার থেকে ফি (সদস্যভিত্তিক)
  async fees(f, from, upto, branches) {
    const out = []; const bs = branches || [f.branch];
    for (const b of bs) {
      const aidx = await Data.accIdx(b); const mem = await Data.memberIdx(b); const sm = await R.sams(b);
      const vs = (await db.collection('vouchers').where('bd', '>=', b + '_' + from).where('bd', '<=', b + '_' + upto).get()).docs.map(d => d.data()).filter(v => v.status === 'posted' && (!f.user || v.by === f.user));
      vs.forEach(v => v.lines.forEach(l => {
        const k = FEE_OF(l.gl); if (!k || !l.cr) return;
        const mid = (v.ref && v.ref.memberId) || ((aidx[(v.ref || {}).accNo] || [])[0]) || ((aidx[l.accNo] || [])[0]) || '';
        const samity = (mem[mid] || [])[1] || ''; const fo = (sm[samity] || {}).foId || '';
        if ((f.samity && samity !== f.samity) || (f.employee && fo !== f.employee) || (f.member && mid !== f.member)) return;
        out.push({ branch: b, date: v.date, memberId: mid, samity, foId: fo, k, amount: num(l.cr) - num(l.dr), vno: v.vno, byName: v.byName });
      }));
    }
    return out;
  },
  // সময়ের ঋণ আদায়ের শ্রেণিবিভাগ (eKisti: Regular / Due / Advance / Expire)
  async recovery(f, from, upto) {
    const close = await R.snaps(f, upto);
    const open = {}; (await Hist.snapsAt(f.branch, addDays(from, -1), f.samity)).forEach(s => open[s.accNo] = s);
    const ts = (await R.txns(f, from, upto)).filter(t => t.kind === 'loan' && t.dc === 'C' && t.tt !== 'EMI_WAIVE');
    const got = {}; ts.forEach(t => { const g = got[t.accNo] = got[t.accNo] || { a: 0, p: 0, pr: 0, pen: 0, dates: {} }; g.a += num(t.amount); g.p += num(t.principal); g.pr += num(t.profit); g.pen += num(t.penalty); g.dates[t.date] = (g.dates[t.date] || 0) + num(t.amount); });
    const rows = close.list.filter(s => s.k === 'loan' && (s.st !== 'closed' || got[s.accNo])).map(s => {
      const o = open[s.accNo];
      const stO = o ? R.loanSt(o, addDays(from, -1)).st : { asonDue: 0, overdue: 0, expired: false, outstanding: 0 };
      const { st, l } = R.loanSt(s, upto);
      const due = r2(sum(Loan.schedule(l).filter(x => x.date >= from && x.date <= upto), x => x.amount));
      const g = got[s.accNo] || { a: 0, p: 0, pr: 0, pen: 0, dates: {} };
      const expired = stO.expired || (l.expDate && l.expDate < from);
      const dueRec = expired ? 0 : Math.min(g.a, stO.asonDue); const regRec = expired ? 0 : Math.min(g.a - dueRec, due);
      return { s, l, st, open: o ? num(o.b) : 0, receivable: Math.min(due, stO.outstanding || st.outstanding + g.a), got: g, due: r2(dueRec), reg: r2(regRec), adv: expired ? 0 : r2(Math.max(0, g.a - dueRec - regRec)), exp: expired ? r2(g.a) : 0, odOpen: stO.asonDue, expired };
    });
    return { rows, mem: close.mem, sm: close.sm, fo: close.fo };
  },
  depBuckets() { const o = {}; BUCKETS.forEach(b => o[b] = 0); return o; },
  info(f, sm, extra = []) { return null; },
});

// ─── কালেকশন শীট (Monthly / Weekly / Daily / 1-15 / 16-31) ───
const COLL_TPL = [['monthly', 'Monthly Collection Sheet'], ['weekly', 'Weekly Collection Sheet'], ['daily', 'Daily Collection Sheet'], ['d1', '1 To 15 Days Collection Sheet'], ['d16', '16 To 31 Days Collection Sheet']];
ReportPage({
  id: 'rptCollSheet', title: 'কালেকশন শীট', landscape: true,
  filters: [F.branch, { ...F.samity, req: 1 }, { ...F.date, l: 'Report Date' }, { k: 'tpl', l: 'Report Name', t: 'select', opts: COLL_TPL }, { k: 'sheet', l: 'Sheet Type', t: 'select', opts: [['blank', 'Blank Sheet'], ['target', 'Target Sheet'], ['data', 'With Data']] }, { k: 'extra', l: 'Extra Row', t: 'number', v: 0 }],
  run: async f => {
    if (!f.samity) fail('সমিতি বাছাই করুন');
    const month = f.date.slice(0, 7), first = month + '-01', last = ymd(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    const c0 = await R.snaps(f, addDays(first, -1)); const c = await R.snaps(f, f.date < last ? f.date : last);
    const openBal = {}; c0.list.forEach(s => openBal[s.accNo] = s);
    const sam = c.sm[f.samity] || {};
    // কলামের তারিখ
    let slots;
    if (f.tpl === 'monthly') slots = R.meetDates(sam, month).map((d, i) => ({ k: d, h: `${['1st', '2nd', '3rd', '4th', '5th'][i] || (i + 1) + 'th'} Week ${fmtD(d)}`, test: x => x === d }));
    else if (f.tpl === 'd1' || f.tpl === 'd16') { const s = f.tpl === 'd1' ? 1 : 16, e = f.tpl === 'd1' ? 15 : Number(last.slice(8)); slots = []; for (let i = s; i <= e; i++) { const d = month + '-' + pad(i, 2); slots.push({ k: d, h: String(i), test: x => x === d }); } }
    else slots = [0, 1, 2, 3].map(i => ({ k: 'w' + i, h: '', test: () => false }));
    if (f.tpl === 'daily') slots = [{ k: f.date, h: fmtD(f.date), test: x => x === f.date }];
    // মাসিক: লেনদেনের তারিখ যে সপ্তাহে পড়ে সেই কলামে
    if (f.tpl === 'monthly') slots.forEach((sl, i) => { const nx = slots[i + 1]; sl.test = x => (i === 0 || x >= sl.k) && (!nx || x < nx.k); });
    const ts = f.sheet === 'data' ? await R.txns(f, first, last) : [];
    const by = {};
    const mrow = m => by[m] = by[m] || { m, gsO: 0, gsI: 0, ssO: 0, ssI: 0, gsC: {}, ssC: {}, gsW: [], ssW: [], loan: null, lc: {}, cycle: 0 };
    Object.entries(c.mem).filter(([, r]) => r[1] === f.samity && r[3] !== 'closed').forEach(([id]) => mrow(id));
    c.list.forEach(s => {
      if ((s.st === 'closed' && !(s.cd >= first)) || !by[s.m] && s.samity !== f.samity) return; const r = mrow(s.m);
      if (s.k === 'loan') {
        r.cycle++; const o = openBal[s.accNo];
        // মাসের শুরুর অবস্থা (মাসে বিতরণ হলে পূর্ণ ঋণ)
        const s0 = o || { ...s, b: num(s.tr), pt: 0, pp: 0, ppr: 0, st: 'active' };
        const { st } = R.loanSt(s0, first); if (!r.loan || s.od > r.loan.s.od) r.loan = { s: s0, st };
      }
      else if (s.k === 'dep' || s.k === 'share') { const g = BUCKET(s.k, s.t) === 'GS' ? 'gs' : 'ss'; r[g + 'O'] += num((openBal[s.accNo] || {}).b); r[g + 'I'] += num(s.ia); }
    });
    ts.forEach(t => {
      const r = by[t.memberId]; if (!r) return;
      if (t.kind === 'loan' && t.dc === 'C') { const sl = slots.find(x => x.test(t.date)); const k = sl ? sl.k : 'other'; r.lc[k] = (r.lc[k] || 0) + num(t.amount); r.lcT = (r.lcT || 0) + num(t.amount); }
      else if (t.kind === 'dep' || t.kind === 'share') { const g = BUCKET(t.kind, t.type) === 'GS' ? 'gs' : 'ss'; if (t.dc === 'C' && t.tt !== 'PROFIT_POST') { const sl = slots.find(x => x.test(t.date)); const k = sl ? sl.k : 'other'; r[g + 'C'][k] = (r[g + 'C'][k] || 0) + num(t.amount); } else if (t.dc === 'D') r[g + 'W'].push(t); }
    });
    const rows = Object.values(by).sort((a, b) => a.m.localeCompare(b.m));
    for (let i = 0; i < (parseInt(f.extra) || 0); i++) rows.push({ blank: 1, gsC: {}, ssC: {}, gsW: [], ssW: [], lc: {} });
    const D = f.sheet === 'data', T = f.sheet !== 'blank', B = r => r.blank;
    const savCols = (g, G) => [
      { g: G, h: 'Opening Balance', f: r => B(r) ? '' : n2(r[g + 'O']), r: 1, sum: 1, v: r => r[g + 'O'] || 0 }, { g: G, h: 'Inst', f: r => B(r) || !T ? '' : n2(r[g + 'I']), r: 1 },
      ...slots.map(sl => ({ g: [G, 'This Month Savings Collection'], h: sl.h || ' ', f: r => D && r[g + 'C'][sl.k] ? n2(r[g + 'C'][sl.k]) : '', r: 1, sum: D, v: r => r[g + 'C'][sl.k] || 0 })),
      { g: [G, 'Withdraw'], h: 'Date', f: r => D ? r[g + 'W'].map(t => fmtD(t.date)).join('<br>') : '' }, { g: [G, 'Withdraw'], h: 'Amount', f: r => D && r[g + 'W'].length ? n2(sum(r[g + 'W'], t => t.amount)) : '', r: 1, sum: D, v: r => sum(r[g + 'W'] || [], t => t.amount) },
    ];
    const LI = 'Loan Information';
    const cols = [SL, { g: 'Member', h: 'Member ID', f: r => r.m || '&nbsp;' }, { g: 'Member', h: 'Member Name', f: r => B(r) ? '' : R.name(c.mem, r.m) }, { g: 'Member', h: 'Father Name', f: r => B(r) ? '' : R.father(c.mem, r.m) }, { g: 'Member', h: 'Mobile No', f: r => B(r) ? '' : R.mobile(c.mem, r.m) },
      ...savCols('gs', 'General Savings'), ...savCols('ss', 'Security Savings'),
      { g: LI, h: 'Disb. Date', f: r => r.loan ? fmtD(r.loan.s.od) : '' }, { g: LI, h: 'Amount', f: r => r.loan ? n2(r.loan.s.pr) : '', r: 1, sum: 1, v: r => r.loan ? r.loan.s.pr : 0 }, { g: LI, h: 'Cycle', f: r => r.loan ? r.cycle : '', r: 1 },
      { g: LI, h: 'Inst Paid', f: r => r.loan ? r.loan.st.paidCnt : '', r: 1 }, { g: LI, h: 'Opening Outst', f: r => r.loan ? n2(r.loan.st.outstanding) : '', r: 1, sum: 1, v: r => r.loan ? r.loan.st.outstanding : 0 },
      { g: LI, h: 'Overdue', f: r => r.loan ? n2(r.loan.st.overdue) : '', r: 1, sum: 1, v: r => r.loan ? r.loan.st.overdue : 0 }, { g: LI, h: 'Inst', f: r => r.loan && T ? n2(r.loan.s.ia) : '', r: 1, sum: T, v: r => r.loan ? r.loan.s.ia : 0 },
      ...slots.map(sl => ({ g: [LI, 'This Month Loan Collection'], h: sl.h || ' ', f: r => D && r.lc[sl.k] ? n2(r.lc[sl.k]) : '', r: 1, sum: D, v: r => r.lc[sl.k] || 0 })),
      { g: LI, h: 'Closing Outst', f: r => r.loan && D ? n2(r.loan.st.outstanding - (r.lcT || 0)) : '', r: 1, sum: D, v: r => r.loan ? r.loan.st.outstanding - (r.lcT || 0) : 0 }];
    const en = await R.empName();
    return {
      title: (COLL_TPL.find(x => x[0] === f.tpl) || COLL_TPL[0])[1], addr: true, landscape: true,
      info: [['Branch Name', esc((await Data.branch(f.branch) || {}).name || '')], ['Samity Name', esc(f.samity.slice(-4) + ' ' + (sam.name || ''))], ['Samity Day', esc(sam.day || '')], ['Samity Time', esc(sam.startTime || '')], ['Samity Opening Date', fmtD(sam.openDate)], ['Report Month', MONTHS[Number(month.slice(5, 7)) - 1]], ['Report Date', fmtD(f.date)], ['Field Officer Name', esc((en(sam.foId) || '').replace(/^\d+ - /, ''))], ['Samity Location', esc(sam.address || 'NA')]],
      sub: `সমিতি: ${f.samity} - ${esc(sam.name || '')} | ${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, html: UI.table(cols, rows, { cls: 'sheet' }),
    };
  },
});

// ─── সঞ্চয় কালেকশন শীট (১ দিনের) — Deposit Collection Sheet ───
ReportPage({
  id: 'rptDepCollSheet', title: 'সঞ্চয় কালেকশন শীট (১ দিনের)', landscape: false,
  filters: [F.branch, F.samity, { ...F.date, l: 'Report Date' }, R.SHEET],
  run: async f => {
    const c = await R.snaps(f, f.date);
    const got = {}; (await R.txns(f, f.date, f.date)).filter(t => (t.kind === 'dep' || t.kind === 'share') && t.tt !== 'PROFIT_POST').forEach(t => { got[t.accNo] = got[t.accNo] || { c: 0, d: 0 }; got[t.accNo][t.dc === 'C' ? 'c' : 'd'] += num(t.amount); });
    const rows = c.list.filter(s => (s.k === 'dep' || s.k === 'share') && (s.st !== 'closed' || got[s.accNo])).map(s => { const g = got[s.accNo] || { c: 0, d: 0 }; return { ...s, open: r2(num(s.b) - g.c + g.d), rc: g.c, py: g.d }; }).sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    const D = f.sheet === 'data';
    return { title: 'Deposit Collection Sheet', html: UI.table([SL, { h: 'ID', f: s => s.m }, { h: 'Name', f: s => R.name(c.mem, s.m) }, { h: 'Phone', f: s => R.mobile(c.mem, s.m) }, { h: 'AC Type', f: s => typeName(s.k, s.t) }, { h: 'Installment', f: s => f.sheet === 'blank' ? '' : n2(s.ia), r: 1, sum: 1, v: s => s.ia }, { h: 'Opening', f: s => n2(s.open), r: 1, sum: 1, v: s => s.open }, { h: 'Receive', f: s => D ? n2(s.rc) : '', r: 1, sum: 1, v: s => D ? s.rc : 0 }, { h: 'Payment', f: s => D ? n2(s.py) : '', r: 1, sum: 1, v: s => D ? s.py : 0 }, { h: 'Total Balance', f: s => D ? n2(s.b) : '', r: 1, sum: 1, v: s => D ? s.b : 0 }], rows) };
  },
});

// ─── লোন কালেকশন শীট (১ দিনের) ───
async function loanDayRows(f) {
  const c = await R.snaps(f, f.date);
  const got = {}; (await R.txns(f, f.date, f.date)).filter(t => t.kind === 'loan' && t.dc === 'C').forEach(t => { const g = got[t.accNo] = got[t.accNo] || { a: 0, p: 0, pr: 0, pen: 0 }; g.a += num(t.amount); g.p += num(t.principal); g.pr += num(t.profit); g.pen += num(t.penalty); });
  const before = s => { const g = got[s.accNo]; if (!g) return s; return { ...s, b: r2(num(s.b) + g.a), pt: r2(num(s.pt) - g.a), pp: r2(num(s.pp) - g.p), ppr: r2(num(s.ppr) - g.pr), st: 'active' }; };
  const rows = c.list.filter(s => s.k === 'loan' && (s.st !== 'closed' || got[s.accNo])).map(s => { const sb = before(s); const { st, l } = R.loanSt(sb, f.date); const g = got[s.accNo] || { a: 0, p: 0, pr: 0, pen: 0 }; const odR = Math.min(g.a, st.overdue), regR = Math.min(g.a - odR, st.todayInst); return { s: sb, l, st, g, odR, regR, advR: r2(Math.max(0, g.a - odR - regR)) }; }).sort((a, b) => a.s.samity.localeCompare(b.s.samity) || a.s.accNo.localeCompare(b.s.accNo));
  return { rows, c };
}
ReportPage({
  id: 'rptLoanCollSheet', title: 'লোন কালেকশন শীট (১ দিনের)', landscape: true,
  filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Report Date' }, R.SHEET],
  run: async f => {
    const { rows, c } = await loanDayRows(f); const D = f.sheet === 'data', T = f.sheet !== 'blank';
    return { title: 'Loan Collection Sheet', html: UI.table([SL, { h: 'Member ID', f: x => x.s.m }, { h: 'Member Name', f: x => R.name(c.mem, x.s.m) }, { h: 'Phone', f: x => R.mobile(c.mem, x.s.m) }, { h: 'Loan ID', f: x => x.s.accNo }, { h: 'Open Date', f: x => fmtD(x.s.od) }, { h: 'Expiry Date', f: x => fmtD(x.s.ed) },
      { h: 'Disbursed', f: x => n2(x.s.pr), r: 1, sum: 1, v: x => x.s.pr }, { h: 'Installment', f: x => n2(x.s.ia), r: 1, sum: 1, v: x => x.s.ia }, { h: 'Opening', f: x => n2(x.st.outstanding), r: 1, sum: 1, v: x => x.st.outstanding },
      { h: 'OD', f: x => T && x.st.overdue ? n2(x.st.overdue) : '', r: 1, sum: 1, v: x => T ? x.st.overdue : 0 }, { h: 'Due', f: x => T && x.st.todayInst ? n2(Math.min(x.st.outstanding, x.st.todayInst)) : '', r: 1, sum: 1, v: x => T ? Math.min(x.st.outstanding, x.st.todayInst) : 0 },
      { h: 'Receive', f: x => D && x.g.a ? n2(x.g.a) : '', r: 1, sum: 1, v: x => D ? x.g.a : 0 }, { h: 'Total Receive', f: x => D ? n2(num(x.s.pt) + x.g.a) : '', r: 1, sum: 1, v: x => D ? num(x.s.pt) + x.g.a : 0 }, { h: 'Closing Balance', f: x => n2(x.st.outstanding - (D ? x.g.a : 0)), r: 1, sum: 1, v: x => x.st.outstanding - (D ? x.g.a : 0) }], rows) };
  },
});
ReportPage({
  id: 'rptLoanCollSheet2', title: 'Loan Collection Sheet Two', landscape: true,
  filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Report Date' }, R.SHEET],
  run: async f => {
    const { rows, c } = await loanDayRows(f); const D = f.sheet === 'data'; const en = await R.empName(); const mm = {}; for (const b of [f.branch]) Object.assign(mm, await Data.memberIdx(b));
    const M = 'Member', I = 'Installment Information', RC = 'Recovery';
    return { title: 'Installment Collection Sheet', html: UI.table([{ h: 'SL', sl: 1 }, { g: M, h: 'অফিসার', f: x => esc((en(c.fo(x.s.samity)) || '').replace(/^\d+ - /, '')) }, { g: M, h: 'সদস্য নং', f: x => x.s.m }, { g: M, h: 'গ্রাহকের নাম', f: x => R.name(c.mem, x.s.m) }, { g: M, h: 'মোবাইল', f: x => R.mobile(c.mem, x.s.m) }, { g: M, h: 'ঠিকানা', f: x => esc((c.sm[x.s.samity] || {}).address || '') },
      { g: I, h: 'পন্য', f: x => esc(typeName('loan', x.s.t)) }, { g: I, h: 'বিতরণ তারিখ', f: x => fmtD(x.s.od) }, { g: I, h: 'কিস্তির সংখ্যা', f: x => x.st.sch.length, r: 1 }, { g: I, h: 'কিস্তি মুল্য', f: x => n2(x.s.tr), r: 1, sum: 1, v: x => x.s.tr }, { g: I, h: 'পরিশোধিত টাকা', f: x => n2(x.s.pt), r: 1, sum: 1, v: x => x.s.pt }, { g: I, h: 'স্থিতি', f: x => n2(x.st.outstanding), r: 1, sum: 1, v: x => x.st.outstanding }, { g: I, h: 'বকেয়া', f: x => n2(x.st.overdue), r: 1, sum: 1, v: x => x.st.overdue },
      { g: [RC, 'নিয়মিত আদায়'], h: 'কিস্তির পরিমান', f: x => n2(x.s.ia), r: 1 }, { g: [RC, 'নিয়মিত আদায়'], h: 'টাকা', f: x => D && x.regR ? n2(x.regR) : '', r: 1, sum: D, v: x => x.regR },
      { g: [RC, 'বকেয়া আদায়'], h: 'কোড', f: () => '' }, { g: [RC, 'বকেয়া আদায়'], h: 'নাম', f: () => '' }, { g: [RC, 'বকেয়া আদায়'], h: 'ঠিকানা', f: () => '' }, { g: [RC, 'বকেয়া আদায়'], h: 'টাকা', f: x => D && x.odR ? n2(x.odR) : '', r: 1, sum: D, v: x => x.odR },
      { g: [RC, 'অগ্রিম আদায়'], h: 'কোড', f: () => '' }, { g: [RC, 'অগ্রিম আদায়'], h: 'নাম', f: () => '' }, { g: [RC, 'অগ্রিম আদায়'], h: 'ঠিকানা', f: () => '' }, { g: [RC, 'অগ্রিম আদায়'], h: 'টাকা', f: x => D && x.advR ? n2(x.advR) : '', r: 1, sum: D, v: x => x.advR }], rows) };
  },
});

// ─── কালেকশন বিস্তারিত (Collection Details Report) — সমিতিভিত্তিক ───
const TT_EN = { EMI_RCV: 'Installment Receive', EMI_MANUAL: 'Installment Receive', EMI_SHEET: 'Installment Receive', EMI_TRF: 'Installment Transfer', DEP_RCV: 'Deposit Receive', DPS_RCV: 'Deposit Receive', SAV_RCV: 'Deposit Receive', DEP_PAY: 'Deposit Payment', SHARE_RCV: 'Share Receive', SHARE_PAY: 'Share Payment', DEP_TRF_IN: 'Transfer Receive', DEP_TRF_OUT: 'Transfer Payment', DEP_CLOSE: 'Deposit Closing', PROFIT_PAY: 'Profit Payment', LOAN_DISB: 'Loan Disbursement', PASSBOOK_FEE: 'Passbook Fee', ADMISSION_FEE: 'Admission Fee', STAFF_EMI_RCV: 'Installment Receive' };
const ttEn = t => TT_EN[t.tt] || (t.kind === 'loan' ? (t.dc === 'C' ? 'Installment Receive' : 'Loan Disbursement') : t.dc === 'C' ? 'Deposit Receive' : 'Deposit Payment');
const FEE_SUM_LABELS = [['admission', 'Admission Fee'], ['passbook', 'Passbook Fee'], ['closing', 'Closing Fee'], ['down', 'Loan Down Payment'], ['penalty', 'Loan Penalty Charge'], ['form', 'Loan Form Fee'], ['insurance', 'Loan Application Fee'], ['document', 'Document Fee']];
function collDetailsBlock(ts, fees, mem, sm, en, samCode) {
  const rc = sum(ts, t => t.dc === 'C' ? num(t.amount) + num(t.penalty) : 0) + sum(fees, x => x.amount), py = sum(ts, t => t.dc === 'D' ? num(t.amount) : 0);
  const fk = k => sum(fees.filter(x => x.k === k), x => x.amount) + (k === 'penalty' ? sum(ts, t => num(t.penalty)) : 0);
  const sam = sm[samCode] || {};
  const info = `<div class="ig"><p><b>Somity Name : </b>${esc((samCode || '').slice(-4) + '-' + (sam.name || ''))}</p><p><b>Field Officer Name : </b>${esc((en(sam.foId) || '').replace(/^\d+ - /, ''))}</p><p></p>`
    + [['Total Receive', rc], ['Total Payment', py], ['Loan Receive', sum(ts, t => t.kind === 'loan' && t.dc === 'C' ? num(t.amount) : 0)], ['Deposit Receive', sum(ts, t => t.kind !== 'loan' && t.dc === 'C' ? num(t.amount) : 0)], ['Deposit Payment', sum(ts, t => t.kind !== 'loan' && t.dc === 'D' ? num(t.amount) : 0)], ...FEE_SUM_LABELS.map(([k, l]) => [l, fk(k)])].map(([l, v]) => `<p><b>${l} : </b>${amt(v)}</p>`).join('') + '</div>';
  const rows = ts.slice().sort((a, b) => (a.date + a.memberId).localeCompare(b.date + b.memberId));
  return info + UI.table([SL, { h: 'Customer Name', f: t => (t.memberId || '') + ' - ' + R.name(mem, t.memberId) }, { h: 'Transaction Type', f: t => ttEn(t) }, { h: 'Date', f: t => fmtD(t.date) }, { h: 'Transaction Details', f: t => esc((TT_NAME[t.tt] || t.tt) + ' ' + (t.memberId || '') + ' ' + (t.accNo || '')) }, { h: 'Posting Time', f: t => tsStr(t.on) }, { h: 'Receive', f: t => t.dc === 'C' ? amt(num(t.amount) + num(t.penalty)) : '0', r: 1, sum: 1, v: t => t.dc === 'C' ? num(t.amount) + num(t.penalty) : 0 }, { h: 'Payment', f: t => t.dc === 'D' ? amt(t.amount) : '0', r: 1, sum: 1, v: t => t.dc === 'D' ? t.amount : 0 }, { h: 'User ID', f: t => esc(t.byName || '') }], rows);
}
const collFilters = (extra = []) => [F.branch, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, ...extra, USER_F];
ReportPage({
  id: 'rptCollDetails', title: 'কালেকশন বিস্তারিত রিপোর্ট', landscape: true, filters: collFilters([TRF_F]), init: R.userOpts,
  run: async f => {
    const mem = await Data.memberIdx(f.branch); const sm = await R.sams(f.branch); const en = await R.empName();
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => ['depRcv', 'depPay', 'loanRcv'].includes(R.cls(t)) && (f.trf !== 'no' || !R.isTrf(t)));
    const fees = await R.fees(f, f.from, f.upto);
    const g = groupBy(ts, t => t.samity || '—'); const fg = groupBy(fees, x => x.samity || '—');
    const keys = [...new Set([...Object.keys(g), ...Object.keys(fg)])].sort();
    return { title: 'Collection Details Report', html: keys.map(k => collDetailsBlock(g[k] || [], fg[k] || [], mem, sm, en, k)).join('<br>') || '<div class="mini">কোনো লেনদেন নেই</div>' };
  },
});

// ─── কালেকশন সামারী (Collection Summary Report) — সদস্যভিত্তিক ───
ReportPage({
  id: 'rptCollSummary', title: 'কালেকশন সামারী রিপোর্ট', landscape: true, filters: collFilters(), init: R.userOpts,
  run: async f => {
    const c = await R.snaps(f, f.upto); const en = await R.empName();
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => !R.isTrf(t) && ['depRcv', 'depPay', 'loanRcv'].includes(R.cls(t)));
    const fees = await R.fees(f, f.from, f.upto);
    const by = {}; const row = m => by[m] = by[m] || { m, dr: 0, dp: 0, inst: 0, pen: 0, fee: {} };
    ts.forEach(t => { const r = row(t.memberId); const cl = R.cls(t); if (cl === 'depRcv') r.dr += num(t.amount); if (cl === 'depPay') r.dp += num(t.amount); if (cl === 'loanRcv') { r.inst += num(t.amount); r.pen += num(t.penalty); } });
    fees.forEach(x => { const r = row(x.memberId); r.fee[x.k] = (r.fee[x.k] || 0) + x.amount; });
    const rows = Object.values(by).filter(r => r.m).map(r => ({ ...r, feeT: sum(Object.values(r.fee)), rc: r.dr + r.inst + r.pen + sum(Object.values(r.fee)), samity: (c.mem[r.m] || [])[1] || '' })).sort((a, b) => a.samity.localeCompare(b.samity) || a.m.localeCompare(b.m));
    const fe = k => ({ g: 'Fee & Charges', h: { admission: 'Admission', passbook: 'Passbook', closing: 'Closing', form: 'Form', insurance: 'Insurance', document: 'Document', cheque: 'Cheque Fee' }[k], f: r => n2(r.fee[k]), r: 1, sum: 1, v: r => r.fee[k] || 0 });
    return { title: 'Collection Summary Report', html: UI.table([SL, { h: 'Member Details', f: r => r.m + ' - ' + R.name(c.mem, r.m) }, { h: 'Samity Details', f: r => esc(r.samity.slice(-4) + '-' + ((c.sm[r.samity] || {}).name || '')) }, { h: 'Field Officer', f: r => esc((en(c.fo(r.samity)) || '').replace(/^\d+ - /, '')) },
      { g: 'Total', h: 'Receive', f: r => n2(r.rc), r: 1, sum: 1, v: r => r.rc }, { g: 'Total', h: 'Payment', f: r => n2(r.dp), r: 1, sum: 1, v: r => r.dp },
      { g: 'Deposit', h: 'Receive', f: r => n2(r.dr), r: 1, sum: 1, v: r => r.dr }, { g: 'Deposit', h: 'Payment', f: r => n2(r.dp), r: 1, sum: 1, v: r => r.dp }, { g: 'Deposit', h: 'Balance', f: r => n2(r.dr - r.dp), r: 1, sum: 1, v: r => r.dr - r.dp },
      { g: 'Investment', h: 'Installment', f: r => n2(r.inst), r: 1, sum: 1, v: r => r.inst }, { g: 'Investment', h: 'Down Payment', f: () => n2(0), r: 1, sum: 1, v: () => 0 }, { g: 'Investment', h: 'Penalty', f: r => n2(r.pen), r: 1, sum: 1, v: r => r.pen }, { g: 'Investment', h: 'Total', f: r => n2(r.inst + r.pen), r: 1, sum: 1, v: r => r.inst + r.pen },
      ...['admission', 'passbook', 'closing', 'form', 'insurance', 'document', 'cheque'].map(fe)], rows) };
  },
});

// ─── সঞ্চয় ও ঋণ আদায় সামারি (Deposit & Investment Collection Summary) ───
async function depInvRows(f, grpDefault) {
  const grp = f.grp || grpDefault; const bs = await R.branchesFor(f);
  const ts = (await R.txns({ ...f, branch: bs[0] }, f.from, f.upto, bs)).filter(t => !R.isTrf(t) && ['depRcv', 'depPay', 'loanRcv', 'disb'].includes(R.cls(t)));
  const sm = {}; for (const b of bs) Object.assign(sm, await R.sams(b));
  const by = {};
  ts.forEach(t => {
    const k = R.gkey(grp, t, (sm[t.samity] || {}).foId) || '—';
    const r = by[k] = by[k] || { k, rc: R.depBuckets(), py: R.depBuckets(), inst: 0, down: 0, pen: 0, disb: 0, cInst: 0, cDown: 0, cPen: 0 };
    const cl = R.cls(t);
    if (cl === 'depRcv') r.rc[BUCKET(t.kind, t.type)] += num(t.amount);
    if (cl === 'depPay') r.py[BUCKET(t.kind, t.type)] += num(t.amount);
    if (cl === 'loanRcv') { r.inst += num(t.amount); r.pen += num(t.penalty); }
    if (cl === 'disb') r.disb += num(t.amount);
  });
  const rows = Object.values(by).map(r => ({ ...r, rcT: sum(BUCKETS, b => r.rc[b]), pyT: sum(BUCKETS, b => r.py[b]) })).map(r => ({ ...r, totRc: r.rcT + r.inst + r.pen, totPy: r.pyT })).sort((a, b) => String(a.k).localeCompare(String(b.k)));
  return { rows, lab: await R.glabel(grp, bs), grp };
}
const depCols = (key, G) => [...['GS', 'SS', 'DPS', 'FDR', 'Share'].map(b => ({ g: G, h: b, f: r => n2(r[key][b]), r: 1, sum: 1, v: r => r[key][b] })), { g: G, h: 'Total', f: r => n2(key === 'rc' ? r.rcT : r.pyT), r: 1, sum: 1, v: r => key === 'rc' ? r.rcT : r.pyT }];
ReportPage({
  id: 'rptCollSumDepInv', title: 'সঞ্চয় ও ঋণ আদায় সামারি', landscape: true, filters: [F.branch, F.btype, F.samity, F.employee, F.member, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, USER_F, R.GROUP], init: R.userOpts,
  run: async f => {
    const { rows, lab, grp } = await depInvRows(f, 'member');
    return { title: 'Deposit & Investment Collection Summary', html: UI.table([SL, { g: grp === 'member' ? 'Member Details' : 'Details', h: 'Code', f: r => esc(String(r.k)) }, { g: grp === 'member' ? 'Member Details' : 'Details', h: 'Name', f: r => r.k === '—' ? '—' : lab(r.k).replace(/^[^-]+- /, '') },
      { g: 'Total', h: 'Receive', f: r => n2(r.totRc), r: 1, sum: 1, v: r => r.totRc }, { g: 'Total', h: 'Payment', f: r => n2(r.totPy), r: 1, sum: 1, v: r => r.totPy },
      ...depCols('rc', ['Deposit', 'Receive']), ...depCols('py', ['Deposit', 'Payment']),
      { g: ['Investment', 'Term Investment'], h: 'Inst', f: r => n2(r.inst), r: 1, sum: 1, v: r => r.inst }, { g: ['Investment', 'Term Investment'], h: 'Down', f: r => n2(r.down), r: 1, sum: 1, v: r => r.down }, { g: ['Investment', 'Term Investment'], h: 'Penal', f: r => n2(r.pen), r: 1, sum: 1, v: r => r.pen },
      { g: ['Investment', 'Continuous Investment'], h: 'Inst', f: r => n2(r.cInst), r: 1, sum: 1, v: r => r.cInst }, { g: ['Investment', 'Continuous Investment'], h: 'Down', f: r => n2(r.cDown), r: 1, sum: 1, v: r => r.cDown }, { g: ['Investment', 'Continuous Investment'], h: 'Penal', f: r => n2(r.cPen), r: 1, sum: 1, v: r => r.cPen }], rows) };
  },
});

// ─── DCR — Samity Wise Collection Summary (ফিল্ড অফিসার রিপোর্টেও ব্যবহৃত) ───
async function dcrRows(f, grp) {
  const rec = await R.recovery(f, f.from, f.upto);
  const ts = (await R.txns(f, f.from, f.upto)).filter(t => !R.isTrf(t));
  const fees = await R.fees(f, f.from, f.upto);
  const key = (samity, mid, fo) => grp === 'center' ? samity : grp === 'employee' ? (fo || rec.fo(samity) || '—') : grp === 'branch' ? f.branch : mid;
  const by = {}; const row = k => by[k] = by[k] || { k, cashR: 0, cashP: 0, disb: 0, recv: 0, tot: 0, reg: 0, due: 0, adv: 0, exp: 0, profit: 0, chg: 0, rc: R.depBuckets(), py: R.depBuckets(), fee: {} };
  rec.rows.forEach(x => { const r = row(key(x.s.samity, x.s.m)); r.recv += x.receivable; r.tot += x.got.a; r.reg += x.reg; r.due += x.due; r.adv += x.adv; r.exp += x.exp; r.profit += x.got.pr; r.chg += x.got.pen; });
  ts.forEach(t => { const r = row(key(t.samity, t.memberId, t.foId)); const cl = R.cls(t); if (cl === 'disb') r.disb += num(t.amount); if (cl === 'depRcv') r.rc[BUCKET(t.kind, t.type)] += num(t.amount); if (cl === 'depPay') r.py[BUCKET(t.kind, t.type)] += num(t.amount); });
  fees.forEach(x => { const r = row(key(x.samity, x.memberId, x.foId)); r.fee[x.k] = (r.fee[x.k] || 0) + x.amount; });
  return { rows: Object.values(by).map(r => ({ ...r, cashR: r.tot + r.chg + sum(BUCKETS, b => r.rc[b]) + sum(Object.values(r.fee)), cashP: sum(BUCKETS, b => r.py[b]) + r.disb, pct: r.recv ? r2((r.reg) / r.recv * 100) : 0, todayDue: Math.max(0, r2(r.recv - r.reg)) })).sort((a, b) => String(a.k).localeCompare(String(b.k))), rec };
}
function dcrCols(lab, firstH) {
  const L = 'ঋণ আদায়';
  return [SL, { h: firstH, f: r => r.k === '—' ? '—' : lab(r.k) }, { g: 'মোট নগদ', h: 'আদায়', f: r => n2(r.cashR), r: 1, sum: 1, v: r => r.cashR }, { g: 'মোট নগদ', h: 'ফেরত', f: r => n2(r.cashP), r: 1, sum: 1, v: r => r.cashP }, { h: 'Disb', f: r => n2(r.disb), r: 1, sum: 1, v: r => r.disb },
    { g: L, h: 'Todays Receivable', f: r => n2(r.recv), r: 1, sum: 1, v: r => r.recv }, { g: L, h: 'Todays Total Recover', f: r => n2(r.tot), r: 1, sum: 1, v: r => r.tot }, { g: L, h: 'আজকের আদায়', f: r => n2(r.reg), r: 1, sum: 1, v: r => r.reg }, { g: L, h: 'আদায়ের শতকরা হার', f: r => r.pct.toFixed(2), r: 1 }, { g: L, h: 'আজকের বকেয়া', f: r => n2(r.todayDue), r: 1, sum: 1, v: r => r.todayDue },
    { g: L, h: 'ডাউন পেমেন্ট', f: () => n2(0), r: 1 }, { g: L, h: 'Due Recover', f: r => n2(r.due + r.exp), r: 1, sum: 1, v: r => r.due + r.exp }, { g: L, h: 'অগ্রীম আদায়', f: r => n2(r.adv), r: 1, sum: 1, v: r => r.adv }, { g: L, h: 'লাভ আদায়', f: r => n2(r.profit), r: 1, sum: 1, v: r => r.profit }, { g: L, h: 'চার্জ', f: r => n2(r.chg), r: 1, sum: 1, v: r => r.chg },
    ...[['GS', 'GS'], ['SS', 'SS'], ['FDR', 'FDR'], ['DPS', 'ডি পি এস আদায়']].map(([b, h]) => ({ g: 'সঞ্চয় আদায়', h, f: r => n2(r.rc[b]), r: 1, sum: 1, v: r => r.rc[b] })),
    ...[['GS', 'GS'], ['SS', 'SS'], ['FDR', 'FDR'], ['DPS', 'ডি পি এস ফেরত']].map(([b, h]) => ({ g: 'সঞ্চয় ফেরত', h, f: r => n2(r.py[b]), r: 1, sum: 1, v: r => r.py[b] })),
    { g: 'শেয়ার', h: 'আদায়', f: r => n2(r.rc.Share), r: 1, sum: 1, v: r => r.rc.Share }, { g: 'শেয়ার', h: 'ফেরত', f: r => n2(r.py.Share), r: 1, sum: 1, v: r => r.py.Share },
    ...[['form', 'ফরম ফি'], ['admission', 'ভর্তি'], ['passbook', 'পাসবুক'], ['insurance', 'বীমা ফি'], ['document', 'ডকুমেন্ট'], ['closing', 'বন্ধ ফি']].map(([k, h]) => ({ g: 'ফি আদায়', h, f: r => n2(r.fee[k]), r: 1, sum: 1, v: r => r.fee[k] || 0 })),
    { g: 'সাইন', h: 'বি এম', f: () => '' }];
}
ReportPage({
  id: 'rptDCR', title: '(ডি সি আর) রিপোর্ট', landscape: true, filters: [F.branch, F.btype, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => { const { rows } = await dcrRows(f, 'center'); const lab = await R.glabel('center', [f.branch]); return { title: 'Samity Wise Collection Summary', html: UI.table(dcrCols(k => lab(k).replace(/^\d{3}(\d{4}) - /, '$1-'), 'সমিতির নাম').concat([]).map(c => c), rows) }; },
});
ReportPage({
  id: 'rptFieldOfficer', title: 'ফিল্ড অফিসার রিপোর্ট', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, F.samity, F.employee, { ...R.GROUP, opts: [['employee', 'Employee'], ['center', 'Center'], ['member', 'Member'], ['branch', 'Branch']] }],
  run: async f => { const grp = f.grp || 'employee'; const { rows } = await dcrRows(f, grp); const lab = await R.glabel(grp, [f.branch]); return { title: 'Field Officer Collection Summary', html: UI.table(dcrCols(lab, { employee: 'ফিল্ড অফিসার', center: 'সমিতির নাম', member: 'সদস্য', branch: 'শাখা' }[grp]), rows) }; },
});

// ─── ঋণ কালেকশন বিবরণ (Loan Collection Details) ───
ReportPage({
  id: 'rptEmiCollect', title: 'ঋণ কালেকশন বিবরণ', landscape: true,
  filters: [F.branch, F.samity, F.employee, { ...F.date, l: 'Collection Date', req: 1 }, { k: 'rt', l: 'Reporting Type', t: 'select', opts: [['inst', 'Todays Installment'], ['od', 'Todays Overdue'], ['adv', 'Todays Advance'], ['center', 'Todays Center'], ['coll', 'Todays All Collection'], ['tod', 'Total Overdue'], ['tadv', 'Total Advance'], ['exp', 'All Expire'], ['all', 'All']] }],
  run: async f => {
    const { rows: all, c } = await loanDayRows(f); const en = await R.empName(); const day = WEEKDAYS[parseD(f.date).getDay()];
    const pick = { inst: x => x.st.todayInst > 0, od: x => x.odR > 0, adv: x => x.advR > 0, center: x => (c.sm[x.s.samity] || {}).day === day, coll: x => x.g.a > 0, tod: x => x.st.overdue > 0, tadv: x => x.st.advance > 0, exp: x => x.st.expired, all: () => true }[f.rt] || (() => true);
    const rows = all.filter(pick);
    const TD = 'This Date', TO = 'Total';
    return { title: 'Loan Collection Details', html: UI.table([SL, { h: 'Member Name', f: x => x.s.m + '-' + R.name(c.mem, x.s.m) }, { h: 'Phone Number', f: x => R.mobile(c.mem, x.s.m) }, { h: 'Samity Name', f: x => esc(x.s.samity.slice(-4) + '-' + ((c.sm[x.s.samity] || {}).name || '')) }, { h: 'Filed Officer', f: x => esc((en(c.fo(x.s.samity)) || '').replace(/^\d+ - /, '')) }, { h: 'Inst Start Date', f: x => fmtD(x.s.fd) }, { h: 'Inst NO', f: x => x.st.sch.length, r: 1 }, { h: 'Inst Freq', f: x => ({ D: 'Daily', W: 'Weekly', M: 'Monthly', F: 'Fortnightly', Q: 'Quarterly', H: 'Half Yearly', Y: 'Yearly', S: 'Single' })[x.s.fq] || x.s.fq }, { h: 'Inst Payment', f: x => `${x.st.dueCnt} / ${x.st.paidCnt}` }, { h: 'Loan Amount', f: x => n2(x.s.tr), r: 1, sum: 1, v: x => x.s.tr }, { h: 'Inst Amount', f: x => n2(x.s.ia), r: 1, sum: 1, v: x => x.s.ia },
      { g: TD, h: 'Receivable', f: x => n2(Math.min(x.st.outstanding, x.st.todayInst)), r: 1, sum: 1, v: x => Math.min(x.st.outstanding, x.st.todayInst) }, { g: TD, h: 'Receive', f: x => n2(x.regR + x.advR), r: 1, sum: 1, v: x => x.regR + x.advR }, { g: TD, h: 'Overdue', f: x => n2(Math.max(0, Math.min(x.st.outstanding, x.st.todayInst) - x.regR)), r: 1, sum: 1, v: x => Math.max(0, Math.min(x.st.outstanding, x.st.todayInst) - x.regR) }, { g: TD, h: 'Advance', f: x => n2(x.advR), r: 1, sum: 1, v: x => x.advR },
      { g: TO, h: 'Receivable', f: x => n2(x.st.cumDue), r: 1, sum: 1, v: x => x.st.cumDue }, { g: TO, h: 'Receive', f: x => n2(num(x.s.pt) + x.g.a), r: 1, sum: 1, v: x => num(x.s.pt) + x.g.a }, { g: TO, h: 'Overdue', f: x => n2(Math.max(0, x.st.cumDue - num(x.s.pt) - x.g.a)), r: 1, sum: 1, v: x => Math.max(0, x.st.cumDue - num(x.s.pt) - x.g.a) }, { g: TO, h: 'Advance', f: x => n2(Math.max(0, num(x.s.pt) + x.g.a - x.st.cumDue)), r: 1, sum: 1, v: x => Math.max(0, num(x.s.pt) + x.g.a - x.st.cumDue) }], rows) };
  },
});

// ─── লক্ষ্য বনাম অর্জন (Installment Target VS Achievement) — সদস্যভিত্তিক ───
ReportPage({
  id: 'rptTarget', title: 'লক্ষ্য বনাম অর্জন', landscape: true,
  filters: [F.branch, F.samity, F.employee, F.member, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const { rows: loans, c } = await loanDayRows(f);
    const dep = {}; (await R.txns(f, f.date, f.date)).filter(t => (t.kind === 'dep' || t.kind === 'share') && t.dc === 'C' && !R.isTrf(t)).forEach(t => dep[t.memberId] = (dep[t.memberId] || 0) + num(t.amount));
    const day = WEEKDAYS[parseD(f.date).getDay()];
    const by = {}; const row = m => by[m] = by[m] || { m, dDue: 0, dCol: 0, lDue: 0, lCol: 0 };
    c.list.filter(s => (s.k === 'dep' || s.k === 'share') && s.st !== 'closed' && num(s.ia) && (s.fq === 'D' || !(c.sm[s.samity] || {}).day || (c.sm[s.samity] || {}).day === day)).forEach(s => row(s.m).dDue += num(s.ia));
    Object.entries(dep).forEach(([m, v]) => row(m).dCol += v);
    loans.forEach(x => { const due = Math.min(x.st.outstanding, x.st.todayInst); if (!due && !x.g.a) return; const r = row(x.s.m); r.lDue += due; r.lCol += Math.min(due, x.regR + x.advR); });
    const rows = Object.values(by).sort((a, b) => a.m.localeCompare(b.m)); const pc = (a, b) => b ? (a / b * 100).toFixed(2) : '0.00';
    return { title: 'Installment Target VS Achievement', html: UI.table([SL, { g: 'Member', h: 'ID', f: r => r.m }, { g: 'Member', h: 'Name', f: r => R.name(c.mem, r.m) }, { g: 'Member', h: 'Phone Number', f: r => R.mobile(c.mem, r.m) },
      { g: 'Deposit', h: 'Due', f: r => n2(r.dDue), r: 1, sum: 1, v: r => r.dDue }, { g: 'Deposit', h: 'Collection', f: r => n2(r.dCol), r: 1, sum: 1, v: r => r.dCol }, { g: 'Deposit', h: 'Overdue', f: r => n2(Math.max(0, r.dDue - r.dCol)), r: 1, sum: 1, v: r => Math.max(0, r.dDue - r.dCol) }, { g: 'Deposit', h: 'Coll. Pct.', f: r => pc(r.dCol, r.dDue), r: 1 },
      { g: 'Loan', h: 'Due', f: r => n2(r.lDue), r: 1, sum: 1, v: r => r.lDue }, { g: 'Loan', h: 'Collection', f: r => n2(r.lCol), r: 1, sum: 1, v: r => r.lCol }, { g: 'Loan', h: 'Overdue', f: r => n2(Math.max(0, r.lDue - r.lCol)), r: 1, sum: 1, v: r => Math.max(0, r.lDue - r.lCol) }, { g: 'Loan', h: 'Coll. Pct.', f: r => pc(r.lCol, r.lDue), r: 1 }], rows) };
  },
});

// ─── কালেকশন টপশিট (Date Wise Collection Topsheet) ───
ReportPage({
  id: 'rptTopsheet', title: 'কালেকশন টপশিট', landscape: true, filters: collFilters(), init: R.userOpts,
  run: async f => {
    const ts = (await R.txns(f, f.from, f.upto)).filter(t => !R.isTrf(t));
    const fees = await R.fees(f, f.from, f.upto);
    const by = {}; const row = d => by[d] = by[d] || { d, rc: R.depBuckets(), py: R.depBuckets(), fee: 0, lr: 0, lp: 0 };
    ts.forEach(t => { const r = row(t.date); const cl = R.cls(t); if (cl === 'depRcv') r.rc[BUCKET(t.kind, t.type)] += num(t.amount); if (cl === 'depPay') r.py[BUCKET(t.kind, t.type)] += num(t.amount); if (cl === 'loanRcv') r.lr += num(t.amount) + num(t.penalty); if (cl === 'disb') r.lp += num(t.amount); });
    fees.forEach(x => row(x.date).fee += x.amount);
    const rows = Object.values(by).map(r => ({ ...r, rcT: sum(BUCKETS, b => r.rc[b]), pyT: sum(BUCKETS, b => r.py[b]) })).map(r => ({ ...r, totR: r.rcT + r.fee + r.lr, totP: r.pyT + r.lp })).sort((a, b) => a.d.localeCompare(b.d));
    return { title: 'Date Wise Collection Topsheet', html: UI.table([SL, { h: 'Transaction Date', f: r => fmtD(r.d) }, { g: 'Total', h: 'Receive', f: r => n2(r.totR), r: 1, sum: 1, v: r => r.totR }, { g: 'Total', h: 'Payment', f: r => n2(r.totP), r: 1, sum: 1, v: r => r.totP },
      ...depCols('rc', ['Deposit', 'Receive']), ...depCols('py', ['Deposit', 'Payment']), { h: 'Fees Receive', f: r => n2(r.fee), r: 1, sum: 1, v: r => r.fee },
      { g: ['Loan', 'Receive'], h: 'Term', f: r => n2(r.lr), r: 1, sum: 1, v: r => r.lr }, { g: ['Loan', 'Receive'], h: 'Cont.', f: () => n2(0), r: 1 }, { g: ['Loan', 'Payment'], h: 'Term', f: r => n2(r.lp), r: 1, sum: 1, v: r => r.lp }, { g: ['Loan', 'Payment'], h: 'Cont.', f: () => n2(0), r: 1 }, { h: 'Signature', f: () => '' }], rows) };
  },
});
