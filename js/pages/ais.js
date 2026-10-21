// ═══════════════════════════════════════════════════════════════
// এ্যাকাউন্টস (এ.আই.এস) — লেনদেন, জার্নাল, কন্ট্রা, অনুমোদন, ভাউচার, COA
// + GLX: glDaily/glMonthly থেকে দ্রুত লেজার ব্যালেন্স
// ═══════════════════════════════════════════════════════════════
const DOCID = () => firebase.firestore.FieldPath.documentId();
const GLX = {
  async branchesFor(f) {
    const all = (await Data.branches()).map(b => b.code);
    if (!f.branch || f.btype === 'all') return allowedBranches() ? all.filter(c => allowedBranches().includes(c)) : all;
    if (f.btype === 'others') return all.filter(c => c !== f.branch);
    return [f.branch];
  },
  add(acc, gl) { Object.entries(gl || {}).forEach(([c, x]) => { acc[c] = acc[c] || { dr: 0, cr: 0 }; acc[c].dr += num(x.dr); acc[c].cr += num(x.cr); }); },
  // [from, upto] এর মধ্যে দৈনিক মোট {code:{dr,cr}}; byDate=true হলে {date:{code:{dr,cr}}}
  async range(branches, from, upto, byDate, field = 'gl') {
    const out = {};
    for (const b of branches) {
      const s = await db.collection('glDaily').where(DOCID(), '>=', b + '_' + from).where(DOCID(), '<=', b + '_' + upto).get();
      s.forEach(d => { const x = d.data(); if (byDate) { out[x.date] = out[x.date] || {}; GLX.add(out[x.date], x[field]); } else GLX.add(out, x[field]); });
    }
    return out;
  },
  // date এর আগ পর্যন্ত সমষ্টি (ওপেনিং)
  async before(branches, date) {
    const out = {}; const month = date.slice(0, 7);
    for (const b of branches) {
      const ms = await db.collection('glMonthly').where(DOCID(), '>=', b + '_0000').where(DOCID(), '<', b + '_' + month).get();
      ms.forEach(d => GLX.add(out, d.data().gl));
      if (date.slice(8) !== '01') { const ds = await db.collection('glDaily').where(DOCID(), '>=', b + '_' + month + '-01').where(DOCID(), '<', b + '_' + date).get(); ds.forEach(d => GLX.add(out, d.data().gl)); }
    }
    return out;
  },
  async upto(branches, date) { return GLX.before(branches, addDays(date, 1)); },
  // স্বাভাবিক ব্যালেন্স (সম্পদ/ব্যয় = ডেবিট−ক্রেডিট, দায়/আয় = ক্রেডিট−ডেবিট)
  nat(code, x) { const d = num(x && x.dr), c = num(x && x.cr); return (code[0] === '1' || code[0] === '4') ? r2(d - c) : r2(c - d); },
  // গ্রুপ রোলআপ: leaf ব্যালেন্স → সব parent এ যোগ
  rollup(ledgers, bal) {
    const byCode = {}; ledgers.forEach(l => byCode[l.code] = l);
    const tot = {};
    Object.entries(bal).forEach(([code, v]) => { let c = code; let guard = 0; while (c && guard++ < 10) { tot[c] = (tot[c] || 0) + v; c = byCode[c] ? byCode[c].parent : ''; } });
    return tot;
  },
  async ledgerBalance(branch, code, date) { const x = await GLX.upto([branch], date); return GLX.nat(code, x[code]); },
};

// ── এ্যাকাউন্টস লেনদেন (অন্যান্য একাউন্ট) ──
App.page('accTxn', {
  title: 'এ্যাকাউন্টস লেনদেন (Account Transaction)', icon: '🏦',
  render: () => UI.card('', UI.grid([F.branch, { k: 'tt', l: 'Transaction Type', t: 'select', req: 1, opts: [['', '----------'], ...REF.ACC_TT.map(x => [x[0], x[1]])] }, { k: 'method', l: 'Receipt/Payment Method', t: 'select', req: 1 }, { k: 'account', l: 'Transaction Account', t: 'select', req: 1 },
    { k: 'balance', l: 'Current Balance', ro: 1 }, { k: 'amount', l: 'Transaction Amount', t: 'number', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }, { k: 'docNo', l: 'Document Number (Bank Cheque)' },
    { k: 'comments', l: 'Comments', t: 'textarea' }, { k: 'payerPhone', l: 'Receiver/Payer Phone' }, { k: 'payerName', l: 'Receiver/Payer Name' }, { k: 'file', l: 'Upload Documents', t: 'file', accept: 'image/*' }], 4)
    + `<div class="actions">${UI.btn('✅ Post Transaction', 'AccTxn.save(this)', 'btn-success')}</div>`) + UI.card('সাম্প্রতিক লেনদেন', '<div class="tl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.ledger(UI.el(el, 'method'), l => l.cashBank && l.leaf); UI.el(el, 'method').value = REF.GL.cash;
    UI.el(el, 'date').value = await businessDate();
    const load = async () => { const t = REF.ACC_TT.find(x => x[0] === UI.el(el, 'tt').value); const list = t ? (await Data.accountsOf(UI.el(el, 'branch').value, null, 'other', t[2])).filter(a => a.status !== 'closed') : []; UI.fill(UI.el(el, 'account'), list, a => a.accNo, a => a.accNo + ' - ' + a.title); };
    UI.el(el, 'tt').addEventListener('change', load); UI.el(el, 'branch').addEventListener('change', load);
    UI.el(el, 'account').addEventListener('change', async () => { await showBal(el, UI.el(el, 'account').value); accTxnList(el, UI.el(el, 'account').value); });
  },
});
const AccTxn = {
  save(btn) {
    const el = $('#page-accTxn');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const t = REF.ACC_TT.find(x => x[0] === f.tt); const a = await Tx.acc(f.account);
      const fileUrl = f.file ? await uploadImage(f.file) : '';
      const opts = { contraGl: f.method, tt: t[3] === 'R' ? 'OTHER_RCV' : 'OTHER_PAY', docNo: f.docNo, narration: f.comments, allowNegative: num(a.creditLimit) > 0 };
      if (t[3] === 'P' && num(a.creditLimit) > 0 && num(a.balance) - num(f.amount) < -num(a.creditLimit)) fail('ক্রেডিট লিমিট অতিক্রম');
      const part = t[3] === 'R' ? await Tx.credit(a, f.amount, opts) : await Tx.debit(a, f.amount, { ...opts, internal: true });
      part.txns[0].payer = f.payerName; part.txns[0].payerPhone = f.payerPhone; part.txns[0].fileUrl = fileUrl;
      const pending = needsAuth(t[3] === 'R' ? 'vrcv' : 'vpay', f.amount);
      const vno = await Tx.post(f.branch, f.date, 'ACC_TXN', `${t[1]} — ${a.accNo} ${a.title}`, [part], { docNo: f.docNo, payer: f.payerName, status: pending ? 'pending' : 'posted', authType: 'AIS' });
      toast(pending ? '⏳ অনুমোদনের অপেক্ষায় — ' + vno : '✅ লেনদেন পোস্ট হয়েছে — ' + vno);
      ['amount', 'docNo', 'comments', 'payerPhone', 'payerName'].forEach(k => UI.el(el, k).value = '');
      await showBal(el, f.account); accTxnList(el, f.account);
    });
  },
};

// ── লেজার লেনদেন ──
App.page('ledgerTxn', {
  title: 'লেজার লেনদেন (Ledger Transaction)', icon: '📗',
  render: () => UI.card('', UI.grid([F.branch, { k: 'tt', l: 'Transaction Type', t: 'select', req: 1, opts: [['', '----------'], ...REF.LEDGER_TT.map(x => [x[0], x[1]])] }, { k: 'ledger', l: 'Transaction Ledger', t: 'select', req: 1 }, { k: 'balance', l: 'Current Balance', ro: 1 },
    { k: 'amount', l: 'Transaction Amount', t: 'number', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }, { k: 'docNo', l: 'Document Number (Bank Cheque)' }, { k: 'comments', l: 'Comments', t: 'textarea' },
    { k: 'payerPhone', l: 'Receiver/Payer Phone' }, { k: 'payerName', l: 'Receiver/Payer Name' }, { k: 'file', l: 'Upload Documents', t: 'file' }], 4)
    + `<div class="actions">${UI.btn('✅ Post Transaction', 'LedgerTxn.save(this)', 'btn-success')}</div>`) + UI.card('আজকের লেজার লেনদেন', '<div class="vl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'tt').addEventListener('change', async () => {
      const k = (REF.LEDGER_TT.find(x => x[0] === UI.el(el, 'tt').value) || [])[2];
      const flt = k === 'BD' || k === 'BW' ? l => l.leaf && l.cashBank && l.code !== REF.GL.cash : k === 'EXP' ? l => l.leaf && l.code[0] === '4' : k === 'INC' ? l => l.leaf && l.code[0] === '3' : () => false;
      await Pick.ledger(UI.el(el, 'ledger'), flt);
    });
    UI.el(el, 'ledger').addEventListener('change', async () => { UI.el(el, 'balance').value = UI.el(el, 'ledger').value ? await GLX.ledgerBalance(UI.el(el, 'branch').value, UI.el(el, 'ledger').value, UI.el(el, 'date').value) : ''; });
    VList.today(el, ['LEDGER_TXN']);
  },
});
const LedgerTxn = {
  save(btn) {
    const el = $('#page-ledgerTxn');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const k = REF.LEDGER_TT.find(x => x[0] === f.tt)[2]; const amtv = num(f.amount);
      const cash = REF.GL.cash; let lines;
      if (k === 'BD') lines = [{ gl: f.ledger, dr: amtv }, { gl: cash, cr: amtv }];
      else if (k === 'BW') lines = [{ gl: cash, dr: amtv }, { gl: f.ledger, cr: amtv }];
      else if (k === 'EXP') lines = [{ gl: f.ledger, dr: amtv }, { gl: cash, cr: amtv }];
      else lines = [{ gl: cash, dr: amtv }, { gl: f.ledger, cr: amtv }];
      const fileUrl = f.file ? await uploadImage(f.file) : '';
      const pending = needsAuth(k === 'EXP' || k === 'BD' ? 'vpay' : 'vrcv', amtv);
      const vno = await Eng.post({ branch: f.branch, date: f.date, type: 'LEDGER_TXN', narration: `${UI.el(el, 'tt').selectedOptions[0].text} — ${UI.el(el, 'ledger').selectedOptions[0].text}${f.comments ? ' — ' + f.comments : ''}`, docNo: f.docNo, payer: f.payerName, lines, status: pending ? 'pending' : 'posted', authType: 'AIS', ref: { payerPhone: f.payerPhone, fileUrl } });
      toast(pending ? '⏳ অনুমোদনের অপেক্ষায় — ' + vno : '✅ লেনদেন পোস্ট হয়েছে — ' + vno);
      ['amount', 'docNo', 'comments', 'payerPhone', 'payerName'].forEach(x => UI.el(el, x).value = ''); UI.el(el, 'ledger').dispatchEvent(new Event('change')); VList.today(el, ['LEDGER_TXN']);
    });
  },
};

// ── জার্নাল / কন্ট্রা (একাধিক লাইন) ──
function MultiLinePage(id, title, contra) {
  App.page(id, {
    title, icon: contra ? '🔁' : '📓',
    render: () => UI.card('', UI.grid([F.branch, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }, { k: 'narration', l: 'Journal Comments', t: 'textarea', req: 1 }, { k: 'docNo', l: 'Document Number (Bank Cheque)' }], 4)
      + `<div class="card-title">লাইন যোগ করুন</div>` + UI.grid(contra
        ? [{ k: 'drGl', l: 'Debit Ledger', t: 'select' }, { k: 'crGl', l: 'Credit Ledger', t: 'select' }, { k: 'amt', l: 'Transaction Amount', t: 'number' }, { k: 'memo', l: 'Comments' }]
        : [{ k: 'side', l: 'Transaction Type', t: 'select', opts: [['dr', 'Debit'], ['cr', 'Credit']] }, { k: 'gl', l: 'Transaction Ledger', t: 'select' }, { k: 'acc', l: 'Transaction Account (ঐচ্ছিক)', t: 'select' }, { k: 'amt', l: 'Transaction Amount', t: 'number' }, { k: 'memo', l: 'Comments' }], 4)
      + `<div class="actions">${UI.btn('➕ Add Item', `ML.add('${id}',${contra})`, 'btn-outline')}${UI.btn('🗑️ Clear All', `ML.clear('${id}')`, 'btn-secondary')}</div><div class="ml-lines" style="margin-top:8px"></div>
      <div class="kv"><div>Total Debit<b class="tdr">0</b></div><div>Total Credit<b class="tcr">0</b></div></div><div class="actions">${UI.btn('✅ Submit Voucher', `ML.submit('${id}',this)`, 'btn-success')}</div>`)
      + (contra ? UI.card('📘 Accounting Entry Help / হিসাব এন্ট্রি সহায়তা', UI.table([{ h: 'Account Type / অ্যাকাউন্টের ধরন', f: r => r[0] }, { h: 'Example / উদাহরণ', f: r => r[1] }, { h: 'If Increased / বৃদ্ধি হলে', f: r => r[2] }, { h: 'If Decreased / হ্রাস হলে', f: r => r[3] }], [['Asset / সম্পদ', 'Cash, Bank, Loan', 'Debit', 'Credit'], ['Liability / দায়', 'Savings, Payable', 'Credit', 'Debit'], ['Income / আয়', 'Service Charge, Fee', 'Credit', 'Debit'], ['Expense / ব্যয়', 'Salary, Rent', 'Debit', 'Credit']])) : ''),
    init: async el => {
      await Pick.branch(el, 'branch'); UI.el(el, 'date').value = await businessDate(); el._lines = [];
      for (const k of contra ? ['drGl', 'crGl'] : ['gl']) await Pick.ledger(UI.el(el, k), l => l.leaf);
      if (!contra) UI.el(el, 'gl').addEventListener('change', async () => {
        const g = UI.el(el, 'gl').value; const kinds = Object.entries(REF.DEP).filter(([, d]) => d.gl === g).map(([t]) => ['dep', t]).concat(Object.entries(REF.LOAN).filter(([, d]) => d.gl === g).map(([t]) => ['loan', t])).concat(Object.entries(REF.OTHER).filter(([, d]) => d.gl === g).map(([t]) => ['other', t])).concat(g === REF.GL.share ? [['share', 'share']] : []);
        let accs = []; for (const [k, t] of kinds) accs.push(...(await Data.accountsOf(UI.el(el, 'branch').value, null, k, t)).filter(a => a.status === 'active'));
        UI.fill(UI.el(el, 'acc'), accs, a => a.accNo, a => a.accNo + ' - ' + a.title, accs.length ? '— একাউন্ট বাছুন —' : '— প্রযোজ্য নয় —');
      });
    },
  });
}
MultiLinePage('journal', 'Journal Entry (জার্নাল ভাউচার)', false);
MultiLinePage('contra', 'বিনিময় লেনদেন (Transfer Transaction)', true);
const ML = {
  add(id, contra) {
    const el = $('#page-' + id); const f = UI.get(el); const a = num(f.amt); if (a <= 0) return toast('পরিমাণ দিন', 'error');
    if (contra) { if (!f.drGl || !f.crGl || f.drGl === f.crGl) return toast('ভিন্ন Debit ও Credit লেজার দিন', 'error'); el._lines.push({ gl: f.drGl, dr: a, memo: f.memo }, { gl: f.crGl, cr: a, memo: f.memo }); }
    else { if (!f.gl) return toast('লেজার বাছাই করুন', 'error'); if (UI.el(el, 'acc').options.length > 1 && !f.acc) return toast('এই লেজারের জন্য একাউন্ট বাছাই করুন', 'error'); el._lines.push({ gl: f.gl, [f.side]: a, accNo: f.acc || '', memo: f.memo }); }
    UI.el(el, 'amt').value = ''; UI.el(el, 'memo').value = ''; ML.draw(el);
  },
  clear(id) { const el = $('#page-' + id); el._lines = []; ML.draw(el); },
  async draw(el) {
    const lm = await Data.ledgerMap();
    $('.ml-lines', el).innerHTML = UI.table([{ h: 'Ledger Code', f: l => l.gl }, { h: 'Ledger Name', f: l => esc((lm[l.gl] || {}).name || '') }, { h: 'Account', f: l => l.accNo || '' }, { h: 'Debit', f: l => l.dr ? amt(l.dr) : '', r: 1 }, { h: 'Credit', f: l => l.cr ? amt(l.cr) : '', r: 1 }, { h: 'Comments', f: l => esc(l.memo || '') }, { h: 'Action', f: l => `<button class="btn btn-danger btn-sm" onclick="ML.del(this,${el._lines.indexOf(l)})">✖</button>` }], el._lines);
    $('.tdr', el).textContent = amt(sum(el._lines, l => l.dr)); $('.tcr', el).textContent = amt(sum(el._lines, l => l.cr));
  },
  del(btn, i) { const el = btn.closest('.page'); el._lines.splice(i, 1); ML.draw(el); },
  submit(id, btn) {
    const el = $('#page-' + id);
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.narration) fail('Journal Comments দিন'); if (!el._lines.length) fail('লাইন যোগ করুন');
      const dr = r2(sum(el._lines, l => l.dr)), cr = r2(sum(el._lines, l => l.cr)); if (dr !== cr) fail(`ডেবিট ${amt(dr)} ≠ ক্রেডিট ${amt(cr)}`);
      // একাউন্ট-সংযুক্ত লাইন → একাউন্ট ব্যালেন্সও আপডেট
      const txns = [], accOps = [];
      for (const l of el._lines.filter(x => x.accNo)) {
        const a = await Tx.acc(l.accNo); const v = r2(num(l.cr) - num(l.dr)); // দায় একাউন্টে ক্রেডিট = ব্যালেন্স বৃদ্ধি
        const sign = a.kind === 'loan' ? -1 : 1; const delta = r2(v * sign);
        txns.push({ accNo: a.accNo, kind: a.kind, type: a.type, memberId: a.memberId || '', samity: a.samity || '', tt: 'JV', amount: Math.abs(v), dc: (a.kind === 'loan' ? v > 0 : v > 0) ? 'C' : 'D', narration: f.narration });
        accOps.push({ accNo: a.accNo, samity: a.samity, inc: a.kind === 'loan' ? { balance: delta } : { balance: delta, [delta >= 0 ? 'totCr' : 'totDr']: Math.abs(delta) }, snapInc: a.samity ? { b: delta } : {} });
      }
      const vno = await Eng.post({ branch: f.branch, date: f.date, type: id === 'contra' ? 'CONTRA' : 'JV', narration: f.narration, docNo: f.docNo, lines: el._lines, txns, accOps, status: needsAuth('vpay', dr) ? 'pending' : 'posted', authType: 'AIS' });
      toast('✅ ভাউচার পোস্ট হয়েছে — ' + vno); ML.clear(id); UI.el(el, 'narration').value = '';
    });
  },
};

// ── অনুমোদন তালিকা ──
function AuthPage(id, title, types) {
  App.page(id, {
    title, icon: '🛂',
    render: () => `<div class="report-filter">${UI.grid([{ ...F.branch }, { k: 'user', l: 'User ID', t: 'select' }, types === 'member' ? { k: 'atype', l: 'Transaction Type', t: 'select', opts: [['', '----------'], ['Member Admission', 'Member Admission'], ['Deposit Payment', 'Deposit Payment'], ['Deposit Receive', 'Deposit Receive']] } : null].filter(Boolean), 4)}<div class="filter-actions">${UI.btn('🔍 Search Transaction', `AuthL.load('${id}',this)`)}</div></div><div class="card al"></div>`,
    init: async el => { await Pick.branch(el, 'branch'); const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })); UI.fill(UI.el(el, 'user'), us, u => u.id, u => u.userId || u.email, '— সব —'); el._types = types; AuthL.load(id); },
  });
}
AuthPage('authList', 'অনুমোদন তালিকা (Member / Deposit)', 'member');
AuthPage('tranAuthList', 'লেনদেন অনুমোদনের তালিকা (AIS)', 'ais');
const AuthL = {
  load(id, btn) {
    const el = $('#page-' + id);
    return guard(btn, async () => {
      const f = UI.get(el);
      let rows = (await db.collection('vouchers').where('status', '==', 'pending').get()).docs.map(d => d.data()).filter(v => v.branch === f.branch && (!f.user || v.by === f.user));
      rows = rows.filter(v => el._types === 'ais' ? v.authType === 'AIS' : v.authType !== 'AIS').filter(v => !f.atype || v.authType === f.atype);
      const lm = await Data.ledgerMap();
      $('.al', el).innerHTML = UI.table([{ h: 'Branch Code', f: v => v.branch }, { h: 'Transaction Type', f: v => esc(v.authType || v.type) }, { h: 'Transaction Date', f: v => fmtD(v.date) }, { h: 'Details', f: v => esc(v.narration) + '<div class="mini">' + v.lines.map(l => `${esc((lm[l.gl] || {}).name || l.gl)} ${l.dr ? 'Dr ' + amt(l.dr) : 'Cr ' + amt(l.cr)}`).join(' | ') + '</div>' }, { h: 'Amount', f: v => amt(v.total), r: 1 }, { h: 'Entered By', f: v => v.byName }, { h: 'Entry Time', f: v => tsStr(v.on) },
        { h: 'Action', f: v => `<span class="list-actions">${UI.btn('✅ Approve', `AuthL.approve('${id}','${v.vno}',this)`, 'btn-success btn-sm')}${UI.btn('✖ Reject', `AuthL.reject('${id}','${v.vno}',this)`, 'btn-danger btn-sm')}</span>` }], rows, { empty: 'অনুমোদনের অপেক্ষায় কিছু নেই' });
    });
  },
  approve(id, vno, btn) {
    return guard(btn, async () => {
      if (!isBM()) fail('অনুমোদনের অনুমতি নেই');
      const v = (await db.collection('vouchers').doc(vno).get()).data();
      if (v.by === App.user.uid && !isAdmin()) fail('নিজের এন্ট্রি নিজে অনুমোদন করা যাবে না');
      await Eng.approve(vno);
      if (v.authType === 'Member Admission' && v.ref && v.ref.memberId) {
        const m = await Data.member(v.ref.memberId); const b = db.batch();
        b.update(db.collection('members').doc(m.id), { status: 'active', approvedBy: App.user.userId }); Idx.setMember(b, m.branch, { ...m, memberId: m.id, status: 'active' }); await b.commit();
      }
      toast('✅ অনুমোদিত'); AuthL.load(id);
    });
  },
  reject(id, vno, btn) {
    const reason = prompt('বাতিলের কারণ:'); if (reason === null) return;
    return guard(btn, async () => {
      if (!isBM()) fail('অনুমতি নেই');
      const v = await Eng.cancel(vno, reason);
      if (v.authType === 'Member Admission' && v.ref && v.ref.memberId) { const m = await Data.member(v.ref.memberId); const b = db.batch(); b.update(db.collection('members').doc(m.id), { status: 'closed', closeReason: 'Admission rejected: ' + reason }); Idx.setMember(b, m.branch, { ...m, memberId: m.id, status: 'closed' }); await b.commit(); }
      toast('বাতিল হয়েছে'); AuthL.load(id);
    });
  },
};

// ── ভাউচার তালিকা ──
const VList = {
  async today(el, types) {
    const box = $('.vl', el); if (!box) return;
    const f = UI.get(el); const rows = (await db.collection('vouchers').where('bd', '==', f.branch + '_' + f.date).get()).docs.map(d => d.data()).filter(v => !types || types.includes(v.type));
    box.innerHTML = VList.table(rows);
  },
  table(rows, lm) {
    return UI.table([{ h: 'Batch Number', f: v => `<a href="javascript:VList.view('${v.vno}')">${v.vno}</a>` }, { h: 'Transaction Date', f: v => fmtD(v.date) }, { h: 'Business Date', f: v => fmtD(v.businessDate) }, { h: 'Type', f: v => v.type }, { h: 'Amount', f: v => amt(v.total), r: 1, sum: 1, v: v => v.status === 'posted' ? v.total : 0 }, { h: 'Comments', f: v => esc(v.narration || '') }, { h: 'Entry User', f: v => v.byName || '' }, { h: 'Auth User', f: v => v.authBy || '' }, { h: 'Cancel User', f: v => v.cancelBy || '' }, { h: 'Status', f: v => v.status === 'cancelled' ? '<span class="tag red">Cancelled</span>' : v.status === 'pending' ? '<span class="tag orange">Pending</span>' : '<span class="tag green">Posted</span>' },
      { h: 'Action', f: v => `<span class="list-actions no-print">${UI.btn('👁️', `VList.view('${v.vno}')`, 'btn-outline btn-sm')}${v.status === 'posted' ? UI.btn('✖', `VList.cancel('${v.vno}',this)`, 'btn-danger btn-sm') : ''}</span>` }], rows.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno)));
  },
  async view(vno) {
    const v = (await db.collection('vouchers').doc(vno).get()).data(); const lm = await Data.ledgerMap();
    const body = `<div class="meta"><span>ভাউচার: <b>${vno}</b></span><span>তারিখ: ${fmtD(v.date)}</span><span>ধরন: ${v.type}</span></div><div>${esc(v.narration || '')}</div>`
      + UI.table([{ h: 'Ledger Code', f: l => l.gl }, { h: 'Ledger Name', f: l => esc((lm[l.gl] || {}).name || '') }, { h: 'Account', f: l => l.accNo || '' }, { h: 'Debit', f: l => l.dr ? amt(l.dr) : '', r: 1, sum: 1, v: l => l.dr }, { h: 'Credit', f: l => l.cr ? amt(l.cr) : '', r: 1, sum: 1, v: l => l.cr }], v.lines)
      + `<div class="mini">Entry: ${esc(v.byName || '')} ${tsStr(v.on)} ${v.authBy ? '| Auth: ' + esc(v.authBy) : ''} ${v.cancelBy ? '| Cancel: ' + esc(v.cancelBy) + ' (' + esc(v.cancelReason || '') + ')' : ''}</div>`;
    UI.modal('🧾 ভাউচার ' + vno, body, UI.btn('🖨️ ভাউচার প্রিন্ট', `Voucher.print('${vno}')`, 'btn-outline') + UI.btn('🧾 রসিদ', `Receipt.print('${vno}')`, 'btn-outline'));
  },
  cancel(vno, btn) { const reason = prompt('বাতিলের কারণ:'); if (reason === null) return; return guard(btn, async () => { if (!isBM()) fail('অনুমতি নেই'); await Eng.cancel(vno, reason); toast('✅ ভাউচার বাতিল হয়েছে'); btn.closest('tr').querySelector('td:nth-child(10)').innerHTML = '<span class="tag red">Cancelled</span>'; }); },
};
ReportPage({
  id: 'voucherList', title: 'ভাউচার তালিকা', icon: '🧾',
  filters: [F.branch, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'fromB', l: 'From Batch' }, { k: 'toB', l: 'To Number' }, { k: 'bdate', l: 'Business Date', t: 'date' }, { k: 'user', l: 'User ID', t: 'select', opts: [['', '— সব —']] }, { k: 'q', l: 'Comments / Type' }],
  init: async (el, f) => { UI.el(f, 'bdate').value = ''; const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() })); UI.fill(UI.el(f, 'user'), us, u => u.id, u => u.userId || u.email, '— সব —'); },
  run: async f => {
    const rows = (await db.collection('vouchers').where('bd', '>=', f.branch + '_' + f.from).where('bd', '<=', f.branch + '_' + f.upto).get()).docs.map(d => d.data())
      .filter(v => (!f.fromB || v.vno >= f.fromB) && (!f.toB || v.vno <= f.toB) && (!f.bdate || v.businessDate === f.bdate) && (!f.user || v.by === f.user) && (!f.q || (v.narration + ' ' + v.type).toLowerCase().includes(f.q.toLowerCase())));
    return { landscape: true, noSig: true, html: VList.table(rows) };
  },
});

// ── লেনদেন সংশোধন (Transaction Query) ──
ReportPage({
  id: 'tranQuery', title: 'লেনদেন সংশোধন (Transaction Query)', icon: '🛠️',
  filters: [F.branch, { k: 'kind', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ['dep', 'Deposit'], ['loan', 'Loan'], ['share', 'Share'], ['other', 'Others']] }, { k: 'member', l: 'সদস্য', t: 'member' }, { k: 'account', l: 'Select Account', t: 'select' }, { k: 'ledger', l: 'Select Ledger', t: 'select' }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  init: async (el, f) => {
    await Pick.ledger(UI.el(f, 'ledger'), l => l.leaf, '— সব —');
    const load = async () => { const mid = UI.el(f, 'member').dataset.val; const kind = UI.el(f, 'kind').value || null; const list = mid ? await Data.accountsOf(UI.el(f, 'branch').value, mid, kind) : (kind === 'other' ? await Data.accountsOf(UI.el(f, 'branch').value, null, 'other') : []); UI.fill(UI.el(f, 'account'), list, a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type), '— সব —'); };
    UI.el(f, 'member').addEventListener('picked', load); UI.el(f, 'kind').addEventListener('change', load);
  },
  run: async f => {
    const lm = await Data.ledgerMap();
    let rows;
    if (f.account) rows = (await db.collection('txns').where('accNo', '==', f.account).get()).docs.map(d => d.data()).filter(t => t.date >= f.from && t.date <= f.upto).map(t => ({ ...t, gl: Eng.productGl(t.kind, t.type) }));
    else {
      const vs = (await db.collection('vouchers').where('bd', '>=', f.branch + '_' + f.from).where('bd', '<=', f.branch + '_' + f.upto).get()).docs.map(d => d.data());
      rows = []; vs.forEach(v => v.lines.forEach(l => { if ((!f.ledger || l.gl === f.ledger) && (!f.member || (v.ref && v.ref.memberId === f.member) || (l.accNo || '').startsWith(f.member))) rows.push({ date: v.date, gl: l.gl, accNo: l.accNo, dc: l.dr ? 'D' : 'C', amount: l.dr || l.cr, vno: v.vno, docNo: v.docNo, narration: v.narration, cancelled: v.status === 'cancelled', cancelBy: v.cancelBy, cancelOn: v.cancelOn, byName: v.byName, on: v.on, status: v.status }); }));
    }
    rows.sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    return { landscape: true, noSig: true, html: UI.table([{ h: 'Branch', f: () => f.branch }, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Ledger Code', f: r => r.gl || '' }, { h: 'Ledger Name', f: r => esc((lm[r.gl] || {}).name || '') }, { h: 'Account Number', f: r => r.accNo || '' }, { h: 'Receipt/Payment', f: r => r.dc === 'C' ? 'Receipt' : r.dc === 'D' ? 'Payment' : '-' }, { h: 'Tran Amount', f: r => amt(r.amount), r: 1 }, { h: 'Cancel Amount', f: r => r.cancelled ? amt(r.amount) : '', r: 1 }, { h: 'Document Number', f: r => esc(r.docNo || r.vno) }, { h: 'Tran Details', f: r => esc(TT_NAME[r.tt] || r.narration || '') }, { h: 'Cancel User', f: r => r.cancelBy || '' }, { h: 'Cancel Date', f: r => tsStr(r.cancelOn) }, { h: 'Entry User', f: r => r.byName || '' }, { h: 'Entry Date', f: r => tsStr(r.on) },
      { h: 'Action', f: r => r.cancelled ? 'বাতিল' : `<span class="no-print">${UI.btn('👁️', `VList.view('${r.vno}')`, 'btn-outline btn-sm')}${UI.btn('✖', `VList.cancel('${r.vno}',this)`, 'btn-danger btn-sm')}</span>` }], rows) };
  },
});

// ── General Ledger (COA) ──
App.page('glManage', {
  title: 'Manage General Ledger', icon: '📚',
  render: () => UI.card('', UI.grid([{ k: 'name', l: 'Ledger Name', req: 1 }, { k: 'repCode', l: 'Reporting Ledger Code' }, { k: 'serial', l: 'Reporting Order Serial', t: 'number' }, { k: 'parent', l: 'Group Ledger', t: 'select', req: 1 }, { k: 'isGroup', l: 'Group Ledger (হেডিং)', t: 'checkbox' }, { k: 'cashBank', l: 'Cash/Bank লেজার', t: 'checkbox' }], 3)
    + `<div class="actions">${UI.btn('✅ Create New Ledger', 'GLM.save(this)', 'btn-success')}${UI.btn('🖨️ Print COA', 'GLM.print()', 'btn-outline')}</div>`) + UI.card('Search Ledger', `<input id="glq" placeholder="নাম/কোড" oninput="GLM.list()" class="full" style="margin-bottom:8px"><div class="gl"></div>`),
  init: async el => { await Pick.ledger(UI.el(el, 'parent'), l => !l.leaf); GLM.list(); },
});
const GLM = {
  save(btn) {
    const el = $('#page-glManage');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const ls = await Data.ledgers();
      const sib = ls.filter(l => l.parent === f.parent).map(l => l.code).sort();
      let code = sib.length ? String(Number(sib[sib.length - 1]) + 1) : String(Number(f.parent) + 1);
      if (f.isGroup) { const base = Number(f.parent); code = String(base + (ls.filter(l => l.parent === f.parent && !l.leaf).length + 1) * 10000); }
      if (ls.some(l => l.code === code)) fail('কোড সংঘর্ষ: ' + code);
      await db.collection('ledgers').doc(code).set({ code, name: f.name, parent: f.parent, leaf: !f.isGroup, type: { '1': 'A', '2': 'L', '3': 'I', '4': 'E' }[code[0]], cashBank: f.cashBank, repCode: f.repCode || code, serial: num(f.serial) || Number(code), system: false, active: true, createdBy: App.user.userId });
      Cache.drop('ledgers'); toast('✅ লেজার তৈরি হয়েছে — কোড ' + code); UI.reset(el); await Pick.ledger(UI.el(el, 'parent'), l => !l.leaf); GLM.list();
    });
  },
  async rows() { const ls = await Data.ledgers(); const q = ($('#glq') || {}).value || ''; return ls.filter(l => !q || (l.code + ' ' + l.name).toLowerCase().includes(q.toLowerCase())); },
  async list() {
    const ls = await Data.ledgers(); const by = {}; ls.forEach(l => by[l.code] = l);
    $('#page-glManage .gl').innerHTML = UI.table([{ h: 'Ledger Code', f: l => l.leaf ? l.code : `<b>${l.code}</b>` }, { h: 'Ledger Name', f: l => l.leaf ? esc(l.name) : `<b>${esc(l.name)}</b>` }, { h: 'Parent Ledger', f: l => l.parent ? l.parent + ' - ' + esc((by[l.parent] || {}).name || '') : '' }, { h: 'Reporting Ledger', f: l => l.repCode || l.code }, { h: 'ধরন', f: l => l.leaf ? (l.cashBank ? 'Cash/Bank' : 'Ledger') : 'Group' }, { h: 'Action', f: l => !l.system ? UI.btn('✏️', `GLM.rename('${l.code}')`, 'btn-outline btn-sm') : '' }], await GLM.rows());
  },
  async rename(code) { const n = prompt('নতুন নাম:'); if (!n) return; await db.collection('ledgers').doc(code).update({ name: n }); Cache.drop('ledgers'); GLM.list(); },
  async print() { const ls = await Data.ledgers(); printHTML('Chart of Accounts', UI.table([{ h: 'Code', f: l => l.code }, { h: 'Ledger Name', f: l => l.leaf ? '&nbsp;&nbsp;&nbsp;' + esc(l.name) : '<b>' + esc(l.name) + '</b>' }, { h: 'Parent', f: l => l.parent }], ls), { noSig: true }); },
};

// ─── ঐতিহাসিক (as-of) ব্যালেন্স: বর্তমান snapshot − পরবর্তী লেনদেন ───
const Hist = {
  async txnsAfter(branch, date) {
    return (await db.collection('txns').where('bd', '>', branch + '_' + date).where('bd', '<=', branch + '_9999').get()).docs.map(d => d.data()).filter(t => !t.cancelled);
  },
  adjust(s, t) {
    s.b = r2(num(s.b) - num(t.delta));
    if (s.k === 'loan') {
      if (t.dc === 'C') { s.pt = r2(num(s.pt) - num(t.amount)); s.pp = r2(num(s.pp) - num(t.principal)); s.ppr = r2(num(s.ppr) - num(t.profit)); }
      if (t.tt === 'EMI_PENALTY') { s.tr = r2(num(s.tr) - num(t.profit)); s.pf = r2(num(s.pf) - num(t.profit)); }
    } else { if (t.dc === 'C') s.tc = r2(num(s.tc) - num(t.amount)); if (t.dc === 'D') s.td = r2(num(s.td) - num(t.amount)); }
    if (s.cd && s.cd > t.date) {} // no-op
  },
  // শাখা/সমিতির সব একাউন্ট date তারিখের শেষে
  async snapsAt(branch, date, samity) {
    let snaps = await Data.snaps(branch, samity);
    if (date < await businessDate(branch)) {
      const ts = await Hist.txnsAfter(branch, date); const by = {};
      snaps.forEach(s => by[s.accNo] = s);
      ts.forEach(t => { const s = by[t.accNo]; if (s) Hist.adjust(s, t); });
      snaps.forEach(s => { if (s.cd && s.cd > date) s.st = 'active'; });
    }
    return snaps.filter(s => !s.od || s.od <= date).filter(s => s.st !== 'cancelled');
  },
};
const fyStart = d => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return (m >= 7 ? y : y - 1) + '-07-01'; };
