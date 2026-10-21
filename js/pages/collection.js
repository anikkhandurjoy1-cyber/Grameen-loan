// ═══════════════════════════════════════════════════════════════
// আমার সকল কালেকশন — শীট পোস্টিং, সদস্য ভিত্তিক কালেকশন, তালিকা,
// নতুন পাসবুক বিক্রয়, কালেকশন গ্রহণ
// ═══════════════════════════════════════════════════════════════
// একটি সমিতি/সদস্যের আদায়যোগ্য একাউন্ট + প্রত্যাশিত পরিমাণ (snap থেকে — ১ রিড)
async function collectRows(samity, date, memberId) {
  const snap = (await db.collection('snap').doc(samity).get()).data() || { a: {} };
  const rows = [];
  Object.entries(snap.a || {}).forEach(([accNo, s]) => {
    if (s.st === 'closed' || s.st === 'cancelled' || (memberId && s.m !== memberId)) return;
    if (s.k === 'loan') { const l = Loan.fromSnap({ ...s, accNo }); const st = Loan.status(l, date); rows.push({ accNo, memberId: s.m, kind: 'loan', type: s.t, bal: num(s.b), exp: st.asonDue, inst: num(s.ia), overdue: st.overdue, advance: st.advance }); }
    else if (s.k === 'dep') { const d = REF.DEP[s.t] || {}; if (d.dtype === 'FD') return; rows.push({ accNo, memberId: s.m, kind: 'dep', type: s.t, bal: num(s.b), exp: num(s.ia), inst: num(s.ia) }); }
    else if (s.k === 'share') rows.push({ accNo, memberId: s.m, kind: 'share', type: 'share', bal: num(s.b), exp: 0, inst: 0 });
  });
  const ord = { loan: 0, dep: 1, share: 2 };
  return rows.sort((a, b) => a.memberId.localeCompare(b.memberId) || ord[a.kind] - ord[b.kind] || a.accNo.localeCompare(b.accNo));
}
// প্রতি সদস্যের ইনপুট → একটি ভাউচার
async function buildMemberCollection(branch, date, memberId, items, src) {
  const parts = [];
  for (const it of items) {
    if (!(num(it.amount) > 0)) continue;
    const a = await Tx.acc(it.accNo);
    if (a.kind === 'loan') {
      const pen = Math.min(num(a.penDue), num(it.amount));
      parts.push(await Tx.loanReceive(a, r2(num(it.amount) - pen), { penalty: pen, date, tt: 'EMI_RCV', narration: src }));
    } else parts.push(await Tx.credit(a, it.amount, { tt: a.kind === 'share' ? 'SHARE_RCV' : (REF.DEP[a.type] && REF.DEP[a.type].dtype === 'RD' ? 'DPS_RCV' : 'DEP_RCV'), narration: src }));
  }
  if (!parts.length) return null;
  const m = Tx.merge(parts);
  m.txns.forEach(t => t.src = src);
  const agg = {}; const lines = [];
  m.lines.forEach(l => { if (!l.accNo && !l.memo) { agg[l.gl] = agg[l.gl] || { dr: 0, cr: 0 }; agg[l.gl].dr += num(l.dr); agg[l.gl].cr += num(l.cr); } else lines.push(l); });
  Object.entries(agg).forEach(([gl, x]) => { const n = r2(x.dr - x.cr); if (n > 0) lines.push({ gl, dr: n }); else if (n < 0) lines.push({ gl, cr: -n }); });
  return { branch, date, type: 'COLLECTION', narration: `কালেকশন ${memberId} (${src})`, lines, txns: m.txns, accOps: m.accOps, ref: { memberId } };
}
const collCols = (mem, editable) => [
  { h: 'সদস্য আইডি', f: r => r.memberId }, { h: 'নাম', f: r => esc((mem[r.memberId] || [])[0] || '') }, { h: 'একাউন্ট', f: r => r.accNo }, { h: 'ধরন', f: r => typeName(r.kind, r.type) },
  { h: 'ব্যালেন্স/বকেয়া', f: r => amt(r.bal), r: 1 }, { h: 'কিস্তি', f: r => amt(r.inst), r: 1 }, { h: 'আজ আদায়যোগ্য', f: r => amt(r.exp), r: 1, sum: 1, v: r => r.exp },
  { h: 'বকেয়া (ওভারডিউ)', f: r => r.kind === 'loan' ? amt(r.overdue) : '', r: 1 },
  { h: 'আদায়', f: r => editable ? `<input type="number" class="ci" data-acc="${r.accNo}" data-m="${r.memberId}" value="${r.exp || ''}" min="0">` : '', r: 1 },
];

// ── শীট পোস্টিং ──
App.page('sheetPosting', {
  title: 'শীট পোস্টিং (সমিতি কালেকশন)', icon: '🧾',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { ...F.samity, req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }], 4)}<div class="filter-actions">${UI.btn('🔍 Search Details', 'Sheet.load(this)')}${UI.btn('✅ Submit', 'Sheet.submit(this)', 'btn-success')}${UI.btn('0️⃣ সব শূন্য', "$$('#page-sheetPosting .ci').forEach(i=>i.value='');Sheet.total()", 'btn-outline')}</div></div><div class="card sheet"></div>`,
  init: async el => { await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false }); UI.el(el, 'date').value = await businessDate(); UI.el(el, 'date').readOnly = !canBackDate(); },
});
const Sheet = {
  load(btn) {
    const el = $('#page-sheetPosting');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.samity) fail('সমিতি বাছাই করুন');
      const rows = await collectRows(f.samity, f.date); const mem = await Data.memberIdx(f.branch);
      el._rows = rows;
      $('.sheet', el).innerHTML = `<div class="kv"><div>সদস্য<b>${new Set(rows.map(r => r.memberId)).size}</b></div><div>একাউন্ট<b>${rows.length}</b></div><div>আদায়যোগ্য<b>${amt(sum(rows, r => r.exp))}</b></div><div>মোট আদায় (ইনপুট)<b id="shTotal">0</b></div></div>` + UI.table(collCols(mem, true), rows, { cls: 'sheet-table' });
      $$('.ci', el).forEach(i => i.addEventListener('input', Sheet.total)); Sheet.total();
    });
  },
  total() { const t = sum($$('#page-sheetPosting .ci'), i => num(i.value)); const e = $('#shTotal'); if (e) e.textContent = amt(t); },
  submit(btn) {
    const el = $('#page-sheetPosting');
    return guard(btn, async () => {
      const f = UI.get(el); if (!el._rows) fail('আগে Search Details চাপুন');
      const byMember = {};
      $$('.ci', el).forEach(i => { if (num(i.value) > 0) (byMember[i.dataset.m] = byMember[i.dataset.m] || []).push({ accNo: i.dataset.acc, amount: num(i.value) }); });
      const ms = Object.keys(byMember); if (!ms.length) fail('কোনো আদায় দেওয়া হয়নি');
      const total = sum(Object.values(byMember).flat(), x => x.amount);
      if (!confirm(`${ms.length} জন সদস্যের মোট ${tk(total)} আদায় পোস্ট করবেন?`)) return;
      busy(true, 'প্রস্তুত হচ্ছে...');
      try {
        const posts = []; let i = 0;
        for (const m of ms) { busy(true, `যাচাই ${++i}/${ms.length}`); const p = await buildMemberCollection(f.branch, f.date, m, byMember[m], 'sheet'); if (p) posts.push(p); }
        const vnos = await Eng.postMany(posts, (k, n) => busy(true, `পোস্ট ${k}/${n}`));
        await db.collection('sheetPosts').add({ branch: f.branch, samity: f.samity, date: f.date, members: ms.length, amount: total, vnos, by: App.user.userId, on: FV.serverTimestamp() });
        toast(`✅ ${posts.length} জন সদস্যের ${tk(total)} আদায় পোস্ট হয়েছে`);
        el._rows = null; $('.sheet', el).innerHTML = '';
      } finally { busy(false); }
    });
  },
};

// ── সদস্য ভিত্তিক কালেকশন ──
App.page('memberColl', {
  title: 'সদস্য ভিত্তিক কালেকশন', icon: '👤',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }], 4)}<div class="filter-actions">${UI.btn('🔍 Search Details', 'MemColl.load(this)')}${UI.btn('✅ Submit', 'MemColl.submit(this)', 'btn-success')}</div></div><div class="card mc"></div>`,
  init: async el => { await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); UI.el(el, 'date').value = await businessDate(); UI.el(el, 'date').readOnly = !canBackDate(); UI.el(el, 'member').addEventListener('picked', () => MemColl.load()); },
});
const MemColl = {
  load(btn) {
    const el = $('#page-memberColl');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.member) fail('সদস্য বাছাই করুন');
      const m = (await Data.members(f.branch)).find(x => x.id === f.member); if (!m) fail('সদস্য পাওয়া যায়নি');
      const rows = await collectRows(m.samity, f.date, f.member); const mem = await Data.memberIdx(f.branch);
      el._rows = rows;
      $('.mc', el).innerHTML = `<div class="mini">সমিতি: ${esc(m.samity)} — মোট আদায়: <b id="mcTotal">0</b></div>` + UI.table(collCols(mem, true), rows, { cls: 'sheet-table' });
      const tot = () => $('#mcTotal').textContent = amt(sum($$('#page-memberColl .ci'), i => num(i.value)));
      $$('.ci', el).forEach(i => i.addEventListener('input', tot)); tot();
    });
  },
  submit(btn) {
    const el = $('#page-memberColl');
    return guard(btn, async () => {
      const f = UI.get(el); const items = $$('.ci', el).filter(i => num(i.value) > 0).map(i => ({ accNo: i.dataset.acc, amount: num(i.value) }));
      if (!items.length) fail('আদায়ের পরিমাণ দিন');
      const p = await buildMemberCollection(f.branch, f.date, f.member, items, 'member');
      const vno = await Eng.post(p);
      toast('✅ কালেকশন সম্পন্ন — ' + vno); Receipt.print(vno); MemColl.load();
    });
  },
};

// ── সদস্য কালেকশন তালিকা ──
ReportPage({
  id: 'memberCollList', title: 'সদস্য কালেকশন তালিকা (Member Installment Collection)', icon: '📋', fromDefault: 'month',
  filters: [F.branch, { k: 'member', l: 'Member Name', t: 'member', req: 1 }, { ...F.from, req: 1 }, { ...F.upto, req: 1 }],
  run: async f => {
    const ts = (await db.collection('txns').where('memberId', '==', f.member).get()).docs.map(d => d.data()).filter(t => t.date >= f.from && t.date <= f.upto && t.dc === 'C' && ['dep', 'loan', 'share'].includes(t.kind));
    const byV = groupBy(ts, t => t.vno);
    const rows = Object.entries(byV).map(([vno, list]) => ({ vno, date: list[0].date, total: sum(list, t => t.amount + num(t.penalty)), dep: sum(list.filter(t => t.kind !== 'loan'), t => t.amount), loan: sum(list.filter(t => t.kind === 'loan'), t => t.amount), lpen: sum(list, t => num(t.penalty)), cancelled: list[0].cancelled, cancelBy: list[0].cancelBy, cancelOn: list[0].cancelOn, by: list[0].byName, on: list[0].on })).sort((a, b) => a.date.localeCompare(b.date));
    return { html: UI.table([{ h: 'Receive Date', f: r => fmtD(r.date) }, { h: 'Total Receive', f: r => amt(r.total), r: 1, sum: 1, v: r => r.cancelled ? 0 : r.total }, { h: 'Deposit Amount', f: r => amt(r.dep), r: 1, sum: 1, v: r => r.cancelled ? 0 : r.dep }, { h: 'Deposit Penalty', f: () => '0.00', r: 1 }, { h: 'Loan Amount', f: r => amt(r.loan), r: 1, sum: 1, v: r => r.cancelled ? 0 : r.loan }, { h: 'Loan Penalty', f: r => amt(r.lpen), r: 1 }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Cancel On', f: r => tsStr(r.cancelOn) }, { h: 'Receive By', f: r => r.by || '' }, { h: 'Receive On', f: r => tsStr(r.on) }, { h: 'Action', f: r => r.cancelled ? '<span class="tag red">বাতিল</span>' : `<span class="no-print">${UI.btn('🧾', `Receipt.print('${r.vno}')`, 'btn-outline btn-sm')}${UI.btn('✖', `DepTx.cancel('${r.vno}',this)`, 'btn-danger btn-sm')}</span>` }], rows) };
  },
});

// ── নতুন পাসবুক বিক্রয় ──
App.page('passbookIssue', {
  title: 'নতুন পাসবুক বিক্রয়', icon: '📘',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'book', l: 'Book Number', req: 1 }, { k: 'fee', l: 'Fee Amount', t: 'number' }, { k: 'date', l: 'Issue Date', t: 'date', req: 1 }, { k: 'docNo', l: 'Document Number' }], 3) + `<div class="actions">${UI.btn('📘 Issue Book', 'Passbook.save(this)', 'btn-success')}</div>`) + UI.card('Search Book', '<div class="tl"></div>'),
  init: async el => { await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); UI.el(el, 'date').value = await businessDate(); UI.el(el, 'member').addEventListener('picked', () => Passbook.list(el)); Passbook.list(el); },
});
const Passbook = {
  save(btn) {
    const el = $('#page-passbookIssue');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const m = await Data.member(f.member); const fee = num(f.fee);
      const fo = await Tx.foOf(m.samity);
      await Eng.post({
        branch: f.branch, date: f.date, type: 'PASSBOOK_ISSUE', narration: 'পাসবুক ' + f.book + ' — ' + f.member, docNo: f.docNo, ref: { memberId: f.member },
        lines: fee ? [{ gl: REF.GL.cash, dr: fee }, { gl: REF.GL.passbook, cr: fee }] : [],
        txns: [{ accNo: '', kind: 'fee', type: 'passbook', memberId: f.member, samity: m.samity, foId: fo, tt: 'PASSBOOK_FEE', amount: fee, dc: 'C', book: f.book, docNo: f.docNo }],
        extra: async b => b.set(db.collection('passbooks').doc(), { branch: f.branch, memberId: f.member, book: f.book, fee, date: f.date, docNo: f.docNo, by: App.user.userId, on: FV.serverTimestamp() }),
      });
      toast('✅ পাসবুক ইস্যু হয়েছে'); UI.el(el, 'book').value = ''; UI.el(el, 'fee').value = ''; Passbook.list(el);
    });
  },
  async list(el) {
    const rows = (await db.collection('txns').where('bm', '==', UI.el(el, 'branch').value + '_' + (await businessDate()).slice(0, 7)).get()).docs.map(d => d.data()).filter(t => t.tt === 'PASSBOOK_FEE' && t.book);
    $('.tl', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'Member ID', f: r => r.memberId }, { h: 'Issue Date', f: r => fmtD(r.date) }, { h: 'Fee Amount', f: r => amt(r.amount), r: 1 }, { h: 'Book Number', f: r => esc(r.book) }, { h: 'Memo Number', f: r => esc(r.docNo || r.vno) }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Action', f: r => r.cancelled ? 'বাতিল' : UI.btn('✖', `DepTx.cancel('${r.vno}',this)`, 'btn-danger btn-sm') }], rows);
  },
};

// ── কালেকশন গ্রহণ (ফিল্ড অফিসারের কাছ থেকে নগদ বুঝে নেওয়া) ──
App.page('collReceive', {
  title: 'কালেকশন গ্রহণ (Collection Receive)', icon: '🤝',
  render: () => UI.card('', UI.grid([F.branch, { k: 'user', l: 'কালেকশনকারী ইউজার/ফিল্ড অফিসার', t: 'select', req: 1 }, { k: 'date', l: 'Collection Date', t: 'date', req: 1 }, { k: 'collected', l: 'সিস্টেমে আদায় (নগদ)', ro: 1 }, { k: 'received', l: 'আগে গ্রহণ', ro: 1 }, { k: 'amount', l: 'Collection Amount (এখন গ্রহণ)', t: 'number', req: 1 }, { k: 'docNo', l: 'Document Number' }, { k: 'comments', l: 'Comments', t: 'textarea' }], 4)
    + `<div class="mini">ফিল্ড অফিসার মাঠে যা আদায় করে সিস্টেমে পোস্ট করেছেন, সেই নগদ শাখায় বুঝে নেওয়ার রেকর্ড। পার্থক্য থাকলে রিপোর্টে দেখাবে।</div><div class="actions">${UI.btn('✅ Collection Receive', 'CollRcv.save(this)', 'btn-success')}</div>`) + UI.card('Search Collection Receive', '<div class="tl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); UI.el(el, 'date').value = await businessDate();
    const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    UI.fill(UI.el(el, 'user'), us, u => u.id, u => (u.userId || u.email) + ' — ' + (u.name || ''));
    const calc = async () => {
      const f = UI.get(el); if (!f.user) return;
      const ts = (await db.collection('txns').where('bd', '==', f.branch + '_' + f.date).get()).docs.map(d => d.data()).filter(t => !t.cancelled && t.by === f.user && t.dc === 'C' && ['dep', 'loan', 'share', 'fee'].includes(t.kind) && !['DEP_TRF_IN', 'EMI_TRF', 'PROFIT_POST', 'LOAN_DISB_TRF'].includes(t.tt));
      UI.el(el, 'collected').value = r2(sum(ts, t => t.amount + num(t.penalty)));
      const rc = (await db.collection('collReceipts').where('bd', '==', f.branch + '_' + f.date).get()).docs.map(d => ({ id: d.id, ...d.data() }));
      UI.el(el, 'received').value = r2(sum(rc.filter(r => r.user === f.user && !r.cancelled), r => r.amount));
      $('.tl', el).innerHTML = UI.table([{ h: 'Branch Code', f: r => r.branch }, { h: 'User', f: r => r.userName }, { h: 'Receive Date', f: r => fmtD(r.date) }, { h: 'Receive Amount', f: r => amt(r.amount), r: 1, sum: 1, v: r => r.cancelled ? 0 : r.amount }, { h: 'Memo Number', f: r => esc(r.docNo || '') }, { h: 'Received By', f: r => r.by }, { h: 'Cancel By', f: r => r.cancelBy || '' }, { h: 'Comments', f: r => esc(r.comments || '') }, { h: 'Action', f: r => r.cancelled ? 'বাতিল' : UI.btn('✖', `CollRcv.cancel('${r.id}')`, 'btn-danger btn-sm') }], rc);
    };
    el._calc = calc; ['user', 'date', 'branch'].forEach(k => UI.el(el, k).addEventListener('change', calc)); calc();
  },
});
const CollRcv = {
  save(btn) {
    const el = $('#page-collReceive');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el); const uname = UI.el(el, 'user').selectedOptions[0].text;
      await db.collection('collReceipts').add({ branch: f.branch, date: f.date, bd: f.branch + '_' + f.date, user: f.user, userName: uname, amount: num(f.amount), collected: num(f.collected), docNo: f.docNo, comments: f.comments, by: App.user.userId, on: FV.serverTimestamp(), cancelled: false });
      toast('✅ কালেকশন গ্রহণ রেকর্ড হয়েছে' + (r2(num(f.collected) - num(f.received) - num(f.amount)) ? ' — পার্থক্য: ' + tk(num(f.collected) - num(f.received) - num(f.amount)) : ''));
      UI.el(el, 'amount').value = ''; el._calc();
    });
  },
  async cancel(id) { if (!confirm('বাতিল করবেন?')) return; await db.collection('collReceipts').doc(id).update({ cancelled: true, cancelBy: App.user.userId, cancelOn: FV.serverTimestamp() }); $('#page-collReceive')._calc(); },
};
