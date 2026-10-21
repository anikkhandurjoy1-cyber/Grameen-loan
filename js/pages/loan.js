// ═══════════════════════════════════════════════════════════════
// লোন ট্রানজেকশন + কর্মী লোন — কিস্তি জমা, ম্যানুয়াল, বাতিল, বিবরণ,
// পুনঃতফসিল, মওকুফ, জরিমানা, উদ্দেশ্য, কিস্তি সেটিংস, লাভের বিবরণ
// ═══════════════════════════════════════════════════════════════
// লোন একাউন্ট নির্বাচন হলে তথ্য প্যানেল
const LoanInfo = {
  async load(el, accNo, date) {
    if (!accNo) { el._loan = null; return null; }
    const l = await Data.account(accNo); el._loan = l; if (!l) return null;
    const st = Loan.status(l, date || await businessDate(l.branch));
    UI.set(el, {
      asonDue: st.asonDue, penalty: num(l.penDue), totalN: st.sch.length, paidN: st.paidCnt, totalLoan: l.totalRepay, totalPaid: l.paidTotal,
      totalDue: st.outstanding, expDate: l.expDate, overdue: st.overdue, advance: st.advance, duePrincipal: st.principalOut, dueProfit: st.profitOut, instAmount: l.instAmount,
    });
    return { l, st };
  },
  fields: [{ k: 'asonDue', l: 'আজকের বকেয়া', ro: 1 }, { k: 'penalty', l: 'জরিমানা চার্জ', ro: 1 }, { k: 'totalN', l: 'মোট কিস্তি', ro: 1 }, { k: 'paidN', l: 'মোট কিস্তি পরিশোধ হয়েছে', ro: 1 },
    { k: 'totalLoan', l: 'মোট ঋণের পরিমাণ', ro: 1 }, { k: 'totalPaid', l: 'মোট ঋণ পরিশোধ হয়েছে', ro: 1 }, { k: 'totalDue', l: 'মোট ঋণ বকেয়া', ro: 1 }, { k: 'expDate', l: 'মেয়াদ উত্তীর্নের তারিখ', t: 'date', ro: 1 }],
};
async function loanReceiptList(el, accNo, cancelMode) {
  const box = $('.rl', el); if (!box) return;
  if (!accNo) { box.innerHTML = ''; return; }
  const rows = (await db.collection('txns').where('accNo', '==', accNo).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(t => ['EMI_RCV', 'EMI_MANUAL', 'EMI_TRF', 'EMI_SHEET'].includes(t.tt)).sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
  rows.forEach((r, i) => r.serial = i + 1);
  box.innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId }, { h: 'Member Account', f: r => r.accNo }, { h: 'Installment Date', f: r => fmtD(r.date) }, { h: 'Installment Serial', f: r => r.serial }, { h: 'Installment Amount', f: r => amt(r.amount), r: 1, sum: 1, v: r => r.cancelled ? 0 : r.amount }, { h: 'আসল', f: r => amt(r.principal), r: 1 }, { h: 'মুনাফা', f: r => amt(r.profit), r: 1 }, { h: 'জরিমানা', f: r => amt(r.penalty), r: 1 }, { h: 'Document Number', f: r => esc(r.docNo || r.vno) }, { h: 'Entry By', f: r => r.byName || '' }, { h: 'Entry On', f: r => tsStr(r.on) }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Cancel On', f: r => tsStr(r.cancelOn) },
    { h: 'Action', f: r => r.cancelled ? '<span class="tag red">বাতিল</span>' : (cancelMode ? UI.btn('✖ বাতিল', `EmiCancel.run('${r.vno}',this)`, 'btn-danger btn-sm') : UI.btn('🧾', `Receipt.print('${r.vno}')`, 'btn-outline btn-sm')) }], rows);
}
// রসিদ প্রিন্ট
// রসিদ প্রিন্ট: js/pages/receipts.js (Receipt / Voucher)
const TT_NAME = { EMI_RCV: 'ঋণের কিস্তি জমা', EMI_MANUAL: 'ম্যানুয়াল কিস্তি', EMI_TRF: 'সঞ্চয় থেকে কিস্তি', EMI_SHEET: 'শীট কিস্তি', DEP_RCV: 'সঞ্চয় জমা', DEP_PAY: 'সঞ্চয় ফেরত', DPS_RCV: 'ডিপিএস জমা', SAV_RCV: 'সেভিংস জমা', SHARE_RCV: 'শেয়ার জমা', SHARE_PAY: 'শেয়ার ফেরত', LOAN_DISB: 'ঋণ বিতরণ', DEP_TRF_IN: 'স্থানান্তর জমা', DEP_TRF_OUT: 'স্থানান্তর উত্তোলন', DEP_CLOSE: 'হিসাব ক্লোজিং', PROFIT_POST: 'মুনাফা জমা', PROFIT_PAY: 'মুনাফা প্রদান', ADMISSION_FEE: 'ভর্তি ফি', PASSBOOK_FEE: 'পাসবই ফি', LOAN_DISB_TRF: 'ঋণ বিতরণ (জমা)', EMI_WAIVE: 'ঋণ মওকুফ', OTHER_RCV: 'জমা', OTHER_PAY: 'প্রদান' };

// ── কিস্তি জমা পেজ (সাধারণ / ম্যানুয়াল / কর্মী) ──
function EmiPage(id, title, o = {}) {
  const memberField = o.staff ? { k: 'member', l: 'Employee Name', t: 'select', req: 1 } : { k: 'member', l: 'সদস্য আইডি', t: 'member', req: 1 };
  const amountFields = o.manual
    ? [{ k: 'principal', l: 'Investment Amount (আসল)', t: 'number' }, { k: 'profit', l: 'Profit Amount (মুনাফা)', t: 'number' }, { k: 'penaltyRcv', l: 'Penalty Charge (জরিমানা)', t: 'number' }]
    : [{ k: 'amount', l: 'জমার পরিমাণ', t: 'number', req: 1 }];
  App.page(id, {
    title, icon: '💵',
    render: () => UI.card('', UI.grid([F.branch, memberField, { k: 'account', l: 'সদস্য অ্যাকাউন্ট', t: 'select', req: 1 }, ...amountFields, { k: 'date', l: 'কিস্তির তারিখ', t: 'date', req: 1 },
      ...LoanInfo.fields, { k: 'duePrincipal', l: 'আসল বকেয়া', ro: 1 }, { k: 'dueProfit', l: 'মুনাফা বকেয়া', ro: 1 },
      { k: 'fromDep', l: 'Transfer From Same Customer Deposit', t: 'checkbox' }, { k: 'depAcc', l: 'সঞ্চয় অ্যাকাউন্ট', t: 'select' }, { k: 'docNo', l: 'ডকুমেন্ট নাম্বার' }, { k: 'comments', l: 'মন্তব্য' }], 4)
      + `<div class="actions">${UI.btn('✅ Receive Installment', `EmiRcv.save('${id}',this)`, 'btn-success')}</div>`) + UI.card('Search Receive Installment', '<div class="rl"></div>'),
    init: async (el, p) => {
      await Pick.branch(el, 'branch');
      if (o.staff) await Pick.employee(el, 'member', 'branch'); else await Pick.member(el, 'member', 'branch');
      UI.el(el, 'date').value = await businessDate();
      const M = UI.el(el, 'member'), A = UI.el(el, 'account');
      const memberKey = () => o.staff ? (M.value ? 'E' + M.value : '') : M.dataset.val;
      const loadAccs = async () => {
        const mk = memberKey(); const all = mk ? await Data.accountsOf(UI.el(el, 'branch').value, mk) : [];
        UI.fill(A, all.filter(a => a.kind === 'loan' && a.status === 'active'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type));
        UI.fill(UI.el(el, 'depAcc'), all.filter(a => (a.kind === 'dep' || a.kind === 'other') && a.status === 'active'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type));
        if (A.options.length === 2) A.selectedIndex = 1; A.dispatchEvent(new Event('change'));
      };
      M.addEventListener(o.staff ? 'change' : 'picked', loadAccs);
      A.addEventListener('change', async () => {
        const r = await LoanInfo.load(el, A.value, UI.el(el, 'date').value);
        if (r && !o.manual) UI.el(el, 'amount').value = r.st.asonDue ? r2(r.st.asonDue + num(r.l.penDue)) : r.l.instAmount;
        loanReceiptList(el, A.value);
      });
      UI.el(el, 'date').addEventListener('change', () => A.value && LoanInfo.load(el, A.value, UI.el(el, 'date').value));
      if (p.member) { if (o.staff) { M.value = p.member; } else { M.value = p.member; } M.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 300)); if (p.account) { A.value = p.account; A.dispatchEvent(new Event('change')); } }
    },
  });
  EmiRcv.opts[id] = o;
}
const EmiRcv = {
  opts: {},
  save(id, btn) {
    const el = $('#page-' + id), o = EmiRcv.opts[id];
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      const l = await Tx.acc(f.account); if (l.kind !== 'loan') fail('ঋণ একাউন্ট নয়');
      let opts = { date: f.date, docNo: f.docNo, narration: f.comments };
      let amount;
      if (o.manual) {
        opts.principal = num(f.principal); opts.profit = num(f.profit); opts.penalty = num(f.penaltyRcv); opts.tt = 'EMI_MANUAL';
        amount = r2(opts.principal + opts.profit + opts.penalty); if (amount <= 0) fail('পরিমাণ দিন');
      } else {
        amount = num(f.amount);
        // জরিমানা বকেয়া থাকলে আগে জরিমানা কাটা হবে
        const pen = Math.min(num(l.penDue), amount);
        opts.penalty = r2(pen); amount = r2(amount - pen);
        if (amount <= 0 && !pen) fail('পরিমাণ দিন');
        opts.tt = 'EMI_RCV';
      }
      const parts = [];
      if (f.fromDep) {
        if (!f.depAcc) fail('সঞ্চয় অ্যাকাউন্ট বাছাই করুন');
        const d = await Tx.acc(f.depAcc);
        const total = o.manual ? r2(opts.principal + opts.profit + opts.penalty) : r2(amount + opts.penalty);
        parts.push(await Tx.debit(d, total, { contraGl: null, internal: true, tt: 'DEP_TRF_OUT', narration: 'ঋণ কিস্তিতে স্থানান্তর ' + l.accNo }));
        opts.contraGl = null; opts.tt = 'EMI_TRF';
      }
      parts.push(await Tx.loanReceive(l, amount, opts));
      const vno = await Tx.post(f.branch, f.date, o.staff ? 'STAFF_EMI_RCV' : 'EMI_RCV', `কিস্তি জমা ${l.accNo} - ${l.title}`, parts, { docNo: f.docNo });
      Cache.drop('aidx_');
      toast('✅ কিস্তি জমা হয়েছে — ভাউচার ' + vno);
      ['amount', 'principal', 'profit', 'penaltyRcv', 'docNo', 'comments'].forEach(k => { const e = UI.el(el, k); if (e) e.value = ''; });
      UI.el(el, 'fromDep').checked = false;
      await LoanInfo.load(el, f.account, f.date); loanReceiptList(el, f.account);
      if (el._loan && el._loan.status === 'closed') toast('🎉 ঋণ সম্পূর্ণ পরিশোধ হয়েছে — একাউন্ট ক্লোজড', 'info');
    });
  },
};
EmiPage('emiRcv', 'ঋণের কিস্তি জমা');
EmiPage('emiManual', 'ম্যানুয়াল কিস্তি জমা (Loan Installment Receive)', { manual: true });
EmiPage('staffEmiRcv', 'কর্মী ঋণের কিস্তি জমা', { staff: true });

// ── কিস্তি জমা বাতিল ──
function EmiCancelPage(id, title, staff) {
  App.page(id, {
    title, icon: '✖',
    render: () => UI.card('', UI.grid([F.branch, staff ? { k: 'member', l: 'Employee Name', t: 'select', req: 1 } : { k: 'member', l: 'Select Member', t: 'member', req: 1 }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }], 3) + '<div class="mini">যে কিস্তি বাতিল করবেন তার পাশে "বাতিল" চাপুন। একই ভাউচারের সব লেনদেন (যেমন সঞ্চয় থেকে স্থানান্তর) একসাথে বাতিল হবে।</div><div class="rl" style="margin-top:8px"></div>'),
    init: async el => {
      await Pick.branch(el, 'branch'); if (staff) await Pick.employee(el, 'member', 'branch'); else await Pick.member(el, 'member', 'branch', { closed: true });
      const M = UI.el(el, 'member'), A = UI.el(el, 'account');
      M.addEventListener(staff ? 'change' : 'picked', async () => { const mk = staff ? 'E' + M.value : M.dataset.val; UI.fill(A, (await Data.accountsOf(UI.el(el, 'branch').value, mk, 'loan')).filter(a => a.status !== 'cancelled'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type) + ' (' + a.status + ')'); if (A.options.length === 2) A.selectedIndex = 1; A.dispatchEvent(new Event('change')); });
      A.addEventListener('change', () => loanReceiptList(el, A.value, true));
    },
  });
}
EmiCancelPage('emiCancel', 'কিস্তি জমা বাতিল');
EmiCancelPage('staffEmiCancel', 'কর্মী ঋণের কিস্তি বাতিল', true);
const EmiCancel = {
  run(vno, btn) {
    const reason = prompt('বাতিলের কারণ লিখুন:'); if (reason === null) return;
    return guard(btn, async () => {
      if (!isBM()) fail('কিস্তি বাতিলের অনুমতি শুধু Branch Manager/Admin এর');
      await Eng.cancel(vno, reason); toast('✅ কিস্তি বাতিল হয়েছে'); Cache.drop('aidx_');
      const el = btn.closest('.page'); loanReceiptList(el, UI.el(el, 'account').value, true);
    });
  },
};

// ── কিস্তির বিবরণ (Installment Receive History) ──
ReportPage({
  id: 'emiHist', title: 'কিস্তির বিবরণ (Installment Receive History)', icon: '📜', fromDefault: 'month',
  filters: [F.branch, { k: 'member', l: 'Select Member', t: 'member', req: 1 }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, F.from, F.upto],
  init: async (el, f) => { await Pick.account(f, 'account', 'member', 'branch', { kind: 'loan', closed: true }); const fe = UI.el(f, 'from'); fe.value = '2000-01-01'; },
  run: async f => {
    const l = await Tx.acc(f.account);
    const ts = (await db.collection('txns').where('accNo', '==', f.account).get()).docs.map(d => d.data()).filter(t => !t.cancelled && t.tt !== 'LOAN_DISB' && t.dc === 'C').sort((a, b) => (a.date + a.vno).localeCompare(b.date + b.vno));
    let paid = 0; const rows = [];
    for (const t of ts) {
      const before = Loan.status(l, t.date, paid);
      paid = r2(paid + num(t.amount));
      const after = Loan.status(l, t.date, paid);
      if (t.date >= f.from && t.date <= f.upto) rows.push({ t, before, after });
    }
    return {
      landscape: true, sub: `${l.accNo} — ${esc(l.title)} | ঋণ ${amt(l.principal)} + মুনাফা ${amt(l.profit)} = ${amt(l.totalRepay)} | কিস্তি ${amt(l.instAmount)}`,
      html: UI.table([{ h: 'Receive Date', f: r => fmtD(r.t.date) }, { h: 'Profit Rate', f: () => l.rate }, { h: 'Inst. Amount', f: () => amt(l.instAmount), r: 1 }, { h: 'Due Inst.', f: r => r.before.dueCnt }, { h: 'Paid Inst.', f: r => r.after.paidCnt }, { h: 'Overdue Inst.', f: r => r.before.overdueCnt },
        { h: 'Receive Amount', f: r => amt(r.t.amount), r: 1, sum: 1, v: r => r.t.amount }, { h: 'Investment Receive', f: r => amt(r.t.principal), r: 1, sum: 1, v: r => r.t.principal }, { h: 'Profit Receive', f: r => amt(r.t.profit), r: 1, sum: 1, v: r => r.t.profit }, { h: 'Charge Receive', f: r => amt(r.t.penalty), r: 1, sum: 1, v: r => r.t.penalty },
        { h: 'Ason Due Recover', f: r => amt(Math.min(r.t.amount, r.before.asonDue)), r: 1 }, { h: 'Advance Recover', f: r => amt(Math.max(0, r.t.amount - r.before.asonDue)), r: 1 }, { h: 'Outstanding', f: r => amt(r.after.outstanding), r: 1 }, { h: 'Total Due', f: r => amt(r.after.asonDue), r: 1 }, { h: 'Total Overdue', f: r => amt(r.after.overdue), r: 1 }, { h: 'Advance', f: r => amt(r.after.advance), r: 1 }], rows),
    };
  },
});

// ── ঋণ পুনঃ বিতরণ (Reschedule) ──
App.page('emiReschedule', {
  title: 'ঋণ পুনঃ বিতরণ (Loan Reschedule)', icon: '🔁',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member Name', t: 'member', req: 1 }, { k: 'account', l: 'Loan Account', t: 'select', req: 1 },
    { k: 'oPrincipal', l: 'Loan Disburse Amount', ro: 1 }, { k: 'oProfit', l: 'Loan Disburse Profit', ro: 1 }, { k: 'oDate', l: 'Disburse Date', ro: 1 }, { k: 'oInst', l: 'Previous Installment Amount', ro: 1 }, { k: 'totalN', l: 'Total Installment', ro: 1 }, { k: 'paidN', l: 'Total Installment Paid', ro: 1 },
    { k: 'totalLoan', l: 'Total Loan Amount', ro: 1 }, { k: 'totalPaid', l: 'Total Loan Paid', ro: 1 }, { k: 'totalDue', l: 'Total Loan Due', ro: 1 }, { k: 'duePrincipal', l: 'Total Due Principal', ro: 1 }, { k: 'dueProfit', l: 'Total Due Profit', ro: 1 }, { k: 'expDate', l: 'Expired Date', ro: 1 },
    { t: 'hr', l: 'নতুন শিডিউল' },
    { k: 'freq', l: 'Installment Frequency', t: 'select', req: 1, opts: [['', 'Select'], ...['D', 'W', 'M', 'Q', 'H', 'Y', 'F', 'S'].map(x => [x, REF.FREQ[x]])] }, { k: 'addProfit', l: 'Additional Profit Amount', t: 'number', v: 0 }, { k: 'newProfit', l: 'Loan Profit Amount', ro: 1 },
    { k: 'date', l: 'Reschedule Date', t: 'date', req: 1 }, { k: 'newTotal', l: 'Total Loan Amount', ro: 1 }, { k: 'instAmount', l: 'Installment Amount', t: 'number', req: 1 }, { k: 'newN', l: 'No of Installment', ro: 1 }, { k: 'firstDate', l: '1st Installment Date', t: 'date', req: 1 }, { k: 'newExp', l: 'Installment Expiry Date', ro: 1 },
    { k: 'formFee', l: 'Form Fee', t: 'number' }, { k: 'healthFee', l: 'Health Service Fee', t: 'number' }, { k: 'riskFee', l: 'Risk Insurance', t: 'number' }, { k: 'docFee', l: 'Document Fee', t: 'number' }, { k: 'lockerFee', l: 'EMI Locker Fee', t: 'number' }, { k: 'othersFee', l: 'Others Fee', t: 'number' }], 3)
    + `<div class="actions">${UI.btn('✅ Submit Reschedule', 'Resched.save(this)', 'btn-success')}</div>`) + UI.card('Search Reschedule', '<div class="rsl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'loan' });
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', async () => {
      const r = await LoanInfo.load(el, UI.el(el, 'account').value, UI.el(el, 'date').value); if (!r) return;
      UI.set(el, { oPrincipal: r.l.principal, oProfit: r.l.profit, oDate: fmtD(r.l.openDate), oInst: r.l.instAmount, freq: r.l.freq, firstDate: Loan.nextDate(UI.el(el, 'date').value, r.l.freq, 1) });
      Resched.calc(el); Resched.list(el);
    });
    ['freq', 'addProfit', 'instAmount', 'firstDate'].forEach(k => UI.el(el, k).addEventListener('input', () => Resched.calc(el)));
    UI.el(el, 'freq').addEventListener('change', () => Resched.calc(el));
  },
});
const Resched = {
  calc(el) {
    const l = el._loan; if (!l) return;
    const due = r2(num(l.totalRepay) - num(l.paidTotal)), add = num(UI.el(el, 'addProfit').value);
    const total = r2(due + add); let inst = num(UI.el(el, 'instAmount').value); if (!inst) { inst = l.instAmount; UI.el(el, 'instAmount').value = inst; }
    const fullN = Math.floor(total / inst), last = r2(total - fullN * inst), n = fullN + (last > 0 ? 1 : 0);
    UI.set(el, { newProfit: r2(num(l.profit) + add), newTotal: total, newN: n, newExp: UI.el(el, 'firstDate').value ? Loan.expiry(UI.el(el, 'firstDate').value, UI.el(el, 'freq').value, n) : '' });
    el._rs = { total, inst, fullN, last, n, add };
  },
  save(btn) {
    const el = $('#page-emiReschedule');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const l = el._loan; Resched.calc(el); const rs = el._rs;
      if (!l || l.status !== 'active') fail('সক্রিয় ঋণ বাছাই করুন');
      const fees = { form: num(f.formFee), health: num(f.healthFee), risk: num(f.riskFee), doc: num(f.docFee), locker: num(f.lockerFee), others: num(f.othersFee) };
      const feeLines = [['form', REF.GL.formFee], ['health', REF.GL.health], ['risk', REF.GL.risk], ['doc', REF.GL.docFee], ['locker', REF.GL.locker], ['others', REF.GL.othersFee]].filter(([k]) => fees[k]).map(([k, gl]) => ({ gl, cr: fees[k] }));
      const feeTotal = sum(feeLines, x => x.cr);
      const prev = { freq: l.freq, firstDate: l.firstDate, instAmount: l.instAmount, actualN: l.actualN, lastInst: l.lastInst, expDate: l.expDate, profit: l.profit, totalRepay: l.totalRepay, base: num(l.base) };
      const upd = { freq: f.freq, firstDate: f.firstDate, instAmount: rs.inst, actualN: rs.fullN, lastInst: rs.last, expDate: Loan.expiry(f.firstDate, f.freq, rs.n), base: num(l.paidTotal), rescheduled: (l.rescheduled || 0) + 1 };
      await Eng.post({
        branch: f.branch, date: f.date, type: 'LOAN_RESCHEDULE', narration: 'ঋণ পুনঃতফসিল ' + l.accNo, ref: { accNo: l.accNo },
        lines: [...(feeTotal ? [{ gl: REF.GL.cash, dr: feeTotal }, ...feeLines] : []), ...(rs.add ? [{ gl: REF.LOAN[l.type].gl, dr: rs.add, accNo: l.accNo }, { gl: REF.LOAN[l.type].recGl, cr: rs.add, memo: 'Reschedule Profit' }] : [])],
        accOps: [{ accNo: l.accNo, samity: l.samity, inc: { profit: rs.add, totalRepay: rs.add, balance: rs.add }, snapInc: { pf: rs.add, tr: rs.add, b: rs.add }, set: upd, snapSet: { fq: upd.freq, fd: upd.firstDate, ia: upd.instAmount, an: upd.actualN, li: upd.lastInst, ed: upd.expDate, bs: upd.base }, undoSet: { ...prev } }],
        extra: async b => b.set(db.collection('reschedules').doc(), { branch: f.branch, accNo: l.accNo, memberId: l.memberId, date: f.date, prev, next: upd, addProfit: rs.add, fees, by: App.user.userId, on: FV.serverTimestamp() }),
      });
      toast('✅ ঋণ পুনঃতফসিল হয়েছে'); UI.el(el, 'account').dispatchEvent(new Event('change'));
    });
  },
  async list(el) {
    const rows = (await db.collection('reschedules').where('accNo', '==', UI.el(el, 'account').value).get()).docs.map(d => d.data());
    $('.rsl', el).innerHTML = UI.table([{ h: 'Member ID', f: r => r.memberId }, { h: 'Account Number', f: r => r.accNo }, { h: 'Installment Frequency', f: r => r.next.freq }, { h: 'Installment Amount', f: r => amt(r.next.instAmount), r: 1 }, { h: 'Reschedule Date', f: r => fmtD(r.date) }, { h: '1st Installment Date', f: r => fmtD(r.next.firstDate) }, { h: 'Expiry Date', f: r => fmtD(r.next.expDate) }, { h: 'Additional Profit', f: r => amt(r.addProfit), r: 1 }, { h: 'By', f: r => r.by }], rows);
  },
};

// ── ঋণ মওকুফ ──
App.page('emiWaive', {
  title: 'ঋণ মওকুফ (Loan Waiver)', icon: '✂️',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Loan Account', t: 'select', req: 1 }, { k: 'expDate', l: 'Installment Expire Date', ro: 1 }, { k: 'date', l: 'Waiver Date', t: 'date', req: 1 },
    { k: 'totalN', l: 'Total Installment', ro: 1 }, { k: 'paidN', l: 'Total Installment Paid', ro: 1 }, { k: 'totalLoan', l: 'Total Loan Amount', ro: 1 }, { k: 'totalPaid', l: 'Total Loan Paid', ro: 1 }, { k: 'duePrincipal', l: 'Loan Due Investment', ro: 1 }, { k: 'dueProfit', l: 'Loan Due Profit', ro: 1 }, { k: 'penalty', l: 'Total Penalty Charge', ro: 1 }, { k: 'totalDue', l: 'Total Loan Due', ro: 1 },
    { k: 'wvP', l: 'Principal Waive Amount', t: 'number' }, { k: 'wvPr', l: 'Profit Waive Amount', t: 'number' }, { k: 'wvC', l: 'Charge Waive Amount', t: 'number' }, { k: 'total', l: 'Total Waiver', ro: 1 }, { k: 'comments', l: 'Waiver Comments', req: 1 }], 4)
    + `<div class="actions">${UI.btn('✅ Submit Waiver', 'Waive.save(this)', 'btn-danger')}</div>`) + UI.card('Search Waiver', '<div class="wl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'loan' });
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', () => { LoanInfo.load(el, UI.el(el, 'account').value); Waive.list(el); });
    ['wvP', 'wvPr', 'wvC'].forEach(k => UI.el(el, k).addEventListener('input', () => UI.el(el, 'total').value = r2(num(UI.el(el, 'wvP').value) + num(UI.el(el, 'wvPr').value) + num(UI.el(el, 'wvC').value))));
  },
});
const Waive = {
  save(btn) {
    const el = $('#page-emiWaive');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); if (!isBM()) fail('মওকুফের অনুমতি নেই');
      const l = await Tx.acc(f.account); const p = num(f.wvP), pr = num(f.wvPr), c = num(f.wvC);
      if (p + pr + c <= 0) fail('মওকুফের পরিমাণ দিন');
      if (p > r2(num(l.principal) - num(l.paidP)) + 0.001) fail('আসল বকেয়ার চেয়ে বেশি');
      if (pr > r2(num(l.profit) - num(l.paidPr)) + 0.001) fail('মুনাফা বকেয়ার চেয়ে বেশি');
      if (c > num(l.penDue) + 0.001) fail('জরিমানা বকেয়ার চেয়ে বেশি');
      const prod = REF.LOAN[l.type];
      const newOut = r2(num(l.balance) - p - pr), closing = newOut <= 0.001;
      await Eng.post({
        branch: f.branch, date: f.date, type: 'LOAN_WAIVER', narration: 'ঋণ মওকুফ ' + l.accNo + ' — ' + f.comments, ref: { accNo: l.accNo },
        lines: (p + pr) ? [{ gl: REF.GL.waiver, dr: p }, { gl: prod.recGl, dr: pr, memo: 'Profit Waiver' }, { gl: prod.gl, cr: r2(p + pr), accNo: l.accNo }] : [],
        txns: [{ accNo: l.accNo, kind: 'loan', type: l.type, memberId: l.memberId, samity: l.samity, tt: 'EMI_WAIVE', amount: r2(p + pr), dc: 'C', principal: p, profit: pr, penalty: c, waiver: true, narration: f.comments }],
        accOps: [{ accNo: l.accNo, samity: l.samity, inc: { balance: -(p + pr), paidP: p, paidPr: pr, paidTotal: p + pr, penDue: -c, wvP: p, wvPr: pr, wvC: c }, snapInc: { b: -(p + pr), pp: p, ppr: pr, pt: p + pr }, set: closing ? { status: 'closed', closeDate: f.date } : null, snapSet: closing ? { st: 'closed', cd: f.date } : null, undoSet: closing ? { status: 'active' } : null }],
      });
      toast('✅ মওকুফ সম্পন্ন'); UI.el(el, 'account').dispatchEvent(new Event('change'));
    });
  },
  async list(el) {
    const rows = (await db.collection('txns').where('accNo', '==', UI.el(el, 'account').value).get()).docs.map(d => d.data()).filter(t => t.tt === 'EMI_WAIVE');
    $('.wl', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId }, { h: 'Loan Account', f: r => r.accNo }, { h: 'Effective Date', f: r => fmtD(r.date) }, { h: 'Total Waiver', f: r => amt(r.amount + num(r.penalty)), r: 1 }, { h: 'Principal Waiver', f: r => amt(r.principal), r: 1 }, { h: 'Profit Waiver', f: r => amt(r.profit), r: 1 }, { h: 'Charge Waiver', f: r => amt(r.penalty), r: 1 }, { h: 'Entry By', f: r => r.byName }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Comments', f: r => esc(r.narration || '') }, { h: 'Action', f: r => r.cancelled ? 'বাতিল' : UI.btn('✖', `EmiCancel.run('${r.vno}',this)`, 'btn-danger btn-sm') }], rows);
  },
};

// ── অতিরিক্ত ঋণের জরিমানা ──
App.page('emiPenalty', {
  title: 'অতিরিক্ত ঋণের জরিমানা', icon: '⚡',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Loan Account', t: 'select', req: 1 }, { k: 'date', l: 'Entry Date', t: 'date', req: 1 },
    { k: 'addProfit', l: 'Additional Profit', t: 'number' }, { k: 'penaltyAmt', l: 'Penalty Amount', t: 'number' }, { k: 'instAmount', l: 'Installment Amount', ro: 1 }, { k: 'totalLoan', l: 'Total EMI Amount', ro: 1 }, { k: 'totalPaid', l: 'Total EMI Paid', ro: 1 }, { k: 'totalDue', l: 'Total EMI Due', ro: 1 }, { k: 'penalty', l: 'বর্তমান জরিমানা বকেয়া', ro: 1 }, { k: 'comments', l: 'Comments', req: 1 }], 4)
    + `<div class="actions">${UI.btn('⚡ Submit Penalty', 'Penalty.save(this)', 'btn-danger')}</div>`) + UI.card('Search Penalty', '<div class="pl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'loan' });
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', () => { LoanInfo.load(el, UI.el(el, 'account').value); Penalty.list(el); });
  },
});
const Penalty = {
  save(btn) {
    const el = $('#page-emiPenalty');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const l = await Tx.acc(f.account);
      const ap = num(f.addProfit), pen = num(f.penaltyAmt); if (ap + pen <= 0) fail('পরিমাণ দিন');
      await Eng.post({
        branch: f.branch, date: f.date, type: 'LOAN_PENALTY', narration: 'জরিমানা/অতিরিক্ত মুনাফা ' + l.accNo + ' — ' + f.comments, ref: { accNo: l.accNo },
        lines: ap ? [{ gl: REF.LOAN[l.type].gl, dr: ap, accNo: l.accNo }, { gl: REF.LOAN[l.type].recGl, cr: ap, memo: 'Additional Profit' }] : [],
        txns: [{ accNo: l.accNo, kind: 'loan', type: l.type, memberId: l.memberId, samity: l.samity, tt: 'EMI_PENALTY', amount: r2(ap + pen), dc: 'D', profit: ap, penalty: pen, narration: f.comments }],
        accOps: [{ accNo: l.accNo, samity: l.samity, inc: { profit: ap, totalRepay: ap, balance: ap, penDue: pen }, snapInc: { pf: ap, tr: ap, b: ap } }],
      });
      toast('✅ জরিমানা যোগ হয়েছে'); UI.el(el, 'account').dispatchEvent(new Event('change'));
    });
  },
  async list(el) {
    const l = el._loan;
    const rows = (await db.collection('txns').where('accNo', '==', UI.el(el, 'account').value).get()).docs.map(d => d.data()).filter(t => t.tt === 'EMI_PENALTY');
    $('.pl', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId }, { h: 'Loan Account', f: r => r.accNo }, { h: 'Date', f: r => fmtD(r.date) }, { h: 'On Amount', f: () => amt(l ? l.principal : 0), r: 1 }, { h: 'Total Profit', f: r => amt(r.profit), r: 1 }, { h: 'Total Penalty', f: r => amt(r.penalty), r: 1 }, { h: 'Comments', f: r => esc(r.narration || '') }, { h: 'Entry By', f: r => r.byName }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Action', f: r => r.cancelled ? 'বাতিল' : UI.btn('✖', `EmiCancel.run('${r.vno}',this)`, 'btn-danger btn-sm') }], rows);
  },
};

// ── ঋণ উদ্দেশ্য সেটআপ ──
CrudPage({
  id: 'loanPurpose', title: 'ঋণ উদ্দেশ্য সেটআপ (Loan Purpose Setup)', icon: '🎯', coll: 'loanPurposes', key: 'code', cacheKey: 'purposes', cols: 3,
  fields: [{ k: 'code', l: 'Purpose Code', ro: 1, ph: 'অটো' }, { k: 'cat', l: 'Category Name', t: 'select', opts: ['Business', 'Agriculture', 'Livestock', 'Fisheries', 'Housing', 'Education', 'Health', 'Transport', 'Consumption', 'Others'] }, { k: 'name', l: 'Purpose Name', req: 1 }, { k: 'active', l: 'IS Active', t: 'checkbox', v: true }],
  autoId: async () => pad(await nextSeq('purpose', 2), 6), submitLabel: '✅ Create Loan Purpose', searchLabel: 'Search Loan Purpose',
  list: { cols: [{ h: 'Category Name', f: r => esc(r.cat || '') }, { h: 'Purpose Code', f: r => r.code }, { h: 'Purpose Name', f: r => esc(r.name) }, { h: 'IS Active', f: r => r.active === false ? 'No' : 'Yes' }] },
});

// ── ঋণের কিস্তি সেটিংস ──
CrudPage({
  id: 'emiInstSet', title: 'ঋণের কিস্তি সেটিংস (Manage Installment Settings)', icon: '⚙️', coll: 'emiInstSettings', cacheKey: 'instset', cols: 4,
  fields: [{ k: 'type', l: 'Account Type', t: 'select', req: 1, opts: Object.entries(REF.LOAN).map(([c, d]) => [c, c + '-' + d.name]) }, { k: 'freq', l: 'Installment Frequency', t: 'select', req: 1, opts: [['', 'Select'], ...['D', 'W', 'M', 'Q', 'H', 'Y', 'C', 'F', 'S'].map(x => [x, REF.FREQ[x]])] }, { k: 'n', l: 'No of Installment', t: 'number', req: 1 }, { k: 'rate', l: 'Profit Rate', t: 'number', req: 1 }, { k: 'active', l: 'Active', t: 'checkbox', v: true }],
  autoId: async () => 'E' + pad(await nextSeq('instset', 9), 8), submitLabel: '➕ Add Installment', searchLabel: 'Search Installment',
  before: d => { d.n = num(d.n); d.rate = num(d.rate); return d; },
  list: { post: rows => rows.sort((a, b) => a.id.localeCompare(b.id)), cols: [{ h: 'Installment ID', f: r => r.id }, { h: 'Account Type', f: r => r.type }, { h: 'Installment Frequency', f: r => REF.FREQ[r.freq] || r.freq }, { h: 'No Of Installment', f: r => r.n }, { h: 'Profit Rate', f: r => amt(r.rate) }, { h: 'Status', f: r => r.active === false ? 'Inactive' : 'Active' }] },
});

// ── ঋণ লাভের বিবরণ (Investment Profit Details) ──
ReportPage({
  id: 'invProfit', title: 'ঋণ লাভের বিবরণ (Investment Profit Details)', icon: '💹', fromDefault: 'month',
  filters: [F.branch, { k: 'member', l: 'সদস্য', t: 'member' }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, F.from, F.upto],
  init: async (el, f) => Pick.account(f, 'account', 'member', 'branch', { kind: 'loan', closed: true }),
  run: async f => {
    const l = await Tx.acc(f.account);
    const ts = (await db.collection('txns').where('accNo', '==', f.account).get()).docs.map(d => d.data()).filter(t => !t.cancelled && t.date >= f.from && t.date <= f.upto).sort((a, b) => a.date.localeCompare(b.date));
    return { sub: `${l.accNo} — ${esc(l.title)} | মোট মুনাফা ${amt(l.profit)} | আদায় ${amt(l.paidPr)} | বকেয়া ${amt(num(l.profit) - num(l.paidPr))}`, html: UI.table([{ h: 'Calculation Date', f: t => fmtD(t.date) }, { h: 'বিবরণ', f: t => TT_NAME[t.tt] || t.tt }, { h: 'Debit/Credit', f: t => t.dc === 'D' ? 'Debit' : 'Credit' }, { h: 'Profit Rate', f: () => l.rate }, { h: 'Profit On Amount', f: t => amt(t.amount), r: 1 }, { h: 'Profit Amount', f: t => amt(t.profit), r: 1, sum: 1, v: t => t.dc === 'C' ? t.profit : 0 }], ts) };
  },
});

// ── ঋণের উদ্দেশ্য পরিবর্তন ──
App.page('emiPurposeUpdate', {
  title: 'ঋণের উদ্দেশ্য পরিবর্তন (Loan Purpose Update)', icon: '🎯',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Select Member', t: 'member', req: 1 }, { k: 'account', l: 'Select Account', t: 'select', req: 1 }, { k: 'cur', l: 'Present Purpose Name', ro: 1 }, { k: 'purpose', l: 'Loan Purpose', t: 'select', req: 1 }], 3) + `<div class="actions">${UI.btn('✅ Update Purpose', 'PurposeUpd.save(this)', 'btn-success')}</div>`),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'loan' });
    UI.fill(UI.el(el, 'purpose'), await Data.purposes(), p => p.code, p => p.name);
    UI.el(el, 'account').addEventListener('change', async () => { const a = await Data.account(UI.el(el, 'account').value); UI.el(el, 'cur').value = a ? a.purposeName || '' : ''; });
  },
});
const PurposeUpd = {
  save(btn) {
    const el = $('#page-emiPurposeUpdate');
    return guard(btn, async () => { UI.validate(el); const f = UI.get(el); const name = UI.el(el, 'purpose').selectedOptions[0].text; await db.collection('accounts').doc(f.account).update({ purpose: f.purpose, purposeName: name, purposeHistory: FV.arrayUnion({ from: f.cur, to: name, date: today(), by: App.user.userId }) }); UI.el(el, 'cur').value = name; toast('✅ উদ্দেশ্য পরিবর্তন হয়েছে'); });
  },
};

// ── কর্মী ঋণ তৈরি ──
App.page('staffLoanOpen', {
  title: 'কর্মী ঋণ তৈরি (Staff Loan)', icon: '👔',
  render: () => UI.card('', UI.grid(LoanForm.fields({ staff: true }), 3) + SubList.render('guarantor', '🤝 জামিনদার') + `<div class="actions">${UI.btn('✅ Open Loan Account', 'StaffLoan.save(this)', 'btn-success')}</div>`) + UI.card('কর্মী ঋণসমূহ', '<div class="sl"></div>'),
  init: async el => { await LoanForm.bind(el, { staff: true }); StaffLoan.list(el); },
});
const StaffLoan = {
  save(btn) {
    const el = $('#page-staffLoanOpen');
    return guard(btn, async () => {
      const d = LoanForm.read(el); d.guarantors = SubList.items(el, 'guarantor');
      if (!confirm(`কর্মী ঋণ ${tk(d.principal)} বিতরণ করবেন?`)) return;
      const r = await LoanForm.disburse(d, { staff: true });
      toast('✅ কর্মী ঋণ খোলা হয়েছে — ' + r.accNo); StaffLoan.list(el);
    });
  },
  async list(el) {
    const rows = (await db.collection('accounts').where('isStaff', '==', true).get()).docs.map(d => d.data()).filter(a => a.branch === UI.el(el, 'branch').value);
    $('.sl', el).innerHTML = UI.table([{ h: 'Account', f: a => a.accNo }, { h: 'Employee', f: a => a.empId + ' - ' + esc(a.title) }, { h: 'Disburse Date', f: a => fmtD(a.openDate) }, { h: 'Loan', f: a => amt(a.principal), r: 1 }, { h: 'Total', f: a => amt(a.totalRepay), r: 1 }, { h: 'Paid', f: a => amt(a.paidTotal), r: 1 }, { h: 'Due', f: a => amt(a.balance), r: 1 }, { h: 'Status', f: a => a.status }], rows);
  },
};
