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
    if (s.k === 'loan') { const l = Loan.fromSnap({ ...s, accNo }); const st = Loan.status(l, date); if (!(st.outstanding > 0)) return; rows.push({ accNo, memberId: s.m, kind: 'loan', type: s.t, bal: num(s.b), exp: st.asonDue, inst: num(s.ia), instAmt: r2(Math.min(num(s.ia) || st.outstanding, st.outstanding)), overdue: st.overdue, advance: st.advance, instNo: st.dueCnt, nInst: num(s.an) + (num(s.li) ? 1 : 0), freq: s.fq, today: r2(Math.min(st.todayInst, st.outstanding)), total: num(l.totalRepay), out: st.outstanding, expDate: l.expDate || '', pen: num(s.pd) }); }
    else if (s.k === 'dep') { const d = REF.DEP[s.t] || {}; if (d.dtype === 'FD') return; rows.push({ accNo, memberId: s.m, kind: 'dep', type: s.t, bal: num(s.b), exp: num(s.ia), inst: num(s.ia), instAmt: num(s.ia) }); }
    else if (s.k === 'share' && num(s.b) > 0) rows.push({ accNo, memberId: s.m, kind: 'share', type: 'share', bal: num(s.b), exp: 0, inst: 0 });
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

// ── শীট পোস্টিং — eKisti "micfin-installmentcollection-form" এর হুবহু ──
// প্রতি সদস্য এক সারি: Member Information | Loan Information | Saving Information | Total Amount
// Due = আজকের কিস্তি, Receive শুরুতে 0.00, F = Due বসে, Z = 0; যেসব Receive > 0 সেগুলো Submit এ পোস্ট হয়
const CollGrid = {
  f: v => r2(num(v)).toFixed(2),
  html(rows, mem, thisInst = {}) {
    rows = rows.filter(r => r.kind !== 'share');
    const by = {}; rows.forEach(r => (by[r.memberId] = by[r.memberId] || { L: [], S: [] })[r.kind === 'loan' ? 'L' : 'S'].push(r));
    const due = r => r.kind === 'loan' ? num(r.today) : num(r.exp);
    const th = (t, cs) => `<th class="c"${cs > 1 ? ` colspan="${cs}"` : ''}>${t}</th>`;
    const chk = (g, k) => `<input type="checkbox" class="cg-all" data-g="${g}" data-k="${k}">`;
    const head = `<tr>${th('Member Information', 3)}${th('Loan Information', 6)}${th('Saving Information', 5)}${th('Total Amount', 2)}</tr>
      <tr>${['ID', 'Name', 'Phone', 'Account', 'Inst No', 'Due', 'F', 'Z', 'Receive', 'Account', 'Due', 'F', 'Z', 'Receive', 'Total Receive', 'Total Due'].map(x => th(x)).join('')}</tr>`;
    const sel = `<tr class="cg-selrow"><td></td><td></td><td></td><td></td><td></td><td></td><td class="c">${chk('L', 'F')}</td><td class="c">${chk('L', 'Z')}</td><td></td><td></td><td></td><td class="c">${chk('S', 'F')}</td><td class="c">${chk('S', 'Z')}</td><td></td><td></td><td></td></tr>`;
    let body = '';
    Object.entries(by).sort((a, b) => a[0].localeCompare(b[0])).forEach(([m, g]) => {
      const n = Math.max(g.L.length, g.S.length, 1);
      const cell = (r, grp) => r ? `<td>${esc(r.accNo)}</td>${grp === 'L' ? `<td>${thisInst[r.accNo] || 0}</td>` : ''}<td>${CollGrid.f(due(r))}</td><td class="c"><input type="radio" name="cz_${esc(r.accNo)}" class="cg-f" data-acc="${esc(r.accNo)}"></td><td class="c"><input type="radio" name="cz_${esc(r.accNo)}" class="cg-z" data-acc="${esc(r.accNo)}"></td><td><input type="number" class="ci" data-acc="${esc(r.accNo)}" data-m="${m}" data-g="${grp}" data-due="${due(r)}" value="0.00" min="0"></td>`
        : `<td></td>${grp === 'L' ? '<td>0</td>' : ''}<td></td><td></td><td></td><td></td>`;
      for (let i = 0; i < n; i++) {
        body += '<tr class="cg-row">';
        if (i === 0) body += `<td rowspan="${n}">${m}</td><td rowspan="${n}">${esc((mem[m] || [])[0] || '')}</td><td rowspan="${n}">${esc((mem[m] || [])[2] || '')}</td>`;
        body += cell(g.L[i], 'L') + cell(g.S[i], 'S');
        if (i === 0) body += `<td rowspan="${n}" class="cg-tot"><span class="cg-mt" data-m="${m}">0.00</span></td><td rowspan="${n}" class="cg-tot"><span class="cg-md" data-m="${m}">0.00</span></td>`;
        body += '</tr>';
      }
    });
    return `<table class="cg-table cg-ek"><thead>${head}</thead><tbody>${sel}${body || '<tr><td colspan="16" class="c">কোনো একাউন্ট নেই</td></tr>'}</tbody></table>`;
  },
  picked(root) { return $$('.ci', root).filter(i => num(i.value) > 0); },
  bind(root, sumRoot) {
    const inp = acc => $(`.ci[data-acc="${CSS.escape(acc)}"]`, root);
    const touched = new Set();
    const upd = () => {
      const tot = { L: 0, S: 0, due: 0 }, pm = {}, pd = {};
      $$('.ci', root).forEach(i => { const v = num(i.value), d = num(i.dataset.due), m = i.dataset.m; tot[i.dataset.g] += v; tot.due += d; pm[m] = (pm[m] || 0) + v; pd[m] = (pd[m] || 0) + d; });
      $$('.cg-mt', root).forEach(b => b.textContent = CollGrid.f(pm[b.dataset.m]));
      $$('.cg-md', root).forEach(b => b.textContent = CollGrid.f(touched.has(b.dataset.m) ? Math.max(0, pd[b.dataset.m] - pm[b.dataset.m]) : 0));
      const sr = sumRoot || root; const set = (k, v, u) => { const e = $(`[data-s="${k}"]`, sr); if (e) e.textContent = MemColl.f(v) + u; };
      set('due', tot.due, ' Tk'); set('L', tot.L, ' Tk'); set('S', tot.S, ' Tk'); set('rcv', tot.L + tot.S, ' TK'); set('dues', Math.max(0, tot.due - tot.L - tot.S), ' TK');
    };
    const setV = (acc, full) => { const i = inp(acc); i.value = full ? CollGrid.f(i.dataset.due) : '0.00'; touched.add(i.dataset.m); };
    $$('.cg-f', root).forEach(r => r.addEventListener('change', () => { if (r.checked) setV(r.dataset.acc, true); upd(); }));
    $$('.cg-z', root).forEach(r => r.addEventListener('change', () => { if (r.checked) setV(r.dataset.acc, false); upd(); }));
    $$('.ci', root).forEach(i => { i.addEventListener('click', () => i.select()); i.addEventListener('focus', () => i.select()); i.addEventListener('input', () => { touched.add(i.dataset.m); $$(`input[name="cz_${CSS.escape(i.dataset.acc)}"]`, root).forEach(x => x.checked = false); upd(); }); });
    $$('.cg-all', root).forEach(c => c.addEventListener('change', () => {
      const F = c.dataset.k === 'F', g = c.dataset.g;
      const o = $(`.cg-all[data-g="${g}"][data-k="${F ? 'Z' : 'F'}"]`, root); if (o && c.checked) o.checked = false;
      $$(`.ci[data-g="${g}"]`, root).forEach(i => { const r = $(`input.${F ? 'cg-f' : 'cg-z'}[data-acc="${CSS.escape(i.dataset.acc)}"]`, root); if (c.checked) { r.checked = true; setV(i.dataset.acc, F); } else r.checked = false; });
      upd(); }));
    upd();
  },
};
// আজ কয়টি কিস্তি জমা হয়েছে (Inst No / This Inst.)
async function thisInstMap(rows, date, q) {
  const ts = (await q.get()).docs.map(d => d.data()).filter(t => t.date === date && !t.cancelled && t.dc === 'C' && t.kind === 'loan');
  const m = {}; rows.filter(r => r.kind === 'loan').forEach(r => { const a = sum(ts.filter(t => t.accNo === r.accNo), t => t.amount); m[r.accNo] = r.inst ? Math.floor((a + 0.001) / r.inst) : 0; }); return m;
}
const SUMMARY_CARD = `<div class="card mc-ek-s"><div class="mc-ek-c1"><small>TOTAL RECEIVABLE</small><b data-s="due">0 Tk</b></div>
  <div class="mc-ek-c2"><div><small>LOAN RECEIVE</small><b data-s="L">0 Tk</b></div><div><small>DEPOSIT RECEIVE</small><b data-s="S">0 Tk</b></div></div>
  <div class="mc-ek-c3"><div><small>TOTAL RECEIVE</small><b class="g" data-s="rcv">0 TK</b></div><div><small>TOTAL DUES</small><b class="r" data-s="dues">0 TK</b></div></div></div>`;

// ── শীট পোস্টিং ──
App.page('sheetPosting', {
  title: 'শীট পোস্টিং (সমিতি কালেকশন)', icon: '🧾',
  render: () => `<div class="mc-ek sp-ek"><div class="card mc-ek-f"><div class="mc-ek-h">🧾 Installment Collection</div>${UI.grid([{ ...F.branch, l: 'Branch Name' }, { ...F.samity, l: 'Samity Name', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }], 1)}<div class="actions">${UI.btn('🔍 Search Details', 'Sheet.load(this)', 'btn-success')} ${UI.btn('Submit', 'Sheet.submit(this)', 'btn-info')}</div></div><div></div>${SUMMARY_CARD}</div><div class="card mc-ek-t sheet"></div>`,
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false }); UI.el(el, 'date').value = await businessDate();
    if (!canBackDate()) { UI.el(el, 'date').readOnly = true; UI.el(el, 'date').closest('.form-group').style.display = 'none'; }   // eKisti: তারিখ = বিজনেস ডেট
    UI.el(el, 'samity').addEventListener('change', () => { if (UI.el(el, 'samity').value) Sheet.load(); });
  },
});
const Sheet = {
  load(btn) {
    const el = $('#page-sheetPosting');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.samity) fail('সমিতি বাছাই করুন');
      const rows = (await collectRows(f.samity, f.date)).filter(r => r.kind !== 'share'); const mem = await Data.memberIdx(f.branch);
      const ti = await thisInstMap(rows, f.date, db.collection('txns').where('date', '==', f.date));
      el._rows = rows;
      $('.sheet', el).innerHTML = `<div class="sp-scroll">${CollGrid.html(rows, mem, ti)}</div><div class="actions">${UI.btn('Submit', 'Sheet.submit(this)', 'btn-info')}</div>`;
      CollGrid.bind($('.sheet', el), el);
    });
  },
  total() { const r = $('#page-sheetPosting .sheet'); if (r) $$('.ci', r).slice(0, 1).forEach(i => i.dispatchEvent(new Event('input'))); },
  submit(btn) {
    const el = $('#page-sheetPosting');
    return guard(btn, async () => {
      const f = UI.get(el); if (!el._rows) fail('আগে Search Details চাপুন');
      const byMember = {};
      CollGrid.picked(el).forEach(i => (byMember[i.dataset.m] = byMember[i.dataset.m] || []).push({ accNo: i.dataset.acc, amount: num(i.value) }));
      const ms = Object.keys(byMember); if (!ms.length) fail('কোনো Receive এ টাকা দেওয়া হয়নি (F চাপলে আজকের Due বসে)');
      const total = sum(Object.values(byMember).flat(), x => x.amount);
      if (!confirm(`${ms.length} জন সদস্যের মোট ${tk(total)} আদায় পোস্ট করবেন?`)) return;
      busy(true, 'প্রস্তুত হচ্ছে...');
      try {
        const posts = []; let i = 0;
        for (const m of ms) { busy(true, `যাচাই ${++i}/${ms.length}`); const p = await buildMemberCollection(f.branch, f.date, m, byMember[m], 'sheet'); if (p) posts.push(p); }
        const vnos = await Eng.postMany(posts, (k, n) => busy(true, `পোস্ট ${k}/${n}`));
        await db.collection('sheetPosts').add({ branch: f.branch, samity: f.samity, date: f.date, members: ms.length, amount: total, vnos, by: App.user.userId, on: FV.serverTimestamp() });
        toast(`✅ ${posts.length} জন সদস্যের ${tk(total)} আদায় পোস্ট হয়েছে`);
        el._rows = null; $('.sheet', el).innerHTML = ''; ['due', 'L', 'S'].forEach(k => { const e = $(`[data-s="${k}"]`, el); if (e) e.textContent = '0 Tk'; }); ['rcv', 'dues'].forEach(k => { const e = $(`[data-s="${k}"]`, el); if (e) e.textContent = '0 TK'; });
      } finally { busy(false); }
    });
  },
};

// ── সদস্য ভিত্তিক কালেকশন — eKisti "micfin-installmentcollection-client-form" এর হুবহু লেআউট ──
App.page('memberColl', {
  title: 'সদস্য ভিত্তিক কালেকশন', icon: '👤',
  render: () => `<div class="mc-ek">
    <div class="card mc-ek-f"><div class="mc-ek-h">🧾 INSTALLMENT COLLECTION</div>${UI.grid([{ ...F.branch, l: 'Branch Name' }, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'date', l: 'Transaction Date', t: 'date', req: 1 }], 1)}<div class="actions">${UI.btn('🔍 Search Details', 'MemColl.load(this)', 'btn-success')}</div></div>
    <div class="card mc-ek-m"><div class="mc-ek-ph"><span class="mc-ph">👤</span><div>Profile image</div></div><table class="mc-ek-it"><tbody>${['Member Name', 'Somity Name', 'Phone', 'Address', 'Saving Account', 'Loan Account'].map(x => `<tr><th>${x}</th><td data-i="${x}"></td></tr>`).join('')}</tbody></table></div>
    <div class="card mc-ek-s"><div class="mc-ek-st">SUMMARY</div><div class="mc-ek-c1"><small>TOTAL RECEIVABLE</small><b data-s="due">0 Tk</b></div>
      <div class="mc-ek-c2"><div><small>LOAN RECEIVE</small><b data-s="L">0 Tk</b></div><div><small>DEPOSIT RECEIVE</small><b data-s="S">0 Tk</b></div></div>
      <div class="mc-ek-c3"><div><small>TOTAL RECEIVE</small><b class="g" data-s="rcv">0 TK</b></div><div><small>TOTAL DUES</small><b class="r" data-s="dues">0 TK</b></div></div>
      <button class="btn mc-ek-sub" onclick="MemColl.submit(this)">Submit</button></div>
  </div><div class="card mc-ek-t"></div>`,
  init: async el => { await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); UI.el(el, 'date').value = await businessDate(); UI.el(el, 'date').readOnly = !canBackDate(); UI.el(el, 'member').addEventListener('picked', () => MemColl.load()); },
});
const MemColl = {
  f: v => { v = r2(num(v)); return Number.isInteger(v) ? String(v) : v.toFixed(2); },
  load(btn) {
    const el = $('#page-memberColl');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.member) fail('Please Select Member');
      const m = await Data.member(f.member); if (!m) fail('সদস্য পাওয়া যায়নি');
      const sam = m.samity ? await Data.samity(m.samity) : null;
      const snaps = (await Data.snaps(f.branch, m.samity)).filter(x => x.m === f.member);
      const rows = (await collectRows(m.samity, f.date, f.member)).sort((a, b) => (a.kind === 'loan') - (b.kind === 'loan') || a.accNo.localeCompare(b.accNo));
      // আজ কয়টি কিস্তি জমা হয়েছে (This Inst.)
      const tday = (await db.collection('txns').where('memberId', '==', f.member).get()).docs.map(d => d.data()).filter(t => t.date === f.date && !t.cancelled && t.dc === 'C');
      rows.forEach(r => { const amtToday = sum(tday.filter(t => t.accNo === r.accNo), t => t.amount); r.thisInst = r.kind === 'loan' && r.inst ? Math.floor((amtToday + 0.001) / r.inst) : 0; });
      el._rows = rows;
      const ph = $('.mc-ek-ph', el); ph.innerHTML = (m.photoUrl ? `<img src="${esc(m.photoUrl)}">` : '<span class="mc-ph">👤</span>') + '<div>Profile image</div>';
      const info = { 'Member Name': m.name, 'Somity Name': sam ? `${sam.code.slice(-4)}----${sam.name}` : m.samity, 'Phone': m.mobile || '', 'Address': m.presentAddr || '', 'Saving Account': snaps.filter(x => x.k === 'dep').length, 'Loan Account': snaps.filter(x => x.k === 'loan').length };
      Object.entries(info).forEach(([k, v]) => { const td = $(`[data-i="${k}"]`, el); if (td) td.textContent = v; });
      const tn = r => r.kind === 'share' ? 'Share Accounts' : ((r.kind === 'loan' ? REF.LOAN : REF.DEP)[r.type] || {}).name || typeName(r.kind, r.type);
      const due = r => r.kind === 'loan' ? r.today : num(r.exp);
      const body = rows.map(r => `<tr><td>${esc(r.accNo)}</td><td>${esc(tn(r))}</td><td>${r.kind === 'loan' ? r.nInst || '' : ''}</td><td>${r.kind === 'loan' ? r.thisInst : ''}</td><td>${num(r.inst).toFixed(2)}</td><td>${num(r.pen).toFixed(2)}</td><td>${due(r).toFixed(2)}</td>
        <td class="c"><input type="radio" name="fz_${esc(r.accNo)}" class="mc-f" data-acc="${esc(r.accNo)}"></td><td class="c"><input type="radio" name="fz_${esc(r.accNo)}" class="mc-z" data-acc="${esc(r.accNo)}"></td>
        <td><input type="number" class="ci mc-in" data-acc="${esc(r.accNo)}" data-g="${r.kind === 'loan' ? 'L' : 'S'}" data-due="${due(r)}" value="0.00" min="0"></td>
        <td>${r.kind === 'loan' ? num(r.total).toFixed(2) : ''}</td><td>${(r.kind === 'loan' ? num(r.out) : num(r.bal)).toFixed(2)}</td><td>${r.kind === 'loan' ? num(r.overdue).toFixed(2) : ''}</td><td>${r.kind === 'loan' ? esc(r.expDate) : ''}</td>
        <td class="c"><button class="btn btn-warning btn-sm" title="PassBook" onclick="MemColl.pass('${esc(r.accNo)}')">👁</button></td></tr>`).join('');
      $('.mc-ek-t', el).innerHTML = `<table class="mc-ek-tbl"><thead><tr><th colspan="10" class="c">Account Details</th><th colspan="4" class="c">Total Balance</th><th>PassBook</th></tr>
        <tr><th>Account NO</th><th>Type</th><th>Total Inst</th><th>This Inst.</th><th>Inst Amount</th><th>Penalty</th><th>Todays Due</th><th>F</th><th>Z</th><th>Receive</th><th>Total Amount</th><th>Balance</th><th>Total Overdue</th><th>Exp Date</th><th>PassBook</th></tr>
        <tr><th colspan="7"></th><th class="c"><input type="checkbox" class="mc-allf"></th><th class="c"><input type="checkbox" class="mc-allz"></th><th colspan="5"></th><th>click</th></tr></thead>
        <tbody>${body || '<tr><td colspan="15" class="c">কোনো একাউন্ট নেই</td></tr>'}</tbody></table>`;
      MemColl.bind(el);
    });
  },
  bind(el) {
    const ins = $$('.mc-in', el);
    const upd = () => {
      const t = { L: 0, S: 0, due: 0 }; ins.forEach(i => { t[i.dataset.g] += num(i.value); t.due += num(i.dataset.due); });
      const set = (k, v, u) => { const e = $(`[data-s="${k}"]`, el); if (e) e.textContent = MemColl.f(v) + u; };
      set('due', t.due, ' Tk'); set('L', t.L, ' Tk'); set('S', t.S, ' Tk'); set('rcv', t.L + t.S, ' TK'); set('dues', Math.max(0, t.due - t.L - t.S), ' TK');
    };
    const inp = acc => $(`.mc-in[data-acc="${CSS.escape(acc)}"]`, el);
    const setF = acc => { const i = inp(acc); i.value = num(i.dataset.due).toFixed(2); };
    const setZ = acc => { inp(acc).value = '0.00'; };
    $$('.mc-f', el).forEach(r => r.addEventListener('change', () => { if (r.checked) setF(r.dataset.acc); upd(); }));
    $$('.mc-z', el).forEach(r => r.addEventListener('change', () => { if (r.checked) setZ(r.dataset.acc); upd(); }));
    ins.forEach(i => { i.addEventListener('click', () => i.select()); i.addEventListener('focus', () => i.select()); i.addEventListener('input', () => { $$(`input[name="fz_${CSS.escape(i.dataset.acc)}"]`, el).forEach(x => x.checked = false); upd(); }); });
    const aF = $('.mc-allf', el), aZ = $('.mc-allz', el);
    aF.addEventListener('change', () => { if (aF.checked) { aZ.checked = false; $$('.mc-f', el).forEach(r => { r.checked = true; setF(r.dataset.acc); }); } else { $$('.mc-f', el).forEach(r => { r.checked = false; setZ(r.dataset.acc); }); } upd(); });
    aZ.addEventListener('change', () => { if (aZ.checked) { aF.checked = false; $$('.mc-z', el).forEach(r => { r.checked = true; setZ(r.dataset.acc); }); } else $$('.mc-z', el).forEach(r => r.checked = false); upd(); });
    upd();
  },
  async pass(accNo) {
    const el = $('#page-memberColl'); const d = UI.el(el, 'date').value;
    UI.modal('PassBook — ' + accNo, '<div class="mini">লোড হচ্ছে...</div>');
    const html = await accStatementHTML(accNo, '2000-01-01', d, 1);
    const b = $('.modal .modal-body') || $('.modal'); if (b) b.innerHTML = `<div class="table-wrap">${html}</div>`;
  },
  submit(btn) {
    const el = $('#page-memberColl');
    return guard(btn, async () => {
      const f = UI.get(el); if (!el._rows) fail('আগে Search Details চাপুন');
      const items = $$('.mc-in', el).filter(i => num(i.value) > 0).map(i => ({ accNo: i.dataset.acc, amount: num(i.value) }));
      if (!items.length) fail('Receive এ টাকা দিন (F চাপলে আজকের বকেয়া বসবে)');
      const p = await buildMemberCollection(f.branch, f.date, f.member, items, 'member');
      const vno = await Eng.post(p);
      toast('✅ কালেকশন সম্পন্ন — ' + vno); Receipt.print(vno); MemColl.load();
    });
  },
};

// ── সদস্য কালেকশন তালিকা ──
ReportPage({
  id: 'memberCollList', ek: 'Search Details', title: 'সদস্য কালেকশন তালিকা (Member Installment Collection)', icon: '📋', fromDefault: 'month',
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
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member ID', t: 'member', req: 1 }, { k: 'book', l: 'Book Number', req: 1 }, { k: 'fee', l: 'Fee Amount', t: 'number' }, { k: 'date', l: 'Issue Date', t: 'date', req: 1 }, { k: 'docNo', l: 'Document Number' }], 3) + `<div class="actions">${UI.btn('Issue Book', 'Passbook.save(this)', 'btn-success')} ${UI.btn('Search Book', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>',
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
    + `<div class="mini">ফিল্ড অফিসার মাঠে যা আদায় করে সিস্টেমে পোস্ট করেছেন, সেই নগদ শাখায় বুঝে নেওয়ার রেকর্ড। পার্থক্য থাকলে রিপোর্টে দেখাবে।</div><div class="actions">${UI.btn('Collection Receive', 'CollRcv.save(this)', 'btn-success')} ${UI.btn('Search Collection Receive', 'EK.show(this)', 'btn-info')}</div>`) + '<div class="ek-rl" style="display:none">' + UI.card('', '<div class="tl"></div>') + '</div>',
  init: async el => {
    await Pick.branch(el, 'branch'); UI.el(el, 'date').value = await businessDate();
    const us = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    UI.fill(UI.el(el, 'user'), us, u => u.id, u => (u.userId || u.email) + ' — ' + (u.name || ''));
    const calc = async () => {
      const f = UI.get(el); if (!f.user) return;
      const ts = (await db.collection('txns').where('bd', '==', f.branch + '_' + f.date).get()).docs.map(d => d.data()).filter(t => !t.cancelled && sameUser(t.by, f.user) && t.dc === 'C' && ['dep', 'loan', 'share', 'fee'].includes(t.kind) && !['DEP_TRF_IN', 'EMI_TRF', 'PROFIT_POST', 'LOAN_DISB_TRF'].includes(t.tt));
      UI.el(el, 'collected').value = r2(sum(ts, t => t.amount + num(t.penalty)));
      const rc = (await db.collection('collReceipts').where('bd', '==', f.branch + '_' + f.date).get()).docs.map(d => ({ id: d.id, ...d.data() }));
      UI.el(el, 'received').value = r2(sum(rc.filter(r => sameUser(r.user, f.user) && !r.cancelled), r => r.amount));
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
