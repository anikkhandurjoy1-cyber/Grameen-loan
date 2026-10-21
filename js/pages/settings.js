// ═══════════════════════════════════════════════════════════════
// সেটিংস মডিউল — eKisti "সেটিংস" মেনু
// ═══════════════════════════════════════════════════════════════
const GENDER = [['', '---------'], ['Male', 'Male'], ['Female', 'Female'], ['Third Gender', 'Third Gender']];
const RELIGION = [['', '---------'], ['Islam', 'Islam'], ['Hinduism', 'Hinduism'], ['Buddhists', 'Buddhists'], ['Christians', 'Christians'], ['Animists', 'Animists']];
const BLOOD = [['', '---------'], ...['A+', 'B+', 'O+', 'AB+', 'A-', 'O-', 'B-', 'AB-'].map(x => [x, x])];
const EDU = [['', '---------'], ...['PSC', 'JSC', 'SSC', 'HSC', 'Honors', 'Masters', 'Not Applicable'].map(x => [x, x])];
const MARITAL = [['', '---------'], ...['Married', 'Single', 'Divorced', 'Others'].map(x => [x, x])];
const DAYS_OPT = [['', '---------'], ...WEEKDAYS.map(d => [d, d])];

// ── প্রাথমিক সেটআপ: COA, প্রোডাক্ট, কিস্তি সেটিংস, পারমিশন গ্রুপ ──
const DEFAULT_GROUPS = {
  'Super Admin': null,
  'Accounts Officer': ['dashboard', 'accTxn', 'ledgerTxn', 'journal', 'contra', 'voucherList', 'tranQuery', 'glManage', 'rptAccBalance', 'rptAccRecPay', 'rptAccStatement', 'rptMemberStatement', 'rptCashTran', 'rptLedgerStatement', 'rptRecPay', 'rptRecPay2', 'rptBalanceSheet', 'rptBalanceSheet2', 'rptIncomeExp', 'rptIncomeExp2', 'rptProfitLoss', 'rptTrialBalance', 'rptTrialBalance2', 'rptCashBook', 'rptBackDate', 'rptCancelList', 'salSetup', 'salProcess', 'salList', 'salEmpList', 'myPayslip'],
  'Branch Manager': ALL_PAGES.map(p => p[0]).filter(p => !['userCreate', 'userList', 'groupPerm', 'userPerm', 'branchManage', 'systemSetup', 'dataImport', 'emiInstSet', 'loanPurpose', 'glManage'].includes(p)),
  'SR. Field Officer': ['dashboard', 'memberAdd', 'memberList', 'depOpen', 'loanProposal', 'loanProposalList', 'emiRcv', 'emiHist', 'depRcv', 'savRcv', 'dpsRcv', 'depPay', 'shareRcv', 'sheetPosting', 'memberColl', 'memberCollList', 'passbookIssue', 'rptPassbook', 'rptCollDetails', 'rptCollSheet', 'rptDepCollSheet', 'rptLoanCollSheet', 'rptLoanCollSheet2', 'rptCollSummary', 'rptEmiCollect', 'rptMemberBalance', 'rptSamityBalance', 'rptMemLoanBalance', 'rptFieldOfficer', 'rptTarget', 'myPayslip'],
  'Field Officer': ['dashboard', 'memberAdd', 'memberList', 'emiRcv', 'emiHist', 'depRcv', 'savRcv', 'dpsRcv', 'sheetPosting', 'memberColl', 'memberCollList', 'passbookIssue', 'rptPassbook', 'rptCollDetails', 'rptCollSheet', 'rptDepCollSheet', 'rptLoanCollSheet', 'rptEmiCollect', 'rptMemberBalance', 'rptTarget', 'myPayslip'],
};
App.page('systemSetup', {
  title: 'প্রাথমিক সেটআপ (Chart of Accounts / প্রোডাক্ট / পারমিশন)', icon: '🛠️',
  render: () => UI.card('', `<div class="alert alert-info">নতুন ডাটাবেসে প্রথমবার এটি চালান। eKisti-র হুবহু Chart of Accounts (${REF.COA.length} টি লেজার), ডিপোজিট/লোন প্রোডাক্ট, DPS শিডিউল (${REF.SCHED.length} টি), কিস্তি সেটিংস, ঋণের উদ্দেশ্য ও পদ ভিত্তিক পারমিশন তৈরি হবে। আগে থেকে থাকা ডেটা মুছবে না।</div>
    <div class="actions">${UI.btn('🛠️ সেটআপ চালান', "SystemSetup.run(this)", 'btn-success')}</div><div id="ssLog" class="mini" style="margin-top:10px;white-space:pre-line"></div>`),
});
const SystemSetup = {
  async run(btn) {
    if (!isAdmin()) return toast('শুধু Super Admin', 'error');
    return guard(btn, async () => {
      const log = m => { $('#ssLog').textContent += m + '\n'; };
      const writeAll = async (coll, items, idf, map) => {
        const ex = new Set((await db.collection(coll).get()).docs.map(d => d.id));
        let b = db.batch(), n = 0, c = 0;
        for (const it of items) { const id = idf(it); if (ex.has(id)) continue; b.set(db.collection(coll).doc(id), map(it)); n++; c++; if (n >= 400) { await b.commit(); b = db.batch(); n = 0; } }
        if (n) await b.commit();
        log(`✓ ${coll}: ${c} টি নতুন`);
      };
      const typeOf = code => ({ '1': 'A', '2': 'L', '3': 'I', '4': 'E' }[code[0]]);
      await writeAll('ledgers', REF.COA, x => x[0], x => ({ code: x[0], name: x[1], parent: x[2], leaf: !!x[3], type: typeOf(x[0]), cashBank: x[2] === '11100000', system: true, active: true }));
      await writeAll('emiInstSettings', REF.INST_SET, x => x.id, x => ({ type: x.type, freq: x.freq, n: x.n, rate: x.rate, active: true }));
      await writeAll('loanPurposes', REF.PURPOSES, x => x.code, x => ({ code: x.code, cat: x.cat, name: x.name, active: true }));
      await writeAll('depSchedules', REF.SCHED, x => x[0], x => ({ code: x[0], type: x[1], name: x[2], n: x[3], inst: x[4], rate: x[5], months: x[6], active: true }));
      await writeAll('permGroups', Object.keys(DEFAULT_GROUPS), x => x, x => ({ name: x, pages: DEFAULT_GROUPS[x] || [] }));
      const cs = await db.collection('counters').doc('samity').get(); if (!cs.exists) await db.collection('counters').doc('samity').set({ v: 4000000 });
      Cache.drop(); log('✅ সম্পন্ন। এখন "শাখা পরিচালনা করুন" থেকে শাখা তৈরি করুন।');
      toast('✅ প্রাথমিক সেটআপ সম্পন্ন');
    });
  },
};

// ── শাখা পরিচালনা ──
CrudPage({
  id: 'branchManage', title: 'শাখা পরিচালনা করুন', icon: '🏢', coll: 'branches', key: 'code', cacheKey: 'branches', cols: 3,
  fields: [
    { k: 'code', l: 'Branch Code', t: 'number', req: 1, hint: 'যেমন 101' }, { k: 'name', l: 'Branch Name', req: 1 },
    { k: 'type', l: 'Branch Type', t: 'select', req: 1, opts: ['Branch Office', 'Regional Office', 'Zonal Office', 'Head Office'] },
    { k: 'parent', l: 'Parent Branch', t: 'select', opts: [['', '- Select an option -']] }, { k: 'manager', l: 'Branch Manager' },
    { k: 'openDate', l: 'Opening Date', t: 'date' }, { k: 'division', l: 'Division' }, { k: 'district', l: 'District' }, { k: 'upazila', l: 'Upozila' },
    { k: 'union', l: 'Union/City Corp' }, { k: 'phone', l: 'Manager Phone' }, { k: 'address', l: 'Address', req: 1 },
    { k: 'status', l: 'Status', t: 'select', req: 1, opts: ['Active', 'Inactive'] }, { k: 'businessDate', l: 'Business Date (শুরু)', t: 'date', hint: 'নতুন শাখার প্রথম বিজনেস ডেট' },
  ],
  init: async el => { const bs = await Data.branches(); UI.fill(UI.el(el, 'parent'), bs, b => b.code, b => b.code + '-' + b.name, '- Select an option -'); UI.el(el, 'businessDate').value = today(); },
  before: (d, isEdit) => { d.code = String(d.code); if (!isEdit && !d.businessDate) d.businessDate = today(); if (isEdit) delete d.businessDate; return d; },
  after: () => { Cache.drop('branches'); refreshBranchBadge(); },
  list: { cols: [{ h: 'Branch Code', f: r => r.code }, { h: 'Branch Name', f: r => esc(r.name) }, { h: 'Type', f: r => r.type }, { h: 'Manager Phone', f: r => esc(r.phone || '') }, { h: 'Address', f: r => esc(r.address || '') }, { h: 'Business Date', f: r => fmtD(r.businessDate) }, { h: 'Status', f: r => r.status }] },
});

// ── কর্মচারী নিবন্ধন ──
CrudPage({
  id: 'employeeReg', title: 'কর্মচারী নিবন্ধন রেজিঃ', icon: '🧑‍💼', coll: 'employees', key: 'empId', cacheKey: 'emp_', cols: 3,
  fields: [
    { k: 'empId', l: 'Employee ID', ro: 1, ph: 'অটো' }, { k: 'branch', l: 'Branch Name', t: 'select', req: 1 }, { k: 'name', l: 'Employee Name', req: 1 },
    { k: 'father', l: 'Father Name' }, { k: 'mother', l: 'Mother Name' }, { k: 'gender', l: 'Gender', t: 'select', opts: GENDER },
    { k: 'joinDate', l: 'Joining Date', t: 'date' }, { k: 'department', l: 'Department', t: 'select', opts: ['', 'Administration', 'Accounts', 'Field', 'Management', 'Others'] },
    { k: 'designation', l: 'Designation', t: 'select', opts: ['', 'Managing Director', 'Branch Manager', 'Accounts Officer', 'SR. Field Officer', 'Field Officer', 'Office Assistant', 'Others'] },
    { k: 'empType', l: 'Employeement Type', t: 'select', opts: ['', 'Permanent', 'Contractual', 'Probation', 'Part Time'] }, { k: 'managerId', l: 'Manager Name', t: 'select' },
    { k: 'presentAddr', l: 'Present Address', t: 'textarea' }, { k: 'permAddr', l: 'Permanent Address', t: 'textarea' }, { k: 'dob', l: 'Date Of Birth', t: 'date' },
    { k: 'nid', l: 'National ID' }, { k: 'religion', l: 'Religion', t: 'select', opts: RELIGION }, { k: 'blood', l: 'Blood Group', t: 'select', opts: BLOOD },
    { k: 'education', l: 'Education', t: 'select', opts: EDU }, { k: 'marital', l: 'Merital Status', t: 'select', opts: MARITAL }, { k: 'mobile', l: 'Mobile Number', req: 1 },
    { k: 'email', l: 'Email Address' }, { k: 'emergencyMobile', l: 'Emergency Mobile Number' }, { k: 'bankName', l: 'Bank Name' },
    { k: 'bankAcc', l: 'Bank Account Number' }, { k: 'bankAccName', l: 'Bank Account Name' }, { k: 'bankBranch', l: 'Bank Branch Name' },
    { k: 'routing', l: 'Branch Routing Number' }, { k: 'bankComments', l: 'Bank Details Comments' }, { k: 'status', l: 'Employee Status', t: 'select', opts: [['active', 'Active'], ['inactive', 'Inactive']] },
    { k: 'photo', l: 'Profile Photo', t: 'file' },
  ],
  init: async el => { await Pick.branch(el, 'branch'); const es = await Data.employees(''); UI.fill(UI.el(el, 'managerId'), es, e => e.empId, e => e.empId + '-' + e.name, '- Select an option -'); },
  autoId: async () => pad(await nextSeq('employee'), 6),
  after: () => Cache.drop('emp_'),
  list: {
    filter: [{ k: 'fbranch', l: 'শাখা', t: 'select' }, { k: 'q', l: 'নাম/আইডি/মোবাইল' }],
    query: async f => (f.fbranch ? db.collection('employees').where('branch', '==', f.fbranch) : db.collection('employees')).get(),
    post: (rows, f) => rows.filter(r => !f.q || [r.empId, r.name, r.mobile].join(' ').toLowerCase().includes(f.q.toLowerCase())).sort((a, b) => String(a.empId).localeCompare(b.empId)),
    cols: [{ h: 'Image', f: r => r.photoUrl ? `<img src="${esc(r.photoUrl)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover">` : '' }, { h: 'Employee ID', f: r => r.empId }, { h: 'Employee Name', f: r => esc(r.name) }, { h: 'Branch Code', f: r => r.branch }, { h: 'Gender', f: r => r.gender || '' }, { h: 'Father Name', f: r => esc(r.father || '') }, { h: 'Joining Date', f: r => fmtD(r.joinDate) }, { h: 'Mobile Number', f: r => esc(r.mobile || '') }, { h: 'Designation', f: r => esc(r.designation || '') }, { h: 'Status', f: r => r.status === 'inactive' ? '<span class="tag red">Inactive</span>' : '<span class="tag green">Active</span>' }],
  },
});
App.pages.employeeReg._init = App.pages.employeeReg.init;
App.pages.employeeReg.init = async el => { await App.pages.employeeReg._init(el); await Pick.branch($$('.card', el)[1], 'fbranch', { all: true }); };

// ── পরিচালক রেজিস্টার ──
CrudPage({
  id: 'directorReg', title: 'পরিচালক রেজিস্টার', icon: '🎖️', coll: 'directors', key: 'dirId', cols: 3,
  fields: [
    { k: 'dirId', l: 'Director ID', ro: 1, ph: 'অটো' }, { k: 'branch', l: 'Branch Name', t: 'select' }, { k: 'name', l: 'Director Name', req: 1 },
    { k: 'father', l: 'Father Name' }, { k: 'mother', l: 'Mother Name' }, { k: 'gender', l: 'Gender', t: 'select', opts: GENDER }, { k: 'joinDate', l: 'Joining Date', t: 'date' },
    { k: 'presentAddr', l: 'Present Address', t: 'textarea' }, { k: 'permAddr', l: 'Permanent Address', t: 'textarea' }, { k: 'dob', l: 'Date Of Birth', t: 'date' },
    { k: 'nid', l: 'National ID' }, { k: 'religion', l: 'Religion', t: 'select', opts: RELIGION }, { k: 'blood', l: 'Blood Group', t: 'select', opts: BLOOD }, { k: 'education', l: 'Education', t: 'select', opts: EDU },
    { k: 'designation', l: 'Designation' }, { k: 'marital', l: 'Merital Status', t: 'select', opts: MARITAL }, { k: 'mobile', l: 'Mobile Number', req: 1 }, { k: 'emergencyMobile', l: 'Emergency Mobile Number' },
    { k: 'email', l: 'Email Address' }, { k: 'status', l: 'Director Status', t: 'select', opts: [['active', 'Active'], ['inactive', 'Inactive']] },
  ],
  init: async el => Pick.branch(el, 'branch'),
  autoId: async () => pad(await nextSeq('director'), 5),
  canDelete: true,
  list: { cols: [{ h: 'Director ID', f: r => r.dirId }, { h: 'Director Name', f: r => esc(r.name) }, { h: 'Branch Code', f: r => r.branch || '' }, { h: 'Designation', f: r => esc(r.designation || '') }, { h: 'Mobile Number', f: r => esc(r.mobile || '') }, { h: 'Joining Date', f: r => fmtD(r.joinDate) }, { h: 'Status', f: r => r.status || 'active' }] },
});

// ── সমিতি / কেন্দ্র সেটআপ ──
CrudPage({
  id: 'samitySetup', title: 'সমিতি / কেন্দ্র সেটআপ', icon: '🏛️', coll: 'samities', key: 'code', cols: 3,
  fields: [
    { k: 'code', l: 'Samity Code', ro: 1, ph: 'অটো' }, { k: 'branch', l: 'Branch Name', t: 'select', req: 1 }, { k: 'name', l: 'Samity Name', req: 1 },
    { k: 'referredBy', l: 'Referred By' }, { k: 'address', l: 'Address', t: 'textarea', req: 1 }, { k: 'openDate', l: 'Open Date', t: 'date', req: 1 },
    { k: 'area', l: 'Working Area' }, { k: 'foId', l: 'Field Officer Name', t: 'select', req: 1 }, { k: 'phone', l: 'Samity Phone', req: 1 },
    { k: 'centerType', l: 'Center Type', t: 'select', opts: ['', 'Male', 'Female', 'All Gender'] }, { k: 'startTime', l: 'Start Time', t: 'time' },
    { k: 'day', l: 'Samity Day', t: 'select', opts: DAYS_OPT }, { k: 'dateOfMonth', l: 'Date of Month', t: 'select', opts: ['', ...Array.from({ length: 31 }, (_, i) => String(i + 1))] },
    { k: 'managerId', l: 'Manager Name', t: 'select' }, { k: 'status', l: 'Status', t: 'select', opts: [['active', 'Active'], ['closed', 'Closed']] },
  ],
  init: async el => { await Pick.branch(el, 'branch'); await Pick.employee(el, 'foId', 'branch'); await Pick.employee(el, 'managerId', 'branch'); const s = $$('.card', el)[1]; if (s) await Pick.branch(s, 'fbranch'); },
  autoId: async () => String(await nextSeq('samity', 4000001)),
  before: (d, isEdit, old) => { if (d.status === 'closed' && (!old || old.status !== 'closed')) { d.closeBy = App.user.userId; d.closeDate = today(); } return d; },
  after: d => { Cache.drop('sam_'); },
  list: {
    filter: [{ k: 'fbranch', l: 'শাখা', t: 'select' }, { k: 'q', l: 'নাম/কোড' }],
    query: async f => db.collection('samities').where('branch', '==', f.fbranch || App.branch).get(),
    post: (rows, f) => rows.filter(r => !f.q || (r.code + ' ' + r.name).toLowerCase().includes(f.q.toLowerCase())).sort((a, b) => a.code.localeCompare(b.code)),
    cols: [{ h: 'Branch Code', f: r => r.branch }, { h: 'Samity Code', f: r => r.code }, { h: 'Samity Name', f: r => esc(r.name) }, { h: 'Address', f: r => esc(r.address || '') }, { h: 'Samity Day', f: r => r.day || '' }, { h: 'Open Date', f: r => fmtD(r.openDate) }, { h: 'Field Officer', f: r => r.foId || '' }, { h: 'Phone Number', f: r => esc(r.phone || '') }, { h: 'Start Time', f: r => r.startTime || '' }, { h: 'Status', f: r => r.status === 'closed' ? '<span class="tag red">Closed</span>' : '<span class="tag green">Active</span>' }],
  },
});

// ── সমিতি বার পরিবর্তন / ফিল্ড অফিসার পরিবর্তন ──
function SamityChangePage(id, title, field, label, optsFn) {
  App.page(id, {
    title, icon: '🔁',
    render: () => UI.card('', UI.grid([
      { k: 'branch', l: 'Branch Name', t: 'select', req: 1 }, { k: 'samity', l: 'Samity Name', t: 'select', req: 1 }, { k: 'date', l: 'Effective From Date', t: 'date', req: 1 },
      { k: 'current', l: 'Current ' + label, ro: 1 }, { k: 'newVal', l: 'New ' + label, t: 'select', req: 1 }, { k: 'comments', l: 'Comments', req: 1 },
    ], 3) + `<div class="actions">${UI.btn('✅ Submit', `SamityChange.save('${id}','${field}',this)`, 'btn-success')}</div>`) + UI.card('পরিবর্তনের ইতিহাস', '<div class="hist"></div>'),
    init: async el => {
      await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false });
      await optsFn(el);
      UI.el(el, 'date').value = await businessDate();
      UI.el(el, 'samity').addEventListener('change', async () => { const s = await Data.samity(UI.el(el, 'samity').value); UI.el(el, 'current').value = s ? (s[field] || '') : ''; });
      SamityChange.hist(id, field);
    },
  });
}
const SamityChange = {
  save(id, field, btn) {
    const el = $('#page-' + id);
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      const b = db.batch();
      b.update(db.collection('samities').doc(f.samity), { [field]: f.newVal });
      b.set(db.collection('samityChanges').doc(), { kind: field, branch: f.branch, samity: f.samity, date: f.date, prev: f.current, next: f.newVal, comments: f.comments, by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); Cache.drop('sam_'); toast('✅ পরিবর্তন হয়েছে'); UI.el(el, 'current').value = f.newVal; SamityChange.hist(id, field);
    });
  },
  async hist(id, field) {
    const el = $('#page-' + id);
    const s = await db.collection('samityChanges').where('branch', '==', UI.el(el, 'branch').value).get();
    const rows = s.docs.map(d => d.data()).filter(r => r.kind === field).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('.hist', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Samity', f: r => r.samity }, { h: 'Change Date', f: r => fmtD(r.date) }, { h: 'Previous', f: r => esc(r.prev) }, { h: 'New', f: r => esc(r.next) }, { h: 'Comments', f: r => esc(r.comments) }, { h: 'By', f: r => r.by }], rows);
  },
};
SamityChangePage('samityDayChange', 'সমিতি / কেন্দ্র বার পরিবর্তন', 'day', 'Samity Day', async el => UI.fill(UI.el(el, 'newVal'), WEEKDAYS, d => d, d => d));
SamityChangePage('samityFoChange', 'সমিতি/সেন্টার ফিল্ড অফিসার পরিবর্তন', 'foId', 'Field Officer', async el => Pick.employee(el, 'newVal', 'branch'));

// ── শাখা সমিতি স্থানান্তর ──
App.page('branchSamityTransfer', {
  title: 'শাখা সমিতি স্থানান্তর', icon: '🔀',
  render: () => UI.card('', UI.grid([{ k: 'branch', l: 'Present Branch Name', t: 'select', req: 1 }, { k: 'samity', l: 'Samity Name', t: 'select', req: 1 }, { k: 'toBranch', l: 'Transfer to Branch', t: 'select', req: 1 }], 3)
    + `<div class="alert alert-warning">সমিতির সব সদস্য, একাউন্ট ও ব্যালেন্স নতুন শাখায় যাবে। হিসাব (GL) আন্তঃ শাখা লেজার দিয়ে স্থানান্তর হবে।</div><div class="actions">${UI.btn('🔀 Submit Transfer', 'BranchSamityTransfer.run(this)', 'btn-danger')}</div>`),
  init: async el => { await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false }); const bs = await Data.branches(); UI.fill(UI.el(el, 'toBranch'), bs, b => b.code, b => b.code + ' - ' + b.name); },
});
const BranchSamityTransfer = {
  run(btn) {
    const el = $('#page-branchSamityTransfer');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      if (f.branch === f.toBranch) fail('একই শাখা');
      if (!confirm('সমিতি ' + f.samity + ' কে শাখা ' + f.toBranch + ' এ স্থানান্তর করবেন?')) return;
      busy(true, 'স্থানান্তর হচ্ছে...');
      try {
        const mems = (await db.collection('members').where('samity', '==', f.samity).get()).docs;
        const accs = (await db.collection('accounts').where('samity', '==', f.samity).get()).docs;
        const date = await businessDate(f.branch);
        // GL ব্যালেন্স স্থানান্তর
        const glBal = {};
        accs.forEach(d => { const a = d.data(); if (a.status === 'closed') return; const gl = Eng.productGl(a.kind, a.type); if (!gl) return; glBal[gl] = (glBal[gl] || 0) + (a.kind === 'loan' ? num(a.principal) - num(a.paidP) : num(a.balance)); });
        const linesOld = [], linesNew = [];
        Object.entries(glBal).forEach(([gl, v]) => {
          if (!r2(v)) return; const asset = gl[0] === '1';
          // পুরাতন শাখা: সম্পদ কমবে (Cr), দায় কমবে (Dr); বিপরীতে আন্তঃশাখা
          linesOld.push(asset ? { gl, cr: v } : { gl, dr: v }); linesOld.push(asset ? { gl: REF.GL.ibReceivable, dr: v } : { gl: REF.GL.ibPayable, cr: v });
          linesNew.push(asset ? { gl, dr: v } : { gl, cr: v }); linesNew.push(asset ? { gl: REF.GL.ibPayable, cr: v } : { gl: REF.GL.ibReceivable, dr: v });
        });
        if (linesOld.length) {
          await Eng.post({ branch: f.branch, date, type: 'IB_SAMITY_OUT', narration: 'সমিতি ' + f.samity + ' স্থানান্তর → ' + f.toBranch, lines: linesOld });
          await Eng.post({ branch: f.toBranch, date: await businessDate(f.toBranch), type: 'IB_SAMITY_IN', narration: 'সমিতি ' + f.samity + ' স্থানান্তর ← ' + f.branch, lines: linesNew });
        }
        let b = db.batch(), n = 0;
        const flush = async () => { if (n) { await b.commit(); b = db.batch(); n = 0; } };
        b.update(db.collection('samities').doc(f.samity), { branch: f.toBranch }); n++;
        for (const d of mems) { const m = d.data(); b.update(d.ref, { branch: f.toBranch }); Idx.delMember(b, f.branch, d.id); Idx.setMember(b, f.toBranch, { ...m, memberId: d.id }); n += 3; if (n > 400) await flush(); }
        for (const d of accs) { const a = d.data(); b.update(d.ref, { branch: f.toBranch }); Idx.delAccount(b, f.branch, d.id); Idx.setAccount(b, f.toBranch, { ...a, accNo: d.id }); n += 3; if (n > 400) await flush(); }
        b.set(db.collection('samityChanges').doc(), { kind: 'branch', branch: f.branch, samity: f.samity, date, prev: f.branch, next: f.toBranch, by: App.user.userId, on: FV.serverTimestamp() }); n++;
        await flush(); Cache.drop();
        toast(`✅ স্থানান্তর সম্পন্ন — ${mems.length} সদস্য, ${accs.length} একাউন্ট`);
      } finally { busy(false); }
    });
  },
};

// ── ছুটির দিন সেটআপ ──
App.page('holidaySetup', {
  title: 'ছুটির দিন সেটআপ', icon: '🏖️',
  render: () => UI.card('', UI.grid([{ k: 'date', l: 'Holiday Date', t: 'date' }, { k: 'from', l: 'From Date', t: 'date' }, { k: 'upto', l: 'Upto Date', t: 'date' }, { k: 'details', l: 'Holiday Details', req: 1 }], 4)
    + `<div class="fgrid c2"><div class="form-group"><label>Branch Name (খালি = সব শাখা)</label><select data-k="branches" multiple size="5"></select></div><div class="form-group"><label>Samity Name (খালি = সব সমিতি)</label><select data-k="samities" multiple size="5"></select></div></div>
    <div class="actions">${UI.btn('➕ Add New Holiday', 'Holiday.save(this)', 'btn-success')}</div><div class="mini">একক তারিখ অথবা From–Upto দিন। শুক্রবার সাপ্তাহিক ছুটি হিসেবে আলাদা যোগ করতে হবে না।</div>`)
    + UI.card('ছুটির তালিকা', `<div class="actions"><input type="number" id="hYear" value="${new Date().getFullYear()}" style="width:90px">${UI.btn('🔍 Search Holiday', 'Holiday.list()')}</div><div class="hl" style="margin-top:8px"></div>`),
  init: async el => {
    const bs = await Data.branches(); const bsel = UI.el(el, 'branches'); bsel.innerHTML = UI.opts(bs, b => b.code, b => b.code + '-' + b.name, null);
    const loadS = async () => { const codes = [...bsel.selectedOptions].map(o => o.value); const all = []; for (const c of (codes.length ? codes : [App.branch])) all.push(...await Data.samities(c)); UI.el(el, 'samities').innerHTML = UI.opts(all, s => s.code, s => s.code + '-' + s.name, null); };
    bsel.addEventListener('change', loadS); await loadS(); Holiday.list();
  },
});
const Holiday = {
  save(btn) {
    const el = $('#page-holidaySetup');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.details) fail('Holiday Details দিন');
      const branches = [...UI.el(el, 'branches').selectedOptions].map(o => o.value), samities = [...UI.el(el, 'samities').selectedOptions].map(o => o.value);
      let dates = [];
      if (f.from && f.upto) { for (let d = f.from; d <= f.upto; d = addDays(d, 1)) dates.push(d); } else if (f.date) dates = [f.date]; else fail('তারিখ দিন');
      if (dates.length > 60) fail('একবারে সর্বোচ্চ ৬০ দিন');
      const b = db.batch(); dates.forEach(d => b.set(db.collection('holidays').doc(d + '_' + uid8()), { date: d, details: f.details, branches, samities, by: App.user.userId, on: FV.serverTimestamp() }));
      await b.commit(); Cache.drop('holidays'); toast('✅ ' + dates.length + ' দিন ছুটি যোগ হয়েছে'); Holiday.list();
    });
  },
  async list() {
    const y = $('#hYear').value; const hs = (await db.collection('holidays').where('date', '>=', y + '-01-01').where('date', '<=', y + '-12-31').get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date));
    $('#page-holidaySetup .hl').innerHTML = UI.table([{ h: 'Date', f: r => fmtD(r.date) }, { h: 'Details', f: r => esc(r.details) }, { h: 'Branch List', f: r => (r.branches || []).join(', ') || 'সব' }, { h: 'Center List', f: r => (r.samities || []).join(', ') || 'সব' }, { h: 'Action', f: r => UI.btn('🗑️', `Holiday.del('${r.id}')`, 'btn-danger btn-sm') }], hs);
  },
  async del(id) { if (!confirm('মুছবেন?')) return; await db.collection('holidays').doc(id).delete(); Cache.drop('holidays'); Holiday.list(); },
};

// ── নোটিশ সেটআপ ──
CrudPage({
  id: 'noticeSetup', title: 'নোটিশ সেটআপ', icon: '📢', coll: 'notices', cols: 3, canDelete: true,
  fields: [{ k: 'branch', l: 'Branch Name (খালি = সব শাখা)', t: 'select' }, { k: 'text', l: 'Notice', t: 'textarea', req: 1 }, { k: 'color', l: 'Text Color', t: 'select', req: 1, opts: ['Red', 'Green', 'Yellow', 'Black'] }],
  init: async el => { const bs = await Data.branches(); UI.fill(UI.el(el, 'branch'), bs, b => b.code, b => b.code + ' - ' + b.name, '— সব শাখা —'); },
  submitLabel: '💾 Save Notice', after: () => loadNotice(),
  list: { query: async () => db.collection('notices').orderBy('createdAt', 'desc').limit(50).get(), cols: [{ h: 'Notice', f: r => esc(r.text) }, { h: 'Branch', f: r => r.branch || 'সব' }, { h: 'Create By', f: r => r.createdBy || '' }, { h: 'Date Time', f: r => tsStr(r.createdAt) }] },
});

// ── ক্লোজিং বিজনেস ডে ──
App.page('dayClose', {
  title: 'ক্লোজিং বিজনেস ডে', icon: '🔒',
  render: () => UI.card('', UI.grid([{ k: 'branch', l: 'Branch Name', t: 'select', req: 1 }, { k: 'cur', l: 'Current Business Date', t: 'date', ro: 1 }, { k: 'next', l: 'Next Business Date', t: 'date', ro: 1 }], 3)
    + `<div class="alert alert-info">দিন বন্ধ করলে বিজনেস ডেট পরের কর্মদিবসে যাবে (ছুটি বাদ দিয়ে)। অনুমোদনের অপেক্ষায় থাকা লেনদেন থাকলে দিন বন্ধ হবে না।</div><div class="actions">${UI.btn('🔒 Start Closing', 'DayClose.run(this)', 'btn-danger')}</div>`)
    + UI.card('ক্লোজিং লগ', '<div class="dl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch');
    const load = async () => { Cache.drop('branches'); const b = await Data.branch(UI.el(el, 'branch').value); const cur = (b && b.businessDate) || today(); UI.el(el, 'cur').value = cur; UI.el(el, 'next').value = await DayClose.next(cur, b.code); DayClose.logs(); };
    UI.el(el, 'branch').addEventListener('change', load); await load();
  },
});
const DayClose = {
  async next(cur, branch) { let d = addDays(cur, 1); for (let i = 0; i < 30; i++) { if (!(await isHoliday(d, branch))) return d; d = addDays(d, 1); } return d; },
  run(btn) {
    const el = $('#page-dayClose');
    return guard(btn, async () => {
      const f = UI.get(el); if (!isBM()) fail('শুধু Branch Manager/Admin দিন বন্ধ করতে পারবেন');
      const pend = await db.collection('vouchers').where('bd', '==', f.branch + '_' + f.cur).get();
      const p = pend.docs.filter(d => d.data().status === 'pending').length;
      if (p) fail(p + ' টি লেনদেন অনুমোদনের অপেক্ষায় — আগে অনুমোদন/বাতিল করুন');
      const g = await db.collection('glDaily').doc(f.branch + '_' + f.cur).get();
      const cash = g.exists && g.data().gl && g.data().gl[REF.GL.cash] ? num(g.data().gl[REF.GL.cash].dr) - num(g.data().gl[REF.GL.cash].cr) : 0;
      if (!confirm(`${fmtD(f.cur)} তারিখ বন্ধ করে ${fmtD(f.next)} খুলবেন?\nআজকের নগদ নিট পরিবর্তন: ${tk(cash)}`)) return;
      const b = db.batch();
      b.update(db.collection('branches').doc(f.branch), { businessDate: f.next });
      b.set(db.collection('dayCloseLogs').doc(f.branch + '_' + f.cur), { branch: f.branch, closed: f.cur, opened: f.next, cashNet: cash, by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); Cache.drop('branches'); await refreshBranchBadge(); toast('✅ বিজনেস ডেট এখন ' + fmtD(f.next));
      UI.el(el, 'cur').value = f.next; UI.el(el, 'next').value = await DayClose.next(f.next, f.branch); DayClose.logs();
    });
  },
  async logs() {
    const el = $('#page-dayClose'); const br = UI.el(el, 'branch').value;
    const s = await db.collection('dayCloseLogs').where('branch', '==', br).get();
    const rows = s.docs.map(d => d.data()).sort((a, b) => b.closed.localeCompare(a.closed)).slice(0, 30);
    $('.dl', el).innerHTML = UI.table([{ h: 'Closed Date', f: r => fmtD(r.closed) }, { h: 'Opened Date', f: r => fmtD(r.opened) }, { h: 'Cash Net', f: r => amt(r.cashNet), r: 1 }, { h: 'By', f: r => r.by }, { h: 'On', f: r => tsStr(r.on) }], rows);
  },
};

// ── প্রোফাইল / পাসওয়ার্ড ──
App.page('profile', {
  title: 'আমার প্রোফাইল', icon: '👤', always: true,
  render: () => UI.card('প্রোফাইল', '<div class="pinfo"></div>') + UI.card('🔑 Reset My Password', UI.grid([{ k: 'old', l: 'বর্তমান পাসওয়ার্ড', t: 'password', req: 1 }, { k: 'p1', l: 'নতুন পাসওয়ার্ড', t: 'password', req: 1 }, { k: 'p2', l: 'আবার নতুন পাসওয়ার্ড', t: 'password', req: 1 }], 3) + `<div class="actions">${UI.btn('🔑 পাসওয়ার্ড পরিবর্তন', 'Profile.pass(this)', 'btn-success')}</div>`),
  init: el => { const u = App.user; $('.pinfo', el).innerHTML = UI.info([['User ID', esc(u.userId || '')], ['নাম', esc(u.name || '')], ['Permission Group', esc(u.group || '')], ['শাখা', esc(u.branch || 'সব')], ['Email', esc(u.email || '')], ['Employee ID', esc(u.empId || '')]]); },
});
const Profile = {
  pass(btn) {
    const el = $$('#page-profile .card')[1];
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      if (f.p1 !== f.p2) fail('নতুন পাসওয়ার্ড মিলছে না'); if (f.p1.length < 6) fail('কমপক্ষে ৬ অক্ষর');
      const u = auth.currentUser;
      if (firebase.auth.EmailAuthProvider && u.reauthenticateWithCredential) await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, f.old));
      await u.updatePassword(f.p1);
      await db.collection('users').doc(u.uid).update({ passwordChangedAt: FV.serverTimestamp() });
      toast('✅ পাসওয়ার্ড পরিবর্তন হয়েছে'); UI.reset(el);
    });
  },
};
