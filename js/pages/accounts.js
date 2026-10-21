// ═══════════════════════════════════════════════════════════════
// এ্যাকাউন্ট ওপেনিং — ডিপোজিট, লোন, অন্যান্য, প্রস্তাব, প্রোফাইল, লাভ হার
// ═══════════════════════════════════════════════════════════════
const DEP_TYPES = Object.entries(REF.DEP).map(([c, d]) => [c, `${c} -${d.short}- ${d.name}`]);
const LOAN_TYPES = Object.entries(REF.LOAN).filter(([, d]) => !d.staff).map(([c, d]) => [c, `${c} -${d.short}- ${d.name}`]);
const OTHER_TYPES = Object.entries(REF.OTHER).map(([c, d]) => [c, `${c} - ${d.name}`]);

// ── সাব-লিস্ট এডিটর (নমিনি / জামিনদার) ──
const SubList = {
  render(key, title) { return `<div class="card-title" style="margin-top:8px">${title} ${UI.btn('➕ Add', `SubList.add(this,'${key}')`, 'btn-outline btn-sm')}</div><div class="sublist" data-sub="${key}"></div>`; },
  defs: {
    nominee: [{ k: 'serial', l: 'Nominee Serial' }, { k: 'name', l: 'Nominee Name', req: 1 }, { k: 'relation', l: 'Relation With Member' }, { k: 'mobile', l: 'Mobile No', req: 1 }, { k: 'sex', l: 'Gender', t: 'select', opts: GENDER }, { k: 'father', l: 'Father Name' }, { k: 'mother', l: 'Mother Name' }, { k: 'pct', l: 'Share Percentage', t: 'number', req: 1 }, { k: 'presentAddr', l: 'Present Address' }, { k: 'permAddr', l: 'Permanent Address' }, { k: 'dob', l: 'Birth Date', t: 'date' }, { k: 'nid', l: 'NID NO', req: 1 }],
    guarantor: [{ k: 'memberId', l: 'Member ID (সদস্য হলে)' }, { k: 'blockAcc', l: 'সঞ্চয় অ্যাকাউন্ট ব্লক', t: 'select', opts: [['', '------------']] }, { k: 'accBal', l: 'অ্যাকাউন্ট ব্যালেন্স', ro: 1 }, { k: 'blockAmt', l: 'ব্লক পরিমাণ', t: 'number' }, { k: 'serial', l: 'জামিনদার সিরিয়াল' }, { k: 'name', l: 'জামিনদার নাম', req: 1 }, { k: 'relation', l: 'সদস্যের সাথে সম্পর্ক' }, { k: 'mobile', l: 'ফোন নাম্বার', req: 1 }, { k: 'sex', l: 'লিঙ্গ', t: 'select', opts: GENDER }, { k: 'father', l: 'পিতার নাম' }, { k: 'mother', l: 'মাতার নাম' }, { k: 'nid', l: 'এন আই ডি নাম্বার' }, { k: 'presentAddr', l: 'বর্তমান ঠিকানা' }, { k: 'permAddr', l: 'স্থায়ী ঠিকানা' }, { k: 'income', l: 'মাসিক আয়', t: 'number' }, { k: 'incomeSrc', l: 'আয়ের উৎস' }, { k: 'dob', l: 'জন্ম তারিখ', t: 'date' }, { k: 'religion', l: 'ধর্ম', t: 'select', opts: RELIGION }, { k: 'blood', l: 'রক্তের গ্রুপ', t: 'select', opts: BLOOD }, { k: 'education', l: 'শিক্ষা', t: 'select', opts: EDU }, { k: 'marital', l: 'বৈবাহিক অবস্থা', t: 'select', opts: MARITAL }, { k: 'photo', l: 'ছবি', t: 'file' }],
  },
  items(root, key) { const box = root.querySelector(`[data-sub="${key}"]`); return (box && box._items) || []; },
  draw(box) {
    const key = box.dataset.sub; const items = box._items || [];
    box.innerHTML = items.length ? UI.table([{ h: '#', f: (r) => items.indexOf(r) + 1 }, { h: 'নাম', f: r => esc(r.name) }, { h: 'মোবাইল', f: r => esc(r.mobile || '') }, { h: 'সম্পর্ক', f: r => esc(r.relation || '') }, { h: key === 'nominee' ? 'শেয়ার %' : 'ব্লক', f: r => key === 'nominee' ? (r.pct || '') : (r.blockAcc ? r.blockAcc + ' / ' + amt(r.blockAmt) : '') }, { h: '', f: r => `<button class="btn btn-danger btn-sm" onclick="SubList.remove(this,${items.indexOf(r)})">✖</button>` }], items) : '<div class="mini">কেউ যোগ করা হয়নি</div>';
  },
  remove(btn, i) { const box = btn.closest('.sublist'); box._items.splice(i, 1); SubList.draw(box); },
  async add(btn, key) {
    const box = btn.closest('.card').querySelector(`[data-sub="${key}"]`) || $(`[data-sub="${key}"]`);
    const m = UI.modal(key === 'nominee' ? '➕ নমিনি যোগ' : '➕ জামিনদার যোগ', UI.grid(SubList.defs[key], 3), UI.btn('✅ ADD', 'void 0', 'btn-success', 'id="subOk"'));
    if (key === 'guarantor') {
      const pg = btn.closest('.page'); const branch = UI.el(pg, 'branch') ? UI.el(pg, 'branch').value : App.branch;
      UI.el(m, 'memberId').addEventListener('change', async () => {
        const id = UI.el(m, 'memberId').value.trim(); if (!id) return;
        const mem = await Data.member(id); if (!mem) return toast('সদস্য পাওয়া যায়নি', 'error');
        UI.set(m, { name: mem.name, mobile: mem.mobile, father: mem.father, mother: mem.mother, nid: mem.nid, presentAddr: mem.presentAddr, permAddr: mem.permAddr, sex: mem.sex, dob: mem.dob, religion: mem.religion, blood: mem.blood });
        const accs = await Data.accountsOf(mem.branch || branch, id, 'dep');
        UI.fill(UI.el(m, 'blockAcc'), accs.filter(a => a.status !== 'closed'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type));
      });
      UI.el(m, 'blockAcc').addEventListener('change', async () => { const a = await Data.account(UI.el(m, 'blockAcc').value); UI.el(m, 'accBal').value = a ? a.balance : ''; });
    }
    $('#subOk', m).onclick = () => guard($('#subOk', m), async () => {
      UI.validate(m); const d = UI.get(m);
      if (d.photo) d.photoUrl = await uploadImage(d.photo); delete d.photo;
      if (d.blockAcc && num(d.blockAmt) > num(d.accBal)) fail('ব্লক পরিমাণ ব্যালেন্সের বেশি');
      box._items = [...(box._items || []), d]; SubList.draw(box); m.remove();
    });
  },
};

// ── ডিপোজিট এ্যাকাউন্ট ওপেনিং ──
App.page('depOpen', {
  title: 'ডিপোজিট এ্যাকাউন্ট ওপেনিং', icon: '💰',
  render: () => UI.card('', UI.grid([
    { k: 'branch', l: 'শাখা নাম', t: 'select', req: 1 }, { k: 'member', l: 'সদস্য আইডি', t: 'member', req: 1 }, { k: 'samityName', l: 'সমিতি নাম', ro: 1 },
    { k: 'type', l: 'হিসাবের ধরন', t: 'select', req: 1, opts: [['', '------------'], ...DEP_TYPES] }, { k: 'freq', l: 'Installment Frequency', t: 'select', opts: [['', '------------']] }, { k: 'instAmount', l: 'Amount (কিস্তি / FDR পরিমাণ)', t: 'number' },
    { k: 'title', l: 'এ্যাকাউন্ট নাম', req: 1 }, { k: 'address', l: 'এ্যাকাউন্ট ঠিকানা' }, { k: 'phone', l: 'Phone Number', req: 1 },
    { k: 'openDate', l: 'হিসাব খোলার তারিখ', t: 'date', req: 1 }, { k: 'rate', l: 'Profit Rate', t: 'number', ro: 1 }, { k: 'sched', l: 'Deposit Type', t: 'select', opts: [['', '------------']] },
    { k: 'months', l: 'মেয়াদ (মাস)', t: 'number', hint: 'FDR/DPS এর মেয়াদ' }, { k: 'maturityDate', l: 'মেয়াদপূর্তির তারিখ', t: 'date', ro: 1 },
    { k: 'autoRenew', l: 'Auto Renew', t: 'checkbox' }, { k: 'renewProfit', l: 'Auto Renew With Profit', t: 'checkbox' },
  ], 3) + SubList.render('nominee', '👤 Nominee') + `<div class="actions">${UI.btn('✅ Open Deposit Account', 'DepOpen.save(this)', 'btn-success')}</div>`) + UI.card('এই সদস্যের একাউন্টসমূহ', '<div class="macc"></div>'),
  init: async (el, p) => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch');
    UI.el(el, 'openDate').value = await businessDate();
    const T = UI.el(el, 'type');
    const recalc = () => {
      const t = T.value, d = REF.DEP[t]; const months = num(UI.el(el, 'months').value);
      UI.el(el, 'maturityDate').value = (d && d.dtype !== 'SB' && months) ? addMonths(UI.el(el, 'openDate').value, months) : '';
    };
    T.addEventListener('change', async () => {
      const t = T.value, d = REF.DEP[t];
      UI.fill(UI.el(el, 'freq'), d ? d.freq : [], f => f, f => REF.FREQ[f]);
      UI.el(el, 'rate').value = d ? d.rate : '';
      const sch = (await db.collection('depSchedules').where('type', '==', t).get()).docs.map(x => x.data()).sort((a, b) => a.code.localeCompare(b.code));
      UI.fill(UI.el(el, 'sched'), sch, s => s.code, s => `${s.name} -- ${s.inst ? amt(s.inst) : ''}`);
      UI.el(el, 'sched')._list = sch;
      UI.el(el, 'months').value = d && d.n ? d.n : '';
      recalc();
    });
    UI.el(el, 'sched').addEventListener('change', () => {
      const s = (UI.el(el, 'sched')._list || []).find(x => x.code === UI.el(el, 'sched').value); if (!s) return;
      if (s.inst) UI.el(el, 'instAmount').value = s.inst; if (s.rate) UI.el(el, 'rate').value = s.rate; if (s.months) UI.el(el, 'months').value = s.months; recalc();
    });
    UI.el(el, 'months').addEventListener('input', recalc); UI.el(el, 'openDate').addEventListener('change', recalc);
    UI.el(el, 'member').addEventListener('picked', async e => {
      const m = e.detail; if (!m) return;
      const full = await Data.member(m.id);
      UI.set(el, { samityName: m.samity, title: m.name, phone: m.mobile, address: full ? full.presentAddr : '' });
      DepOpen.showAccs(el, m.id);
    });
    if (p.member) { const inp = UI.el(el, 'member'); inp.value = p.member; inp.dispatchEvent(new Event('change')); }
  },
});
const DepOpen = {
  async showAccs(el, mid) {
    const accs = await Data.accountsOf(UI.el(el, 'branch').value, mid);
    $('.macc', el).innerHTML = UI.table([{ h: 'একাউন্ট', f: a => a.accNo }, { h: 'ধরন', f: a => typeFull(a.kind, a.type) }, { h: 'অবস্থা', f: a => a.status }], accs);
  },
  save(btn) {
    const el = $('#page-depOpen');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const d = REF.DEP[f.type];
      const nominees = SubList.items(el, 'nominee');
      if (nominees.length && Math.round(sum(nominees, n => num(n.pct))) !== 100) fail('নমিনিদের শেয়ার % এর যোগফল ১০০ হতে হবে');
      if (d.comp && !num(f.instAmount)) fail('কিস্তির পরিমাণ দিন');
      if (d.dtype === 'RD' && !f.sched) fail('DPS এর Deposit Type (শিডিউল) বাছাই করুন');
      if (d.dtype !== 'SB' && !num(f.months)) fail('মেয়াদ (মাস) দিন');
      const m = await Data.member(f.member); if (!m || m.status !== 'active') fail('সদস্য সক্রিয় নয়');
      const exist = (await Data.accountsOf(f.branch, f.member, 'dep', f.type)).filter(a => a.status !== 'closed');
      if (d.dtype === 'SB' && exist.length) fail(`এই সদস্যের ${d.name} একাউন্ট আগে থেকেই আছে: ${exist[0].accNo}`);
      const accNo = await newAccNo(f.branch, f.member);
      const acc = {
        accNo, kind: 'dep', type: f.type, branch: f.branch, memberId: f.member, samity: m.samity, title: f.title, address: f.address, phone: f.phone,
        openDate: f.openDate, freq: f.freq || '', instAmount: num(f.instAmount), rate: num(f.rate), sched: f.sched || '', months: num(f.months), maturityDate: f.maturityDate || '',
        autoRenew: f.autoRenew, renewProfit: f.renewProfit, nominees, status: 'active', balance: 0, totCr: 0, totDr: 0, profitPaid: 0, block: { amount: 0, dep: false, wd: false },
        createdBy: App.user.userId, createdAt: FV.serverTimestamp(),
      };
      const b = db.batch();
      b.set(db.collection('accounts').doc(accNo), acc);
      Idx.setAccount(b, f.branch, acc);
      b.set(db.collection('snap').doc(m.samity), { a: { [accNo]: DepSnap(acc) } }, { merge: true });
      await b.commit();
      toast('✅ ডিপোজিট একাউন্ট খোলা হয়েছে — নং: ' + accNo);
      UI.modal('✅ একাউন্ট খোলা হয়েছে', UI.info([['একাউন্ট নং', `<b style="font-size:18px">${accNo}</b>`], ['ধরন', typeFull('dep', f.type)], ['সদস্য', esc(f.member + ' - ' + f.title)], ['কিস্তি', tk(f.instAmount)], ['মুনাফার হার', f.rate + '%'], ['মেয়াদপূর্তি', fmtD(f.maturityDate)]]),
        UI.btn('💰 টাকা জমা', `this.closest('.modal').remove();App.go('${d.dtype === 'RD' ? 'dpsRcv' : 'depRcv'}',{member:'${f.member}',account:'${accNo}'})`, 'btn-success'));
      $('[data-sub="nominee"]', el)._items = []; SubList.draw($('[data-sub="nominee"]', el));
      DepOpen.showAccs(el, f.member);
    });
  },
};

// ── লোন ফর্ম (লোন ওপেনিং / প্রস্তাব / কর্মী ঋণ — একই হিসাব) ──
const LoanForm = {
  fields(o = {}) {
    return [
      { k: 'branch', l: 'শাখা নাম', t: 'select', req: 1 }, { k: 'type', l: 'হিসাবের ধরন', t: 'select', req: 1, opts: o.staff ? [['3101', '3101 -SL- Staff Loan']] : LOAN_TYPES },
      o.staff ? { k: 'member', l: 'Employee Name', t: 'select', req: 1 } : { k: 'member', l: 'সদস্য আইডি', t: 'member', req: 1 }, { k: 'samityName', l: 'সমিতি নাম', ro: 1 },
      { k: 'openDate', l: o.proposal ? 'Proposal Date' : 'হিসাব খোলার তারিখ', t: 'date', req: 1 }, { k: 'purpose', l: 'ঋণের উদ্দেশ্য', t: 'select', req: 1 },
      { k: 'principal', l: 'ঋণের পরিমাণ', t: 'number', req: 1 }, { k: 'blockAcc', l: 'Block Account (সঞ্চয়)', t: 'select', opts: [['', '------------']] }, { k: 'blockAmt', l: 'ব্লক পরিমাণ', t: 'number' },
      { k: 'freq', l: 'কিস্তির ধরন (দৈনিক/সপ্তাহিক/মাসিক)', t: 'select', req: 1, opts: [['', '------------']] }, { k: 'setting', l: 'কিস্তির সংখ্যা ও ঋন হার (%)', t: 'select', req: 1, opts: [['', '-- Select --']] },
      { k: 'calcInst', l: 'প্রকৃত কিস্তির পরিমাণ', t: 'number', ro: 1 }, { k: 'instAmount', l: 'মূল কিস্তির পরিমাণ (টাকা)', t: 'number', req: 1 },
      { k: 'extra', l: 'অতিরিক্ত টাকা ( প্রকৃত কিস্তির)', t: 'number', ro: 1 }, { k: 'lastInst', l: 'সর্বশেষ কিস্তির পরিমাণ (টাকা)', t: 'number', ro: 1 }, { k: 'actualN', l: 'প্রকৃত কিস্তি সংখ্যা', t: 'number', ro: 1 },
      { k: 'rate', l: 'মুনাফার হার (%)', t: 'number', ro: 1 }, { k: 'profit', l: 'মুনাফার পরিমাণ', t: 'number', ro: 1 }, { k: 'totalRepay', l: 'সর্বমোট প্রদেয় টাকার পরিমাণ', t: 'number', ro: 1 },
      { k: 'firstDate', l: 'কিস্তি শুরুর তারিখ', t: 'date', req: 1 }, { k: 'expDate', l: 'মেয়াদ উত্তীর্নের তারিখ', t: 'date', ro: 1 },
      o.proposal ? null : { k: 'payLedger', l: 'টাকা প্রদানের ধরন', t: 'select', req: 1 }, o.proposal ? null : { k: 'trfAcc', l: o.staff ? 'Payment to Account' : 'গ্রাহকের হিসাবে স্থানান্তর ( অপশনাল)', t: 'select', opts: [['', '------------']] },
      { t: 'hr', l: 'ফি সমূহ' },
      { k: 'formFee', l: 'ফরম ফি', t: 'number', ro: o.proposal }, { k: 'healthFee', l: 'স্বাস্থ্য সেবা ফি', t: 'number', ro: o.proposal }, { k: 'riskFee', l: 'ঝুকি তহবিল', t: 'number', ro: o.proposal },
      { k: 'docFee', l: 'ডকুমেন্ট ফি', t: 'number', ro: o.proposal }, { k: 'lockerFee', l: 'EMI Locker Fee', t: 'number', ro: o.proposal }, { k: 'othersFee', l: 'অন্যান্য ফি', t: 'number', ro: o.proposal },
    ];
  },
  async bind(el, o = {}) {
    await Pick.branch(el, 'branch');
    if (o.staff) await Pick.employee(el, 'member', 'branch');
    else await Pick.member(el, 'member', 'branch');
    UI.el(el, 'openDate').value = await businessDate();
    const purs = (await Data.purposes()).filter(p => p.active !== false);
    UI.fill(UI.el(el, 'purpose'), purs, p => p.code, p => p.name); if (purs.length) UI.el(el, 'purpose').value = purs[0].code;
    if (UI.el(el, 'payLedger')) await Pick.ledger(UI.el(el, 'payLedger'), l => l.cashBank && l.leaf);
    if (UI.el(el, 'payLedger')) UI.el(el, 'payLedger').value = REF.GL.cash;
    const T = UI.el(el, 'type'), FQ = UI.el(el, 'freq'), ST = UI.el(el, 'setting');
    const loadFreq = async () => {
      const sets = (await Data.instSettings()).filter(s => s.type === (o.staff ? '3001' : T.value) && s.active !== false);
      el._sets = sets;
      UI.fill(FQ, [...new Set(sets.map(s => s.freq))], f => f, f => REF.FREQ[f]); FQ.dispatchEvent(new Event('change'));
    };
    FQ.addEventListener('change', () => { const ss = (el._sets || []).filter(s => s.freq === FQ.value); UI.fill(ST, ss, s => s.id, s => s.n + '-' + amt(s.rate), '-- Select --'); if (ss.length === 1) ST.value = ss[0].id; LoanForm.firstDate(el); LoanForm.calc(el); });
    T.addEventListener('change', loadFreq); await loadFreq();
    ST.addEventListener('change', () => { UI.el(el, 'instAmount').value = ''; LoanForm.calc(el); });
    ['principal', 'instAmount', 'firstDate'].forEach(k => UI.el(el, k).addEventListener('input', () => LoanForm.calc(el, k)));
    UI.el(el, 'openDate').addEventListener('change', () => LoanForm.firstDate(el));
    const M = UI.el(el, 'member');
    const onMember = async (mid) => {
      if (!mid) return;
      let samity = '';
      if (o.staff) { UI.el(el, 'samityName').value = ''; }
      else { const mem = await Data.member(mid); samity = mem ? mem.samity : ''; const s = samity ? await Data.samity(samity) : null; UI.el(el, 'samityName').value = s ? s.code + ' - ' + s.name : samity; el._samity = s; }
      const accs = o.staff ? await Data.accountsOf(UI.el(el, 'branch').value, 'E' + mid) : await Data.accountsOf(UI.el(el, 'branch').value, mid, 'dep');
      UI.fill(UI.el(el, 'blockAcc'), accs.filter(a => a.status !== 'closed' && a.kind === 'dep'), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type));
      if (UI.el(el, 'trfAcc')) UI.fill(UI.el(el, 'trfAcc'), accs.filter(a => a.status !== 'closed' && (a.kind === 'dep' && REF.DEP[a.type] && REF.DEP[a.type].dtype === 'SB' || a.kind === 'other')), a => a.accNo, a => a.accNo + ' - ' + typeName(a.kind, a.type));
      if (o.onMember) o.onMember(el, mid);
      LoanForm.firstDate(el);
    };
    M.addEventListener(o.staff ? 'change' : 'picked', e => onMember(o.staff ? M.value : (e.detail && e.detail.id)));
    UI.el(el, 'blockAcc').addEventListener('change', async () => { const a = await Data.account(UI.el(el, 'blockAcc').value); UI.el(el, 'blockAmt').value = a ? r2(num(a.balance) - num(a.block && a.block.amount)) : ''; });
  },
  // প্রথম কিস্তির তারিখ: সাপ্তাহিক হলে পরের সপ্তাহের সমিতি বার; মাসিক হলে ১ মাস পর; দৈনিক হলে পরদিন
  firstDate(el) {
    const od = UI.el(el, 'openDate').value, fq = UI.el(el, 'freq').value; if (!od || !fq) return;
    let fd = Loan.nextDate(od, fq, 1);
    const s = el._samity;
    if (fq === 'W' && s && s.day) { fd = addDays(od, 7); const want = WEEKDAYS.indexOf(s.day); while (parseD(fd).getDay() !== want) fd = addDays(fd, 1); }
    if (fq === 'M' && s && s.dateOfMonth) { const d = parseD(addMonths(od, 1)); d.setDate(Math.min(num(s.dateOfMonth), 28)); fd = ymd(d); }
    UI.el(el, 'firstDate').value = fd; LoanForm.calc(el);
  },
  calc(el, src) {
    const st = (el._sets || []).find(s => s.id === UI.el(el, 'setting').value);
    const P = num(UI.el(el, 'principal').value);
    if (!st || !P) { ['calcInst', 'extra', 'lastInst', 'actualN', 'rate', 'profit', 'totalRepay', 'expDate'].forEach(k => UI.el(el, k).value = ''); return; }
    const base = Loan.calc(P, st.rate, st.n);
    if (src !== 'instAmount' && (src === 'principal' || !num(UI.el(el, 'instAmount').value) || src === undefined)) UI.el(el, 'instAmount').value = base.inst;
    const c = Loan.calc(P, st.rate, st.n, num(UI.el(el, 'instAmount').value) || base.inst);
    UI.set(el, { calcInst: base.inst, extra: c.extra, lastInst: c.lastInst, actualN: c.actualN, rate: st.rate, profit: c.profit, totalRepay: c.total });
    const fd = UI.el(el, 'firstDate').value; if (fd) UI.el(el, 'expDate').value = Loan.expiry(fd, st.freq, c.totalN);
  },
  read(el) {
    UI.validate(el); const f = UI.get(el);
    const st = (el._sets || []).find(s => s.id === f.setting); if (!st) fail('কিস্তির সংখ্যা বাছাই করুন');
    const c = Loan.calc(f.principal, st.rate, st.n, f.instAmount);
    if (c.actualInst > f.principal) fail('কিস্তি ঋণের চেয়ে বেশি');
    if (num(f.blockAmt) && !f.blockAcc) fail('ব্লক একাউন্ট বাছাই করুন');
    const purpose = UI.el(el, 'purpose').selectedOptions[0]?.text || '';
    return {
      ...f, purposeName: purpose, settingId: st.id, freq: st.freq, n: st.n, rate: st.rate, principal: num(f.principal), profit: c.profit, totalRepay: c.total,
      instAmount: c.actualInst, calcInst: c.inst, lastInst: c.lastInst, actualN: c.actualN, totalN: c.totalN, expDate: Loan.expiry(f.firstDate, st.freq, c.totalN),
      fees: { form: num(f.formFee), health: num(f.healthFee), risk: num(f.riskFee), doc: num(f.docFee), locker: num(f.lockerFee), others: num(f.othersFee) },
    };
  },
  // লোন বিতরণ — একাউন্ট তৈরি + GL পোস্টিং
  async disburse(d, opts = {}) {
    const staff = !!opts.staff;
    let memberId = d.member, samity = '', title = '', phone = '';
    if (staff) { const e = (await Data.employees(d.branch)).find(x => x.empId === d.member); if (!e) fail('কর্মী পাওয়া যায়নি'); memberId = 'E' + e.empId; title = e.name; phone = e.mobile; }
    else { const m = await Data.member(d.member); if (!m || m.status !== 'active') fail('সদস্য সক্রিয় নয়'); samity = m.samity; title = m.name; phone = m.mobile; }
    const prod = REF.LOAN[d.type]; if (!prod) fail('ঋণের ধরন সঠিক নয়');
    const active = (await Data.accountsOf(d.branch, memberId, 'loan')).filter(a => a.status === 'active');
    if (active.length && !confirm(`এই ${staff ? 'কর্মীর' : 'সদস্যের'} চলমান ঋণ আছে (${active.map(a => a.accNo).join(', ')})। তবুও নতুন ঋণ দেবেন?`)) fail('বাতিল করা হয়েছে');
    const accNo = staff ? 'SL' + d.member + pad((active.length + 1 + Math.floor(Math.random() * 90)), 2) : await newAccNo(d.branch, memberId);
    const sam = samity ? await Data.samity(samity) : null;
    const acc = {
      accNo, kind: 'loan', type: d.type, branch: d.branch, memberId, samity, title, phone, isStaff: staff, empId: staff ? d.member : '',
      openDate: d.openDate, purpose: d.purpose, purposeName: d.purposeName, principal: d.principal, rate: d.rate, profit: d.profit, totalRepay: d.totalRepay,
      n: d.n, actualN: d.actualN, instAmount: d.instAmount, calcInst: d.calcInst, lastInst: d.lastInst, freq: d.freq, firstDate: d.firstDate, expDate: d.expDate, settingId: d.settingId,
      fees: d.fees, blockAcc: d.blockAcc || '', blockAmt: num(d.blockAmt), guarantors: d.guarantors || [], proposalId: d.proposalId || '', payLedger: d.payLedger || REF.GL.cash, trfAcc: d.trfAcc || '',
      paidP: 0, paidPr: 0, paidPen: 0, paidTotal: 0, penDue: 0, wvP: 0, wvPr: 0, wvC: 0, balance: 0, status: 'active', foId: sam ? sam.foId : '',
      createdBy: App.user.userId, createdAt: FV.serverTimestamp(),
    };
    const feeMap = [['form', REF.GL.formFee], ['health', REF.GL.health], ['risk', REF.GL.risk], ['doc', REF.GL.docFee], ['locker', REF.GL.locker], ['others', REF.GL.othersFee]];
    const feeTotal = sum(feeMap, ([k]) => num(d.fees[k]));
    const parts = [];
    // eKisti: ঋণ হিসাবে আসল+মুনাফা ডেবিট, মুনাফা Profit Receivable এ ক্রেডিট
    const lines = [{ gl: prod.gl, dr: r2(num(d.principal) + num(d.profit)), accNo }];
    if (num(d.profit)) lines.push({ gl: prod.recGl, cr: num(d.profit), memo: 'Loan Disbursement Profit' });
    let trf = null;
    if (d.trfAcc) { trf = await Tx.acc(d.trfAcc); const p = await Tx.credit(trf, d.principal, { contraGl: null, tt: 'LOAN_DISB_TRF', narration: 'ঋণ বিতরণ ' + accNo, skipProfile: true }); parts.push(p); }
    else lines.push({ gl: d.payLedger || REF.GL.cash, cr: d.principal });
    feeMap.forEach(([k, gl]) => { if (num(d.fees[k])) lines.push({ gl, cr: num(d.fees[k]), memo: 'fee_' + k }); });
    if (feeTotal) lines.push({ gl: REF.GL.cash, dr: feeTotal, memo: 'fees' });
    const m = Tx.merge(parts);
    // ব্লক (লিয়েন): নিজের ও জামিনদারের সঞ্চয়
    const blocks = [];
    if (d.blockAcc && num(d.blockAmt)) blocks.push([d.blockAcc, num(d.blockAmt)]);
    (d.guarantors || []).forEach(g => { if (g.blockAcc && num(g.blockAmt)) blocks.push([g.blockAcc, num(g.blockAmt)]); });
    const vno = await Eng.post({
      branch: d.branch, date: d.openDate, type: staff ? 'STAFF_LOAN_DISB' : 'LOAN_DISB', narration: `ঋণ বিতরণ ${accNo} - ${title}`, ref: { accNo },
      lines: [...lines, ...m.lines],
      txns: [{ accNo, kind: 'loan', type: d.type, memberId, samity, foId: acc.foId, tt: 'LOAN_DISB', amount: d.principal, dc: 'D', principal: d.principal, profit: d.profit, narration: d.purposeName },
        ...feeMap.filter(([k]) => num(d.fees[k])).map(([k]) => ({ accNo, kind: 'fee', type: k, memberId, samity, foId: acc.foId, tt: 'LOAN_FEE_' + k.toUpperCase(), amount: num(d.fees[k]), dc: 'C' })), ...m.txns],
      accOps: [{ accNo, samity, inc: { balance: d.totalRepay }, snapInc: { b: d.totalRepay }, undoSet: { status: 'cancelled' } }, ...m.accOps,
        ...blocks.map(([a, amtv]) => ({ accNo: a, inc: { 'block.amount': amtv } }))],
      pre: async batch => {
        batch.set(db.collection('accounts').doc(accNo), acc);
        Idx.setAccount(batch, d.branch, acc);
        if (samity) batch.set(db.collection('snap').doc(samity), { a: { [accNo]: { ...Loan.snapOf(acc), b: 0 } } }, { merge: true });
        if (d.proposalId) batch.update(db.collection('loanProposals').doc(d.proposalId), { status: 'Disbursed', loanAccNo: accNo, disbursedBy: App.user.userId, disbursedOn: FV.serverTimestamp() });
        blocks.forEach(([a, amtv]) => batch.set(db.collection('liens').doc(), { branch: d.branch, accNo: a, kind: 'add', date: d.openDate, amount: amtv, dep: false, wd: false, reason: 'ঋণ ' + accNo + ' এর জামানত', loanAcc: accNo, by: App.user.userId, on: FV.serverTimestamp() }));
      },
    });
    return { accNo, vno, acc };
  },
};
function loanSchedulePrint(acc) {
  const sch = Loan.schedule(acc); let bal = acc.totalRepay;
  printHTML('কিস্তি পরিশোধ সূচী', UI.info([['ঋণ নং', acc.accNo], ['সদস্য', esc(acc.memberId + ' - ' + acc.title)], ['ঋণের পরিমাণ', amt(acc.principal)], ['মুনাফা', amt(acc.profit)], ['মোট', amt(acc.totalRepay)], ['কিস্তি', amt(acc.instAmount) + ' × ' + sch.length]])
    + UI.table([{ h: 'ক্রম', f: r => r.i }, { h: 'তারিখ', f: r => fmtD(r.date) }, { h: 'কিস্তি', f: r => amt(r.amount), r: 1 }, { h: 'অবশিষ্ট', f: r => amt(r.bal), r: 1 }], sch.map((s, i) => ({ ...s, i: i + 1, bal: (bal = r2(bal - s.amount)) }))), {});
}

App.page('loanOpen', {
  title: 'লোন এ্যাকাউন্ট ওপেনিং', icon: '💳',
  render: () => UI.card('', UI.grid(LoanForm.fields(), 3) + SubList.render('guarantor', '🤝 জামিনদার') + `<div class="actions">${UI.btn('✅ Open Loan Account', 'LoanOpen.save(this)', 'btn-success')}${UI.btn('📅 কিস্তি সূচী দেখুন', 'LoanOpen.preview()', 'btn-outline')}</div>`),
  init: async (el, p) => {
    await LoanForm.bind(el);
    if (p.proposal) {
      const pr = (await db.collection('loanProposals').doc(p.proposal).get()).data(); if (!pr) return;
      el._proposal = p.proposal;
      UI.el(el, 'branch').value = pr.branch; UI.el(el, 'type').value = pr.type;
      const M = UI.el(el, 'member'); M.value = pr.member; M.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 400));
      UI.el(el, 'freq').value = pr.freq; UI.el(el, 'freq').dispatchEvent(new Event('change'));
      UI.set(el, { purpose: pr.purpose, principal: pr.principal, setting: pr.settingId, blockAcc: pr.blockAcc || '', blockAmt: pr.blockAmt || '' });
      LoanForm.calc(el); UI.el(el, 'instAmount').value = pr.instAmount; LoanForm.calc(el, 'instAmount');
      $('[data-sub="guarantor"]', el)._items = pr.guarantors || []; SubList.draw($('[data-sub="guarantor"]', el));
      toast('ঋণ প্রস্তাব থেকে তথ্য লোড হয়েছে — ফি দিয়ে বিতরণ করুন', 'info');
    }
  },
});
const LoanOpen = {
  preview() { const el = $('#page-loanOpen'); try { const d = LoanForm.read(el); loanSchedulePrint({ ...d, accNo: '(নতুন)', memberId: d.member, title: '' }); } catch (e) { toast(e.message, 'error'); } },
  save(btn) {
    const el = $('#page-loanOpen');
    return guard(btn, async () => {
      const d = LoanForm.read(el); d.guarantors = SubList.items(el, 'guarantor'); d.proposalId = el._proposal || '';
      if (!confirm(`ঋণ বিতরণ নিশ্চিত করুন:\nপরিমাণ ${tk(d.principal)}, মুনাফা ${tk(d.profit)}, মোট ${tk(d.totalRepay)}\nকিস্তি ${tk(d.instAmount)} × ${d.totalN} (${REF.FREQ[d.freq]})`)) return;
      busy(true, 'ঋণ বিতরণ হচ্ছে...');
      let r; try { r = await LoanForm.disburse(d); } finally { busy(false); }
      toast('✅ ঋণ একাউন্ট খোলা হয়েছে — নং: ' + r.accNo);
      UI.modal('✅ ঋণ বিতরণ সম্পন্ন', UI.info([['ঋণ নং', `<b style="font-size:18px">${r.accNo}</b>`], ['ভাউচার', r.vno], ['ঋণ', tk(d.principal)], ['মোট প্রদেয়', tk(d.totalRepay)], ['কিস্তি', tk(d.instAmount) + ' × ' + d.totalN], ['প্রথম কিস্তি', fmtD(d.firstDate)]]), UI.btn('📅 কিস্তি সূচী প্রিন্ট', `Data.account('${r.accNo}').then(loanSchedulePrint)`, 'btn-outline'));
      el._proposal = null; UI.reset(el, ['branch', 'type', 'openDate', 'payLedger']); $('[data-sub="guarantor"]', el)._items = []; SubList.draw($('[data-sub="guarantor"]', el));
    });
  },
};

// ── ঋণ আবেদন / প্রস্তাব ──
App.page('loanProposal', {
  title: 'ঋন আবেদন', icon: '📝',
  render: () => UI.card('', UI.grid(LoanForm.fields({ proposal: true }), 3) + SubList.render('guarantor', '🤝 জামিনদার') + `<div class="actions">${UI.btn('✅ Submit Application', 'Proposal.save(this)', 'btn-success')}</div>`),
  init: el => LoanForm.bind(el, { proposal: true }),
});
const PROPOSAL_ST = ['Pending Review', 'Review Completed', 'Approved', 'Disbursed', 'Reject', 'Disbursed Cancel'];
const Proposal = {
  save(btn) {
    const el = $('#page-loanProposal');
    return guard(btn, async () => {
      const d = LoanForm.read(el); const m = await Data.member(d.member); if (!m) fail('সদস্য পাওয়া যায়নি');
      const ref = db.collection('loanProposals').doc();
      await ref.set({ ...d, memberName: m.name, samity: m.samity, foId: (el._samity || {}).foId || '', guarantors: SubList.items(el, 'guarantor'), status: 'Pending Review', createdBy: App.user.userId, createdAt: FV.serverTimestamp() });
      toast('✅ ঋণ আবেদন জমা হয়েছে'); UI.reset(el, ['branch', 'type', 'openDate']); $('[data-sub="guarantor"]', el)._items = []; SubList.draw($('[data-sub="guarantor"]', el));
    });
  },
  async setStatus(id, st) {
    if (st === 'Approved' && !isBM()) return toast('অনুমোদনের অনুমতি নেই', 'error');
    await db.collection('loanProposals').doc(id).update({ status: st, ['st_' + st.replace(/\s/g, '')]: App.user.userId, updatedAt: FV.serverTimestamp() });
    toast('✅ অবস্থা: ' + st); ReportPage.run('loanProposalList');
  },
};
ReportPage({
  id: 'loanProposalList', title: 'ঋন আবেদন তালিকা', icon: '📋', fromDefault: 'month',
  filters: [F.branch, F.samity, F.employee, F.member, { k: 'status', l: 'Status', t: 'select', opts: [['', '--------'], ...PROPOSAL_ST.map(s => [s, s])] }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    let rows = (await db.collection('loanProposals').where('branch', '==', f.branch).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    rows = rows.filter(r => (!f.samity || r.samity === f.samity) && (!f.employee || r.foId === f.employee) && (!f.member || r.member === f.member) && (!f.status || r.status === f.status) && r.openDate >= f.from && r.openDate <= f.upto).sort((a, b) => a.openDate.localeCompare(b.openDate));
    const act = r => {
      const b = [];
      if (r.status === 'Pending Review') b.push(UI.btn('✔ Review', `Proposal.setStatus('${r.id}','Review Completed')`, 'btn-outline btn-sm'));
      if (['Pending Review', 'Review Completed'].includes(r.status)) b.push(UI.btn('✅ Approve', `Proposal.setStatus('${r.id}','Approved')`, 'btn-success btn-sm'), UI.btn('✖ Reject', `Proposal.setStatus('${r.id}','Reject')`, 'btn-danger btn-sm'));
      if (r.status === 'Approved') b.push(UI.btn('💳 বিতরণ', `App.go('loanOpen',{proposal:'${r.id}'})`, 'btn-primary btn-sm'));
      return `<span class="list-actions no-print">${b.join('')}</span>`;
    };
    return { landscape: true, html: UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Somity Code', f: r => r.samity }, { h: 'Member ID', f: r => r.member }, { h: 'Member Name', f: r => esc(r.memberName) }, { h: 'Account Type', f: r => r.type }, { h: 'Profit Rate', f: r => r.rate }, { h: 'Proposal Date', f: r => fmtD(r.openDate) }, { h: 'Loan Purpose', f: r => esc(r.purposeName || '') }, { h: 'Proposal Amount', f: r => amt(r.principal), r: 1, sum: 1, v: r => r.principal }, { h: 'Inst. Frequency', f: r => r.freq }, { h: 'Inst. Amount', f: r => amt(r.instAmount), r: 1 }, { h: 'Repay From', f: r => fmtD(r.firstDate) }, { h: 'No. of Inst.', f: r => r.totalN }, { h: 'Loan Exp date', f: r => fmtD(r.expDate) }, { h: 'Status', f: r => `<span class="tag">${r.status}</span>` }, { h: 'Action', f: act }], rows) };
  },
});

// ── অন্যান্য এ্যাকাউন্ট ওপেনিং ──
App.page('otherOpen', {
  title: 'অন্যান্য এ্যাকাউন্ট ওপেনিং', icon: '📁',
  render: () => UI.card('', UI.grid([F.branch, { k: 'type', l: 'Account Type', t: 'select', req: 1, opts: [['', '------------'], ...OTHER_TYPES] }, { k: 'openDate', l: 'Account Opening Date', t: 'date', req: 1 }, { k: 'ref', l: 'Account ID (কর্মী/পরিচালক আইডি)', t: 'select' }, { k: 'title', l: 'Account Title', req: 1 }, { k: 'phone', l: 'Phone Number', req: 1 }, { k: 'address', l: 'Account Address', req: 1 }, { k: 'creditLimit', l: 'Credit Limit', t: 'number' }], 4) + `<div class="actions">${UI.btn('✅ Open New Account', 'OtherOpen.save(this)', 'btn-success')}</div>`)
    + UI.card('🔍 Search Account', '<div class="ol"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); UI.el(el, 'openDate').value = await businessDate();
    const emps = await Data.employees(''); const dirs = (await db.collection('directors').get()).docs.map(d => d.data());
    UI.fill(UI.el(el, 'ref'), [...emps.map(e => ['E' + e.empId, 'কর্মী ' + e.empId + '-' + e.name, e]), ...dirs.map(d => ['D' + d.dirId, 'পরিচালক ' + d.dirId + '-' + d.name, d])], x => x[0], x => x[1], '------------');
    UI.el(el, 'ref').addEventListener('change', () => { const o = [...emps.map(e => ['E' + e.empId, e]), ...dirs.map(d => ['D' + d.dirId, d])].find(x => x[0] === UI.el(el, 'ref').value); if (o) UI.set(el, { title: o[1].name, phone: o[1].mobile || '', address: o[1].presentAddr || '' }); });
    OtherOpen.list();
  },
});
const OtherOpen = {
  save(btn) {
    const el = $('#page-otherOpen');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      const seq = await nextSeq('other_' + f.branch);
      const accNo = 'O' + f.branch + f.type + pad(seq, 4);
      const acc = { accNo, kind: 'other', type: f.type, branch: f.branch, memberId: f.ref || '', samity: '', title: f.title, phone: f.phone, address: f.address, creditLimit: num(f.creditLimit), openDate: f.openDate, status: 'active', balance: 0, totCr: 0, totDr: 0, createdBy: App.user.userId, createdAt: FV.serverTimestamp() };
      const b = db.batch(); b.set(db.collection('accounts').doc(accNo), acc); Idx.setAccount(b, f.branch, acc); await b.commit();
      toast('✅ একাউন্ট খোলা হয়েছে — নং: ' + accNo); UI.reset(el, ['branch', 'openDate']); OtherOpen.list();
    });
  },
  async list() {
    const el = $('#page-otherOpen');
    const rows = (await db.collection('accounts').where('kind', '==', 'other').get()).docs.map(d => d.data()).filter(a => a.branch === UI.el(el, 'branch').value);
    $('.ol', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Phone Number', f: r => esc(r.phone) }, { h: 'Member ID', f: r => r.memberId || '' }, { h: 'AC Type', f: r => typeFull('other', r.type) }, { h: 'Account Number', f: r => r.accNo }, { h: 'Account Name', f: r => esc(r.title) }, { h: 'Address', f: r => esc(r.address || '') }, { h: 'Total Credit', f: r => amt(r.totCr), r: 1 }, { h: 'Total Debit', f: r => amt(r.totDr), r: 1 }, { h: 'Current Balance', f: r => amt(r.balance), r: 1 }, { h: 'Credit Limit', f: r => amt(r.creditLimit), r: 1 }, { h: 'Is Active', f: r => r.status === 'active' ? 'Yes' : 'No' }, { h: 'Opening Date', f: r => fmtD(r.openDate) }], rows);
  },
};

// ── সঞ্চয়ের পরিমান নির্ধারন ──
App.page('depInstUpdate', {
  title: 'সঞ্চয়ের পরিমান নির্ধারন (Update Deposit Installment)', icon: '✏️',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Member Account', t: 'select', req: 1 }, { k: 'cur', l: 'বর্তমান কিস্তি', ro: 1 }, { k: 'instAmount', l: 'Installment Amount', t: 'number', req: 1 }], 3) + `<div class="actions">${UI.btn('✅ Update Installment', 'DepInst.save(this)', 'btn-success')}</div>`),
  init: async el => { await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' }); UI.el(el, 'account').addEventListener('change', async () => { const a = await Data.account(UI.el(el, 'account').value); UI.el(el, 'cur').value = a ? a.instAmount || 0 : ''; }); },
});
const DepInst = {
  save(btn) {
    const el = $('#page-depInstUpdate');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const a = await Data.account(f.account);
      const b = db.batch();
      b.update(db.collection('accounts').doc(f.account), { instAmount: num(f.instAmount), instHistory: FV.arrayUnion({ from: num(a.instAmount), to: num(f.instAmount), date: await businessDate(f.branch), by: App.user.userId }) });
      if (a.samity) b.set(db.collection('snap').doc(a.samity), { a: { [f.account]: { ia: num(f.instAmount) } } }, { merge: true });
      await b.commit(); toast('✅ কিস্তির পরিমাণ আপডেট হয়েছে'); UI.el(el, 'cur').value = f.instAmount;
    });
  },
};

// ── ঋণ বিতরণ তালিকা ──
ReportPage({
  id: 'loanDisbList', title: 'ঋণ বিতরণ তালিকা', icon: '📃', fromDefault: 'month',
  filters: [F.branch, F.samity, F.member, F.from, F.upto],
  run: async f => {
    const snaps = (await Data.snaps(f.branch, f.samity)).filter(s => s.k === 'loan' && s.st !== 'cancelled' && (!f.member || s.m === f.member) && s.od >= f.from && s.od <= f.upto).map(Loan.fromSnap);
    const mem = await Data.memberIdx(f.branch);
    snaps.sort((a, b) => a.openDate.localeCompare(b.openDate));
    return { landscape: true, html: UI.table([{ h: 'Samity', f: r => r.samity }, { h: 'Member ID', f: r => r.memberId }, { h: 'Member Name', f: r => esc((mem[r.memberId] || [])[0] || '') }, { h: 'Account', f: r => r.accNo }, { h: 'Disburse Date', f: r => fmtD(r.openDate) }, { h: 'Loan Amount', f: r => amt(r.principal), r: 1, sum: 1, v: r => r.principal }, { h: 'Repay Amount', f: r => amt(r.totalRepay), r: 1, sum: 1, v: r => r.totalRepay }, { h: 'Profit Rate', f: r => r.rate }, { h: 'Repayment Start', f: r => fmtD(r.firstDate) }, { h: 'Inst NO', f: r => r.actualN + (r.lastInst ? 1 : 0) }, { h: 'Actions', f: r => `<span class="no-print">${UI.btn('📅', `Data.account('${r.accNo}').then(loanSchedulePrint)`, 'btn-outline btn-sm')}</span>` }], snaps) };
  },
});

// ── এ্যাকাউন্ট তালিকা ──
ReportPage({
  id: 'accList', title: 'এ্যাকাউন্ট তালিকা', icon: '📒',
  filters: [F.branch, F.samity, { k: 'kind', l: 'Account Type', t: 'select', opts: [['', '— সব —'], ['dep', 'Deposit'], ['loan', 'Loan'], ['share', 'Share'], ['other', 'Others'], ...DEP_TYPES.map(([c, t]) => ['dep:' + c, t]), ...LOAN_TYPES.map(([c, t]) => ['loan:' + c, t])] }, F.member, { k: 'phone', l: 'Phone Number' }, { k: 'status', l: 'অবস্থা', t: 'select', opts: [['', 'All'], ['active', 'Active'], ['closed', 'Closed']] }],
  run: async f => {
    const [kind, type] = (f.kind || '').split(':');
    let accs = await Data.accountsOf(f.branch, f.member || null, kind || null, type || null);
    if (f.samity) accs = accs.filter(a => a.samity === f.samity);
    if (f.status) accs = accs.filter(a => (a.status || 'active') === f.status);
    const snaps = {}; (await Data.snaps(f.branch, f.samity)).forEach(s => snaps[s.accNo] = s);
    const mem = await Data.memberIdx(f.branch);
    if (f.phone) accs = accs.filter(a => ((mem[a.memberId] || [])[2] || '').includes(f.phone));
    return { landscape: true, html: UI.table([{ h: 'Branch', f: () => f.branch }, { h: 'Phone', f: a => esc((mem[a.memberId] || [])[2] || '') }, { h: 'Member ID', f: a => a.memberId }, { h: 'AC Type', f: a => typeFull(a.kind, a.type) }, { h: 'Account Number', f: a => a.accNo }, { h: 'Account Name', f: a => esc(a.title) }, { h: 'Total Credit', f: a => amt((snaps[a.accNo] || {}).tc || (snaps[a.accNo] || {}).pt), r: 1 }, { h: 'Total Debit', f: a => amt((snaps[a.accNo] || {}).td || (a.kind === 'loan' ? (snaps[a.accNo] || {}).tr : 0)), r: 1 }, { h: 'Current Balance', f: a => amt((snaps[a.accNo] || {}).b), r: 1, sum: 1, v: a => (snaps[a.accNo] || {}).b }, { h: 'Is Active', f: a => a.status === 'closed' ? 'No' : 'Yes' }, { h: 'Opening Date', f: a => fmtD((snaps[a.accNo] || {}).od) }, { h: 'Closing Date', f: a => fmtD((snaps[a.accNo] || {}).cd) }], accs) };
  },
});

// ── লেনদেন প্রোফাইল সেটআপ ──
const TRAN_FREQ = [['D', 'D-Daily'], ['W', 'W-Weekly'], ['M', 'M-Monthly'], ['Q', 'Q-Quarterly'], ['H', 'H-Half Yearly'], ['Y', 'Y-Yearly'], ['N', 'N-Not Applicable']];
CrudPage({
  id: 'tranProfile', title: 'লেনদেন প্রোফাইল সেটআপ', icon: '🧮', coll: 'tranProfiles', key: 'accNo', cols: 4,
  fields: [F.branch, { k: 'member', l: 'Select Member', t: 'member' }, { k: 'accNo', l: 'Account Number', t: 'select', req: 1 }, { k: 'freq', l: 'Transaction Frequency', t: 'select', req: 1, opts: TRAN_FREQ },
    { k: 'maxDrCount', l: 'Max Debit Count', t: 'number' }, { k: 'maxCrCount', l: 'Max Credit Count', t: 'number' }, { k: 'maxDr', l: 'Max Debit Amount', t: 'number' }, { k: 'maxCr', l: 'Max Credit Amount', t: 'number' },
    { k: 'maxDrPct', l: 'Max Debit Amount Percentage', t: 'number' }, { k: 'maxCrPct', l: 'Max Credit Amount Percentage', t: 'number' }, { k: 'minBalPct', l: 'Minimum Balance Percentage', t: 'number' }, { k: 'minBal', l: 'Minimum Balance Amount', t: 'number' },
    { k: 'status', l: 'Status', t: 'select', req: 1, opts: ['Active', 'Inactive'] }, { k: 'comments', l: 'Comments', t: 'textarea' }],
  init: async el => { await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'accNo', 'member', 'branch', { kind: 'dep' }); },
  submitLabel: '✅ Create Transaction AC',
  list: { query: async () => db.collection('tranProfiles').where('branch', '==', App.branch).get(), cols: [{ h: 'Branch', f: r => r.branch }, { h: 'Member ID', f: r => r.member }, { h: 'Account', f: r => r.accNo }, { h: 'Frequency', f: r => r.freq }, { h: 'Max Debit', f: r => amt(r.maxDr), r: 1 }, { h: 'Max Credit', f: r => amt(r.maxCr), r: 1 }, { h: 'Max Dr %', f: r => r.maxDrPct || '' }, { h: 'Min Balance', f: r => amt(r.minBal), r: 1 }, { h: 'Status', f: r => r.status }, { h: 'Comments', f: r => esc(r.comments || '') }] },
});

// ── এ্যাকাউন্ট লাভ সেটআপ ──
App.page('accProfitRate', {
  title: 'এ্যাকাউন্ট লাভ সেটআপ (Deposit Account Profit)', icon: '📈',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'account', l: 'Accont Number', t: 'select', req: 1 }, { k: 'cur', l: 'বর্তমান হার', ro: 1 }, { k: 'date', l: 'Effective Date', t: 'date', req: 1 }, { k: 'rate', l: 'Profit Rate', t: 'number', req: 1 }], 3) + `<div class="actions">${UI.btn('✅ Set Profit Rate', 'AccRate.save(this)', 'btn-success')}</div>`) + UI.card('Search Profit Rate', '<div class="rl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.account(el, 'account', 'member', 'branch', { kind: 'dep' });
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'account').addEventListener('change', async () => { const a = await Data.account(UI.el(el, 'account').value); UI.el(el, 'cur').value = a ? a.rate : ''; AccRate.list(); });
  },
});
const AccRate = {
  save(btn) {
    const el = $('#page-accProfitRate');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const b = db.batch();
      b.update(db.collection('accounts').doc(f.account), { rate: num(f.rate), rates: FV.arrayUnion({ date: f.date, rate: num(f.rate) }) });
      b.set(db.collection('profitRates').doc(), { branch: f.branch, accNo: f.account, date: f.date, rate: num(f.rate), prev: num(f.cur), by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); toast('✅ লাভের হার সেট হয়েছে'); UI.el(el, 'cur').value = f.rate; AccRate.list();
    });
  },
  async list() {
    const el = $('#page-accProfitRate'); const acc = UI.el(el, 'account').value; if (!acc) return;
    const rows = (await db.collection('profitRates').where('accNo', '==', acc).get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date.localeCompare(a.date));
    $('.rl', el).innerHTML = UI.table([{ h: 'Account Number', f: r => r.accNo }, { h: 'Effective Date', f: r => fmtD(r.date) }, { h: 'Profit Rate', f: r => r.rate }, { h: 'Previous', f: r => r.prev }, { h: 'Setup By', f: r => r.by }, { h: 'Setup On', f: r => tsStr(r.on) }], rows);
  },
};
