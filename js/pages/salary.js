// ═══════════════════════════════════════════════════════════════
// বেতন — সেটআপ, অনুমোদন/বিতরণ, তালিকা, কর্মচারী তালিকা, পে-স্লিপ
// ═══════════════════════════════════════════════════════════════
const SAL = [['basic', 'Basic Salary', '41100001', 1], ['house', 'House Rent', '41100002', 1], ['medical', 'Medical Allowance', '41100003', 1], ['transport', 'Transport Allowance', '41100004', 1], ['intensive', 'Intensive Allowance', '41100007', 1], ['festival', 'Festival Bonus', '41100008', 1], ['pf', 'Provident Fund', '21910002', -1]];
const salCalc = r => { const e = sum(SAL.filter(s => s[3] > 0), s => num(r[s[0]])), d = sum(SAL.filter(s => s[3] < 0), s => num(r[s[0]])); return { earn: r2(e), ded: r2(d), pay: r2(e - d) }; };
const salGrid = (rows, editable) => UI.table([{ h: 'ID', f: r => r.empId }, { h: 'Name', f: r => esc(r.name) }, { h: 'Designation', f: r => esc(r.designation || '') },
  ...SAL.map(s => ({ h: s[1], f: r => editable ? `<input type="number" class="sal" data-e="${r.empId}" data-k="${s[0]}" value="${num(r[s[0]]) || ''}" style="width:80px">` : amt(r[s[0]]), r: 1, sum: !editable, v: r => num(r[s[0]]) })),
  { h: 'Earnings', f: r => `<span class="se" data-e="${r.empId}">${amt(salCalc(r).earn)}</span>`, r: 1, sum: !editable, v: r => salCalc(r).earn }, { h: 'Deduction', f: r => `<span class="sd" data-e="${r.empId}">${amt(salCalc(r).ded)}</span>`, r: 1, sum: !editable, v: r => salCalc(r).ded }, { h: 'Payment', f: r => `<b class="sp" data-e="${r.empId}">${amt(salCalc(r).pay)}</b>`, r: 1, sum: !editable, v: r => salCalc(r).pay }], rows, { cls: 'sheet-table' });
function salRead(el, rows) { $$('.sal', el).forEach(i => { const r = rows.find(x => x.empId === i.dataset.e); if (r) r[i.dataset.k] = num(i.value); }); return rows; }
function salLive(el, rows) { $$('.sal', el).forEach(i => i.addEventListener('input', () => { salRead(el, rows); const r = rows.find(x => x.empId === i.dataset.e); const c = salCalc(r); $(`.se[data-e="${r.empId}"]`, el).textContent = amt(c.earn); $(`.sd[data-e="${r.empId}"]`, el).textContent = amt(c.ded); $(`.sp[data-e="${r.empId}"]`, el).textContent = amt(c.pay); })); }
const DEPTS = ['', 'Administration', 'Accounts', 'Field', 'Management', 'Others'];
async function salEmployees(f) { return (await Data.employees(f.branch)).filter(e => e.status !== 'inactive' && (!f.dept || e.department === f.dept) && (!f.employee || e.empId === f.employee)); }

App.page('salSetup', {
  title: 'কর্মচারী বেতন সেটআপ', icon: '💼',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { k: 'dept', l: 'Department', t: 'select', opts: DEPTS }, F.employee, { k: 'date', l: 'Effective Date', t: 'date', req: 1 }], 4)}<div class="filter-actions">${UI.btn('🔍 Search', 'SalSetup.load(this)')}${UI.btn('💾 Submit Salary Setup', 'SalSetup.save(this)', 'btn-success')}</div></div><div class="card ss"></div>`,
  init: async el => { await Pick.branch(el, 'branch'); await Pick.employee(el, 'employee', 'branch', { blank: '— সব —' }); UI.el(el, 'date').value = await businessDate(); SalSetup.load(); },
});
const SalSetup = {
  load(btn) {
    const el = $('#page-salSetup');
    return guard(btn, async () => {
      const f = UI.get(el); const emps = await salEmployees(f);
      const setups = await Promise.all(emps.map(e => db.collection('salarySetup').doc(e.empId).get()));
      el._rows = emps.map((e, i) => ({ empId: e.empId, name: e.name, designation: e.designation, ...(setups[i].exists ? setups[i].data() : {}) }));
      $('.ss', el).innerHTML = salGrid(el._rows, true); salLive(el, el._rows);
    });
  },
  save(btn) {
    const el = $('#page-salSetup');
    return guard(btn, async () => {
      const f = UI.get(el); const rows = salRead(el, el._rows || []); if (!rows.length) fail('আগে Search করুন');
      const b = db.batch(); rows.forEach(r => { const o = { empId: r.empId, branch: f.branch, effective: f.date, updatedBy: App.user.userId }; SAL.forEach(s => o[s[0]] = num(r[s[0]])); b.set(db.collection('salarySetup').doc(r.empId), o, { merge: true }); });
      await b.commit(); toast('✅ ' + rows.length + ' জনের বেতন সেটআপ সংরক্ষণ হয়েছে');
    });
  },
};
App.page('salProcess', {
  title: 'বেতন অনুমোদন/বিতরন', icon: '💵',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { k: 'dept', l: 'Department', t: 'select', opts: DEPTS }, F.employee, { k: 'year', l: 'Salary Year', t: 'number', req: 1 }, { k: 'month', l: 'Month Name', t: 'select', req: 1, opts: MONTHS.map((m, i) => [String(i + 1).padStart(2, '0'), m]) }, { k: 'from', l: 'From Date', t: 'date', req: 1 }, { k: 'upto', l: 'Upto Date', t: 'date', req: 1 }, { k: 'date', l: 'Posting Date', t: 'date', req: 1 }, { k: 'ledger', l: 'Payment Ledger', t: 'select' }], 4)}
    <div class="filter-actions">${UI.btn('🔍 Search', 'SalProc.load(this)')}${UI.btn('✅ Disbursment Submit', 'SalProc.submit(this)', 'btn-success')}</div></div><div class="card sp"></div>`,
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.employee(el, 'employee', 'branch', { blank: '— সব —' }); await Pick.ledger(UI.el(el, 'ledger'), l => l.cashBank && l.leaf, null); UI.el(el, 'ledger').value = REF.GL.cash;
    const bd = await businessDate(); const d = parseD(bd); UI.set(el, { year: d.getFullYear(), month: pad(d.getMonth() + 1, 2), date: bd, from: bd.slice(0, 8) + '01', upto: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) });
  },
});
const SalProc = {
  load(btn) {
    const el = $('#page-salProcess');
    return guard(btn, async () => {
      const f = UI.get(el); const emps = await salEmployees(f);
      const posted = (await db.collection('salaryPosts').where('branch', '==', f.branch).get()).docs.map(d => d.data()).filter(p => p.status !== 'cancelled' && p.ym === f.year + '-' + f.month);
      const done = new Set(posted.flatMap(p => p.rows.map(r => r.empId)));
      const setups = await Promise.all(emps.map(e => db.collection('salarySetup').doc(e.empId).get()));
      el._rows = emps.map((e, i) => ({ empId: e.empId, name: e.name, designation: e.designation, ...(setups[i].exists ? setups[i].data() : {}) })).filter(r => !done.has(r.empId));
      $('.sp', el).innerHTML = (done.size ? `<div class="alert alert-info">${done.size} জনের এই মাসের বেতন আগেই বিতরণ হয়েছে (তালিকায় নেই)</div>` : '') + salGrid(el._rows, true); salLive(el, el._rows);
    });
  },
  submit(btn) {
    const el = $('#page-salProcess');
    return guard(btn, async () => {
      const f = UI.get(el); const rows = salRead(el, el._rows || []).filter(r => salCalc(r).pay > 0); if (!rows.length) fail('বিতরণযোগ্য বেতন নেই');
      const tot = { earn: sum(rows, r => salCalc(r).earn), ded: sum(rows, r => salCalc(r).ded), pay: sum(rows, r => salCalc(r).pay) };
      if (!confirm(`${rows.length} জনের ${MONTHS[num(f.month) - 1]} ${f.year} বেতন ${tk(tot.pay)} বিতরণ করবেন?`)) return;
      const lines = SAL.filter(s => s[3] > 0).map(s => ({ gl: s[2], dr: sum(rows, r => num(r[s[0]])) })).concat([{ gl: '21910002', cr: sum(rows, r => num(r.pf)) }, { gl: f.ledger || REF.GL.cash, cr: tot.pay }]);
      const vno = await Eng.post({ branch: f.branch, date: f.date, type: 'SALARY', narration: `বেতন ${MONTHS[num(f.month) - 1]} ${f.year} (${rows.length} জন)`, lines, ref: { ym: f.year + '-' + f.month } });
      await db.collection('salaryPosts').add({ branch: f.branch, ym: f.year + '-' + f.month, month: MONTHS[num(f.month) - 1], year: f.year, from: f.from, upto: f.upto, date: f.date, rows: rows.map(r => ({ ...r, ...salCalc(r) })), ...tot, vno, status: 'posted', by: App.user.userId, on: FV.serverTimestamp() });
      toast('✅ বেতন বিতরণ সম্পন্ন — ' + vno); SalProc.load();
    });
  },
};
const SalFilter = [F.branch, { k: 'month', l: 'Month Name', t: 'select', opts: [['', '-----------------'], ...MONTHS.map((m, i) => [String(i + 1).padStart(2, '0'), m])] }, F.from, F.upto];
async function salPosts(f) { return (await db.collection('salaryPosts').where('branch', '==', f.branch).get()).docs.map(d => ({ id: d.id, ...d.data() })).filter(p => (!f.month || p.ym.slice(5) === f.month) && (!f.from || p.date >= f.from) && (!f.upto || p.date <= f.upto)).sort((a, b) => a.date.localeCompare(b.date)); }
ReportPage({
  id: 'salList', title: 'বেতন বিতরণ তালিকা', icon: '📋', filters: SalFilter, init: async (el, f) => { UI.el(f, 'from').value = (await businessDate()).slice(0, 4) + '-01-01'; },
  run: async f => ({ html: UI.table([{ h: 'Branch Code', f: p => p.branch }, { h: 'Salary Month', f: p => p.month + ' ' + p.year }, { h: 'Posting Date', f: p => fmtD(p.date) }, { h: 'Employees', f: p => p.rows.length }, { h: 'Total Earning', f: p => amt(p.earn), r: 1, sum: 1, v: p => p.status === 'cancelled' ? 0 : p.earn }, { h: 'Total Deduction', f: p => amt(p.ded), r: 1, sum: 1, v: p => p.status === 'cancelled' ? 0 : p.ded }, { h: 'Total Payment', f: p => amt(p.pay), r: 1, sum: 1, v: p => p.status === 'cancelled' ? 0 : p.pay }, { h: 'Cancel By', f: p => p.cancelBy || '' }, { h: 'Posting By', f: p => p.by }, { h: 'Posting On', f: p => tsStr(p.on) }, { h: 'Action', f: p => p.status === 'cancelled' ? 'বাতিল' : `<span class="no-print">${UI.btn('✖', `SalCancel('${p.id}',this)`, 'btn-danger btn-sm')}</span>` }], await salPosts(f)) }),
});
async function SalCancel(id, btn) {
  if (!confirm('এই বেতন বিতরণ বাতিল করবেন?')) return;
  return guard(btn, async () => { if (!isBM()) fail('অনুমতি নেই'); const p = (await db.collection('salaryPosts').doc(id).get()).data(); await Eng.cancel(p.vno, 'Salary cancel'); await db.collection('salaryPosts').doc(id).update({ status: 'cancelled', cancelBy: App.user.userId, cancelOn: FV.serverTimestamp() }); toast('বাতিল হয়েছে'); ReportPage.run('salList'); });
}
const salEmpRows = async (f, empId) => (await salPosts(f)).filter(p => p.status !== 'cancelled').flatMap(p => p.rows.filter(r => !empId || r.empId === empId).map(r => ({ ...r, month: p.month + ' ' + p.year, date: p.date, by: p.by, branch: p.branch })));
const salEmpCols = [{ h: 'Branch Code', f: r => r.branch }, { h: 'Employee ID', f: r => r.empId }, { h: 'Employee Name', f: r => esc(r.name) }, { h: 'Salary Month', f: r => r.month }, { h: 'Posting Date', f: r => fmtD(r.date) }, { h: 'Total Earning', f: r => amt(r.earn), r: 1, sum: 1, v: r => r.earn }, { h: 'Total Deduction', f: r => amt(r.ded), r: 1, sum: 1, v: r => r.ded }, { h: 'Total Payment', f: r => amt(r.pay), r: 1, sum: 1, v: r => r.pay }, { h: 'Posting By', f: r => r.by }];
ReportPage({ id: 'salEmpList', title: 'বিতরণ কর্মচারী তালিকা', icon: '👥', filters: [F.branch, { k: 'employee', l: 'Employee Name', t: 'select' }, ...SalFilter.slice(1)], init: async (el, f) => { UI.el(f, 'from').value = (await businessDate()).slice(0, 4) + '-01-01'; }, run: async f => ({ landscape: true, html: UI.table(salEmpCols, await salEmpRows(f, f.employee)) }) });
ReportPage({
  id: 'myPayslip', title: 'আমার পেস্লিপ', icon: '🧾', filters: SalFilter,
  init: async (el, f) => { UI.el(f, 'from').value = (await businessDate()).slice(0, 4) + '-01-01'; if (App.user.branch) UI.el(f, 'branch').value = App.user.branch; },
  run: async f => {
    if (!App.user.empId) return { html: '<div class="alert alert-warning">আপনার ইউজারের সাথে কোনো কর্মচারী আইডি যুক্ত নেই।</div>' };
    const rows = await salEmpRows(f, App.user.empId);
    return { title: 'পে-স্লিপ', html: rows.map(r => `<h4>${esc(r.month)} — ${esc(r.name)} (${r.empId})</h4>` + UI.table([{ h: 'খাত', f: x => x[0] }, { h: 'পরিমাণ', f: x => amt(x[1]), r: 1 }], [...SAL.map(s => [s[1] + (s[3] < 0 ? ' (কর্তন)' : ''), num(r[s[0]])]), ['মোট আয়', r.earn], ['মোট কর্তন', r.ded], ['নিট প্রদেয়', r.pay]])).join('<hr>') || '<div class="mini">কোনো পে-স্লিপ নেই</div>' };
  },
});
