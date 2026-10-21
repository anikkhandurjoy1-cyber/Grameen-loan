// ═══════════════════════════════════════════════════════════════
// আন্তঃ শাখা লেনদেন — তহবিল স্থানান্তর অনুরোধ, তালিকা, রিপোর্ট
// প্রেরক শাখা: Dr Other Branch Receivable / Cr Cash-Bank
// গ্রাহক শাখা: Dr Cash-Bank / Cr Other Branch Payable
// ═══════════════════════════════════════════════════════════════
App.page('ibRequest', {
  title: 'তহবিল স্থানান্তর অনুরোধ', icon: '📨',
  render: () => UI.card('', UI.grid([{ k: 'branch', l: 'গ্রাহক শাখা (Receiver)', t: 'select', req: 1 }, { k: 'sender', l: 'Sender Branch', t: 'select', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', ro: 1 }, { k: 'ledger', l: 'Transaction Ledger (গ্রাহকের নগদ/ব্যাংক)', t: 'select', req: 1 }, { k: 'amount', l: 'Transaction Amount', t: 'number', req: 1 }, { k: 'comments', l: 'Comments', req: 1 }], 3)
    + `<div class="mini">অনুরোধ পাঠানোর পর প্রেরক শাখা "স্থানান্তর অনুরোধের তালিকা" থেকে Approve করলে দুই শাখার হিসাবে পোস্ট হবে।</div><div class="actions">${UI.btn('📨 Post Transaction', 'IB.request(this)', 'btn-success')}</div>`),
  init: async el => {
    await Pick.branch(el, 'branch'); const bs = await Data.branches(); UI.fill(UI.el(el, 'sender'), bs, b => b.code, b => b.code + ' - ' + b.name);
    await Pick.ledger(UI.el(el, 'ledger'), l => l.cashBank && l.leaf); UI.el(el, 'ledger').value = REF.GL.cash;
    UI.el(el, 'date').value = await businessDate(); UI.el(el, 'branch').addEventListener('change', async () => UI.el(el, 'date').value = await businessDate(UI.el(el, 'branch').value));
  },
});
const IB = {
  request(btn) {
    const el = $('#page-ibRequest');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); if (f.sender === f.branch) fail('একই শাখা');
      const id = 'IB' + Date.now().toString().slice(-9);
      await db.collection('interBranch').doc(id).set({ id, receiver: f.branch, sender: f.sender, date: f.date, rLedger: f.ledger, amount: num(f.amount), comments: f.comments, status: 'Approve Pending', by: App.user.userId, on: FV.serverTimestamp() });
      toast('✅ অনুরোধ পাঠানো হয়েছে — ' + id); UI.el(el, 'amount').value = ''; UI.el(el, 'comments').value = '';
    });
  },
  async approve(id, btn) {
    return guard(btn, async () => {
      const r = (await db.collection('interBranch').doc(id).get()).data(); if (r.status !== 'Approve Pending') fail('অবস্থা: ' + r.status);
      const allowed = allowedBranches(); if (allowed && !allowed.includes(r.sender)) fail('শুধু প্রেরক শাখা Approve করতে পারবে');
      const sLedger = prompt('প্রেরক শাখার কোন লেজার থেকে টাকা যাবে? (কোড)', REF.GL.cash); if (!sLedger) return;
      const sDate = await businessDate(r.sender), rDate = await businessDate(r.receiver);
      const v1 = await Eng.post({ branch: r.sender, date: sDate, type: 'IB_SEND', narration: `আন্তঃ শাখা প্রেরণ → ${r.receiver} (${id}) ${r.comments}`, lines: [{ gl: REF.GL.ibReceivable, dr: r.amount, accNo: 'IB' + r.receiver }, { gl: sLedger, cr: r.amount }], ref: { ib: id, other: r.receiver } });
      const v2 = await Eng.post({ branch: r.receiver, date: rDate, type: 'IB_RECEIVE', narration: `আন্তঃ শাখা প্রাপ্তি ← ${r.sender} (${id}) ${r.comments}`, lines: [{ gl: r.rLedger, dr: r.amount }, { gl: REF.GL.ibPayable, cr: r.amount, accNo: 'IB' + r.sender }], ref: { ib: id, other: r.sender } });
      await db.collection('interBranch').doc(id).update({ status: 'Approve Completed', authBy: App.user.userId, authOn: FV.serverTimestamp(), vSend: v1, vRcv: v2, sDate, rDate, sLedger });
      toast('✅ অনুমোদিত ও পোস্ট হয়েছে'); ReportPage.run('ibList');
    });
  },
  async reject(id, btn) {
    const why = prompt('কারণ:'); if (why === null) return;
    return guard(btn, async () => {
      const r = (await db.collection('interBranch').doc(id).get()).data();
      if (r.status === 'Approve Completed') { if (!isBM()) fail('অনুমতি নেই'); await Eng.cancel(r.vSend, why); await Eng.cancel(r.vRcv, why); await db.collection('interBranch').doc(id).update({ status: 'Authorization Cancel', cancelBy: App.user.userId, cancelReason: why, cancelOn: FV.serverTimestamp() }); }
      else await db.collection('interBranch').doc(id).update({ status: 'Rejected', cancelBy: App.user.userId, cancelReason: why, cancelOn: FV.serverTimestamp() });
      toast('বাতিল হয়েছে'); ReportPage.run('ibList');
    });
  },
  async rows(f) {
    const all = (await db.collection('interBranch').get()).docs.map(d => d.data());
    return all.filter(r => (!f.receiver || r.receiver === f.receiver) && (!f.sender || r.sender === f.sender) && (!f.from || r.date >= f.from) && (!f.upto || r.date <= f.upto) && (!f.status || r.status === f.status)).sort((a, b) => a.date.localeCompare(b.date));
  },
};
ReportPage({
  id: 'ibList', title: 'স্থানান্তর অনুরোধের তালিকা', icon: '📋', fromDefault: 'month',
  filters: [{ k: 'receiver', l: 'Receiver Branch', t: 'select' }, { k: 'sender', l: 'Sender Branch', t: 'select' }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }, { k: 'status', l: 'Transaction Status', t: 'select', opts: [['', '-------------'], ...['Approve Pending', 'Approve Completed', 'Rejected', 'Authorization Cancel'].map(s => [s, s])] }],
  init: async (el, f) => { const bs = await Data.branches(); ['receiver', 'sender'].forEach(k => UI.fill(UI.el(f, k), bs, b => b.code, b => b.code + ' - ' + b.name, '— সব —')); setTimeout(() => ReportPage.run('ibList'), 0); },
  run: async f => ({ landscape: true, noSig: true, html: UI.table([{ h: 'Receiver Branch', f: r => r.receiver }, { h: 'Sender Branch', f: r => r.sender }, { h: 'Transaction ID', f: r => r.id }, { h: 'Date', f: r => fmtD(r.date) }, { h: 'Amount', f: r => amt(r.amount), r: 1, sum: 1, v: r => r.amount }, { h: 'Status', f: r => `<span class="tag">${r.status}</span>` }, { h: 'Request By', f: r => r.by }, { h: 'Authorized By', f: r => r.authBy || '' }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Cancel Reason', f: r => esc(r.cancelReason || '') },
    { h: 'Action', f: r => `<span class="list-actions no-print">${r.status === 'Approve Pending' ? UI.btn('✅ Approve', `IB.approve('${r.id}',this)`, 'btn-success btn-sm') : ''}${['Approve Pending', 'Approve Completed'].includes(r.status) ? UI.btn('✖', `IB.reject('${r.id}',this)`, 'btn-danger btn-sm') : ''}</span>` }], await IB.rows(f)) }),
});
ReportPage({
  id: 'rptIbBalance', title: 'শাখা অনুযায়ী প্রাপ্তি প্রদান (Inter Branch Balance)', icon: '⚖️',
  filters: [F.branch, { k: 'other', l: 'Other Branch Name', t: 'select' }, F.date],
  init: async (el, f) => { const bs = await Data.branches(); UI.fill(UI.el(f, 'other'), bs, b => b.code, b => b.code + ' - ' + b.name, '— সব —'); },
  run: async f => {
    const rows = (await IB.rows({ upto: f.date })).filter(r => r.status === 'Approve Completed' && (r.sender === f.branch || r.receiver === f.branch));
    const bs = await Data.branches(); const agg = {};
    rows.forEach(r => { const other = r.sender === f.branch ? r.receiver : r.sender; if (f.other && other !== f.other) return; agg[other] = agg[other] || { rcv: 0, pay: 0 }; if (r.sender === f.branch) agg[other].rcv += r.amount; else agg[other].pay += r.amount; });
    const list = Object.entries(agg).map(([b, v]) => ({ b, name: (bs.find(x => x.code === b) || {}).name || '', ...v, net: r2(v.rcv - v.pay) }));
    return { sub: 'তারিখ: ' + fmtD(f.date), html: UI.table([{ h: 'Other Branch', f: r => r.b + ' - ' + esc(r.name) }, { h: 'Receivable (পাওনা)', f: r => amt(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { h: 'Payable (দেনা)', f: r => amt(r.pay), r: 1, sum: 1, v: r => r.pay }, { h: 'Net Balance', f: r => amt(r.net), r: 1, sum: 1, v: r => r.net }], list) };
  },
});
ReportPage({
  id: 'rptIbStatement', title: 'শাখা অনুযায়ী লেনদেন ডিটেলস', icon: '📄', fromDefault: 'month',
  filters: [F.branch, { k: 'other', l: 'Other Branch Name', t: 'select' }, F.from, F.upto],
  buttons: [['🖨️ Print Details Report', 'details']],
  init: async (el, f) => { const bs = await Data.branches(); UI.fill(UI.el(f, 'other'), bs, b => b.code, b => b.code + ' - ' + b.name, '— সব —'); },
  run: async f => {
    const rows = (await IB.rows({ from: f.from, upto: f.upto })).filter(r => (r.sender === f.branch || r.receiver === f.branch) && (!f.other || r.sender === f.other || r.receiver === f.other));
    return { landscape: true, html: UI.table([{ h: 'Date', f: r => fmtD(r.date) }, { h: 'Transaction ID', f: r => r.id }, { h: 'Other Branch', f: r => r.sender === f.branch ? r.receiver : r.sender }, { h: 'ধরন', f: r => r.sender === f.branch ? 'প্রেরণ (Payment)' : 'প্রাপ্তি (Receipt)' }, { h: 'Receipt', f: r => r.receiver === f.branch ? amt(r.amount) : '', r: 1, sum: 1, v: r => r.receiver === f.branch && r.status === 'Approve Completed' ? r.amount : 0 }, { h: 'Payment', f: r => r.sender === f.branch ? amt(r.amount) : '', r: 1, sum: 1, v: r => r.sender === f.branch && r.status === 'Approve Completed' ? r.amount : 0 }, { h: 'Status', f: r => r.status }, { h: 'Comments', f: r => esc(r.comments || '') }], rows) };
  },
});
