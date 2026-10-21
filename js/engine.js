// ═══════════════════════════════════════════════════════════════
// ENGINE — সব লেনদেন এখান দিয়ে: একাউন্ট ব্যালেন্স + লেনদেন + ভাউচার (ডাবল এন্ট্রি)
// + glDaily/glMonthly সারাংশ + সমিতি snapshot — সব এক WriteBatch-এ (atomic)
// ═══════════════════════════════════════════════════════════════
const Eng = {
  productGl(kind, type) {
    if (kind === 'dep') return (REF.DEP[type] || {}).gl;
    if (kind === 'loan') return (REF.LOAN[type] || {}).gl;
    if (kind === 'share') return REF.GL.share;
    if (kind === 'other') return (REF.OTHER[type] || {}).gl;
  },
  newVno(branch) { const d = new Date(); return String(branch || '') + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) + pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2) + pad(d.getMilliseconds(), 3) + Math.floor(Math.random() * 10); },

  /* p = {
       branch, date, type, narration, docNo, payer,
       lines: [{gl, dr, cr, accNo?, memo?}],
       txns:  [{accNo, kind, type, memberId, samity, foId, tt, amount, dc:'C'|'D', principal, profit, penalty, extra}],
       accOps:[{accNo, samity, inc:{field:+n}, set:{}, snapInc:{}, snapSet:{}, undoSet:{}}],
       status: 'posted'|'pending', authType, extra(batch, vno) } */
  build(p) {
    const lines = (p.lines || []).filter(l => r2(l.dr) || r2(l.cr)).map(l => ({ gl: l.gl, dr: r2(l.dr || 0), cr: r2(l.cr || 0), accNo: l.accNo || '', memo: l.memo || '' }));
    const dr = r2(sum(lines, l => l.dr)), cr = r2(sum(lines, l => l.cr));
    if (Math.abs(dr - cr) > 0.009) throw new Error(`ডেবিট (${dr}) ও ক্রেডিট (${cr}) সমান নয়`);
    if (!lines.length && !(p.txns || []).length && !p.extra && !p.pre && !(p.accOps || []).length) throw new Error('খালি লেনদেন');
    for (const l of lines) if (!l.gl) throw new Error('লেজার কোড নেই');
    return { ...p, lines, total: dr };
  },
  async post(p) {
    const v = Eng.build(p);
    if (!v.branch) fail('শাখা বাছাই করুন');
    if (!v.date) fail('তারিখ দিন');
    await Eng.checkDate(v.branch, v.date);
    const vno = Eng.newVno(v.branch);
    const batch = db.batch();
    const pending = v.status === 'pending';
    const payload = { lines: v.lines, txns: v.txns || [], accOps: v.accOps || [] };
    batch.set(db.collection('vouchers').doc(vno), {
      vno, branch: v.branch, date: v.date, bd: v.branch + '_' + v.date, type: v.type || 'JV', narration: v.narration || '', docNo: v.docNo || '', payer: v.payer || '',
      lines: v.lines, total: v.total, status: pending ? 'pending' : 'posted', authType: v.authType || '', payload: pending ? payload : null, ref: v.ref || null,
      accs: [...new Set([...(v.txns || []).map(t => t.accNo), ...(v.accOps || []).map(a => a.accNo)].filter(Boolean))],
      accOps: pending ? [] : (v.accOps || []).map(a => ({ accNo: a.accNo, samity: a.samity || '', inc: a.inc || {}, snapInc: a.snapInc || {}, undoSet: a.undoSet || null })),
      by: App.user.uid, byName: App.user.userId || App.user.name || '', on: FV.serverTimestamp(),
      businessDate: await businessDate(v.branch),
    });
    if (v.pre) await v.pre(batch, vno);           // নতুন ডক তৈরি (আপডেটের আগে)
    if (!pending) Eng._apply(batch, vno, v.branch, v.date, payload, 1);
    if (v.extra) await v.extra(batch, vno);
    await batch.commit();
    return vno;
  },
  // একাধিক ভাউচার একসাথে (শীট পোস্টিং) — প্রতি ব্যাচে ~৪০০ অপারেশন
  async postMany(list, onProgress) {
    const out = []; let batch = db.batch(), ops = 0, done = 0;
    for (const p of list) {
      const v = Eng.build(p);
      await Eng.checkDate(v.branch, v.date);
      const vno = Eng.newVno(v.branch) + String(out.length).padStart(3, '0');
      const payload = { lines: v.lines, txns: v.txns || [], accOps: v.accOps || [] };
      const est = 3 + payload.txns.length + payload.accOps.length * 2;
      if (ops + est > 400) { await batch.commit(); batch = db.batch(); ops = 0; }
      batch.set(db.collection('vouchers').doc(vno), {
        vno, branch: v.branch, date: v.date, bd: v.branch + '_' + v.date, type: v.type || 'JV', narration: v.narration || '', docNo: v.docNo || '', payer: '', lines: v.lines, total: v.total, status: 'posted', authType: '', payload: null, ref: v.ref || null,
        accs: [...new Set([...payload.txns.map(t => t.accNo), ...payload.accOps.map(a => a.accNo)].filter(Boolean))],
        accOps: payload.accOps.map(a => ({ accNo: a.accNo, samity: a.samity || '', inc: a.inc || {}, snapInc: a.snapInc || {}, undoSet: a.undoSet || null })),
        by: App.user.uid, byName: App.user.userId || '', on: FV.serverTimestamp(), businessDate: await businessDate(v.branch),
      });
      Eng._apply(batch, vno, v.branch, v.date, payload, 1);
      ops += est; out.push(vno); done++; if (onProgress) onProgress(done, list.length);
    }
    if (ops) await batch.commit();
    return out;
  },
  // প্রভাব প্রয়োগ (sign = 1 পোস্ট, -1 রিভার্স)
  _apply(batch, vno, branch, date, payload, sign) {
    const inc = n => FV.increment(r2(n) * sign);
    // লেনদেন ডক
    const deltaOf = accNo => { const a = (payload.accOps || []).find(x => x.accNo === accNo); return a && a.inc && a.inc.balance != null ? r2(a.inc.balance) : 0; };
    const used = {};
    if (sign === 1) (payload.txns || []).forEach((t, i) => {
      const delta = t.accNo && !used[t.accNo] ? deltaOf(t.accNo) : 0; if (t.accNo) used[t.accNo] = 1;
      batch.set(db.collection('txns').doc(vno + '_' + i), {
        ...t, amount: r2(t.amount), principal: r2(t.principal || 0), profit: r2(t.profit || 0), penalty: r2(t.penalty || 0), delta,
        vno, branch, date, bd: branch + '_' + date, bm: branch + '_' + date.slice(0, 7), cancelled: false,
        by: App.user.uid, byName: App.user.userId || '', on: FV.serverTimestamp(),
      });
    });
    // একাউন্ট আপডেট
    (payload.accOps || []).forEach(a => {
      const upd = {};
      Object.entries(a.inc || {}).forEach(([k, n]) => { upd[k] = inc(n); });
      if (sign === 1 && a.set) Object.assign(upd, a.set);
      if (sign === -1 && a.undoSet) Object.assign(upd, a.undoSet);
      upd.lastTxnDate = date;
      if (Object.keys(upd).length) batch.update(db.collection('accounts').doc(a.accNo), upd);
      if (a.samity) {
        const s = {};
        Object.entries(a.snapInc || {}).forEach(([k, n]) => { s[k] = inc(n); });
        if (sign === 1 && a.snapSet) Object.assign(s, a.snapSet);
        if (sign === -1 && a.undoSet && a.undoSet.status) s.st = a.undoSet.status;
        if (Object.keys(s).length) batch.set(db.collection('snap').doc(a.samity), { a: { [a.accNo]: s } }, { merge: true });
      }
    });
    // GL সারাংশ
    const gl = {};
    (payload.lines || []).forEach(l => { gl[l.gl] = gl[l.gl] || { dr: 0, cr: 0 }; gl[l.gl].dr += l.dr; gl[l.gl].cr += l.cr; });
    if (Object.keys(gl).length) {
      const g = {}; Object.entries(gl).forEach(([c, x]) => { g[c] = {}; if (x.dr) g[c].dr = inc(x.dr); if (x.cr) g[c].cr = inc(x.cr); });
      // নগদ/ব্যাংক জড়িত ভাউচার হলে আলাদা cgl (প্রাপ্তি-প্রদান ও ক্যাশবুকের জন্য)
      const isCash = (payload.lines || []).some(l => String(l.gl).startsWith('111'));
      const day = { branch, date, gl: g }; if (isCash) day.cgl = g;
      batch.set(db.collection('glDaily').doc(branch + '_' + date), day, { merge: true });
      batch.set(db.collection('glMonthly').doc(branch + '_' + date.slice(0, 7)), isCash ? { branch, month: date.slice(0, 7), gl: g, cgl: g } : { branch, month: date.slice(0, 7), gl: g }, { merge: true });
    }
  },
  async checkDate(branch, date) {
    const b = await Data.branch(branch);
    if (!b) fail('শাখা পাওয়া যায়নি');
    const bd = b.businessDate || today();
    if (date > bd) fail(`বিজনেস ডেট (${fmtD(bd)}) এর পরের তারিখে লেনদেন করা যাবে না`);
    if (date < bd && !canBackDate()) fail(`Back Date লেনদেনের অনুমতি নেই (বিজনেস ডেট ${fmtD(bd)})`);
  },
  async cancel(vno, reason) {
    const vd = await db.collection('vouchers').doc(vno).get();
    if (!vd.exists) fail('ভাউচার পাওয়া যায়নি');
    const v = vd.data();
    if (v.status === 'cancelled') fail('ইতিমধ্যে বাতিল');
    const batch = db.batch();
    if (v.status === 'posted') {
      Eng._apply(batch, vno, v.branch, v.date, { lines: v.lines, txns: [], accOps: v.accOps || [] }, -1);
      const ts = await db.collection('txns').where('vno', '==', vno).get();
      ts.forEach(d => batch.update(d.ref, { cancelled: true, cancelBy: App.user.userId || App.user.uid, cancelOn: FV.serverTimestamp() }));
    }
    batch.update(vd.ref, { status: 'cancelled', cancelBy: App.user.userId || App.user.uid, cancelOn: FV.serverTimestamp(), cancelReason: reason || '' });
    await batch.commit();
    return v;
  },
  async approve(vno) {
    const vd = await db.collection('vouchers').doc(vno).get();
    const v = vd.data();
    if (v.status !== 'pending') fail('অনুমোদনের অপেক্ষায় নেই');
    const batch = db.batch();
    Eng._apply(batch, vno, v.branch, v.date, v.payload, 1);
    batch.update(vd.ref, { status: 'posted', payload: null, accOps: (v.payload.accOps || []).map(a => ({ accNo: a.accNo, samity: a.samity || '', inc: a.inc || {}, snapInc: a.snapInc || {}, undoSet: a.undoSet || null })), authBy: App.user.userId || App.user.uid, authOn: FV.serverTimestamp() });
    await batch.commit();
  },
  // সাধারণ নগদ/অন্য লেজার লাইন
  cashLine(dr, cr, ledger) { return { gl: ledger || REF.GL.cash, dr: dr || 0, cr: cr || 0 }; },
};

// ─────────────── ঋণ হিসাব (eKisti ফর্মুলা: flat) ───────────────
const Loan = {
  // amount, rate%, n, instAmountOverride → {profit, total, inst, actualInst, extra, lastInst, actualN}
  calc(amount, rate, n, override) {
    amount = num(amount); rate = num(rate); n = Math.max(1, parseInt(n) || 1);
    const profit = Math.round(amount * rate / 100);
    const total = amount + profit;
    const inst = Math.ceil(total / n);
    let actual = override ? num(override) : inst;
    if (actual <= 0) actual = inst;
    const fullN = Math.floor(total / actual);
    const last = r2(total - fullN * actual);
    return { profit, total, inst, actualInst: actual, extra: r2(inst - actual), lastInst: last, actualN: fullN, totalN: fullN + (last > 0 ? 1 : 0) };
  },
  nextDate(d, freq, i) {
    if (freq === 'D') return addDays(d, i);
    if (freq === 'W') return addDays(d, 7 * i);
    if (freq === 'F') return addDays(d, 15 * i);
    if (freq === 'M') return addMonths(d, i);
    if (freq === 'Q') return addMonths(d, 3 * i);
    if (freq === 'H') return addMonths(d, 6 * i);
    if (freq === 'Y') return addMonths(d, 12 * i);
    return d; // S / C : একক কিস্তি
  },
  // eKisti: মেয়াদ উত্তীর্ণ = প্রথম কিস্তি + n পিরিয়ড
  expiry(first, freq, n) { return (freq === 'S' || freq === 'C') ? first : Loan.nextDate(first, freq, Math.max(0, n)); },
  // কিস্তির তালিকা [{date, amount}]
  schedule(l) {
    const out = []; const fullN = l.actualN || l.n; const ia = l.instAmount;
    for (let i = 0; i < fullN; i++) out.push({ date: Loan.nextDate(l.firstDate, l.freq, i), amount: ia });
    if (num(l.lastInst) > 0) out.push({ date: Loan.nextDate(l.firstDate, l.freq, fullN), amount: num(l.lastInst) });
    return out;
  },
  // as-of অবস্থা
  status(l, asOf, paidOverride) {
    const paidAll = paidOverride != null ? paidOverride : num(l.paidTotal);
    const paid = r2(paidAll - num(l.base));   // পুনঃতফসিলের পর নতুন শিডিউলের বিপরীতে আদায়
    const sch = Loan.schedule(l);
    let cumToday = 0, cumBefore = 0, dueCnt = 0, todayInst = 0;
    sch.forEach(s => { if (s.date <= asOf) { cumToday += s.amount; dueCnt++; } if (s.date < asOf) cumBefore += s.amount; if (s.date === asOf) todayInst += s.amount; });
    const total = num(l.totalRepay), outstanding = r2(Math.max(0, total - paidAll));
    const paidCnt = l.instAmount ? Math.min(sch.length, Math.floor((paid + 0.001) / l.instAmount)) : 0;
    return {
      sch, paid: paidAll, outstanding, dueCnt, paidCnt,
      cumDue: r2(cumToday), todayInst: r2(todayInst),
      asonDue: r2(Math.max(0, cumToday - paid)),
      overdue: r2(Math.max(0, cumBefore - paid)),
      advance: r2(Math.max(0, paid - cumToday)),
      overdueCnt: Math.max(0, dueCnt - paidCnt - (todayInst ? 1 : 0)),
      expired: l.expDate && l.expDate < asOf && outstanding > 0,
      principalOut: r2(num(l.principal) - num(l.paidP)), profitOut: r2(num(l.profit) - num(l.paidPr)),
    };
  },
  // আদায়ের টাকা আসল/মুনাফায় ভাগ
  split(l, amount) {
    amount = r2(amount);
    const pOut = r2(num(l.principal) - num(l.paidP)), prOut = r2(num(l.profit) - num(l.paidPr));
    if (amount >= r2(pOut + prOut)) return { principal: pOut, profit: r2(amount - pOut) };
    const ratio = num(l.totalRepay) ? num(l.principal) / num(l.totalRepay) : 1;
    let principal = Math.min(pOut, r2(amount * ratio));
    let profit = r2(amount - principal);
    if (profit > prOut) { profit = prOut; principal = r2(amount - profit); }
    return { principal: r2(principal), profit: r2(profit) };
  },
};

// ─────────────── ডিপোজিট লাভ হিসাব ───────────────
const DepCalc = {
  // txns: [{date, amount, dc}] — দৈনিক ব্যালেন্স পদ্ধতি; rate% বার্ষিক; 360 দিন
  dailyProfit(txns, from, upto, rate, openingBal) {
    const ev = txns.filter(t => !t.cancelled).map(t => ({ d: t.date, a: t.dc === 'C' ? num(t.amount) : -num(t.amount) })).sort((a, b) => a.d.localeCompare(b.d));
    let bal = openingBal != null ? openingBal : sum(ev.filter(e => e.d < from), e => e.a);
    const rows = []; let cur = from, total = 0;
    const inRange = ev.filter(e => e.d >= from && e.d <= upto);
    const points = [...new Set([from, ...inRange.map(e => e.d), addDays(upto, 1)])].sort();
    for (let i = 0; i < points.length - 1; i++) {
      const d = points[i];
      bal += sum(inRange.filter(e => e.d === d), e => e.a);
      const days = daysBetween(d, points[i + 1]);
      const pr = r2(Math.max(0, bal) * days * num(rate) / 36000);
      if (days > 0) rows.push({ from: d, upto: addDays(points[i + 1], -1), days, bal: r2(bal), profit: pr });
      total += pr;
    }
    return { rows, total: r2(total) };
  },
};
