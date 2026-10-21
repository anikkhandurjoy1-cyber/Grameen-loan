// ═══════════════════════════════════════════════════════════════
// ড্যাশবোর্ড — eKisti এর মতো: শাখা/মাঠকর্মী ফিল্টার + বিজনেস ডেট + কার্ড
// রিড কম রাখতে: সমিতি snapshot (প্রতি সমিতি ১ রিড) + আজকের লেনদেন; ১০ মিনিট ক্যাশ
// ═══════════════════════════════════════════════════════════════
App.page('dashboard', {
  title: 'ড্যাশবোর্ড', icon: '🏠', always: true,
  render: () => `<div class="report-filter">${UI.grid([F.branch, F.btype, { k: 'employee', l: 'Employee Name', t: 'select' }, { k: 'date', l: 'Business Date', t: 'date' }], 4)}
    <div class="filter-actions">${UI.btn('🔄 Refresh Dashboard', 'Dash.load(this,true)')}</div></div><div class="dash-out"><div class="mini">লোড হচ্ছে...</div></div>`,
  init: async el => {
    const f = $('.report-filter', el);
    await Pick.branch(f, 'branch'); await Pick.employee(f, 'employee', 'branch', { blank: '— সব —' });
    UI.el(f, 'date').value = await businessDate();
    UI.el(f, 'branch').addEventListener('change', async () => { UI.el(f, 'date').value = await businessDate(UI.el(f, 'branch').value); });
    await Dash.load();
  },
});
const Dash = {
  async compute(f) {
    const bs = await R.branchesFor(f);
    const d = { members: new Set(), borrowers: new Set(), samities: 0, loanOut: 0, loanPrin: 0, od: 0, odCnt: 0, adv: 0, expired: 0, expCnt: 0, sav: {}, savTot: 0, share: 0, todayDue: 0, todayRcv: 0, depRcv: 0, depPay: 0, disb: 0, disbN: 0, pen: 0, fee: 0, profit: 0, emp: {}, newMem: 0, closedLoans: 0 };
    for (const b of bs) {
      const ff = { branch: b, employee: f.employee };
      const c = await R.snaps(ff, f.date);
      d.samities += Object.values(c.sm).filter(s => s.status !== 'closed' && (!f.employee || s.foId === f.employee)).length;
      const ts = await R.txns(ff, f.date, f.date);
      const got = {}; ts.forEach(t => { if (t.kind === 'loan' && t.dc === 'C') got[t.accNo] = (got[t.accNo] || 0) + num(t.amount); });
      c.list.forEach(s => {
        if (s.st === 'closed') return;
        d.members.add(s.m);
        if (s.k === 'loan') {
          const { st } = R.loanSt(s, f.date); const fo = c.fo(s.samity) || '—';
          d.borrowers.add(s.m); d.loanOut += st.outstanding; d.loanPrin += st.principalOut; d.od += st.overdue; if (st.overdue > 0) d.odCnt++; d.adv += st.advance;
          if (st.expired) { d.expired += st.outstanding; d.expCnt++; }
          // আজকের প্রাপ্য = আজ পর্যন্ত বকেয়া (আজকের আদায় যোগ করে আগের অবস্থা)
          const due = Math.min(st.outstanding + (got[s.accNo] || 0), r2(st.asonDue + (got[s.accNo] || 0)));
          d.todayDue += due;
          const e = d.emp[fo] = d.emp[fo] || { due: 0, rcv: 0, out: 0, od: 0 }; e.due += due; e.rcv += Math.min(due, got[s.accNo] || 0); e.out += st.outstanding; e.od += st.overdue;
        } else if (s.k === 'share') d.share += num(s.b);
        else { d.sav[s.t] = (d.sav[s.t] || 0) + num(s.b); d.savTot += num(s.b); }
      });
      ts.forEach(t => { const cl = R.cls(t); if (cl === 'loanRcv') { d.todayRcv += num(t.amount); d.profit += num(t.profit); } if (cl === 'depRcv') d.depRcv += num(t.amount); if (cl === 'depPay') d.depPay += num(t.amount); if (cl === 'disb') { d.disb += num(t.amount); d.disbN++; } d.pen += num(t.penalty); if (cl === 'fee') d.fee += num(t.amount); if (t.tt === 'MEMBER_ADMISSION' || t.tt === 'ADMISSION_FEE') d.newMem++; });
    }
    d.memberCnt = d.members.size; d.borrowerCnt = d.borrowers.size; delete d.members; delete d.borrowers;
    return d;
  },
  async load(btn, force) {
    const el = $('#page-dashboard'); if (!el) return;
    return guard(btn, async () => {
      const f = UI.get($('.report-filter', el));
      if (!f.branch) { $('.dash-out', el).innerHTML = '<div class="card"><div class="alert">প্রথমে "সেটিংস → প্রাথমিক সেটআপ" থেকে COA তৈরি করুন এবং শাখা যোগ করুন।</div></div>'; return; }
      const key = 'dash_' + JSON.stringify(f);
      if (force) Cache.drop(key);
      $('.dash-out', el).innerHTML = '<div class="mini">লোড হচ্ছে...</div>';
      const d = await Cache.get(key, () => Dash.compute(f), 10 * 60000);
      const en = await R.empName();
      const card = (t, v, sub, color) => `<div class="stat-card" style="border-left:4px solid ${color || 'var(--primary)'}"><div class="stat-label">${t}</div><div class="stat-value">${v}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
      const rate = d.todayDue ? r2(Math.min(100, d.todayRcv / d.todayDue * 100)) : 0;
      $('.dash-out', el).innerHTML = `
        <div class="stat-grid">
          ${card('সদস্য তথ্য', d.memberCnt, `ঋণী: ${d.borrowerCnt} | সঞ্চয়ী: ${d.memberCnt - d.borrowerCnt}`, '#2980b9')}
          ${card('সমিতির তথ্য', d.samities, 'সক্রিয় সমিতি', '#8e44ad')}
          ${card('ঋণ স্থিতি', tk(d.loanOut), `আসল: ${tk(d.loanPrin)}`, '#c0392b')}
          ${card('বকেয়া', tk(d.od), `${d.odCnt} টি হিসাব | মেয়াদোত্তীর্ণ ${d.expCnt} টি (${tk(d.expired)})`, '#e67e22')}
          ${card('সঞ্চয় স্থিতি', tk(d.savTot), `শেয়ার: ${tk(d.share)}`, '#16a085')}
          ${card('আজকের সঞ্চয় আদায়', tk(d.depRcv), '', '#27ae60')}
          ${card('আজকের সঞ্চয় ফেরত', tk(d.depPay), '', '#7f8c8d')}
          ${card('আজকের ঋণ আদায়', tk(d.todayRcv), `প্রাপ্য: ${tk(d.todayDue)} | হার: ${rate}%`, '#2c3e50')}
          ${card('আজকের ঋণ বিতরণ', tk(d.disb), `${d.disbN} টি`, '#d35400')}
          ${card('Profit Earned (আজ)', tk(d.profit + d.pen + d.fee), `সার্ভিস চার্জ ${tk(d.profit)} | জরিমানা ${tk(d.pen)} | ফি ${tk(d.fee)}`, '#1abc9c')}
        </div>
        ${UI.card('👔 কর্মচারীর ঋণ আদায়ের হার (আজ)', UI.table([{ h: 'মাঠকর্মী', f: r => r.k === '—' ? '—' : en(r.k) }, { h: 'প্রাপ্য', f: r => amt(r.due), r: 1, sum: 1, v: r => r.due }, { h: 'আদায়', f: r => amt(r.rcv), r: 1, sum: 1, v: r => r.rcv }, { h: 'হার', f: r => r.due ? r2(r.rcv / r.due * 100) + '%' : '—', r: 1 }, { h: 'ঋণ স্থিতি', f: r => amt(r.out), r: 1, sum: 1, v: r => r.out }, { h: 'বকেয়া', f: r => amt(r.od), r: 1, sum: 1, v: r => r.od }], Object.entries(d.emp).map(([k, v]) => ({ k, ...v })).sort((a, b) => a.k.localeCompare(b.k))))}
        ${UI.card('💰 সঞ্চয় স্থিতি (প্রোডাক্টভিত্তিক)', UI.table([{ h: 'প্রোডাক্ট', f: r => typeFull('dep', r[0]) }, { h: 'স্থিতি', f: r => amt(r[1]), r: 1, sum: 1, v: r => r[1] }], Object.entries(d.sav).sort()))}
        <div class="mini">তথ্য ১০ মিনিট ক্যাশ থাকে — নতুন তথ্যের জন্য "Refresh Dashboard" চাপুন।</div>`;
    });
  },
};
