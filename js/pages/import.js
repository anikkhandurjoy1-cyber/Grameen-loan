// ═══════════════════════════════════════════════════════════════
// eKisti ডেটা ইমপোর্ট — শাখা, কর্মী, সমিতি, সদস্য, একাউন্ট (ব্যালেন্স সহ), ওপেনিং GL
// ফাইল ফরম্যাট (JSON): { version:1, asOf:'YYYY-MM-DD', branches:[], employees:[], samities:[], members:[], accounts:[], glOpening:[{gl,dr,cr}] }
// লেনদেন ডক তৈরি হয় না (ফ্রি প্ল্যানে লেখা কম) — স্টেটমেন্টে ইমপোর্ট তারিখের ব্যালেন্স ওপেনিং হিসেবে আসে
// ═══════════════════════════════════════════════════════════════
App.page('dataImport', {
  title: 'eKisti ডেটা ইমপোর্ট', icon: '📥',
  render: () => UI.card('', `<div class="alert alert-info">eKisti থেকে এক্সপোর্ট করা <b>.json</b> ফাইল বাছাই করুন। প্রথমে "যাচাই করুন" চাপুন — কোনো ডেটা লেখা হবে না, শুধু সারাংশ ও সমস্যা দেখাবে। সব ঠিক থাকলে "ইমপোর্ট শুরু করুন"।<br>
    ⚠️ Firebase ফ্রি প্ল্যানে দিনে ২০,০০০ লেখা সীমা — বড় ডেটা হলে শাখা বাছাই করে দিনে ১-২টি শাখা ইমপোর্ট করুন।</div>`
    + UI.grid([{ k: 'file', l: 'eKisti JSON ফাইল', t: 'file', accept: '.json,application/json' }, { k: 'branch', l: 'শুধু এই শাখা (খালি = সব)', t: 'select', opts: [['', '— সব শাখা —']] }, { k: 'reGl', l: 'আগের ওপেনিং GL বাতিল করে নতুন করে পোস্ট করুন', t: 'checkbox' }], 3)
    + `<div class="actions">${UI.btn('🔎 যাচাই করুন', 'Imp.check(this)', 'btn-primary')}${UI.btn('📥 ইমপোর্ট শুরু করুন', 'Imp.run(this)', 'btn-success')}</div>
    <div class="imp-out" style="margin-top:10px"></div><pre class="imp-log mini" style="white-space:pre-wrap;max-height:300px;overflow:auto"></pre>`),
  init: async el => {
    if (!isAdmin()) { $('.imp-out', el).innerHTML = '<div class="alert alert-danger">শুধু Super Admin ইমপোর্ট করতে পারবেন।</div>'; return; }
    UI.el(el, 'file').addEventListener('change', async () => { Imp.data = null; const f = UI.el(el, 'file').files[0]; if (!f) return; try { Imp.data = JSON.parse(await f.text()); const bs = (Imp.data.branches || []).map(b => String(b.code)); const all = [...new Set([...bs, ...(Imp.data.members || []).map(m => String(m.branch))])].sort(); UI.fill(UI.el(el, 'branch'), all, b => b, b => b, '— সব শাখা —'); toast('ফাইল পড়া হয়েছে — যাচাই করুন', 'info'); } catch (e) { toast('JSON ফাইল পড়া যায়নি: ' + e.message, 'error'); } });
  },
});
const Imp = {
  data: null,
  log(m) { const p = $('#page-dataImport .imp-log'); if (p) { p.textContent += m + '\n'; p.scrollTop = p.scrollHeight; } },
  // নরমালাইজ + যাচাই
  prepare(branchOnly) {
    const D = Imp.data; if (!D) fail('আগে JSON ফাইল বাছাই করুন');
    const asOf = D.asOf || today();
    const S = s => String(s == null ? '' : s).trim();
    const inB = b => !branchOnly || S(b) === branchOnly;
    const branches = (D.branches || []).filter(b => inB(b.code)).map(b => ({ code: S(b.code), name: S(b.name), type: b.type || 'Branch Office', address: S(b.address), phone: S(b.phone), openDate: b.openDate || '', status: 'Active', businessDate: b.businessDate || asOf }));
    const employees = (D.employees || []).filter(e => inB(e.branch)).map(e => ({ ...e, empId: S(e.empId), branch: S(e.branch), name: S(e.name), mobile: S(e.mobile), status: e.status || 'active' }));
    const samities = (D.samities || []).filter(s => inB(s.branch)).map(s => ({ ...s, code: S(s.code), branch: S(s.branch), name: S(s.name), foId: S(s.foId), day: s.day || '', status: s.status || 'active' }));
    const members = (D.members || []).filter(m => inB(m.branch)).map(m => ({ ...m, memberId: S(m.memberId), branch: S(m.branch), samity: S(m.samity), name: S(m.name), mobile: S(m.mobile), status: m.status || 'active', joinDate: m.joinDate || asOf }));
    const memSet = new Set(members.map(m => m.memberId)); const samSet = new Set(samities.map(s => s.code));
    const issues = [];
    members.forEach(m => { if (!m.memberId) issues.push('সদস্য আইডি নেই: ' + m.name); if (m.samity && !samSet.has(m.samity)) issues.push(`সদস্য ${m.memberId}: সমিতি ${m.samity} ফাইলে নেই`); });
    const accounts = (D.accounts || []).filter(a => inB(a.branch)).map(a => {
      const x = { ...a, accNo: S(a.accNo), memberId: S(a.memberId), branch: S(a.branch), kind: a.kind, type: S(a.type), openDate: a.openDate || asOf, status: a.status || 'active', balance: r2(num(a.balance)) };
      if (!x.samity) { const m = members.find(mm => mm.memberId === x.memberId); x.samity = m ? m.samity : ''; }
      if (x.kind === 'loan') {
        x.principal = num(a.principal); x.rate = num(a.rate); x.profit = a.profit != null ? num(a.profit) : Math.round(x.principal * x.rate / 100);
        x.totalRepay = a.totalRepay != null ? num(a.totalRepay) : x.principal + x.profit;
        x.paidP = num(a.paidP); x.paidPr = num(a.paidPr); x.paidTotal = a.paidTotal != null ? num(a.paidTotal) : r2(x.paidP + x.paidPr);
        if (a.balance == null) x.balance = r2(x.totalRepay - x.paidTotal);
        x.n = num(a.n) || 1; x.instAmount = num(a.instAmount) || Math.ceil(x.totalRepay / x.n); x.actualN = num(a.actualN) || Math.floor(x.totalRepay / x.instAmount); x.lastInst = a.lastInst != null ? num(a.lastInst) : r2(x.totalRepay - x.actualN * x.instAmount);
        x.freq = a.freq || 'W'; x.firstDate = a.firstDate || x.openDate; x.expDate = a.expDate || Loan.expiry(x.firstDate, x.freq, x.actualN);
        x.paidPen = 0; x.penDue = 0; x.wvP = 0; x.wvPr = 0; x.wvC = 0; x.base = 0; x.purposeName = a.purposeName || ''; x.isStaff = !!a.isStaff;
        if (!REF.LOAN[x.type]) issues.push(`ঋণ ${x.accNo}: অজানা প্রোডাক্ট ${x.type}`);
        if (Math.abs(x.balance - r2(x.totalRepay - x.paidTotal)) > 1) issues.push(`ঋণ ${x.accNo}: স্থিতি (${x.balance}) ≠ মোট (${x.totalRepay}) − আদায় (${x.paidTotal})`);
      } else {
        x.totCr = a.totCr != null ? num(a.totCr) : Math.max(0, x.balance); x.totDr = a.totDr != null ? num(a.totDr) : 0;
        x.instAmount = num(a.instAmount); x.freq = a.freq || ''; x.rate = a.rate != null ? num(a.rate) : ((REF.DEP[x.type] || {}).rate || 0); x.maturityDate = a.maturityDate || ''; x.profitPaid = 0; x.block = { amount: 0, dep: false, wd: false };
        if (x.kind === 'dep' && !REF.DEP[x.type]) issues.push(`সঞ্চয় ${x.accNo}: অজানা প্রোডাক্ট ${x.type}`);
        if (x.kind === 'other' && !REF.OTHER[x.type]) issues.push(`অন্যান্য ${x.accNo}: অজানা ধরন ${x.type}`);
      }
      if (x.kind !== 'other' && !memSet.has(x.memberId)) issues.push(`একাউন্ট ${x.accNo}: সদস্য ${x.memberId} ফাইলে নেই`);
      if (!x.title) { const m = members.find(mm => mm.memberId === x.memberId); x.title = m ? m.name : ''; }
      return x;
    });
    const dupAcc = accounts.map(a => a.accNo).filter((v, i, s) => s.indexOf(v) !== i); if (dupAcc.length) issues.push('ডুপ্লিকেট একাউন্ট নং: ' + [...new Set(dupAcc)].slice(0, 10).join(', '));
    return { asOf, branches, employees, samities, members, accounts, glOpening: D.glOpening || [], issues };
  },
  // শাখাভিত্তিক ওপেনিং GL লাইন
  glLines(P, branch) {
    const by = {}; const add = (gl, d) => { by[gl] = r2((by[gl] || 0) + d); };   // d>0 = Dr
    P.accounts.filter(a => a.branch === branch && a.status !== 'closed').forEach(a => {
      if (a.kind === 'loan') { const pr = REF.LOAN[a.type] || REF.LOAN['3001']; add(pr.gl, r2(a.balance)); add(pr.recGl, -r2(a.profit - a.paidPr)); }
      else add(Eng.productGl(a.kind, a.type), -a.balance);
    });
    const productGls = new Set([...Object.values(REF.DEP).map(d => d.gl), ...Object.values(REF.LOAN).map(d => d.gl), ...Object.values(REF.LOAN).map(d => d.recGl), REF.GL.share, ...Object.values(REF.OTHER).map(d => d.gl)]);
    (P.glOpening || []).filter(g => !g.branch || String(g.branch) === branch).forEach(g => { if (!productGls.has(String(g.gl))) add(String(g.gl), r2(num(g.dr) - num(g.cr))); });
    const lines = Object.entries(by).filter(([, v]) => r2(v)).map(([gl, v]) => v > 0 ? { gl, dr: v, cr: 0 } : { gl, dr: 0, cr: -v });
    const net = r2(sum(lines, l => l.dr) - sum(lines, l => l.cr));
    if (net) lines.push(net > 0 ? { gl: '20010000', dr: 0, cr: net, memo: 'Opening Adjustment' } : { gl: '20010000', dr: -net, cr: 0, memo: 'Opening Adjustment' });
    return { lines, adj: net };
  },
  check(btn) {
    return guard(btn, async () => {
      const el = $('#page-dataImport'); const P = Imp.prepare(UI.el(el, 'branch').value);
      const bs = [...new Set(P.members.map(m => m.branch).concat(P.branches.map(b => b.code)))].sort();
      const writes = P.branches.length + P.employees.length + P.samities.length + P.members.length + P.accounts.length + new Set(P.accounts.map(a => a.samity)).size + bs.length * 6;
      const k = kind => P.accounts.filter(a => a.kind === kind);
      $('.imp-out', el).innerHTML = UI.info([['ইমপোর্ট তারিখ (asOf)', fmtD(P.asOf)], ['শাখা', bs.join(', ')], ['কর্মী', P.employees.length], ['সমিতি', P.samities.length], ['সদস্য', P.members.length], ['সঞ্চয় হিসাব', `${k('dep').length} টি — ${tk(sum(k('dep'), a => a.balance))}`], ['শেয়ার', `${k('share').length} টি — ${tk(sum(k('share'), a => a.balance))}`], ['ঋণ হিসাব', `${k('loan').length} টি — স্থিতি ${tk(sum(k('loan'), a => a.balance))}`], ['অন্যান্য', k('other').length], ['আনুমানিক লেখা (writes)', writes.toLocaleString() + (writes > 18000 ? ' ⚠️ দিনের সীমার কাছাকাছি — শাখা ভাগ করুন' : '')]])
        + bs.map(b => { const g = Imp.glLines(P, b); return `<div class="mini">শাখা ${b}: ওপেনিং GL লাইন ${g.lines.length} টি, Adjustment ${amt(g.adj)}</div>`; }).join('')
        + (P.issues.length ? `<div class="alert alert-danger" style="margin-top:8px"><b>${P.issues.length} টি সমস্যা:</b><br>${P.issues.slice(0, 50).map(esc).join('<br>')}${P.issues.length > 50 ? '<br>...' : ''}</div>` : '<div class="alert alert-success" style="margin-top:8px">✅ কোনো সমস্যা পাওয়া যায়নি</div>');
    });
  },
  run(btn) {
    return guard(btn, async () => {
      if (!isAdmin()) fail('শুধু Super Admin');
      const el = $('#page-dataImport'); const P = Imp.prepare(UI.el(el, 'branch').value);
      if (P.issues.length && !confirm(P.issues.length + ' টি সমস্যা আছে। তবুও ইমপোর্ট করবেন?')) return;
      if (!confirm(`${P.members.length} সদস্য ও ${P.accounts.length} একাউন্ট ইমপোর্ট হবে (${fmtD(P.asOf)} তারিখের ব্যালেন্স)। শুরু করবেন?`)) return;
      $('.imp-log', el).textContent = '';
      let batch = db.batch(), ops = 0, total = 0;
      const put = async (ref, data, merge) => { batch.set(ref, data, merge ? { merge: true } : {}); ops++; total++; if (ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0; Imp.log('… ' + total + ' লেখা সম্পন্ন'); } };
      const flush = async () => { if (ops) { await batch.commit(); batch = db.batch(); ops = 0; } };
      const meta = { importedAt: FV.serverTimestamp(), importedBy: App.user.userId || App.user.uid, source: 'ekisti' };
      busy(true, 'ইমপোর্ট হচ্ছে...');
      try {
        for (const b of P.branches) await put(db.collection('branches').doc(b.code), { ...b, ...meta }, true);
        await flush(); Cache.drop(); Imp.log('✓ শাখা ' + P.branches.length);
        for (const e of P.employees) await put(db.collection('employees').doc(e.empId), { ...e, ...meta }, true);
        for (const s of P.samities) await put(db.collection('samities').doc(s.code), { ...s, ...meta }, true);
        await flush(); Imp.log('✓ কর্মী ' + P.employees.length + ', সমিতি ' + P.samities.length);
        const midx = {}, aidx = {}, snaps = {};
        for (const m of P.members) { await put(db.collection('members').doc(m.memberId), { ...m, ...meta }, true); (midx[m.branch] = midx[m.branch] || {})[m.memberId] = Idx.memberRow(m); }
        await flush(); Imp.log('✓ সদস্য ' + P.members.length);
        for (const a of P.accounts) {
          await put(db.collection('accounts').doc(a.accNo), { ...a, lastTxnDate: P.asOf, ...meta });
          (aidx[a.branch] = aidx[a.branch] || {})[a.accNo] = Idx.accRow(a);
          if (a.samity) { const s = a.kind === 'loan' ? Loan.snapOf(a) : a.kind === 'share' ? { m: a.memberId, k: 'share', t: 'share', b: a.balance, st: a.status, od: a.openDate } : DepSnap(a); if (a.status === 'closed' && a.closeDate) s.cd = a.closeDate; (snaps[a.samity] = snaps[a.samity] || {})[a.accNo] = s; }
        }
        await flush(); Imp.log('✓ একাউন্ট ' + P.accounts.length);
        for (const [sc, a] of Object.entries(snaps)) await put(db.collection('snap').doc(sc), { a }, true);
        for (const [b, rows] of Object.entries(midx)) await put(db.collection('idx').doc('mem_' + b), { rows }, true);
        for (const [b, rows] of Object.entries(aidx)) await put(db.collection('idx').doc('acc_' + b), { rows }, true);
        // কাউন্টার (নতুন আইডি যেন না মেলে)
        const maxN = (arr, f) => arr.reduce((m, x) => Math.max(m, parseInt(f(x), 10) || 0), 0);
        for (const b of Object.keys(midx)) { const v = maxN(P.members.filter(m => m.branch === b), m => m.memberId.slice(b.length)); const cur = await db.collection('counters').doc('member_' + b).get(); if (!cur.exists || (cur.data().v || 0) < v) await put(db.collection('counters').doc('member_' + b), { v }, true); }
        const sv = maxN(P.samities, s => s.code); if (sv) { const cur = await db.collection('counters').doc('samity').get(); if (!cur.exists || (cur.data().v || 0) < sv) await put(db.collection('counters').doc('samity'), { v: sv }, true); }
        const ev = maxN(P.employees, e => e.empId); if (ev) { const cur = await db.collection('counters').doc('employee').get(); if (!cur.exists || (cur.data().v || 0) < ev) await put(db.collection('counters').doc('employee'), { v: ev }, true); }
        await flush(); Cache.drop(); Imp.log('✓ ইনডেক্স, snapshot ও কাউন্টার');
        // ওপেনিং GL ভাউচার (শাখাভিত্তিক)
        const reGl = UI.el(el, 'reGl').checked;
        for (const b of [...new Set(P.accounts.map(a => a.branch).concat(P.branches.map(x => x.code)))]) {
          const vid = 'OPEN-' + b; const old = await db.collection('vouchers').doc(vid).get();
          if (old.exists && old.data().status === 'posted') { if (!reGl) { Imp.log('• শাখা ' + b + ': ওপেনিং GL আগেই আছে — বাদ'); continue; } await Eng.cancel(vid, 'Re-import'); }
          const g = Imp.glLines(P, b); if (!g.lines.length) continue;
          const bt = db.batch(); const tot = r2(sum(g.lines, l => l.dr));
          bt.set(db.collection('vouchers').doc(vid), { vno: vid, branch: b, date: P.asOf, bd: b + '_' + P.asOf, type: 'OPENING', narration: 'eKisti ওপেনিং ব্যালেন্স (' + fmtD(P.asOf) + ')', docNo: '', payer: '', lines: g.lines.map(l => ({ gl: l.gl, dr: l.dr, cr: l.cr, accNo: '', memo: l.memo || '' })), total: tot, status: 'posted', authType: '', payload: null, ref: null, accs: [], accOps: [], by: App.user.uid, byName: App.user.userId || '', on: FV.serverTimestamp(), businessDate: P.asOf });
          Eng._apply(bt, vid, b, P.asOf, { lines: g.lines, txns: [], accOps: [] }, 1);
          await bt.commit(); Imp.log(`✓ শাখা ${b}: ওপেনিং GL পোস্ট (${g.lines.length} লাইন, Adjustment ${amt(g.adj)})`);
        }
        await db.collection('config').doc('import_' + (UI.el(el, 'branch').value || 'all')).set({ asOf: P.asOf, members: P.members.length, accounts: P.accounts.length, ...meta });
        Cache.drop(); toast('✅ ইমপোর্ট সম্পন্ন — মোট লেখা প্রায় ' + total);
        Imp.log('✅ সম্পন্ন');
      } finally { busy(false); }
    });
  },
};
