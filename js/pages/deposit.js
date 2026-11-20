// ═══════════════════════════════════════════════════════════════
// ডিপোজিট ট্রানজেকশন + শেয়ার লেনদেন
// ═══════════════════════════════════════════════════════════════
const isRD = t => REF.DEP[t] && REF.DEP[t].dtype === 'RD';
const isFD = t => REF.DEP[t] && REF.DEP[t].dtype === 'FD';
async function accTxnList(el, accNo, tts, cancel = true) {
  const box = $('.tl', el); if (!box) return;
  if (!accNo) { box.innerHTML = ''; return; }
  const rows = (await db.collection('txns').where('accNo', '==', accNo).get()).docs.map(d => d.data()).filter(t => !tts || tts.includes(t.tt)).sort((a, b) => (b.date + b.vno).localeCompare(a.date + a.vno)).slice(0, 100);
  const pid = (el.id || '').replace('page-', ''); const pay = /Pay$|Closing$/.test(pid), shr = /^share/.test(pid);
  const dH = shr ? (pay ? 'Payment Date' : 'Receive Date') : pay ? 'Payment Date' : 'Deposit Date', aH = shr ? (pay ? 'Payment Amount' : 'Receive Amount') : pay ? 'Payment Amount' : 'Deposit Amount';
  box.innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId }, { h: dH, f: r => fmtD(r.date) }, { h: aH, f: r => amt(r.amount), r: 1 }, { h: 'Memo Number', f: r => esc(r.docNo || r.vno) }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Cancel On', f: r => tsStr(r.cancelOn) }, { h: 'Narration', f: r => esc(r.narration || '') },
    { h: 'Action', f: r => r.cancelled ? '<span class="tag red">বাতিল</span>' : `${UI.btn('Print', `Receipt.print('${r.vno}')`, 'btn-info btn-sm')} ${cancel ? UI.btn('Cancel', `DepTx.cancel('${r.vno}',this)`, 'btn-danger btn-sm') : ''}` }], rows, { rowCls: r => r.cancelled ? 'row-cancel' : '' });
}
// একাউন্ট বাছাই হলে ব্যালেন্স দেখানো
async function showBal(el, accNo, key = 'balance') {
  const a = accNo ? await Data.account(accNo) : null; el._acc = a;
  const e = UI.el(el, key); if (e) e.value = a ? r2(a.balance) : '';
  const blk = UI.el(el, 'blocked'); if (blk) blk.value = a ? r2(num(a.block && a.block.amount)) : '';
  return a;
}

// ── জমা / উত্তোলন পেজ ফ্যাক্টরি ──
// eKisti এর হুবহু লেবেল (কিছু পেজ বাংলা, কিছু ইংরেজি)
function DEP_LBL(id, o) {
  if (id === 'depRcv') return { branch: 'শাখা নাম', member: 'সদস্য আইডি', account: 'জমা হিসাব', amount: 'জমার পরিমাণ', date: 'জমার তারিখ', balance: 'অ্যাকাউন্ট ব্যালেন্স', ledger: 'নগদ/ব্যাংক', doc: 'ডকুমেন্ট নাম্বার', comments: 'মন্তব্য' };
  if (id === 'depPay') return { branch: 'শাখা নাম', member: 'সদস্যের নাম', account: 'জমা হিসাব', amount: 'ফেরতের পরিমাণ', date: 'তারিখ', balance: 'অ্যাকাউন্ট ব্যালেন্স', ledger: 'নগদ/ব্যাংক', doc: 'ডকুমেন্ট নাম্বার', comments: 'মন্তব্য' };
  if (o.share) return { branch: 'Branch Name', member: 'Member Name', account: 'Share Account', amount: 'Share Amount', date: 'Purchase Date', balance: 'Share Balance', ledger: 'Cash/Bank', doc: 'Document Number', comments: 'Comments' };
  return { branch: 'Branch Name', member: 'Member ID', account: 'Deposit Account', amount: o.dir === 'C' ? 'Deposit Amount' : 'Payment Amount', date: o.dir === 'C' ? 'Deposit Date' : 'Payment Date', balance: 'Account Balance', ledger: 'Cash/Bank', doc: 'Document Number', comments: 'Comments' };
}
// eKisti "finance-depositereciveinfo-list": Title | Info
function depAcInfo(el, a) {
  const box = $('.ek-acinfo', el); if (!box) return;
  if (!a) { box.innerHTML = '<div class="emircv-empty">Select an account to view account details.</div>'; return; }
  const rows = [['Account Number', a.accNo], ['Total Deposit(Credit)', num(a.totCr).toFixed(2)], ['Total Withdrawal(Debit)', num(a.totDr).toFixed(2)], ['Unauthorize Deposit', '0.00'], ['Unauthorize Withdrawal', '0.00'], ['Account Balance', num(a.balance).toFixed(2)]];
  box.innerHTML = `<table class="ek-acinfo-t"><thead><tr><th>Title</th><th>Info</th></tr></thead><tbody>${rows.map(([t, v]) => `<tr><td class="hd">${t}</td><td>${esc(String(v))}</td></tr>`).join('')}</tbody></table>`;
}
function DepTxPage(id, title, o) {
  // eKisti এর হুবহু ফিল্ড ক্রম; নগদ লেজার ডিফল্ট (eKisti তে নগদ/ব্যাংক ফিল্ড নেই)
  const searchBtn = o.share ? 'Search Share' : o.dir === 'C' ? 'Search Deposit Receive' : 'Search Deposit Payment';
  App.page(id, {
    title, icon: o.dir === 'C' ? '📥' : '📤',
    render: () => {
      const L = DEP_LBL(id, o);
      const acc = { k: 'account', l: L.account, t: 'select', req: !(o.share && o.dir === 'C') };
      const amtF = { k: 'amount', l: L.amount, t: 'number', req: 1 }, dateF = { k: 'date', l: L.date, t: 'date', req: 1 }, balF = { k: 'balance', l: L.balance, ro: 1 };
      const fields = o.share ? [{ ...F.branch, l: L.branch }, { k: 'member', l: L.member, t: 'member', req: 1 }, amtF, dateF, balF, acc]
        : o.dir === 'D' ? [{ ...F.branch, l: L.branch }, { k: 'member', l: L.member, t: 'member', req: 1 }, acc, dateF, balF, amtF]
        : [{ ...F.branch, l: L.branch }, { k: 'member', l: L.member, t: 'member', req: 1 }, acc, amtF, dateF, balF];
      fields.push({ k: 'docNo', l: L.doc }, { k: 'narration', l: L.comments, req: o.dir === 'D' && o.share });
      return UI.card('', UI.grid(fields, 4) + `<div class="actions">${UI.btn(o.btn, `DepTx.save('${id}',this)`, o.dir === 'C' ? 'btn-success' : 'btn-warning')} ${UI.btn(searchBtn, `DepTx.search('${id}')`, 'btn-info')} <span class="ek-last"></span></div>`)
        + UI.card('', '<div class="ek-acinfo"><div class="emircv-empty">Select an account to view account details.</div></div>') + MemberCard.html()
        + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>';
    },
    init: async (el, p) => {
      await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch');
      await Pick.account(el, 'account', 'member', 'branch', o.share ? { kind: 'share' } : { kind: 'dep', type: o.types });
      if (o.share) UI.el(el, 'account').closest('.form-group').style.display = 'none';   // eKisti: শেয়ারে আলাদা একাউন্ট ফিল্ড নেই
      UI.el(el, 'date').value = await businessDate();
      const amtEl = UI.el(el, 'amount'); amtEl.addEventListener('click', () => amtEl.select()); amtEl.addEventListener('focus', () => amtEl.select());
      UI.el(el, 'account').addEventListener('change', async () => {
        const sel = UI.el(el, 'account');
        if (o.share && sel.options.length === 2 && !sel.value) { sel.selectedIndex = 1; }
        const a = await showBal(el, sel.value);
        if (o.dir === 'C') amtEl.value = a && num(a.instAmount) ? num(a.instAmount).toFixed(2) : '';   // eKisti: জমার পরিমাণ = কিস্তির পরিমাণ
        depAcInfo(el, a); $('.ek-rl', el).style.display = 'none';
      });
      if (p.member) { const M = UI.el(el, 'member'); M.value = p.member; M.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 400)); if (p.account) { UI.el(el, 'account').value = p.account; UI.el(el, 'account').dispatchEvent(new Event('change')); } }
    },
  });
  DepTx.opts[id] = o;
}
// শেয়ার একাউন্ট দরকার হলে খোলা (অটো শেয়ার বন্ধ — প্রথম শেয়ার জমায় খোলে)
const ShareAcc = {
  async ensure(branch, memberId, date) {
    const accNo = 'S' + memberId; const ex = await Data.account(accNo);
    if (ex) { if (ex.status === 'closed') fail('শেয়ার একাউন্ট ক্লোজড: ' + accNo); return accNo; }
    const m = await Data.member(memberId); if (!m) fail('সদস্য পাওয়া যায়নি');
    const sa = { accNo, kind: 'share', type: 'share', branch: m.branch || branch, memberId, samity: m.samity, title: m.name, openDate: date || await businessDate(branch), status: 'active', balance: 0, totCr: 0, totDr: 0, createdBy: App.user.userId, createdAt: FV.serverTimestamp() };
    const b = db.batch(); b.set(db.collection('accounts').doc(accNo), sa); Idx.setAccount(b, sa.branch, sa);
    b.set(db.collection('snap').doc(m.samity), { a: { [accNo]: { m: memberId, k: 'share', t: 'share', b: 0, st: 'active', od: sa.openDate } } }, { merge: true });
    await b.commit(); Cache.drop('aidx_'); return accNo;
  },
};
const DepTx = {
  opts: {},
  search(id) {
    const el = $('#page-' + id), M = UI.el(el, 'member');
    if (!(M.dataset.val || M.value)) return toast('Please Select Member', 'error');
    const acc = UI.el(el, 'account').value; if (!acc) return toast('Please Select Account', 'error');
    $('.ek-rl', el).style.display = ''; accTxnList(el, acc, DepTx.tts(DepTx.opts[id]));
  },
  tts(o) { return o.share ? [o.tt] : o.dir === 'C' ? ['DEP_RCV', 'SAV_RCV', 'DPS_RCV'] : ['DEP_PAY']; },
  // DPS: আজ পর্যন্ত কয়টি কিস্তি বকেয়া
  dpsDue(a, date) {
    const months = Math.max(0, (parseD(date).getFullYear() - parseD(a.openDate).getFullYear()) * 12 + parseD(date).getMonth() - parseD(a.openDate).getMonth()) + 1;
    const n = Math.min(months, num(a.months) || 999), paid = num(a.instAmount) ? Math.floor((num(a.totCr) + 0.001) / num(a.instAmount)) : 0;
    const dueN = Math.max(0, n - paid); return { dueN, dueAmt: r2(dueN * num(a.instAmount)), paidN: paid };
  },
  save(id, btn) {
    const el = $('#page-' + id), o = DepTx.opts[id];
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      if (!f.account && o.share && o.dir === 'C') { if (!f.member) fail('সদস্য বাছাই করুন'); f.account = await ShareAcc.ensure(f.branch, f.member, f.date); }
      if (!f.account) fail('একাউন্ট বাছাই করুন');
      const a = await Tx.acc(f.account);
      if (o.dps && num(a.instAmount) && r2(f.amount % num(a.instAmount)) !== 0) fail('DPS জমা কিস্তির গুণিতক (' + a.instAmount + ') হতে হবে');
      const gl = f.ledger || REF.GL.cash;
      const part = o.dir === 'C' ? await Tx.credit(a, f.amount, { contraGl: gl, tt: o.tt, docNo: f.docNo, narration: f.narration }) : await Tx.debit(a, f.amount, { contraGl: gl, tt: o.tt, docNo: f.docNo, narration: f.narration });
      const pending = needsAuth(o.dir === 'C' ? 'deposit' : 'withdraw', f.amount);
      const vno = await Tx.post(f.branch, f.date, o.tt, `${TT_NAME[o.tt] || o.tt} ${a.accNo} - ${a.title}`, [part], { docNo: f.docNo, status: pending ? 'pending' : 'posted', authType: o.dir === 'C' ? 'Deposit Receive' : 'Deposit Payment' });
      toast(pending ? '⏳ লিমিট অতিক্রম — অনুমোদনের অপেক্ষায় (' + vno + ')' : '✅ সম্পন্ন — ভাউচার ' + vno);
      UI.el(el, 'amount').value = ''; UI.el(el, 'docNo').value = ''; UI.el(el, 'narration').value = '';
      const a2 = await showBal(el, f.account); depAcInfo(el, a2); if ($('.ek-rl', el).style.display !== 'none') accTxnList(el, f.account, DepTx.tts(o));
      const lp = $('.ek-last', el); if (lp && !pending) lp.innerHTML = UI.btn('🧾 রসিদ প্রিন্ট (' + vno + ')', `Receipt.print('${vno}')`, 'btn-outline');
    });
  },
  cancel(vno, btn) {
    const reason = prompt('বাতিলের কারণ:'); if (reason === null) return;
    return guard(btn, async () => {
      if (!isBM()) fail('বাতিলের অনুমতি শুধু Branch Manager/Admin এর');
      await Eng.cancel(vno, reason); toast('✅ বাতিল হয়েছে');
      const el = btn.closest('.page'); const acc = UI.el(el, 'account') ? UI.el(el, 'account').value : ''; if (acc) { const a = await showBal(el, acc); depAcInfo(el, a); const oo = DepTx.opts[(el.id || '').replace('page-', '')]; accTxnList(el, acc, oo ? DepTx.tts(oo) : undefined); }
    });
  },
};
const SB_TYPES = Object.keys(REF.DEP).filter(t => !isRD(t));
const RD_TYPES = Object.keys(REF.DEP).filter(isRD);
DepTxPage('depRcv', 'সঞ্চয় জমা', { dir: 'C', tt: 'DEP_RCV', btn: 'Deposit Receive', types: SB_TYPES });
DepTxPage('savRcv', 'সেভিংস জমা', { dir: 'C', tt: 'SAV_RCV', btn: 'Deposit Receive', types: ['2001'] });
DepTxPage('dpsRcv', 'ডিপিএস জমা', { dir: 'C', tt: 'DPS_RCV', btn: 'Deposit Receive', types: RD_TYPES, dps: true });
DepTxPage('depPay', 'সঞ্চয় ফেরত', { dir: 'D', tt: 'DEP_PAY', btn: 'Deposit Payment', types: Object.keys(REF.DEP) });
DepTxPage('shareRcv', 'শেয়ার জমা', { dir: 'C', tt: 'SHARE_RCV', btn: 'Share Receive', share: true });
DepTxPage('sharePay', 'শেয়ার ফেরত', { dir: 'D', tt: 'SHARE_PAY', btn: 'Share Payment', share: true });

// ── ডিপোজিট হিসাব স্থানান্তর ──
App.page('depTransfer', {
  title: 'ডিপোজিট হিসাব স্থানান্তর (Deposit Transfer)', icon: '🔄',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'From Customer Name', t: 'member', req: 1 }, { k: 'account', l: 'From Account', t: 'select', req: 1 }, { k: 'balance', l: 'Account Balance', ro: 1 }, { k: 'date', l: 'Transfer Date', t: 'date', req: 1 },
    { k: 'toMember', l: 'To Customer Name', t: 'member', req: 1 }, { k: 'toAccount', l: 'To Account', t: 'select', req: 1 }, { k: 'toBalance', l: 'Account Balance', ro: 1 }, { k: 'docNo', l: 'Document Number' }, { k: 'amount', l: 'Transfer Amount', t: 'number', req: 1 }, { k: 'narration', l: 'Comments', t: 'textarea', req: 1 }], 4)
    + `<div class="actions">${UI.btn('Deposit Transfer', 'DepTransfer.save(this)', 'btn-success')} ${UI.btn('Search Deposit Transfer', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>',
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.member(el, 'toMember', 'branch');
    await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' }); await Pick.account(el, 'toAccount', 'toMember', 'branch', { kind: ['dep', 'share'] });
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', async () => { await showBal(el, UI.el(el, 'account').value); accTxnList(el, UI.el(el, 'account').value, ['DEP_TRF_OUT', 'DEP_TRF_IN']); });
    UI.el(el, 'toAccount').addEventListener('change', async () => { const a = await Data.account(UI.el(el, 'toAccount').value); UI.el(el, 'toBalance').value = a ? a.balance : ''; });
  },
});
const DepTransfer = {
  save(btn) {
    const el = $('#page-depTransfer');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); if (f.account === f.toAccount) fail('একই একাউন্ট');
      const a = await Tx.acc(f.account), b = await Tx.acc(f.toAccount);
      const p1 = await Tx.debit(a, f.amount, { contraGl: null, internal: true, tt: 'DEP_TRF_OUT', narration: 'স্থানান্তর → ' + b.accNo + ' ' + f.narration, docNo: f.docNo });
      const p2 = await Tx.credit(b, f.amount, { contraGl: null, tt: 'DEP_TRF_IN', narration: 'স্থানান্তর ← ' + a.accNo + ' ' + f.narration, docNo: f.docNo });
      const vno = await Tx.post(f.branch, f.date, 'DEP_TRANSFER', `স্থানান্তর ${a.accNo} → ${b.accNo}`, [p1, p2], { docNo: f.docNo, status: needsAuth('withdraw', f.amount) ? 'pending' : 'posted', authType: 'Deposit Payment' });
      toast('✅ স্থানান্তর সম্পন্ন — ' + vno); UI.el(el, 'amount').value = ''; await showBal(el, f.account); accTxnList(el, f.account, ['DEP_TRF_OUT', 'DEP_TRF_IN']);
    });
  },
};

// ── ডিপোজিট হিসাব ক্লোজিং ──
App.page('depClosing', {
  title: 'ডিপোজিট হিসাব ক্লোজিং', icon: '🔒',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member Name', t: 'member', req: 1 }, { k: 'account', l: 'Deposit Account', t: 'select', req: 1 }, { k: 'payable', l: 'Payable Amount', ro: 1 }, { k: 'date', l: 'Closing Date', t: 'date', req: 1 }, { k: 'balance', l: 'Account Balance', ro: 1 }, { k: 'blocked', l: 'ব্লক পরিমাণ', ro: 1 },
    { k: 'calcProfit', l: 'Closing Profit (হিসাবকৃত)', ro: 1 }, { k: 'profit', l: 'Profit Payment', t: 'number' }, { k: 'charge', l: 'Closing Charge', t: 'number' }, { k: 'mode', l: 'Payment', t: 'select', opts: [['cash', 'নগদ'], ['trf', 'অন্য একাউন্টে স্থানান্তর']] }, { k: 'trfAcc', l: 'স্থানান্তর একাউন্ট', t: 'select' }, { k: 'docNo', l: 'Payment Document Number' }, { k: 'narration', l: 'Comments', t: 'textarea', req: 1 }], 4)
    + `<div class="actions">${UI.btn('Submit Closing', 'DepClose.save(this)', 'btn-danger')} ${UI.btn('Search Closing', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>',
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' });
    UI.el(el, 'date').value = await businessDate();
    const calc = async () => {
      const a = await showBal(el, UI.el(el, 'account').value); if (!a) return;
      const ts = (await db.collection('txns').where('accNo', '==', a.accNo).get()).docs.map(d => d.data()).filter(t => t.tt !== 'PROFIT_POST');
      const pr = DepCalc.dailyProfit(ts, a.lastProfitDate ? addDays(a.lastProfitDate, 1) : a.openDate, UI.el(el, 'date').value, a.rate, null);
      UI.el(el, 'calcProfit').value = pr.total; UI.el(el, 'profit').value = pr.total;
      const mem = UI.el(el, 'member').dataset.val; UI.fill(UI.el(el, 'trfAcc'), (await Data.accountsOf(UI.el(el, 'branch').value, mem, 'dep')).filter(x => x.accNo !== a.accNo && x.status === 'active'), x => x.accNo, x => x.accNo + ' - ' + typeName(x.kind, x.type));
      DepClose.payable(el); accTxnList(el, a.accNo, ['DEP_CLOSE'], false);
    };
    UI.el(el, 'account').addEventListener('change', calc); UI.el(el, 'date').addEventListener('change', calc);
    ['profit', 'charge'].forEach(k => UI.el(el, k).addEventListener('input', () => DepClose.payable(el)));
  },
});
const DepClose = {
  payable(el) { UI.el(el, 'payable').value = r2(num(UI.el(el, 'balance').value) + num(UI.el(el, 'profit').value) - num(UI.el(el, 'charge').value)); },
  save(btn) {
    const el = $('#page-depClosing');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const a = await Tx.acc(f.account); const d = REF.DEP[a.type];
      if (num(a.block && a.block.amount) > 0) fail('ব্লক (লিয়েন) আছে — আগে লিয়েন রিমুভ করুন');
      const bal = r2(a.balance), profit = num(f.profit), charge = num(f.charge), pay = r2(bal + profit - charge);
      if (pay < 0) fail('প্রদেয় টাকা ঋণাত্মক');
      if (!confirm(`একাউন্ট ${a.accNo} ক্লোজ করবেন?\nব্যালেন্স ${tk(bal)} + মুনাফা ${tk(profit)} − চার্জ ${tk(charge)} = প্রদেয় ${tk(pay)}`)) return;
      const lines = [{ gl: d.gl, dr: bal, accNo: a.accNo }, { gl: d.expGl, dr: profit, memo: 'profit' }, { gl: d.feeGl || REF.GL.closing, cr: charge, memo: 'charge' }];
      const parts = [];
      if (f.mode === 'trf') { if (!f.trfAcc) fail('স্থানান্তর একাউন্ট বাছাই করুন'); const t = await Tx.acc(f.trfAcc); parts.push(await Tx.credit(t, pay, { contraGl: null, tt: 'DEP_TRF_IN', narration: 'ক্লোজিং ' + a.accNo })); }
      else lines.push({ gl: REF.GL.cash, cr: pay });
      a._fo = await Tx.foOf(a.samity);
      const m = Tx.merge(parts);
      await Eng.post({
        branch: f.branch, date: f.date, type: 'DEP_CLOSING', narration: 'ডিপোজিট ক্লোজিং ' + a.accNo + ' — ' + f.narration, docNo: f.docNo, ref: { accNo: a.accNo },
        lines: [...lines, ...m.lines], txns: [Tx.base(a, 'DEP_CLOSE', bal, 'D', { profit, penalty: charge, narration: f.narration, docNo: f.docNo }), ...m.txns],
        accOps: [{ accNo: a.accNo, samity: a.samity, inc: { balance: -bal, totDr: bal, profitPaid: profit }, snapInc: { b: -bal, td: bal }, set: { status: 'closed', closeDate: f.date }, snapSet: { st: 'closed', cd: f.date }, undoSet: { status: 'active', closeDate: '' } }, ...m.accOps],
        extra: async b => Idx.setAccount(b, a.branch, { ...a, status: 'closed' }),
      });
      toast('✅ একাউন্ট ক্লোজ হয়েছে'); UI.reset(el, ['branch', 'date']);
    });
  },
};

// ── সঞ্চয় লেনদেন ব্লক / লিয়েন রিমুভ ──
function LienPage(id, title, add) {
  App.page(id, {
    title, icon: add ? '⛔' : '🔓',
    render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, { k: 'balance', l: 'Account Balance', ro: 1 }, { k: 'blocked', l: 'Current Block Amount', ro: 1 },
      { k: 'date', l: add ? 'Block Effective Date' : 'Remove Date', t: 'date', req: 1 }, { k: 'amount', l: add ? 'Block Amount' : 'Remove Amount', t: 'number' }, { k: 'reason', l: add ? 'Blocking Reason' : 'Clear Reason', req: 1 },
      { k: 'dep', l: add ? 'Deposit Block' : 'Deposit Block Clear', t: 'checkbox' }, { k: 'wd', l: add ? 'Withdrawal Block' : 'Withdrawal Block Clear', t: 'checkbox' }], 4)
      + `<div class="actions">${UI.btn(add ? '⛔ Add Block' : '🔓 Clear Block', `Lien.save('${id}',${add},this)`, add ? 'btn-danger' : 'btn-success')} ${UI.btn(add ? 'Search Block' : 'Search Block Clear', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="ll"></div>') + '</div>',
    init: async el => {
      await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' });
      UI.el(el, 'date').value = await businessDate();
      UI.el(el, 'account').addEventListener('change', async () => { await showBal(el, UI.el(el, 'account').value); Lien.list(el); });
    },
  });
}
LienPage('lienAdd', 'সঞ্চয় লেনদেন ব্লক', true);
LienPage('lienRemove', 'লিয়েন রিমুভ', false);
const Lien = {
  save(id, add, btn) {
    const el = $('#page-' + id);
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const a = await Tx.acc(f.account); const blk = a.block || { amount: 0, dep: false, wd: false };
      const amtv = num(f.amount); if (!amtv && !f.dep && !f.wd) fail('পরিমাণ অথবা ব্লক টিক দিন');
      if (!add && amtv > num(blk.amount) + 0.001) fail('বর্তমান ব্লকের চেয়ে বেশি রিমুভ করা যাবে না');
      if (add && amtv > r2(num(a.balance) - num(blk.amount)) + 0.001) fail('ব্লক পরিমাণ ব্যালেন্সের বেশি');
      const nb = { amount: r2(num(blk.amount) + (add ? amtv : -amtv)), dep: add ? (blk.dep || f.dep) : (blk.dep && !f.dep), wd: add ? (blk.wd || f.wd) : (blk.wd && !f.wd) };
      const b = db.batch();
      b.update(db.collection('accounts').doc(a.accNo), { block: nb });
      b.set(db.collection('liens').doc(), { branch: f.branch, memberId: a.memberId, accNo: a.accNo, kind: add ? 'add' : 'remove', date: f.date, amount: amtv, dep: f.dep, wd: f.wd, reason: f.reason, by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); toast('✅ সম্পন্ন'); await showBal(el, a.accNo); Lien.list(el);
    });
  },
  async list(el) {
    const rows = (await db.collection('liens').where('accNo', '==', UI.el(el, 'account').value).get()).docs.map(d => d.data()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('.ll', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId || '' }, { h: 'Reference Account', f: r => r.accNo }, { h: 'ধরন', f: r => r.kind === 'add' ? 'Block' : 'Clear' }, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Amount', f: r => amt(r.amount), r: 1 }, { h: 'Deposit', f: r => r.dep ? '✔' : '' }, { h: 'Withdrawal', f: r => r.wd ? '✔' : '' }, { h: 'Reason', f: r => esc(r.reason || '') }, { h: 'By', f: r => r.by }, { h: 'On', f: r => tsStr(r.on) }], rows);
  },
};

// ── লাভের বিবরণ (Deposit Profit Details) ──
ReportPage({
  id: 'depProfit', ek: 'Search Details', title: 'লাভের বিবরণ (Deposit Profit Details)', icon: '💹',
  filters: [F.branch, { k: 'member', l: 'সদস্য', t: 'member' }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'rate', l: 'Profit Rate (খালি = একাউন্টের হার)', t: 'number' }],
  init: async (el, f) => { await Pick.account(f, 'account', 'member', 'branch', { kind: 'dep', closed: true }); UI.el(f, 'account').addEventListener('change', async () => { const a = await Data.account(UI.el(f, 'account').value); if (a) UI.el(f, 'from').value = a.lastProfitDate ? addDays(a.lastProfitDate, 1) : a.openDate; }); },
  run: async f => {
    const a = await Tx.acc(f.account);
    const ts = (await db.collection('txns').where('accNo', '==', f.account).get()).docs.map(d => d.data()).filter(t => t.tt !== 'PROFIT_POST');
    const rate = num(f.rate) || num(a.rate);
    const r = DepCalc.dailyProfit(ts, f.from, f.upto, rate, null);
    return { sub: `${a.accNo} — ${esc(a.title)} | ${typeFull('dep', a.type)} | হার ${rate}% | বর্তমান ব্যালেন্স ${amt(a.balance)}`, html: UI.table([{ h: 'Calculation Date', f: x => fmtD(x.upto) }, { h: 'From Date', f: x => fmtD(x.from) }, { h: 'Upto Date', f: x => fmtD(x.upto) }, { h: 'Days', f: x => x.days }, { h: 'Profit Rate', f: () => rate }, { h: 'Profit On Amount', f: x => amt(x.bal), r: 1 }, { h: 'Profit Amount', f: x => amt(x.profit), r: 1, sum: 1, v: x => x.profit }], r.rows) };
  },
});

// ── ডিপোজিট লভ্যাংশ প্রদান ──
App.page('profitPayment', {
  title: 'ডিপোজিট লভ্যাংশ প্রদান', icon: '💸',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Accont Number', t: 'select', req: 1 }, { k: 'date', l: 'Payment Date', t: 'date', req: 1 },
    { k: 'mode', l: 'Payment Type', t: 'select', req: 1, opts: [['', 'Select Payment Type'], ['cash', 'Cash Payment'], ['trf', 'Account Transfer']] }, { k: 'trfAcc', l: 'Transfer Account', t: 'select' }, { k: 'on', l: 'Profit On Amount', t: 'number', req: 1 }, { k: 'rate', l: 'Profit Rate', t: 'number', req: 1 },
    { k: 'from', l: 'From Date', t: 'date', req: 1 }, { k: 'upto', l: 'Upto Date', t: 'date', req: 1 }, { k: 'profit', l: 'Profit Amount', t: 'number', req: 1 }, { k: 'comments', l: 'Comments' }], 4)
    + `<div class="actions">${UI.btn('🧮 হিসাব করুন', 'ProfitPay.calc(this)', 'btn-outline')}${UI.btn('Save Payment Info', 'ProfitPay.save(this)', 'btn-success')} ${UI.btn('Search Payment Info', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>',
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' });
    UI.el(el, 'date').value = UI.el(el, 'upto').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', async () => {
      const a = await showBal(el, UI.el(el, 'account').value); if (!a) return;
      UI.set(el, { rate: a.rate, on: a.balance, from: a.lastProfitDate ? addDays(a.lastProfitDate, 1) : a.openDate });
      const mem = UI.el(el, 'member').dataset.val; const d = REF.DEP[a.type];
      UI.fill(UI.el(el, 'trfAcc'), (await Data.accountsOf(UI.el(el, 'branch').value, mem, 'dep')).filter(x => x.status === 'active'), x => x.accNo, x => x.accNo + ' - ' + typeName(x.kind, x.type));
      const to = (await Data.accountsOf(UI.el(el, 'branch').value, mem, 'dep', d.profitTo || '2001'))[0]; if (to) UI.el(el, 'trfAcc').value = to.accNo;
      accTxnList(el, a.accNo, ['PROFIT_PAY', 'PROFIT_POST']);
    });
  },
});
const ProfitPay = {
  calc(btn) {
    const el = $('#page-profitPayment');
    return guard(btn, async () => {
      const f = UI.get(el); const ts = (await db.collection('txns').where('accNo', '==', f.account).get()).docs.map(d => d.data()).filter(t => t.tt !== 'PROFIT_POST');
      const r = DepCalc.dailyProfit(ts, f.from, f.upto, f.rate, null); UI.el(el, 'profit').value = r.total;
      UI.el(el, 'on').value = r.rows.length ? r2(sum(r.rows, x => x.bal * x.days) / Math.max(1, sum(r.rows, x => x.days))) : f.on;
    });
  },
  save(btn) {
    const el = $('#page-profitPayment');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const a = await Tx.acc(f.account); const d = REF.DEP[a.type];
      const parts = []; const lines = [{ gl: d.expGl, dr: f.profit }];
      if (f.mode === 'trf') { if (!f.trfAcc) fail('স্থানান্তর একাউন্ট বাছাই করুন'); parts.push(await Tx.credit(await Tx.acc(f.trfAcc), f.profit, { contraGl: null, tt: 'PROFIT_POST', narration: 'মুনাফা ' + a.accNo + ' (' + fmtD(f.from) + '–' + fmtD(f.upto) + ')' })); }
      else lines.push({ gl: REF.GL.cash, cr: f.profit });
      a._fo = await Tx.foOf(a.samity); const m = Tx.merge(parts);
      await Eng.post({
        branch: f.branch, date: f.date, type: 'PROFIT_PAYMENT', narration: `লভ্যাংশ প্রদান ${a.accNo} ${fmtD(f.from)}–${fmtD(f.upto)} @${f.rate}%`, ref: { accNo: a.accNo },
        lines: [...lines, ...m.lines], txns: [Tx.base(a, 'PROFIT_PAY', f.profit, 'X', { profit: f.profit, from: f.from, upto: f.upto, rate: num(f.rate), on: num(f.on), narration: f.comments }), ...m.txns],
        accOps: [{ accNo: a.accNo, samity: a.samity, inc: { profitPaid: f.profit }, set: { lastProfitDate: f.upto }, undoSet: { lastProfitDate: a.lastProfitDate || '' } }, ...m.accOps],
      });
      toast('✅ লভ্যাংশ প্রদান সম্পন্ন'); accTxnList(el, a.accNo, ['PROFIT_PAY', 'PROFIT_POST']);
    });
  },
};

// ── ম্যানুয়াল লাভ বন্টন ──
App.page('profitDist', {
  title: 'ম্যানুয়াল লাভ বন্টন', icon: '🧮',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { ...F.samity }, { k: 'type', l: 'Account Type', t: 'select', req: 1, opts: [['', '------------'], ...DEP_TYPES] },
    { k: 'on', l: 'Profit Balance On', t: 'select', req: 1, opts: [['D', 'D-Daily Balance'], ['B', 'B-Ason Day Balance'], ['M', 'M-Minimum Balance'], ['X', 'X-Maximum Balance'], ['A', 'A-Average Balance'], ['O', 'O-Account Opening Balance'], ['N', 'N-Not Applicable']] },
    { k: 'from', l: 'From Date', t: 'date', req: 1 }, { k: 'upto', l: 'Upto Date', t: 'date', req: 1 }, { k: 'rate', l: 'Profit Rate', t: 'number' }, { k: 'dist', l: 'Distribution Amount', t: 'number', hint: 'দিলে হার স্বয়ংক্রিয় হিসাব হবে' },
    { k: 'calcRate', l: 'Calculated Profit Rate', ro: 1 }, { k: 'calcDist', l: 'Calculated Distribution Amount', ro: 1 }, { k: 'date', l: 'Posting Date', t: 'date', req: 1 }, { k: 'excl', l: 'Exclude Zero Balance', t: 'select', opts: [['Y', 'Yes'], ['N', 'No']] }], 4)}
    <div class="filter-actions">${UI.btn('Search', 'ProfitDist.search(this)')}${UI.btn('Update Profit', 'ProfitDist.update(this)', 'btn-outline')}${UI.btn('Post to Account', 'ProfitDist.post(this)', 'btn-success')}</div></div><div class="card pd"></div>`,
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch');
    const bd = await businessDate(); UI.el(el, 'date').value = UI.el(el, 'upto').value = bd; UI.el(el, 'from').value = bd.slice(0, 4) + '-01-01';
    UI.el(el, 'type').addEventListener('change', () => { const d = REF.DEP[UI.el(el, 'type').value]; if (d) UI.el(el, 'rate').value = d.rate; });
  },
});
const ProfitDist = {
  search(btn) {
    const el = $('#page-profitDist');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.type) fail('Account Type বাছাই করুন');
      busy(true, 'হিসাব হচ্ছে...');
      try {
        const allS = await Data.samities(f.branch); el._sams = allS; const sams = f.samity ? allS.filter(x => x.code === f.samity) : allS;
        const mem = await Data.memberIdx(f.branch);
        const rows = [];
        for (const s of sams) {
          const snap = (await db.collection('snap').doc(s.code).get()).data() || { a: {} };
          const accs = Object.entries(snap.a || {}).filter(([, v]) => v.k === 'dep' && v.t === f.type && v.st !== 'closed');
          if (!accs.length) continue;
          const ts = (await db.collection('txns').where('samity', '==', s.code).get()).docs.map(d => d.data()).filter(t => t.kind === 'dep' && t.type === f.type && t.tt !== 'PROFIT_POST' && t.date <= f.upto);
          const byAcc = groupBy(ts, t => t.accNo);
          for (const [accNo, v] of accs) {
            const tx = byAcc[accNo] || [];
            const r = DepCalc.dailyProfit(tx, f.from, f.upto, 100, null); // rate 100 → ভিত্তি (balance×days/360)
            const vals = r.rows.map(x => x.bal);
            let base;
            const days = Math.max(1, daysBetween(f.from, f.upto) + 1);
            if (f.on === 'D') base = r.total;                                   // Σ(bal×days)/360 ×100%
            else if (f.on === 'B') base = r2((vals.length ? vals[vals.length - 1] : num(v.b)) * days / 360);
            else if (f.on === 'M') base = r2((vals.length ? Math.min(...vals) : 0) * days / 360);
            else if (f.on === 'X') base = r2((vals.length ? Math.max(...vals) : 0) * days / 360);
            else if (f.on === 'O') base = r2((vals.length ? vals[0] : num(v.b)) * days / 360);   // সময়ের শুরুর ব্যালেন্স
            else if (f.on === 'N') base = 0;                                                     // শুধু হাতে লেখা মুনাফা
            else base = r2((r.rows.length ? sum(r.rows, x => x.bal * x.days) / days : 0) * days / 360);
            const bal = r.rows.length ? r.rows[r.rows.length - 1].bal : num(v.b);
            if (f.excl === 'Y' && bal <= 0) continue;
            rows.push({ accNo, memberId: v.m, name: (mem[v.m] || [])[0] || '', samity: s.code, samName: s.name || '', bal, base, last: (byAcc[accNo] || []).filter(t => t.tt === 'PROFIT_POST').map(t => t.date).sort().pop() || '' });
          }
        }
        const totalBase = sum(rows, r => r.base);
        let rate = num(f.rate);
        if (num(f.dist) && totalBase) rate = r2(num(f.dist) * 100 / totalBase * 10000) / 10000;
        rows.forEach(r => r.profit = Math.round(r.base * rate / 100));
        UI.el(el, 'calcRate').value = rate; UI.el(el, 'calcDist').value = sum(rows, r => r.profit);
        el._rows = rows; el._f = { ...f, rate };
        ProfitDist.draw(el);
      } finally { busy(false); }
    });
  },
  draw(el) {
    const rows = el._rows || []; const sn = {}; (el._sams || []).forEach(x => sn[x.code] = x.name);
    $('.pd', el).innerHTML = UI.table([{ h: 'SL', f: r => rows.indexOf(r) + 1 }, { h: 'ID', f: r => r.memberId }, { h: 'Name', f: r => esc(r.name) }, { h: 'Center Code', f: r => String(r.samity).slice(-4) }, { h: 'Center Name', f: r => esc(r.samName || sn[r.samity] || '') }, { h: 'Account Number', f: r => r.accNo }, { h: 'Last Payment Date', f: r => fmtD(r.last) },
      { h: 'Balance', f: r => amt(r.bal), r: 1, sum: 1, v: r => r.bal }, { h: 'Profit On Amount', f: r => amt(r.base), r: 1, sum: 1, v: r => r.base }, { h: 'Profit Pending', f: () => '0.00', r: 1 }, { h: 'Total Payable', f: r => amt(r.profit), r: 1, sum: 1, v: r => r.profit },
      { h: 'Profit Payment', f: r => `<input type="number" class="pp" data-acc="${r.accNo}" value="${r.profit}" style="width:90px">`, r: 1, sum: 1, v: r => r.profit }], rows);
  },
  // Update Profit: হার/বন্টন পরিমাণ বদলালে আবার Search ছাড়াই নতুন হিসাব; হাতে বদলানো ঘরও গোনা হয়
  update(btn) {
    const el = $('#page-profitDist');
    return guard(btn, async () => {
      const rows = el._rows; if (!rows || !rows.length) fail('আগে Search করুন');
      const f = UI.get(el); const totalBase = sum(rows, r => r.base); let rate = num(f.rate);
      const changed = rate !== num((el._f || {}).rate) || num(f.dist) !== num((el._f || {}).dist);
      if (changed) { if (num(f.dist) && totalBase) rate = r2(num(f.dist) * 100 / totalBase * 10000) / 10000; rows.forEach(r => r.profit = Math.round(r.base * rate / 100)); }
      else $$('.pp', el).forEach(i => { const r = rows.find(x => x.accNo === i.dataset.acc); if (r) r.profit = num(i.value); });
      el._f = { ...el._f, rate, dist: f.dist, date: f.date };
      UI.el(el, 'calcRate').value = rate; UI.el(el, 'calcDist').value = sum(rows, r => r.profit);
      ProfitDist.draw(el); toast('✅ মুনাফা আপডেট হয়েছে');
    });
  },
  post(btn) {
    const el = $('#page-profitDist');
    return guard(btn, async () => {
      const rows = el._rows, f = el._f; if (!rows || !rows.length) fail('আগে Search করুন');
      $$('.pp', el).forEach(i => { const r = rows.find(x => x.accNo === i.dataset.acc); if (r) r.profit = num(i.value); });
      const list = rows.filter(r => r.profit > 0); if (!list.length) fail('বন্টনযোগ্য মুনাফা নেই');
      const total = sum(list, r => r.profit);
      if (!confirm(`${list.length} টি একাউন্টে মোট ${tk(total)} মুনাফা জমা হবে। নিশ্চিত?`)) return;
      busy(true, 'পোস্ট হচ্ছে...');
      try {
        const d = REF.DEP[f.type]; const posts = [];
        for (const r of list) {
          const a = await Tx.acc(r.accNo); const part = await Tx.credit(a, r.profit, { contraGl: d.expGl, tt: 'PROFIT_POST', narration: `মুনাফা ${fmtD(f.from)}–${fmtD(f.upto)} @${f.rate}%`, skipProfile: true });
          part.accOps[0].set = { lastProfitDate: f.upto }; part.accOps[0].inc.profitPaid = r.profit;
          posts.push({ branch: f.branch, date: f.date, type: 'PROFIT_DIST', narration: 'মুনাফা বন্টন ' + r.accNo, lines: part.lines, txns: part.txns, accOps: part.accOps });
        }
        const vnos = await Eng.postMany(posts, (i, n) => busy(true, `পোস্ট হচ্ছে ${i}/${n}`));
        await db.collection('profitPosts').add({ branch: f.branch, samity: f.samity || '', type: f.type, on: f.on, from: f.from, upto: f.upto, date: f.date, rate: f.rate, amount: total, count: list.length, vnos, by: App.user.userId, at: FV.serverTimestamp(), status: 'posted' });
        toast(`✅ ${list.length} টি একাউন্টে মুনাফা পোস্ট হয়েছে`); el._rows = null; $('.pd', el).innerHTML = '';
      } finally { busy(false); }
    });
  },
};
ReportPage({
  id: 'profitPostList', ek: 'Search Details', title: 'মুনাফা বন্টন তালিকা', icon: '📋',
  filters: [F.branch, F.samity, { k: 'type', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ...DEP_TYPES] }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  init: async (el, f) => { UI.el(f, 'from').value = (await businessDate()).slice(0, 4) + '-01-01'; },
  run: async f => {
    const rows = (await db.collection('profitPosts').where('branch', '==', f.branch).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(r => (!f.samity || r.samity === f.samity) && (!f.type || r.type === f.type) && r.date >= f.from && r.date <= f.upto).sort((a, b) => b.date.localeCompare(a.date));
    return { landscape: true, html: UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Samity', f: r => r.samity || 'সব' }, { h: 'Account Type', f: r => typeFull('dep', r.type) }, { h: 'Profit Balance', f: r => r.on }, { h: 'From Date', f: r => fmtD(r.from) }, { h: 'Upto Date', f: r => fmtD(r.upto) }, { h: 'Posting Date', f: r => fmtD(r.date) }, { h: 'Profit Rate', f: r => r.rate }, { h: 'Accounts', f: r => r.count }, { h: 'Profit Amount', f: r => amt(r.amount), r: 1, sum: 1, v: r => r.status === 'cancelled' ? 0 : r.amount }, { h: 'Posting By', f: r => r.by }, { h: 'Posting On', f: r => tsStr(r.at) }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Action', f: r => r.status === 'cancelled' ? 'বাতিল' : `<span class="no-print">${UI.btn('✖ বাতিল', `ProfitPostCancel('${r.id}',this)`, 'btn-danger btn-sm')}</span>` }], rows) };
  },
});
async function ProfitPostCancel(id, btn) {
  if (!confirm('এই মুনাফা বন্টনের সব পোস্টিং বাতিল করবেন?')) return;
  return guard(btn, async () => {
    if (!isBM()) fail('অনুমতি নেই');
    const p = (await db.collection('profitPosts').doc(id).get()).data();
    busy(true, 'বাতিল হচ্ছে...'); try { for (const v of p.vnos || []) { try { await Eng.cancel(v, 'মুনাফা বন্টন বাতিল'); } catch (e) { if (!/ইতিমধ্যে/.test(e.message)) throw e; } } } finally { busy(false); }
    await db.collection('profitPosts').doc(id).update({ status: 'cancelled', cancelBy: App.user.userId, cancelOn: FV.serverTimestamp() });
    toast('✅ বাতিল হয়েছে'); ReportPage.run('profitPostList');
  });
}
