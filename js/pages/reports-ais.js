// ═══════════════════════════════════════════════════════════════
// এ.আই.এস রিপোর্ট
// ═══════════════════════════════════════════════════════════════
const KIND_OPTS = [['', '— সব —'], ['dep', 'Deposit (সব)'], ...DEP_TYPES.map(([c, t]) => ['dep:' + c, t]), ['loan', 'Loan (সব)'], ...LOAN_TYPES.map(([c, t]) => ['loan:' + c, t]), ['share', 'Share'], ['other', 'Others']];
const kindMatch = (f, s) => { if (!f.kind) return true; const [k, t] = f.kind.split(':'); return s.k === k && (!t || s.t === t); };
async function foMap(branch) { const m = {}; (await Data.samities(branch)).forEach(s => m[s.code] = s.foId || ''); return m; }
const ZERO_OPTS = [['all', 'With Zero (All)'], ['nz', 'Without Zero'], ['pos', 'Positive Only'], ['neg', 'Negative Only']];
const zeroOk = (z, v) => z === 'nz' ? r2(v) !== 0 : z === 'pos' ? v > 0 : z === 'neg' ? v < 0 : true;

// ── এ্যাকাউন্টস ব্যালেন্স ──
ReportPage({
  id: 'rptAccBalance', title: 'এ্যাকাউন্টস ব্যালেন্স', landscape: true,
  filters: [F.branch, F.samity, F.employee, { k: 'kind', l: 'Account Type', t: 'select', opts: KIND_OPTS }, F.member, F.date, { k: 'zero', l: 'Show Zero Balance', t: 'select', opts: ZERO_OPTS }, { k: 'status', l: 'Customer Status', t: 'select', opts: [['', 'Choose'], ['active', 'Active'], ['closed', 'Closed']] }],
  run: async f => {
    const fo = await foMap(f.branch); const mem = await Data.memberIdx(f.branch);
    let rows = (await Hist.snapsAt(f.branch, f.date, f.samity)).filter(s => kindMatch(f, s) && (!f.member || s.m === f.member) && (!f.employee || fo[s.samity] === f.employee) && (!f.status || (s.st === 'closed' ? 'closed' : 'active') === f.status) && zeroOk(f.zero, num(s.b)));
    rows.sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    return { sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([{ h: 'Samity', f: s => s.samity }, { h: 'Member ID', f: s => s.m }, { h: 'Name', f: s => esc((mem[s.m] || [])[0] || '') }, { h: 'Mobile', f: s => esc((mem[s.m] || [])[2] || '') }, { h: 'Account', f: s => s.accNo }, { h: 'Type', f: s => typeName(s.k, s.t) }, { h: 'Open Date', f: s => fmtD(s.od) }, { h: 'Balance', f: s => amt(s.b), r: 1, sum: 1, v: s => s.b }], rows) };
  },
});

// ── এ্যাকাউন্ট রিসিভ পেমেন্ট ──
ReportPage({
  id: 'rptAccRecPay', title: 'এ্যাকাউন্ট রিসিভ পেমেন্ট', landscape: true, fromDefault: 'month',
  filters: [F.branch, { k: 'kind', l: 'Account Type', t: 'select', opts: KIND_OPTS }, F.samity, F.employee, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'cash', l: 'Cash & Bank', t: 'select', opts: [['all', 'Cash, Bank & Non-Cash All'], ['cb', 'Cash & Bank'], ['nc', 'Non Cash']] }, { k: 'bal', l: 'Balance Type', t: 'select', opts: [['nz', 'All Without Zero Balance'], ['all', 'All With Zero Balance']] }],
  buttons: [['🖨️ Print Details Report', 'details'], ['🖨️ Print Type Wise', 'type']],
  run: async (f, mode) => {
    const fo = await foMap(f.branch); const mem = await Data.memberIdx(f.branch);
    const opening = await Hist.snapsAt(f.branch, addDays(f.from, -1), f.samity);
    const closing = await Hist.snapsAt(f.branch, f.upto, f.samity);
    const ts = (await db.collection('txns').where('bd', '>=', f.branch + '_' + f.from).where('bd', '<=', f.branch + '_' + f.upto).get()).docs.map(d => d.data()).filter(t => !t.cancelled && t.accNo && (!f.samity || t.samity === f.samity));
    const nonCash = t => ['DEP_TRF_IN', 'DEP_TRF_OUT', 'EMI_TRF', 'PROFIT_POST', 'LOAN_DISB_TRF', 'JV'].includes(t.tt);
    const tsf = ts.filter(t => f.cash === 'all' || (f.cash === 'nc' ? nonCash(t) : !nonCash(t)));
    const by = {}; const ob = {}; opening.forEach(s => ob[s.accNo] = num(s.b));
    closing.forEach(s => { if (kindMatch(f, s) && (!f.employee || fo[s.samity] === f.employee)) by[s.accNo] = { ...s, open: ob[s.accNo] || 0, close: num(s.b), rcv: 0, pay: 0, list: [] }; });
    tsf.forEach(t => { const r = by[t.accNo]; if (!r) return; const d = num(t.delta); const isRcv = r.k === 'loan' ? d < 0 : d > 0; if (isRcv) r.rcv += Math.abs(d); else r.pay += Math.abs(d); r.list.push(t); });
    let rows = Object.values(by).filter(r => f.bal === 'all' || r2(r.open) || r2(r.rcv) || r2(r.pay) || r2(r.close));
    rows.sort((a, b) => a.samity.localeCompare(b.samity) || a.accNo.localeCompare(b.accNo));
    if (mode === 'type') { const g = groupBy(rows, r => typeName(r.k, r.t)); rows = Object.entries(g).map(([t, l]) => ({ accNo: t, m: '', open: sum(l, x => x.open), rcv: sum(l, x => x.rcv), pay: sum(l, x => x.pay), close: sum(l, x => x.close), k: '', t })); }
    const cols = [{ h: 'Account', f: r => r.accNo }, { h: 'Member ID', f: r => r.m || '' }, { h: 'Name', f: r => esc((mem[r.m] || [])[0] || '') }, { h: 'Type', f: r => r.k ? typeName(r.k, r.t) : '' }, { h: 'Opening', f: r => amt(r.open), r: 1, sum: 1, v: r => r.open }, { h: 'Receive', f: r => amt(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { h: 'Payment', f: r => amt(r.pay), r: 1, sum: 1, v: r => r.pay }, { h: 'Closing', f: r => amt(r.close), r: 1, sum: 1, v: r => r.close }];
    let html = UI.table(cols, rows);
    if (mode === 'details') html = rows.map(r => `<h4 style="margin:10px 0 2px">${r.accNo} — ${esc((mem[r.m] || [])[0] || '')} (${typeName(r.k, r.t)}) | ওপেনিং ${amt(r.open)}</h4>` + UI.table([{ h: 'Date', f: t => fmtD(t.date) }, { h: 'বিবরণ', f: t => TT_NAME[t.tt] || t.tt }, { h: 'Receive', f: t => (r.k === 'loan' ? t.delta < 0 : t.delta > 0) ? amt(Math.abs(t.delta)) : '', r: 1 }, { h: 'Payment', f: t => (r.k === 'loan' ? t.delta > 0 : t.delta < 0) ? amt(Math.abs(t.delta)) : '', r: 1 }], r.list)).join('');
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html };
  },
});

// ── এ্যাকাউন্ট স্টেটমেন্ট ──
async function accStatementHTML(accNo, from, upto) {
  const a = await Tx.acc(accNo);
  const ts = (await db.collection('txns').where('accNo', '==', accNo).get()).docs.map(d => d.data()).filter(t => !t.cancelled).sort((x, y) => (x.date + x.vno).localeCompare(y.date + y.vno));
  const after = sum(ts.filter(t => t.date >= from), t => t.delta);
  let bal = r2(num(a.balance) - after);
  const opening = bal;
  const rows = ts.filter(t => t.date >= from && t.date <= upto).map(t => { bal = r2(bal + num(t.delta)); return { ...t, bal }; });
  const isLoan = a.kind === 'loan';
  const head = UI.info([['একাউন্ট', a.accNo], ['নাম', esc(a.title)], ['ধরন', typeFull(a.kind, a.type)], ['খোলার তারিখ', fmtD(a.openDate)], isLoan ? ['ঋণ/মুনাফা/মোট', `${amt(a.principal)} / ${amt(a.profit)} / ${amt(a.totalRepay)}`] : ['মুনাফার হার', (a.rate || 0) + '%'], ['ওপেনিং ব্যালেন্স', amt(opening)]]);
  return head + UI.table([{ h: 'তারিখ', f: t => fmtD(t.date) }, { h: 'বিবরণ', f: t => esc((TT_NAME[t.tt] || t.tt) + (t.narration ? ' — ' + t.narration : '')) }, { h: 'ভাউচার', f: t => t.vno }, { h: isLoan ? 'বিতরণ/চার্জ' : 'উত্তোলন (Dr)', f: t => t.delta < 0 === isLoan ? '' : amt(Math.abs(t.delta)), r: 1, sum: 1, v: t => (t.delta < 0 === isLoan) ? 0 : Math.abs(t.delta) }, { h: isLoan ? 'আদায় (আসল+মুনাফা)' : 'জমা (Cr)', f: t => t.delta < 0 === isLoan ? amt(Math.abs(t.delta)) : '', r: 1, sum: 1, v: t => (t.delta < 0 === isLoan) ? Math.abs(t.delta) : 0 }, isLoan ? { h: 'আসল', f: t => t.dc === 'C' ? amt(t.principal) : '', r: 1 } : null, isLoan ? { h: 'মুনাফা', f: t => t.dc === 'C' ? amt(t.profit) : '', r: 1 } : null, { h: 'ব্যালেন্স', f: t => amt(t.bal), r: 1 }].filter(Boolean), rows);
}
ReportPage({
  id: 'rptAccStatement', title: 'এ্যাকাউন্ট স্টেটমেন্ট', fromDefault: 'month',
  filters: [F.branch, { k: 'member', l: 'সদস্য', t: 'member' }, { k: 'kind', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ['dep', 'Deposit'], ['loan', 'Loan'], ['share', 'Share'], ['other', 'Others']] }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  init: async (el, f) => {
    const load = async () => { const mid = UI.el(f, 'member').dataset.val; const kind = UI.el(f, 'kind').value || null; const list = mid ? await Data.accountsOf(UI.el(f, 'branch').value, mid, kind) : (kind === 'other' ? await Data.accountsOf(UI.el(f, 'branch').value, null, 'other') : []); UI.fill(UI.el(f, 'account'), list, a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type) + (a.status === 'closed' ? ' (closed)' : '')); if (list.length === 1) UI.el(f, 'account').value = list[0].accNo; };
    UI.el(f, 'member').addEventListener('picked', load); UI.el(f, 'kind').addEventListener('change', load);
  },
  run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: await accStatementHTML(f.account, f.from, f.upto) }),
});
ReportPage({
  id: 'rptMemberStatement', title: 'সদস্য স্টেটমেন্ট', fromDefault: 'month',
  filters: [F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  init: async (el, f) => { const p = App._params || {}; if (p.member) { const m = UI.el(f, 'member'); m.value = p.member; m.dispatchEvent(new Event('change')); UI.el(f, 'from').value = '2000-01-01'; } },
  run: async f => {
    const m = await Data.member(f.member); if (!m) fail('সদস্য পাওয়া যায়নি');
    const accs = (await Data.accountsOf(f.branch, f.member)).filter(a => a.status !== 'cancelled');
    let html = UI.info([['সদস্য', esc(m.memberId + ' - ' + m.name)], ['পিতা/স্বামী', esc(m.father || m.spouse || '')], ['সমিতি', esc(m.samity)], ['মোবাইল', esc(m.mobile)]]);
    for (const a of accs) html += `<h4 style="margin:12px 0 4px">${a.accNo} — ${typeFull(a.kind, a.type)}</h4>` + await accStatementHTML(a.accNo, f.from, f.upto);
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html };
  },
});

// ── নগদ লেনদেনের বিবরণ ──
ReportPage({
  id: 'rptCashTran', title: 'নগদ লেনদেনের বিবরণ', landscape: true,
  filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const lm = await Data.ledgerMap(); const rows = [];
    for (const b of await GLX.branchesFor(f)) {
      const vs = (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.map(d => d.data()).filter(v => v.status === 'posted');
      vs.forEach(v => { const cash = v.lines.filter(l => l.gl.startsWith('111')); if (!cash.length) return; const rc = sum(cash, l => l.dr), py = sum(cash, l => l.cr); rows.push({ ...v, rc, py, other: v.lines.filter(l => !l.gl.startsWith('111')).map(l => (lm[l.gl] || {}).name || l.gl).join(', ') }); });
    }
    rows.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'Date', f: v => fmtD(v.date) }, { h: 'Branch', f: v => v.branch }, { h: 'Voucher', f: v => v.vno }, { h: 'Particulars', f: v => esc(v.narration) }, { h: 'Ledger', f: v => esc(v.other) }, { h: 'Receipt', f: v => v.rc ? amt(v.rc) : '', r: 1, sum: 1, v: v => v.rc }, { h: 'Payment', f: v => v.py ? amt(v.py) : '', r: 1, sum: 1, v: v => v.py }, { h: 'User', f: v => v.byName }], rows) };
  },
});

// ── লেজার স্টেটমেন্ট ──
ReportPage({
  id: 'rptLedgerStatement', title: 'লেজার স্টেটমেন্ট', fromDefault: 'month',
  filters: [F.branch, F.btype, { k: 'ledger', l: 'Ledger Name', t: 'select', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'rtype', l: 'Report Type', t: 'select', opts: [['S', 'Summary'], ['D', 'Details']] }],
  init: async (el, f) => Pick.ledger(UI.el(f, 'ledger'), () => true),
  run: async f => {
    const lm = await Data.ledgerMap(); const L = lm[f.ledger]; const bs = await GLX.branchesFor(f);
    const codes = L.leaf ? [f.ledger] : Object.keys(lm).filter(c => { let p = c, g = 0; while (p && g++ < 10) { if (p === f.ledger) return true; p = (lm[p] || {}).parent; } return false; }).filter(c => lm[c].leaf);
    const ob = await GLX.before(bs, f.from); let bal = sum(codes, c => GLX.nat(f.ledger, ob[c]));
    const sign = (f.ledger[0] === '1' || f.ledger[0] === '4') ? 1 : -1;
    let rows = [];
    if (f.rtype === 'D') {
      for (const b of bs) { const vs = (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.map(d => d.data()).filter(v => v.status === 'posted'); vs.forEach(v => v.lines.filter(l => codes.includes(l.gl)).forEach(l => rows.push({ date: v.date, vno: v.vno, narration: v.narration, gl: l.gl, dr: l.dr, cr: l.cr, acc: l.accNo }))); }
      rows.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    } else {
      const byD = await GLX.range(bs, f.from, f.upto, true);
      rows = Object.keys(byD).sort().map(d => ({ date: d, narration: 'দৈনিক মোট', dr: sum(codes, c => num((byD[d][c] || {}).dr)), cr: sum(codes, c => num((byD[d][c] || {}).cr)) })).filter(r => r.dr || r.cr);
    }
    const opening = bal;
    rows.forEach(r => { bal = r2(bal + sign * (num(r.dr) - num(r.cr))); r.bal = bal; });
    return { sub: `${f.ledger} - ${esc(L.name)} | ${fmtD(f.from)} হতে ${fmtD(f.upto)} | ওপেনিং ${amt(opening)}`, html: UI.table([{ h: 'Date', f: r => fmtD(r.date) }, { h: 'Voucher', f: r => r.vno || '' }, { h: 'Particulars', f: r => esc(r.narration || '') + (r.acc ? ' [' + r.acc + ']' : '') }, { h: 'Debit', f: r => r.dr ? amt(r.dr) : '', r: 1, sum: 1, v: r => r.dr }, { h: 'Credit', f: r => r.cr ? amt(r.cr) : '', r: 1, sum: 1, v: r => r.cr }, { h: 'Balance', f: r => amt(r.bal), r: 1 }], rows) };
  },
});

// ── প্রাপ্তি-প্রদান ──
async function recPay(f, from, upto, group) {
  const lm = await Data.ledgerMap(); const bs = await GLX.branchesFor(f);
  const cashCodes = Object.keys(lm).filter(c => c.startsWith('111') && lm[c].leaf);
  const ob = await GLX.before(bs, from), cb = await GLX.upto(bs, upto);
  const field = f.rtype === 'nc' ? 'gl' : 'cgl';
  const per = group === 'date' ? await GLX.range(bs, from, upto, true, field) : { all: await GLX.range(bs, from, upto, false, field) };
  let ncPer = null; if (f.rtype === 'nc' || f.rtype === 'both') ncPer = group === 'date' ? await GLX.range(bs, from, upto, true, 'gl') : { all: await GLX.range(bs, from, upto, false, 'gl') };
  const sec = (title, data, sub) => {
    const r = [], p = [];
    Object.entries(data).forEach(([c, x]) => { if (c.startsWith('111')) return; let dr = num(x.dr), cr = num(x.cr); if (sub && sub[c]) { dr -= num(sub[c].dr); cr -= num(sub[c].cr); } if (r2(cr)) r.push([c, cr]); if (r2(dr)) p.push([c, dr]); });
    return { title, r: r.sort(), p: p.sort() };
  };
  const blocks = Object.keys(per).sort().map(k => {
    const cashSec = sec('Cash', per[k]);
    if (f.rtype === 'nc') { const cdata = group === 'date' ? null : null; return { k, ...sec('Non Cash', ncPer[k], null) }; }
    if (f.rtype === 'both') { const nc = sec('Non Cash', ncPer[k], per[k]); return { k, r: [...cashSec.r, ...nc.r.map(x => [x[0] + '*', x[1]])], p: [...cashSec.p, ...nc.p.map(x => [x[0] + '*', x[1]])] }; }
    return { k, ...cashSec };
  });
  const name = c => { const cc = c.replace('*', ''); return cc + ' - ' + esc((lm[cc] || {}).name || '') + (c.endsWith('*') ? ' (নন-ক্যাশ)' : ''); };
  const openCash = cashCodes.map(c => [c, GLX.nat(c, ob[c])]).filter(x => r2(x[1])), closeCash = cashCodes.map(c => [c, GLX.nat(c, cb[c])]).filter(x => r2(x[1]));
  const rT = sum(blocks, b => sum(b.r, x => x[1])), pT = sum(blocks, b => sum(b.p, x => x[1]));
  const left = [['<b>প্রারম্ভিক জের (Opening)</b>', ''], ...openCash.map(([c, v]) => [name(c), amt(v)])], right = [];
  blocks.forEach(b => { if (group === 'date') { left.push([`<b>${fmtD(b.k)}</b>`, '']); right.push([`<b>${fmtD(b.k)}</b>`, '']); } b.r.forEach(([c, v]) => left.push([name(c), amt(v)])); b.p.forEach(([c, v]) => right.push([name(c), amt(v)])); });
  right.push(['<b>সমাপনী জের (Closing)</b>', '']); closeCash.forEach(([c, v]) => right.push([name(c), amt(v)]));
  const totL = r2(sum(openCash, x => x[1]) + rT), totR = r2(pT + sum(closeCash, x => x[1]));
  const n = Math.max(left.length, right.length);
  let html = '<table><thead><tr><th>প্রাপ্তি (Receipts)</th><th class="r">টাকা</th><th>প্রদান (Payments)</th><th class="r">টাকা</th></tr></thead><tbody>';
  for (let i = 0; i < n; i++) html += `<tr><td>${(left[i] || ['', ''])[0]}</td><td class="r">${(left[i] || ['', ''])[1]}</td><td>${(right[i] || ['', ''])[0]}</td><td class="r">${(right[i] || ['', ''])[1]}</td></tr>`;
  html += `</tbody><tfoot><tr><td>মোট</td><td class="r">${amt(totL)}</td><td>মোট</td><td class="r">${amt(totR)}</td></tr></tfoot></table>`;
  if (f.rtype !== 'nc' && Math.abs(totL - totR) > 0.01) html += `<div class="alert alert-warning">সতর্কতা: পার্থক্য ${amt(totL - totR)} (নন-ক্যাশ এন্ট্রিতে নগদ লেজার ব্যবহার হলে হতে পারে)</div>`;
  return html;
}
const RTYPE = { k: 'rtype', l: 'Reporting Type', t: 'select', opts: [['cash', 'Cash Only'], ['nc', 'Non Cash Only'], ['both', 'Cash & Non-Cash Both']] };
ReportPage({ id: 'rptRecPay', title: 'প্রাপ্তি- প্রদান রিপোর্ট', filters: [F.branch, F.btype, F.date, RTYPE], run: async f => ({ sub: 'তারিখ: ' + fmtD(f.date), html: await recPay(f, f.date, f.date) }) });
ReportPage({ id: 'rptRecPay2', title: 'প্রাপ্তি- প্রদান II', fromDefault: 'month', filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, RTYPE, { k: 'group', l: 'Group With', t: 'select', opts: [['none', 'No Grouping'], ['date', 'Date']] }], run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: await recPay(f, f.from, f.upto, f.group) }) });

// ── ব্যালেন্স সীট / লাভ-ক্ষতি / ট্রায়াল ব্যালেন্স ──
async function ledgerTree(bal, prefixes, opts = {}) {
  const ls = await Data.ledgers(); const byC = {}; ls.forEach(l => byC[l.code] = l);
  const leafBal = {}; Object.entries(bal).forEach(([c, x]) => { if (prefixes.includes(c[0])) leafBal[c] = typeof x === 'number' ? x : GLX.nat(c, x); });
  const tot = GLX.rollup(ls, leafBal);
  const depth = c => { let d = 0, p = byC[c] && byC[c].parent; while (p && d < 8) { d++; p = byC[p] && byC[p].parent; } return d; };
  return ls.filter(l => prefixes.includes(l.code[0]) && (opts.zero || r2(tot[l.code] || 0) !== 0)).map(l => ({ code: l.code, name: l.name, leaf: l.leaf, depth: depth(l.code), v: r2(tot[l.code] || 0) }));
}
const treeRows = rows => rows.map(r => `<tr class="${r.leaf ? '' : 'grp'}"><td style="padding-left:${6 + r.depth * 14}px">${r.leaf ? '' : '<b>'}${r.code} - ${esc(r.name)}${r.leaf ? '' : '</b>'}</td><td class="r">${r.leaf ? amt(r.v) : ''}</td><td class="r">${r.leaf ? '' : '<b>' + amt(r.v) + '</b>'}</td></tr>`).join('');
async function balanceSheet(bs, date) {
  const up = await GLX.upto(bs, date);
  const inc = sum(Object.entries(up).filter(([c]) => c[0] === '3'), ([c, x]) => GLX.nat(c, x)), exp = sum(Object.entries(up).filter(([c]) => c[0] === '4'), ([c, x]) => GLX.nat(c, x));
  const pl = r2(inc - exp);
  const bal = { ...up }; bal[REF.GL.pl] = { dr: num((up[REF.GL.pl] || {}).dr) + (pl < 0 ? -pl : 0), cr: num((up[REF.GL.pl] || {}).cr) + (pl > 0 ? pl : 0) };
  const A = await ledgerTree(bal, ['1']), L = await ledgerTree(bal, ['2']);
  const tA = sum(A.filter(r => r.leaf), r => r.v), tL = sum(L.filter(r => r.leaf), r => r.v);
  return { A, L, tA, tL, pl };
}
ReportPage({
  id: 'rptBalanceSheet', title: 'ব্যালেন্স সীট', filters: [F.branch, F.btype, F.date], buttons: [['🖨️ Print All Branch', 'all']],
  run: async (f, mode) => {
    if (mode === 'all') f.btype = 'all';
    const r = await balanceSheet(await GLX.branchesFor(f), f.date);
    return { sub: 'তারিখ: ' + fmtD(f.date) + (f.btype === 'all' ? ' (সকল শাখা)' : ''), html: `<table><thead><tr><th>সম্পদ (Assets)</th><th class="r">টাকা</th><th class="r">মোট</th></tr></thead><tbody>${treeRows(r.A)}</tbody><tfoot><tr><td>মোট সম্পদ</td><td></td><td class="r">${amt(r.tA)}</td></tr></tfoot></table>
      <table style="margin-top:12px"><thead><tr><th>দায় ও মূলধন (Liabilities & Equity)</th><th class="r">টাকা</th><th class="r">মোট</th></tr></thead><tbody>${treeRows(r.L)}</tbody><tfoot><tr><td>মোট দায় ও মূলধন</td><td></td><td class="r">${amt(r.tL)}</td></tr></tfoot></table>${Math.abs(r.tA - r.tL) > 0.01 ? `<div class="alert alert-danger">ব্যালেন্স মিলছে না: পার্থক্য ${amt(r.tA - r.tL)}</div>` : '<div class="alert alert-success">✔ সম্পদ = দায় + মূলধন</div>'}` };
  },
});
async function branchColumns(f, fn) {
  const bl = (await GLX.branchesFor({ ...f, btype: 'all' })); const bsx = await Data.branches();
  const per = {}; for (const b of bl) per[b] = await fn([b]);
  return { bl, per, name: b => (bsx.find(x => x.code === b) || {}).name || b };
}
function tabular(rowsByBranch, bl, name) {
  const codes = {}; bl.forEach(b => rowsByBranch[b].forEach(r => codes[r.code] = r));
  const list = Object.values(codes).sort((a, b) => a.code.localeCompare(b.code));
  return `<table><thead><tr><th>Ledger</th>${bl.map(b => `<th class="r">${b}<div class="mini">${esc(name(b))}</div></th>`).join('')}<th class="r">মোট</th></tr></thead><tbody>${list.map(r => { const vals = bl.map(b => (rowsByBranch[b].find(x => x.code === r.code) || {}).v || 0); return `<tr class="${r.leaf ? '' : 'grp'}"><td style="padding-left:${6 + r.depth * 12}px">${r.code} - ${esc(r.name)}</td>${vals.map(v => `<td class="r">${amt(v)}</td>`).join('')}<td class="r">${amt(sum(vals))}</td></tr>`; }).join('')}</tbody></table>`;
}
ReportPage({
  id: 'rptBalanceSheet2', title: 'ব্যালেন্স সীট II (শাখাভিত্তিক)', landscape: true, filters: [F.branch, F.date],
  run: async f => { const c = await branchColumns(f, async bs => { const r = await balanceSheet(bs, f.date); return [...r.A, ...r.L]; }); return { sub: 'তারিখ: ' + fmtD(f.date), html: tabular(c.per, c.bl, c.name) }; },
});
async function incomeExp(bs, from, upto) {
  const g = await GLX.range(bs, from, upto);
  const I = await ledgerTree(g, ['3']), E = await ledgerTree(g, ['4']);
  return { I, E, tI: sum(I.filter(r => r.leaf), r => r.v), tE: sum(E.filter(r => r.leaf), r => r.v) };
}
const ieHTML = r => `<table><thead><tr><th>আয় (Income)</th><th class="r">টাকা</th><th class="r">মোট</th></tr></thead><tbody>${treeRows(r.I)}</tbody><tfoot><tr><td>মোট আয়</td><td></td><td class="r">${amt(r.tI)}</td></tr></tfoot></table>
  <table style="margin-top:12px"><thead><tr><th>ব্যয় (Expenses)</th><th class="r">টাকা</th><th class="r">মোট</th></tr></thead><tbody>${treeRows(r.E)}</tbody><tfoot><tr><td>মোট ব্যয়</td><td></td><td class="r">${amt(r.tE)}</td></tr></tfoot></table>
  <div class="kv"><div>মোট আয়<b>${amt(r.tI)}</b></div><div>মোট ব্যয়<b>${amt(r.tE)}</b></div><div>${r.tI - r.tE >= 0 ? 'নিট লাভ' : 'নিট ক্ষতি'}<b>${amt(Math.abs(r.tI - r.tE))}</b></div></div>`;
ReportPage({ id: 'rptIncomeExp', title: 'লাভ-ক্ষতি', filters: [F.branch, F.btype, F.date], run: async f => ({ sub: `অর্থবছর ${fmtD(fyStart(f.date))} হতে ${fmtD(f.date)}`, html: ieHTML(await incomeExp(await GLX.branchesFor(f), fyStart(f.date), f.date)) }) });
ReportPage({ id: 'rptIncomeExp2', title: 'লাভ-ক্ষতি II (শাখাভিত্তিক)', landscape: true, filters: [F.branch, F.date], run: async f => { const c = await branchColumns(f, async bs => { const r = await incomeExp(bs, fyStart(f.date), f.date); return [...r.I, ...r.E]; }); return { sub: `${fmtD(fyStart(f.date))} হতে ${fmtD(f.date)}`, html: tabular(c.per, c.bl, c.name) }; } });
ReportPage({
  id: 'rptProfitLoss', title: 'আয়-ব্যায় হিসাব', fromDefault: 'month', filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'group', l: 'Group With', t: 'select', opts: [['none', 'No Grouping'], ['date', 'Date']] }],
  buttons: [['🖨️ Print Income Statement', 'inc'], ['🖨️ Print Expense Statement', 'exp']],
  run: async (f, mode) => {
    const bs = await GLX.branchesFor(f);
    if (f.group === 'date') {
      const byD = await GLX.range(bs, f.from, f.upto, true); const lm = await Data.ledgerMap();
      const rows = []; Object.keys(byD).sort().forEach(d => Object.entries(byD[d]).forEach(([c, x]) => { if ((c[0] === '3' && mode !== 'exp') || (c[0] === '4' && mode !== 'inc')) { const v = GLX.nat(c, x); if (r2(v)) rows.push({ d, c, n: (lm[c] || {}).name, inc: c[0] === '3' ? v : 0, exp: c[0] === '4' ? v : 0 }); } }));
      return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'Date', f: r => fmtD(r.d) }, { h: 'Ledger', f: r => r.c + ' - ' + esc(r.n || '') }, { h: 'Income', f: r => r.inc ? amt(r.inc) : '', r: 1, sum: 1, v: r => r.inc }, { h: 'Expense', f: r => r.exp ? amt(r.exp) : '', r: 1, sum: 1, v: r => r.exp }], rows) };
    }
    const r = await incomeExp(bs, f.from, f.upto); if (mode === 'inc') r.E = []; if (mode === 'exp') r.I = [];
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: ieHTML(r) };
  },
});
async function trialBalance(bs, from, upto) {
  const lm = await Data.ledgerMap(); const ob = await GLX.before(bs, from), pr = await GLX.range(bs, from, upto);
  const codes = [...new Set([...Object.keys(ob), ...Object.keys(pr)])].filter(c => lm[c]).sort();
  return codes.map(c => { const o = num((ob[c] || {}).dr) - num((ob[c] || {}).cr), d = num((pr[c] || {}).dr), cr = num((pr[c] || {}).cr), cl = r2(o + d - cr); return { code: c, name: lm[c].name, oDr: o > 0 ? o : 0, oCr: o < 0 ? -o : 0, d, cr, cDr: cl > 0 ? cl : 0, cCr: cl < 0 ? -cl : 0, v: cl }; }).filter(r => r2(r.oDr) || r2(r.oCr) || r2(r.d) || r2(r.cr));
}
ReportPage({
  id: 'rptTrialBalance', title: 'ট্রায়াল ব্যালেন্স', landscape: true, fromDefault: 'month', filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => { const rows = await trialBalance(await GLX.branchesFor(f), f.from, f.upto); return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: UI.table([{ h: 'Code', f: r => r.code }, { h: 'Ledger Name', f: r => esc(r.name) }, { h: 'Opening Dr', f: r => amt(r.oDr), r: 1, sum: 1, v: r => r.oDr }, { h: 'Opening Cr', f: r => amt(r.oCr), r: 1, sum: 1, v: r => r.oCr }, { h: 'Debit', f: r => amt(r.d), r: 1, sum: 1, v: r => r.d }, { h: 'Credit', f: r => amt(r.cr), r: 1, sum: 1, v: r => r.cr }, { h: 'Closing Dr', f: r => amt(r.cDr), r: 1, sum: 1, v: r => r.cDr }, { h: 'Closing Cr', f: r => amt(r.cCr), r: 1, sum: 1, v: r => r.cCr }], rows) }; },
});
ReportPage({
  id: 'rptTrialBalance2', title: 'ট্রায়াল ব্যালেন্স II (শাখাভিত্তিক)', landscape: true, fromDefault: 'month', filters: [F.branch, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => { const lm = await Data.ledgerMap(); const c = await branchColumns(f, async bs => (await trialBalance(bs, f.from, f.upto)).map(r => ({ ...r, leaf: true, depth: 0 }))); return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)} — সমাপনী ব্যালেন্স (Dr + / Cr −)`, html: tabular(c.per, c.bl, c.name) }; },
});

// ── ক্যাশবুক ──
ReportPage({
  id: 'rptCashBook', title: 'ক্যাশবুক (Cash & Bank)', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'group', l: 'Group With', t: 'select', opts: [['date', 'Date'], ['none', 'No Grouping']] }],
  buttons: [['🖨️ Cash & Bank Statement', 'stmt'], ['🖨️ Debit Voucher', 'dv'], ['🖨️ Credit Voucher', 'cv']],
  run: async (f, mode) => {
    const lm = await Data.ledgerMap(); const bs = await GLX.branchesFor(f);
    const cashCodes = Object.keys(lm).filter(c => c.startsWith('111') && lm[c].leaf);
    const vs = []; for (const b of bs) (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.forEach(d => { const v = d.data(); if (v.status === 'posted' && v.lines.some(l => cashCodes.includes(l.gl))) vs.push(v); });
    vs.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    if (mode === 'dv' || mode === 'cv') {
      const pick = vs.filter(v => mode === 'dv' ? v.lines.some(l => cashCodes.includes(l.gl) && l.cr) : v.lines.some(l => cashCodes.includes(l.gl) && l.dr));
      return { title: mode === 'dv' ? 'Debit Voucher' : 'Credit Voucher', noSig: false, html: pick.map(v => `<div style="page-break-inside:avoid;margin-bottom:14px;border:1px solid #999;padding:6px"><div class="meta"><span>Voucher: ${v.vno}</span><span>Date: ${fmtD(v.date)}</span></div><div>${esc(v.narration)}</div>` + UI.table([{ h: 'Ledger', f: l => l.gl + ' - ' + esc((lm[l.gl] || {}).name || '') }, { h: 'Debit', f: l => l.dr ? amt(l.dr) : '', r: 1 }, { h: 'Credit', f: l => l.cr ? amt(l.cr) : '', r: 1 }], v.lines) + '</div>').join('') };
    }
    const ob = await GLX.before(bs, f.from); let open = sum(cashCodes, c => GLX.nat(c, ob[c]));
    const days = groupBy(vs, v => f.group === 'none' ? 'all' : v.date);
    let html = '';
    Object.keys(days).sort().forEach(d => {
      const list = days[d]; const rc = list.map(v => ({ v, a: sum(v.lines.filter(l => cashCodes.includes(l.gl)), l => l.dr) })).filter(x => x.a), py = list.map(v => ({ v, a: sum(v.lines.filter(l => cashCodes.includes(l.gl)), l => l.cr) })).filter(x => x.a);
      const close = r2(open + sum(rc, x => x.a) - sum(py, x => x.a));
      html += `<h4 style="margin:10px 0 4px">${d === 'all' ? '' : fmtD(d)} — প্রারম্ভিক জের: ${amt(open)}</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`
        + UI.table([{ h: 'প্রাপ্তি — বিবরণ', f: x => esc(x.v.narration) }, { h: 'Voucher', f: x => x.v.vno }, { h: 'টাকা', f: x => amt(x.a), r: 1, sum: 1, v: x => x.a }], rc)
        + UI.table([{ h: 'প্রদান — বিবরণ', f: x => esc(x.v.narration) }, { h: 'Voucher', f: x => x.v.vno }, { h: 'টাকা', f: x => amt(x.a), r: 1, sum: 1, v: x => x.a }], py) + `</div><div class="mini" style="text-align:right">সমাপনী জের: <b>${amt(close)}</b></div>`;
      open = close;
    });
    if (mode === 'stmt') { const cb = await GLX.upto(bs, f.upto); html = UI.table([{ h: 'Cash/Bank Ledger', f: c => c + ' - ' + esc(lm[c].name) }, { h: 'Opening', f: c => amt(GLX.nat(c, ob[c])), r: 1 }, { h: 'Closing', f: c => amt(GLX.nat(c, cb[c])), r: 1, sum: 1, v: c => GLX.nat(c, cb[c]) }], cashCodes) + html; }
    return { sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: html || '<div class="mini">কোনো লেনদেন নেই</div>' };
  },
});

// ── Back Date / Cancel List ──
const vRows = async (f, flt) => (await db.collection('vouchers').where('bd', '>=', f.branch + '_' + f.from).where('bd', '<=', f.branch + '_' + f.upto).get()).docs.map(d => d.data()).filter(flt).filter(v => (!f.user || v.by === f.user) && (!f.samity || ((v.ref && v.ref.memberId) || '').length));
const userFilter = { k: 'user', l: 'User Name', t: 'select', opts: [['', '------------']] };
const fillUsers = async (el, f) => { const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })); UI.fill(UI.el(f, 'user'), us, u => u.id, u => u.userId || u.email, '------------'); };
ReportPage({ id: 'rptBackDate', title: 'Back Date Transaction', landscape: true, fromDefault: 'month', filters: [F.branch, F.samity, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, userFilter], init: fillUsers, run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: VList.table(await vRows(f, v => v.businessDate && v.date < v.businessDate)) }) });
ReportPage({ id: 'rptCancelList', title: 'Transaction Cancel List', landscape: true, fromDefault: 'month', filters: [F.branch, F.samity, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, userFilter], init: fillUsers, run: async f => ({ sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: VList.table(await vRows(f, v => v.status === 'cancelled')) }) });
