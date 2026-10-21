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
    const sgn = s => s.k === 'loan' ? -num(s.b) : num(s.b); const cr = s => s.k === 'loan' ? num(s.pt) : num(s.tc); const dr = s => s.k === 'loan' ? num(s.tr) : num(s.td);
    return { title: 'Account Balance Report', html: UI.table([SL, { h: 'সদস্য আইডি', f: s => s.m }, { h: 'হিসাবের নাম', f: s => esc((mem[s.m] || [])[0] || '') + '<div class="mini">' + s.accNo + '</div>' }, { h: 'Address', f: s => esc((mem[s.m] || [])[6] || '') }, { h: 'Phone', f: s => esc((mem[s.m] || [])[2] || '') }, { h: 'অ্যাকাউন্টের ধরন', f: s => s.k === 'share' ? 'Share Accounts' : esc(typeFull(s.k, s.t).replace(/^\w+ - /, '')) }, { h: 'Credit(Receive)', f: s => amt(cr(s)), r: 1, sum: 1, v: cr }, { h: 'Debit(Payment)', f: s => amt(dr(s)), r: 1, sum: 1, v: dr }, { h: 'ব্যালেন্স', f: s => amt(sgn(s)), r: 1, sum: 1, v: sgn }], rows, { totalLabel: 'মোট :' }) };
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
    const sg = r => r.k === 'loan' ? -1 : 1;
    const cols = [SL, { h: 'সদস্য আইডি', f: r => r.m || r.accNo }, { h: 'সদস্যের নাম', f: r => esc((mem[r.m] || [])[0] || '') + (r.m ? '<div class="mini">' + r.accNo + '</div>' : '') }, { h: 'একাউন্টের ধরন', f: r => r.k ? (r.k === 'share' ? 'Share Accounts' : esc(typeFull(r.k, r.t).replace(/^\w+ - /, ''))) : esc(r.t || '') }, { h: 'ওপেনিং ব্যালেন্স', f: r => amt(sg(r) * r.open), r: 1, sum: 1, v: r => sg(r) * r.open }, { h: 'Credit(Receive)', f: r => amt(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { h: 'Debit(Payment)', f: r => amt(r.pay), r: 1, sum: 1, v: r => r.pay }, { h: 'ক্লোজিং', f: r => amt(sg(r) * r.close), r: 1, sum: 1, v: r => sg(r) * r.close }];
    let html = UI.table(cols, rows, { totalLabel: 'মোট :' });
    if (mode === 'details') html = rows.map(r => `<h4 style="margin:10px 0 2px">${r.accNo} — ${esc((mem[r.m] || [])[0] || '')} (${typeName(r.k, r.t)}) | ওপেনিং ${amt(r.open)}</h4>` + UI.table([{ h: 'Date', f: t => fmtD(t.date) }, { h: 'বিবরণ', f: t => TT_NAME[t.tt] || t.tt }, { h: 'Receive', f: t => (r.k === 'loan' ? t.delta < 0 : t.delta > 0) ? amt(Math.abs(t.delta)) : '', r: 1 }, { h: 'Payment', f: t => (r.k === 'loan' ? t.delta > 0 : t.delta < 0) ? amt(Math.abs(t.delta)) : '', r: 1 }], r.list)).join('');
    return { title: 'Account Receipt Payment Report', html };
  },
});

// ── এ্যাকাউন্ট স্টেটমেন্ট ──
async function accStatementHTML(accNo, from, upto) {
  const a = await Tx.acc(accNo);
  const ts = (await db.collection('txns').where('accNo', '==', accNo).get()).docs.map(d => d.data()).filter(t => !t.cancelled).sort((x, y) => (x.date + x.vno).localeCompare(y.date + y.vno));
  const after = sum(ts.filter(t => t.date >= from), t => t.delta);
  let bal = r2(num(a.balance) - after);
  const isLoan = a.kind === 'loan';
  const rows = [{ date: from > '2000-01-01' ? addDays(from, -1) : (a.openDate || from), open: 1, bal }].concat(ts.filter(t => t.date >= from && t.date <= upto).map(t => { bal = r2(bal + num(t.delta)); return { ...t, bal }; }));
  const inc = t => !t.open && (isLoan ? t.delta < 0 : t.delta > 0), dec = t => !t.open && !inc(t);
  const det = t => t.open ? 'Opening Balance' : esc((TT_EN[t.tt] || TT_NAME[t.tt] || t.tt) + ' ' + (a.accNo) + (t.narration ? ' — ' + t.narration : ''));
  const cols = isLoan
    ? [SL, { h: 'Date', f: t => fmtD(t.date).replace(/-/g, '/') }, { h: 'Transaction Details', f: det }, { h: 'Disburse', f: t => dec(t) && t.delta ? amt(Math.abs(t.delta)) : '', r: 1, sum: 1, v: t => dec(t) ? Math.abs(t.delta || 0) : 0 }, { h: 'Principal', f: t => inc(t) ? amt(t.principal) : '', r: 1, sum: 1, v: t => inc(t) ? t.principal : 0 }, { h: 'Profit', f: t => inc(t) ? amt(t.profit) : '', r: 1, sum: 1, v: t => inc(t) ? t.profit : 0 }, { h: 'Receive', f: t => inc(t) ? amt(Math.abs(t.delta)) : '', r: 1, sum: 1, v: t => inc(t) ? Math.abs(t.delta) : 0 }, { h: 'Balance', f: t => amt(t.bal), r: 1 }]
    : [SL, { h: 'Date', f: t => fmtD(t.date).replace(/-/g, '/') }, { h: 'Transaction Details', f: det }, { h: 'Deposit', f: t => inc(t) ? amt(Math.abs(t.delta)) : '', r: 1, sum: 1, v: t => inc(t) ? Math.abs(t.delta) : 0 }, { h: 'Withdraw', f: t => dec(t) && t.delta ? amt(Math.abs(t.delta)) : '', r: 1, sum: 1, v: t => dec(t) ? Math.abs(t.delta || 0) : 0 }, { h: 'Balance', f: t => amt(t.bal), r: 1 }];
  const head = isLoan ? UI.info([['Loan No', a.accNo], ['Disbursed', amt(a.principal)], ['Profit', amt(a.profit)], ['Total', amt(a.totalRepay)], ['Installment', amt(a.instAmount) + ' (' + (FREQ_EN[a.freq] || a.freq || '') + ')'], ['Expire Date', fmtD(a.expDate)]]) : '';
  return head + UI.table(cols, rows);
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
    let html = UI.info([['Member', esc(m.memberId + ' - ' + m.name)], ['Father Name', esc(m.father || m.spouse || '')], ['Samity', esc(m.samity)], ['Phone', esc(m.mobile)]]);
    for (const a of accs) html += `<h4 style="margin:12px 0 4px">${a.accNo} — ${typeFull(a.kind, a.type)}</h4>` + await accStatementHTML(a.accNo, f.from, f.upto);
    return { title: 'Member All Account Statement', sub: `${fmtD(f.from)} হতে ${fmtD(f.upto)}`, html: html + `<div style="text-align:right;margin-top:30px">Authorized Signature: ${esc(App.user.userId || '')}</div>`, noSig: true };
  },
});

// ═══════════ AIS রিপোর্ট — eKisti এর হুবহু ফরম্যাট ═══════════
const glName = (lm, c) => esc(((lm[c] || {}).name || c) + ' [' + c + ']');
const prevMonthEnd = d => addDays(d.slice(0, 7) + '-01', -1);
const prevYearEnd = d => (Number(d.slice(0, 4)) - 1) + '-12-31';
const isCashGl = (lm, c) => c.startsWith('111') || (lm[c] || {}).cashBank;
const isBankGl = c => c.startsWith('1112');
// লেজার ট্রি (একাধিক কলাম): vals[i][code] = leaf মান → গ্রুপে রোলআপ
async function treeMulti(valsList, prefixes, keepZero) {
  const ls = await Data.ledgers(); const byC = {}; ls.forEach(l => byC[l.code] = l);
  const tots = valsList.map(v => GLX.rollup(ls, v));
  const depth = c => { let d = 0, p = byC[c] && byC[c].parent; while (p && d < 8) { d++; p = byC[p] && byC[p].parent; } return d; };
  return ls.filter(l => prefixes.includes(l.code[0]) && (keepZero || tots.some(t => r2(t[l.code] || 0) !== 0))).map(l => ({ code: l.code, name: l.name, leaf: l.leaf, depth: depth(l.code), vals: tots.map(t => r2(t[l.code] || 0)) }));
}
const natMap = (bal, pre) => { const o = {}; Object.entries(bal).forEach(([c, x]) => { if (pre.includes(c[0])) o[c] = GLX.nat(c, x); }); return o; };
const rawMap = (bal, key) => { const o = {}; Object.entries(bal).forEach(([c, x]) => o[c] = num(x[key])); return o; };
// পাশাপাশি দুই অংশের টেবিল (eKisti Statement ফরম্যাট)
function sideBySide(lh, rh, cols, L, Rr, footL, footR) {
  const cell = (r, lm) => r ? `<td style="padding-left:${4 + r.depth * 10}px">${r.leaf ? '' : '<b>'}${esc(r.name)} [${r.code}]${r.leaf ? '' : '</b>'}</td>${r.vals.map(v => `<td class="r">${r.leaf ? '' : '<b>'}${GLFMT(v)}${r.leaf ? '' : '</b>'}</td>`).join('')}` : `<td></td>${cols.map(() => '<td></td>').join('')}`;
  const n = Math.max(L.length, Rr.length); let h = `<table><thead><tr><th>${lh}</th>${cols.map(c => `<th class="r">${c}</th>`).join('')}<th>${rh}</th>${cols.map(c => `<th class="r">${c}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = 0; i < n; i++) h += `<tr>${cell(L[i])}${cell(Rr[i])}</tr>`;
  const fr = (lab, vals) => `<td><b>${lab}</b></td>${vals.map(v => `<td class="r"><b>${GLFMT(v)}</b></td>`).join('')}`;
  h += `</tbody><tfoot>${(footL || []).map((f, i) => `<tr>${fr(f[0], f[1])}${(footR || [])[i] ? fr(footR[i][0], footR[i][1]) : fr('', cols.map(() => 0))}</tr>`).join('')}</tfoot></table>`;
  return h;
}
const GLFMT = v => r2(v) < 0 ? '(' + amt(-v) + ')' : amt(v);
function treeTable(rows, colHeads, opts = {}) {
  return `<table><thead><tr>${opts.code ? '<th>Ledger Code</th>' : ''}<th>${opts.nameHead || 'Ledger Name'}</th>${colHeads.map(c => `<th class="r">${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${opts.code ? `<td>${r.code}</td>` : ''}<td style="padding-left:${4 + r.depth * 10}px">${r.leaf ? '' : '<b>'}${esc(r.name)} [${r.code}]${r.leaf ? '' : '</b>'}</td>${r.vals.map(v => `<td class="r">${r.leaf ? '' : '<b>'}${GLFMT(v)}${r.leaf ? '' : '</b>'}</td>`).join('')}</tr>`).join('')}</tbody>${opts.foot || ''}</table>`;
}

// ── নগদ লেনদেনের বিবরণ (Cash Transaction Details) ──
ReportPage({
  id: 'rptCashTran', title: 'নগদ লেনদেনের বিবরণ', landscape: true,
  filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const lm = await Data.ledgerMap(); const bs = await GLX.branchesFor(f); const cash = REF.GL.cash;
    const ob = await GLX.before(bs, f.from); let bal = GLX.nat(cash, ob[cash]);
    const rows = [{ date: addDays(f.from, -1), det: 'Opening Balance', cr: 0, dr: 0, bal }];
    for (const b of bs) {
      const vs = (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.map(d => d.data()).filter(v => v.status === 'posted').sort((a, c) => (a.date + a.vno).localeCompare(c.date + c.vno));
      vs.forEach(v => v.lines.filter(l => l.gl === cash).forEach(l => rows.push({ date: v.date, det: v.narration, dr: num(l.dr), cr: num(l.cr) })));
    }
    rows.slice(1).sort((a, c) => a.date.localeCompare(c.date)).forEach(r => { bal = r2(bal + r.dr - r.cr); r.bal = bal; });
    return { title: 'Cash Transaction Details', html: UI.table([SL, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Transaction Details', f: r => esc(r.det) }, { h: 'Credit(Payment)', f: r => amt(r.cr), r: 1, sum: 1, v: r => r.cr }, { h: 'Debit(Receive)', f: r => amt(r.dr), r: 1, sum: 1, v: r => r.dr }, { h: 'Balance', f: r => amt(r.bal), r: 1 }], rows) };
  },
});

// ── লেজার স্টেটমেন্ট (Ledger Statement) ──
ReportPage({
  id: 'rptLedgerStatement', title: 'লেজার স্টেটমেন্ট', fromDefault: 'month', landscape: true,
  filters: [F.branch, F.btype, { k: 'ledger', l: 'Ledger Name', t: 'select', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'rtype', l: 'Report Type', t: 'select', opts: [['D', 'Details'], ['S', 'Summary']] }],
  init: async (el, f) => Pick.ledger(UI.el(f, 'ledger'), () => true),
  run: async f => {
    const lm = await Data.ledgerMap(); const L = lm[f.ledger]; const bs = await GLX.branchesFor(f);
    const codes = L.leaf ? [f.ledger] : Object.keys(lm).filter(c => { let p = c, g = 0; while (p && g++ < 10) { if (p === f.ledger) return true; p = (lm[p] || {}).parent; } return false; }).filter(c => lm[c].leaf);
    const ob = await GLX.before(bs, f.from); let bal = sum(codes, c => GLX.nat(f.ledger, ob[c]));
    const sign = (f.ledger[0] === '1' || f.ledger[0] === '4') ? 1 : -1;
    let rows = [];
    if (f.rtype !== 'S') {
      for (const b of bs) { const vs = (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.map(d => d.data()).filter(v => v.status === 'posted'); vs.forEach(v => v.lines.filter(l => codes.includes(l.gl)).forEach(l => rows.push({ date: v.date, vno: v.vno, det: (v.narration || '') + (l.accNo ? ' [' + l.accNo + ']' : ''), dr: num(l.dr), cr: num(l.cr) }))); }
      rows.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    } else {
      const byD = await GLX.range(bs, f.from, f.upto, true);
      rows = Object.keys(byD).sort().map(d => ({ date: d, det: 'দৈনিক মোট', dr: sum(codes, c => num((byD[d][c] || {}).dr)), cr: sum(codes, c => num((byD[d][c] || {}).cr)) })).filter(r => r.dr || r.cr);
    }
    const all = [{ date: addDays(f.from, -1), det: 'Opening Balance', dr: 0, cr: 0, bal }].concat(rows.map(r => { bal = r2(bal + sign * (r.dr - r.cr)); return { ...r, bal }; }));
    return { title: 'Ledger Statement', info: [['Reporting Date', `${fmtD(f.from)} - ${fmtD(f.upto)}`], ['Branch Name', esc((await Data.branch(f.branch) || {}).name || '')], ['Branch Address', esc((await Data.branch(f.branch) || {}).address || '')], ['Ledger Name', glName(lm, f.ledger)]],
      html: UI.table([SL, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Transaction Details', f: r => esc(r.det) }, { h: 'Credit(Payment)', f: r => amt(r.cr), r: 1, sum: 1, v: r => r.cr }, { h: 'Debit(Receive)', f: r => amt(r.dr), r: 1, sum: 1, v: r => r.dr }, { h: 'Balance', f: r => GLFMT(r.bal), r: 1 }], all) };
  },
});

// ── প্রাপ্তি-প্রদান (Receipt Payment Statement) ──
// প্রাপ্তি = নগদ/ব্যাংক জড়িত ভাউচারে অন্য লেজারের ক্রেডিট, প্রদান = ডেবিট
async function rpPeriod(bs, from, upto) {
  const lm = await Data.ledgerMap();
  const g = from ? await GLX.range(bs, from, upto, false, 'cgl') : await (async () => { const out = {}; for (const b of bs) { const ms = await db.collection('glMonthly').where(DOCID(), '>=', b + '_0000').where(DOCID(), '<=', b + '_' + upto.slice(0, 7)).get(); ms.forEach(d => { if (d.id.slice(-7) < upto.slice(0, 7)) GLX.add(out, d.data().cgl || {}); }); } GLX.add(out, await GLX.range(bs, upto.slice(0, 7) + '-01', upto, false, 'cgl')); return out; })();
  const rc = {}, py = {}; Object.entries(g).forEach(([c, x]) => { if (isCashGl(lm, c)) return; if (num(x.cr)) rc[c] = num(x.cr); if (num(x.dr)) py[c] = num(x.dr); });
  const cashCodes = Object.keys(lm).filter(c => isCashGl(lm, c) && lm[c].leaf);
  const ob = from ? await GLX.before(bs, from) : {}; const cb = await GLX.upto(bs, upto);
  const open = {}, close = {}; cashCodes.forEach(c => { open[c] = GLX.nat(c, ob[c]); close[c] = GLX.nat(c, cb[c]); });
  return { rc, py, open, close };
}
async function recPayStatement(f, periods, heads) {
  const bs = await GLX.branchesFor(f); const P = []; for (const [fr, up] of periods) P.push(await rpPeriod(bs, fr, up));
  const openRows = await treeMulti(P.map(p => p.open), ['1']), rcRows = await treeMulti(P.map(p => p.rc), ['1', '2', '3', '4']);
  const pyRows = await treeMulti(P.map(p => p.py), ['1', '2', '3', '4']), closeRows = await treeMulti(P.map(p => p.close), ['1']);
  const hdr = (t) => ({ code: '', name: t, leaf: false, depth: 0, vals: P.map(() => 0), hdr: 1 });
  const L = [hdr('OPENING'), ...openRows, hdr('RECEIPTS'), ...rcRows], Rr = [hdr('PAYMENTS'), ...pyRows, hdr('CLOSING'), ...closeRows];
  const cell = r => r ? (r.hdr ? `<td><b><u>${r.name}</u></b></td>${P.map(() => '<td></td>').join('')}` : `<td style="padding-left:${4 + r.depth * 10}px">${r.leaf ? '' : '<b>'}${esc(r.name)} [${r.code}]${r.leaf ? '' : '</b>'}</td>${r.vals.map(v => `<td class="r">${r.leaf ? '' : '<b>'}${GLFMT(v)}${r.leaf ? '' : '</b>'}</td>`).join('')}`) : `<td></td>${P.map(() => '<td></td>').join('')}`;
  const n = Math.max(L.length, Rr.length);
  const tL = P.map(p => sum(Object.values(p.open)) + sum(Object.values(p.rc))), tR = P.map(p => sum(Object.values(p.py)) + sum(Object.values(p.close)));
  let h = `<table><thead><tr><th>${heads[0]}</th>${heads[1].map(c => `<th class="r">${c}</th>`).join('')}<th>${heads[2]}</th>${heads[1].map(c => `<th class="r">${c}</th>`).join('')}</tr></thead><tbody>`;
  for (let i = 0; i < n; i++) h += `<tr>${cell(L[i])}${cell(Rr[i])}</tr>`;
  h += `</tbody><tfoot><tr><td><b>Total:</b></td>${tL.map(v => `<td class="r"><b>${amt(v)}</b></td>`).join('')}<td><b>Total:</b></td>${tR.map(v => `<td class="r"><b>${amt(v)}</b></td>`).join('')}</tr></tfoot></table>`;
  return h;
}
const RTYPE = { k: 'rtype', l: 'Reporting Type', t: 'select', opts: [['cash', 'Cash Only'], ['both', 'Cash & Non-Cash Both']] };
ReportPage({
  id: 'rptRecPay', title: 'প্রাপ্তি- প্রদান রিপোর্ট', landscape: true, filters: [F.branch, F.btype, F.date, RTYPE],
  run: async f => ({ title: 'Receipt Payment Statement', info: [['Report Date', fmtD(f.date)], ['শাখার নাম', esc((await Data.branch(f.branch) || {}).name || '')], ['শাখার ঠিকানা', esc((await Data.branch(f.branch) || {}).address || '')]],
    html: await recPayStatement(f, [[f.date, f.date], [f.date.slice(0, 7) + '-01', f.date], [f.date.slice(0, 4) + '-01-01', f.date], [null, f.date]], ['প্রাপ্তি', ['This Date', 'This Month', 'This Year', 'Cumulative'], 'প্রদান']) }),
});
ReportPage({
  id: 'rptRecPay2', title: 'প্রাপ্তি- প্রদান II', fromDefault: 'month', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, RTYPE],
  run: async f => ({ title: 'Receipt Payment Statement', html: await recPayStatement(f, [[f.from, f.upto]], ['Receipt', ['This Period'], 'Payment']) }),
});

// ── ব্যালেন্স সীট (Statement of Financial Position) ──
async function bsBal(bs, date) {
  const up = await GLX.upto(bs, date);
  const pl = r2(sum(Object.entries(up).filter(([c]) => c[0] === '3'), ([c, x]) => GLX.nat(c, x)) - sum(Object.entries(up).filter(([c]) => c[0] === '4'), ([c, x]) => GLX.nat(c, x)));
  const m = natMap(up, ['1', '2']); m[REF.GL.pl] = r2((m[REF.GL.pl] || 0) + pl); return m;
}
const BS_DATES = d => [d, prevMonthEnd(d), prevYearEnd(d)];
ReportPage({
  id: 'rptBalanceSheet', title: 'ব্যালেন্স সীট', landscape: true, filters: [F.branch, F.btype, { ...F.date, l: 'Report Date' }], buttons: [['🖨️ Print All Branch', 'all']],
  run: async (f, mode) => {
    if (mode === 'all') f.btype = 'all';
    const bs = await GLX.branchesFor(f); const vals = []; for (const d of BS_DATES(f.date)) vals.push(await bsBal(bs, d));
    const A = await treeMulti(vals, ['1']), Lb = await treeMulti(vals, ['2']);
    const tA = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '1'), ([, x]) => x)), tL = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '2'), ([, x]) => x));
    const cols = ['আজকের তারিখ', 'পূর্বের মাস', 'পূর্বের বছর'];
    return { title: 'Statement of Financial Position', info: [['রিপোর্টিং তারিক', fmtD(f.date)], ['শাখার নাম', f.btype === 'all' ? 'All Branch' : esc((await Data.branch(f.branch) || {}).name || '')], ['শাখার ঠিকানা', esc((await Data.branch(f.branch) || {}).address || '')]],
      html: sideBySide('সম্পদ', 'দায়সমূহ', cols, A, Lb, [['Total :', tA]], [['Total :', tL]]) + (Math.abs(tA[0] - tL[0]) > 0.01 ? `<div class="alert alert-danger no-print">ব্যালেন্স মিলছে না: পার্থক্য ${amt(tA[0] - tL[0])}</div>` : '') };
  },
});
ReportPage({
  id: 'rptBalanceSheet2', title: 'ব্যালেন্স সীট II', filters: [F.branch, F.btype, { ...F.date, l: 'Report Date' }], buttons: [['🖨️ Print All Branch', 'all']],
  run: async (f, mode) => {
    if (mode === 'all') f.btype = 'all';
    const bs = await GLX.branchesFor(f); const vals = []; for (const d of BS_DATES(f.date)) vals.push(await bsBal(bs, d));
    return { title: 'Statement of Financial Position', html: treeTable(await treeMulti(vals, ['1', '2']), ['This Date', 'Last Month', 'Last Year'], { code: 1 }) };
  },
});

// ── লাভ-ক্ষতি (Statement of Income & Expenses) ──
async function ieVals(bs, date) { return natMap(await GLX.upto(bs, date), ['3', '4']); }
ReportPage({
  id: 'rptIncomeExp', title: 'লাভ-ক্ষতি', landscape: true, filters: [F.branch, F.btype, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const bs = await GLX.branchesFor(f); const ds = [f.date, f.date, prevMonthEnd(f.date), prevYearEnd(f.date)]; const vals = []; for (const d of ds) vals.push(await ieVals(bs, d));
    const I = await treeMulti(vals, ['3']), E = await treeMulti(vals, ['4']);
    const tI = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '3'), ([, x]) => x)), tE = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '4'), ([, x]) => x));
    const np = tI.map((v, i) => Math.max(0, r2(v - tE[i]))), nl = tI.map((v, i) => Math.max(0, r2(tE[i] - v)));
    return { title: 'Statement of Income & Expenses', html: sideBySide('INCOME', 'EXPENSES', ['This Date', 'This Month', 'Last Month', 'Last Year'], I, E, [['Net Profit :', np], ['Total :', tI.map((v, i) => v + nl[i])]], [['Net Loss :', nl], ['Total :', tE.map((v, i) => v + np[i])]]) };
  },
});
ReportPage({
  id: 'rptIncomeExp2', title: 'লাভ-ক্ষতি II', filters: [F.branch, F.btype, { ...F.date, l: 'Report Date' }],
  run: async f => {
    const bs = await GLX.branchesFor(f); const vals = []; for (const d of [f.date, prevMonthEnd(f.date), prevYearEnd(f.date)]) vals.push(await ieVals(bs, d));
    const net = vals.map(v => r2(sum(Object.entries(v).filter(([c]) => c[0] === '3'), ([, x]) => x) - sum(Object.entries(v).filter(([c]) => c[0] === '4'), ([, x]) => x)));
    return { title: 'Statement of Income & Expenses', html: treeTable(await treeMulti(vals, ['3', '4']), ['This Date', 'Last Month', 'Last Year'], { code: 1, foot: `<tfoot><tr><td colspan="2" class="r"><b>Net Profit/Loss :</b></td>${net.map(v => `<td class="r"><b>${amt(v)}</b></td>`).join('')}</tr></tfoot>` }) };
  },
});
// ── আয়-ব্যায় হিসাব (Statement of Profit & Loss) ──
ReportPage({
  id: 'rptProfitLoss', title: 'আয়-ব্যায় হিসাব', fromDefault: 'month', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  buttons: [['🖨️ Print Income Statement', 'inc'], ['🖨️ Print Expense Statement', 'exp']],
  run: async (f, mode) => {
    const bs = await GLX.branchesFor(f); const vals = [natMap(await GLX.range(bs, f.from, f.upto), ['3', '4']), await ieVals(bs, f.upto)];
    let I = await treeMulti(vals, ['3']), E = await treeMulti(vals, ['4']); if (mode === 'inc') E = []; if (mode === 'exp') I = [];
    const tI = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '3'), ([, x]) => x)), tE = vals.map(v => sum(Object.entries(v).filter(([c]) => c[0] === '4'), ([, x]) => x));
    const np = tI.map((v, i) => Math.max(0, r2(v - tE[i]))), nl = tI.map((v, i) => Math.max(0, r2(tE[i] - v)));
    return { title: 'Statement of Profit & Loss', html: sideBySide('INCOME', 'EXPENSES', ['This Period', 'Cumulative'], I, E, [['Net Profit :', np]], [['Net Loss :', nl]]) };
  },
});

// ── ট্রায়াল ব্যালেন্স (Consolidated Trial Balance) ──
async function tbRows(bs, from, upto) {
  const ob = await GLX.before(bs, from), pr = await GLX.range(bs, from, upto), cb = await GLX.upto(bs, upto);
  const rows = await treeMulti([rawMap(ob, 'dr'), rawMap(ob, 'cr'), rawMap(pr, 'dr'), rawMap(pr, 'cr'), rawMap(cb, 'dr'), rawMap(cb, 'cr')], ['1', '2', '3', '4']);
  return rows;
}
ReportPage({
  id: 'rptTrialBalance', title: 'ট্রায়াল ব্যালেন্স', landscape: true, fromDefault: 'month', filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const rows = await tbRows(await GLX.branchesFor(f), f.from, f.upto);
    const lv = (i) => ({ r: 1, f: r => `${r.leaf ? '' : '<b>'}${amt(r.vals[i])}${r.leaf ? '' : '</b>'}` });
    return { title: 'Consolidated Trial Balance Report', html: UI.table([SL, { h: 'Particular', f: r => `<span style="padding-left:${r.depth * 10}px">${r.leaf ? '' : '<b>'}${esc(r.name)} [${r.code}]${r.leaf ? '' : '</b>'}</span>` },
      { g: 'Balance at the beginning', h: 'Debit', ...lv(0) }, { g: 'Balance at the beginning', h: 'Credit', ...lv(1) }, { g: 'During this period', h: 'Debit', ...lv(2) }, { g: 'During this period', h: 'Credit', ...lv(3) }, { g: 'Closing Balance (Cumulative)', h: 'Debit', ...lv(4) }, { g: 'Closing Balance (Cumulative)', h: 'Credit', ...lv(5) }], rows) };
  },
});
ReportPage({
  id: 'rptTrialBalance2', title: 'ট্রায়াল ব্যালেন্স II', fromDefault: 'month', filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const pr = await GLX.range(await GLX.branchesFor(f), f.from, f.upto); const rows = await treeMulti([rawMap(pr, 'dr'), rawMap(pr, 'cr')], ['1', '2', '3', '4']);
    const leaf = rows.filter(r => r.leaf);
    return { title: 'Consolidated Trial Balance Report', html: UI.table([SL, { h: 'Ledger Code', f: r => r.code }, { h: 'Ledger Name', f: r => `${r.leaf ? '' : '<b>'}${esc(r.name)} [${r.code}]${r.leaf ? '' : '</b>'}` }, { h: 'Debit', f: r => amt(r.vals[0]), r: 1 }, { h: 'Credit', f: r => amt(r.vals[1]), r: 1 }], rows) + `<table><tr><td class="r"><b>Total (Leaf) :</b></td><td class="r" style="width:120px"><b>${amt(sum(leaf, r => r.vals[0]))}</b></td><td class="r" style="width:120px"><b>${amt(sum(leaf, r => r.vals[1]))}</b></td></tr></table>` };
  },
});

// ── ক্যাশবুক (Cash & Bank Book Report) ──
ReportPage({
  id: 'rptCashBook', title: 'ক্যাশবুক (Cash & Bank)', landscape: true, filters: [F.branch, F.btype, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  buttons: [['🖨️ Debit Voucher', 'dv'], ['🖨️ Credit Voucher', 'cv']],
  run: async (f, mode) => {
    const lm = await Data.ledgerMap(); const bs = await GLX.branchesFor(f);
    const cashCodes = Object.keys(lm).filter(c => isCashGl(lm, c) && lm[c].leaf);
    const vs = []; for (const b of bs) (await db.collection('vouchers').where('bd', '>=', b + '_' + f.from).where('bd', '<=', b + '_' + f.upto).get()).docs.forEach(d => { const v = d.data(); if (v.status === 'posted' && v.lines.some(l => cashCodes.includes(l.gl))) vs.push(v); });
    vs.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    if (mode === 'dv' || mode === 'cv') {
      const pick = vs.filter(v => mode === 'dv' ? v.lines.some(l => cashCodes.includes(l.gl) && l.cr) : v.lines.some(l => cashCodes.includes(l.gl) && l.dr));
      return { title: mode === 'dv' ? 'Debit Voucher' : 'Credit Voucher', html: pick.map(v => `<div style="page-break-inside:avoid;margin-bottom:14px;border:1px solid #999;padding:6px"><div class="ig"><p><b>Voucher :</b> ${v.vno}</p><p><b>Date :</b> ${fmtD(v.date)}</p><p></p></div><div>${esc(v.narration)}</div>` + UI.table([{ h: 'Ledger', f: l => glName(lm, l.gl) }, { h: 'Debit', f: l => l.dr ? amt(l.dr) : '', r: 1, sum: 1, v: l => l.dr }, { h: 'Credit', f: l => l.cr ? amt(l.cr) : '', r: 1, sum: 1, v: l => l.cr }], v.lines) + '</div>').join('') };
    }
    const ob = await GLX.before(bs, f.from);
    let cash = sum(cashCodes.filter(c => !isBankGl(c)), c => GLX.nat(c, ob[c])), bank = sum(cashCodes.filter(isBankGl), c => GLX.nat(c, ob[c]));
    const oCash = cash, oBank = bank;
    const rows = [];
    vs.forEach(v => {
      const cl = v.lines.filter(l => cashCodes.includes(l.gl)); const other = v.lines.filter(l => !cashCodes.includes(l.gl));
      const part = [...new Set(other.map(l => glName(lm, l.gl)))].join(', ') || esc(v.narration);
      const rcC = sum(cl.filter(l => !isBankGl(l.gl)), l => l.dr), rcB = sum(cl.filter(l => isBankGl(l.gl)), l => l.dr), pyC = sum(cl.filter(l => !isBankGl(l.gl)), l => l.cr), pyB = sum(cl.filter(l => isBankGl(l.gl)), l => l.cr);
      cash = r2(cash + rcC - pyC); bank = r2(bank + rcB - pyB);
      rows.push({ date: v.date, part: part + `<div class="mini">${esc(v.narration)}</div>`, rcC, rcB, pyC, pyB, bC: cash, bB: bank });
    });
    const tR = sum(rows, r => r.rcC + r.rcB), tP = sum(rows, r => r.pyC + r.pyB);
    const info = [['রিপোর্ট তারিখ', `${fmtD(f.from)} - ${fmtD(f.upto)}`], ['ওপেনিং হাতে নগদ', amt(oCash)], ['মোট ওপেনিং টাকা', amt(oCash + oBank)], ['ব্যাংক ওপেনিং', amt(oBank)], ['শাখা', esc((await Data.branch(f.branch) || {}).name || '')], ['আজকের মোট গ্রহন', amt(tR)], ['আজকের উদৃত্ত হিসাব', amt(oCash + oBank + tR - tP)], ['আজকের মোট প্রদান', amt(tP)], ['Branch Address', esc((await Data.branch(f.branch) || {}).address || '')], ['Closing Cash', amt(cash)], ['Closing Balance', amt(cash + bank)], ['Closing Bank', amt(bank)]];
    const foot = `<tfoot><tr><td colspan="3" class="r"><b>Total During This Period :</b></td>${[sum(rows, r => r.rcC), sum(rows, r => r.rcB), sum(rows, r => r.pyC), sum(rows, r => r.pyB), cash, bank].map(v => `<td class="r"><b>${amt(v)}</b></td>`).join('')}</tr><tr><td colspan="3" class="r"><b>Closing Total :</b></td>${[oCash + sum(rows, r => r.rcC), oBank + sum(rows, r => r.rcB), sum(rows, r => r.pyC), sum(rows, r => r.pyB), cash, bank].map(v => `<td class="r"><b>${amt(v)}</b></td>`).join('')}</tr></tfoot>`;
    const tbl = UI.table([SL, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Particular', f: r => r.part }, { g: 'Receipt (Debit)', h: 'Cash', f: r => amt(r.rcC), r: 1 }, { g: 'Receipt (Debit)', h: 'Bank', f: r => amt(r.rcB), r: 1 }, { g: 'Payment (Credit)', h: 'Cash', f: r => amt(r.pyC), r: 1 }, { g: 'Payment (Credit)', h: 'Bank', f: r => amt(r.pyB), r: 1 }, { g: 'Balance', h: 'Cash', f: r => amt(r.bC), r: 1 }, { g: 'Balance', h: 'Bank', f: r => amt(r.bB), r: 1 }], rows).replace('</table></div>', foot + '</table></div>');
    return { title: 'Cash & Bank Book Report', info, html: tbl };
  },
});

// ── Back Date / Cancel Transaction ──
const vRows = async (f, flt) => (await db.collection('vouchers').where('bd', '>=', f.branch + '_' + f.from).where('bd', '<=', f.branch + '_' + f.upto).get()).docs.map(d => d.data()).filter(flt).filter(v => (!f.user || v.by === f.user)).sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
const userFilter = { k: 'user', l: 'User Name', t: 'select', opts: [['', '------------']] };
const fillUsers = async (el, f) => { const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })); UI.fill(UI.el(f, 'user'), us, u => u.id, u => u.userId || u.email, '------------'); };
async function vName(f) { const aidx = await Data.accIdx(f.branch); const mem = await Data.memberIdx(f.branch); return v => { const a = (v.accs || [])[0]; const r = aidx[a]; return esc(r ? (r[5] || (mem[r[0]] || [])[0] || '') : ((v.ref && v.ref.memberId && (mem[v.ref.memberId] || [])[0]) || v.payer || '')); }; }
const vCash = (v, side) => sum(v.lines.filter(l => String(l.gl).startsWith('111')), l => l[side]) || (side === 'dr' ? 0 : 0);
ReportPage({
  id: 'rptBackDate', title: 'Back Date Transaction', landscape: true, fromDefault: 'month', filters: [F.branch, F.samity, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, userFilter], init: fillUsers,
  run: async f => { const nm = await vName(f); return { title: 'Back Date Transaction Report', html: UI.table([SL, { h: 'Business Date', f: v => fmtD(v.businessDate) }, { h: 'Transaction Date', f: v => fmtD(v.date) }, { h: 'Name', f: nm }, { h: 'Transaction Details', f: v => esc(v.narration) }, { h: 'Doc Number', f: v => esc(v.docNo || '') }, { h: 'Receive Amount', f: v => amt(vCash(v, 'dr')), r: 1, sum: 1, v: v => vCash(v, 'dr') }, { h: 'Payment Amount', f: v => amt(vCash(v, 'cr')), r: 1, sum: 1, v: v => vCash(v, 'cr') }, { h: 'Posting User', f: v => esc(v.byName || '') }, { h: 'Posting Time', f: v => tsStr(v.on) }], await vRows(f, v => v.businessDate && v.date < v.businessDate)) }; },
});
ReportPage({
  id: 'rptCancelList', title: 'Transaction Cancel List', landscape: true, fromDefault: 'month', filters: [F.branch, F.samity, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, userFilter], init: fillUsers,
  run: async f => { const nm = await vName(f); return { title: 'Cancel Transaction Report', html: UI.table([SL, { h: 'Business Date', f: v => fmtD(v.businessDate) }, { h: 'Transaction Date', f: v => fmtD(v.date) }, { h: 'Name', f: nm }, { h: 'Transaction Details', f: v => esc(v.narration) + (v.cancelReason ? '<div class="mini">কারণ: ' + esc(v.cancelReason) + '</div>' : '') }, { h: 'Doc Number', f: v => esc(v.docNo || '') }, { h: 'Batch NO', f: v => v.vno }, { h: 'Receive Amount', f: v => amt(vCash(v, 'dr')), r: 1, sum: 1, v: v => vCash(v, 'dr') }, { h: 'Payment Amount', f: v => amt(vCash(v, 'cr')), r: 1, sum: 1, v: v => vCash(v, 'cr') }, { h: 'Posting User', f: v => esc(v.byName || '') }, { h: 'Posting Time', f: v => tsStr(v.on) }, { h: 'Cancel User', f: v => esc(v.cancelBy || '') }, { h: 'Cancel Time', f: v => tsStr(v.cancelOn) }], await vRows(f, v => v.status === 'cancelled')) }; },
});
