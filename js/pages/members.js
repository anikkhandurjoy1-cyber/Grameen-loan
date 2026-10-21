// ═══════════════════════════════════════════════════════════════
// সদস্য পরিচালনা — ভর্তি, তালিকা, ক্লোজিং, সমিতি স্থানান্তর
// ═══════════════════════════════════════════════════════════════
const MEMBER_FIELDS = [
  { k: 'branch', l: 'শাখা নাম', t: 'select', req: 1 }, { k: 'name', l: 'সদস্য নাম', req: 1 }, { k: 'samity', l: 'সমিতি নাম', t: 'select', req: 1 },
  { k: 'father', l: 'পিতার নাম' }, { k: 'mother', l: 'মাতার নাম' }, { k: 'spouse', l: 'স্বামী / স্ত্রী' },
  { k: 'mobile', l: 'মোবাইল', req: 1 }, { k: 'joinDate', l: 'ভর্তির তারিখ', t: 'date', req: 1 }, { k: 'presentAddr', l: 'বর্তমান ঠিকানা', t: 'textarea' },
  { k: 'permAddr', l: 'স্থায়ী ঠিকানা', t: 'textarea' }, { k: 'share', l: 'শেয়ার পরিমান TK', t: 'number' }, { k: 'reference', l: 'রেফারেন্স' },
  { k: 'nid', l: 'জাতীয় পরিচয় পত্র' }, { k: 'birthId', l: 'জন্ম সনদ' }, { k: 'email', l: 'ই-মেইল' },
  { k: 'blood', l: 'রক্তের গ্রুপ', t: 'select', opts: BLOOD }, { k: 'sex', l: 'লিঙ্গ', t: 'select', opts: GENDER }, { k: 'religion', l: 'ধর্ম', t: 'select', opts: RELIGION },
  { k: 'marital', l: 'বৈবাহিক অবস্থা', t: 'select', opts: MARITAL }, { k: 'dob', l: 'জন্ম তারিখ', t: 'date' }, { k: 'income', l: 'মাসিক আয়', t: 'number' },
  { k: 'profession', l: 'পেশা' }, { k: 'admitFee', l: 'ভর্তি ফি', t: 'number' }, { k: 'passbookFee', l: 'পাসবই ফি', t: 'number' },
  { k: 'photo', l: 'সদস্যের ছবি', t: 'file' }, { k: 'signature', l: 'স্বাক্ষর', t: 'file' }, { k: 'document', l: 'Upload Documents', t: 'file' },
  { t: 'hr', l: '👤 নমিনির তথ্য' },
  { k: 'nomName', l: 'নমিনি নাম' }, { k: 'nomFather', l: 'পিতার নাম' }, { k: 'nomMother', l: 'মাতার নাম' }, { k: 'nomPhone', l: 'মোবাইল' },
  { k: 'nomRelation', l: 'সম্পর্ক' }, { k: 'nomNid', l: 'জাতীয় পরিচয় পত্র' }, { k: 'nomAddr', l: 'ঠিকানা', t: 'textarea' },
  { k: 'lat', l: 'Latitude', ro: 1 }, { k: 'lng', l: 'Longitude', ro: 1 },
];
App.page('memberAdd', {
  title: 'সদস্য ভর্তি', icon: '➕',
  render: p => UI.card(p.edit ? '✏️ সদস্য এডিট — ' + esc(p.edit) : '', UI.grid(MEMBER_FIELDS, 3) + `<div class="actions">
      ${UI.btn('📍 Set Map Location', 'Member.geo()', 'btn-outline')}
      ${UI.btn(p.edit ? '💾 আপডেট' : '✅ সদস্য তৈরি', 'Member.save(this)', 'btn-success')}
      ${UI.btn('🔍 সদস্য সার্চ', "App.go('memberList')", 'btn-secondary')}</div>`),
  init: async (el, p) => {
    await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false });
    UI.el(el, 'joinDate').value = await businessDate();
    el._edit = null;
    if (p.edit) {
      const m = await Data.member(p.edit); if (!m) return toast('সদস্য পাওয়া যায়নি', 'error');
      el._edit = m; UI.el(el, 'branch').value = m.branch; UI.el(el, 'branch').dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 300));
      UI.set(el, { ...m, ...(m.nominee ? { nomName: m.nominee.name, nomFather: m.nominee.father, nomMother: m.nominee.mother, nomPhone: m.nominee.phone, nomRelation: m.nominee.relation, nomNid: m.nominee.nid, nomAddr: m.nominee.address } : {}) });
      ['share', 'admitFee', 'passbookFee', 'branch', 'samity'].forEach(k => { const e = UI.el(el, k); e.readOnly = true; e.disabled = true; });
    }
  },
});
const Member = {
  geo() {
    const el = $('#page-memberAdd');
    if (!navigator.geolocation) return toast('লোকেশন সাপোর্ট নেই', 'error');
    navigator.geolocation.getCurrentPosition(p => { UI.el(el, 'lat').value = p.coords.latitude.toFixed(6); UI.el(el, 'lng').value = p.coords.longitude.toFixed(6); toast('📍 লোকেশন সেট হয়েছে'); }, e => toast('লোকেশন পাওয়া যায়নি: ' + e.message, 'error'), { enableHighAccuracy: true, timeout: 15000 });
  },
  save(btn) {
    const el = $('#page-memberAdd');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      if (f.mobile && !/^01\d{9}$/.test(f.mobile)) fail('মোবাইল নম্বর ১১ ডিজিট (01XXXXXXXXX) দিন');
      busy(true, 'সংরক্ষণ হচ্ছে...');
      try {
        const up = {};
        for (const k of ['photo', 'signature', 'document']) if (f[k]) up[k + 'Url'] = await uploadImage(f[k]);
        const data = {
          name: f.name, father: f.father, mother: f.mother, spouse: f.spouse, mobile: f.mobile, joinDate: f.joinDate, presentAddr: f.presentAddr, permAddr: f.permAddr,
          reference: f.reference, nid: f.nid, birthId: f.birthId, email: f.email, blood: f.blood, sex: f.sex, religion: f.religion, marital: f.marital, dob: f.dob,
          income: num(f.income), profession: f.profession, lat: f.lat, lng: f.lng,
          nominee: { name: f.nomName, father: f.nomFather, mother: f.nomMother, phone: f.nomPhone, relation: f.nomRelation, nid: f.nomNid, address: f.nomAddr }, ...up,
        };
        if (el._edit) {
          const m = el._edit; const b = db.batch();
          b.update(db.collection('members').doc(m.id), { ...data, updatedBy: App.user.userId, updatedAt: FV.serverTimestamp() });
          Idx.setMember(b, m.branch, { ...m, ...data, memberId: m.id });
          await b.commit(); toast('✅ সদস্যের তথ্য আপডেট হয়েছে'); App.go('memberList'); return;
        }
        // ডুপ্লিকেট NID/মোবাইল সতর্কতা
        const idx = await Data.members(f.branch);
        const dupM = idx.find(x => x.status !== 'closed' && ((f.nid && x.nid === f.nid) || x.mobile === f.mobile));
        if (dupM && !confirm(`সতর্কতা: ${dupM.id} - ${dupM.name} এর সাথে মোবাইল/NID মিলে যাচ্ছে। তবুও ভর্তি করবেন?`)) return;
        const seq = await nextSeq('member_' + f.branch);
        const memberId = f.branch + pad(seq, 5);
        const pending = !isBM();
        const sam = await Data.samity(f.samity);
        const mdoc = { memberId, branch: f.branch, samity: f.samity, ...data, status: pending ? 'pending' : 'active', shareAdmit: num(f.share), admitFee: num(f.admitFee), passbookFee: num(f.passbookFee), createdBy: App.user.userId, createdAt: FV.serverTimestamp() };
        const share = num(f.share), fee = num(f.admitFee), pbf = num(f.passbookFee);
        const shareAcc = 'S' + memberId;
        await Eng.post({
          branch: f.branch, date: f.joinDate, type: 'MEMBER_ADMISSION', narration: 'সদস্য ভর্তি ' + memberId + ' - ' + f.name, status: pending ? 'pending' : 'posted', authType: 'Member Admission', ref: { memberId },
          lines: [Eng.cashLine(share + fee + pbf, 0), { gl: REF.GL.share, cr: share, accNo: shareAcc }, { gl: REF.GL.admission, cr: fee }, { gl: REF.GL.passbook, cr: pbf }],
          txns: [share && { accNo: shareAcc, kind: 'share', type: 'share', memberId, samity: f.samity, foId: sam && sam.foId, tt: 'SHARE_RCV', amount: share, dc: 'C', narration: 'ভর্তি শেয়ার' },
            fee && { accNo: '', kind: 'fee', type: 'admission', memberId, samity: f.samity, foId: sam && sam.foId, tt: 'ADMISSION_FEE', amount: fee, dc: 'C' },
            pbf && { accNo: '', kind: 'fee', type: 'passbook', memberId, samity: f.samity, foId: sam && sam.foId, tt: 'PASSBOOK_FEE', amount: pbf, dc: 'C' }].filter(Boolean),
          accOps: share ? [{ accNo: shareAcc, samity: f.samity, inc: { balance: share, totCr: share }, snapInc: { b: share } }] : [],
          pre: async batch => {
            batch.set(db.collection('members').doc(memberId), mdoc);
            Idx.setMember(batch, f.branch, mdoc);
            const sa = { accNo: shareAcc, kind: 'share', type: 'share', branch: f.branch, memberId, samity: f.samity, title: f.name, openDate: f.joinDate, status: 'active', balance: 0, totCr: 0, totDr: 0, createdAt: FV.serverTimestamp() };
            batch.set(db.collection('accounts').doc(shareAcc), sa);
            Idx.setAccount(batch, f.branch, sa);
            batch.set(db.collection('snap').doc(f.samity), { a: { [shareAcc]: { m: memberId, k: 'share', t: 'share', b: 0, st: 'active', od: f.joinDate } } }, { merge: true });
          },
        });
        toast(pending ? `✅ সদস্য ${memberId} তৈরি হয়েছে — অনুমোদনের অপেক্ষায়` : `✅ সদস্য তৈরি হয়েছে — আইডি: ${memberId}`);
        UI.reset(el, ['branch', 'samity', 'joinDate']);
        UI.modal('✅ সদস্য ভর্তি সম্পন্ন', UI.info([['সদস্য আইডি', `<b style="font-size:18px">${memberId}</b>`], ['নাম', esc(f.name)], ['সমিতি', esc(f.samity)], ['শেয়ার', tk(share)], ['ভর্তি ফি', tk(fee)], ['পাসবই ফি', tk(pbf)]]),
          UI.btn('💰 ডিপোজিট একাউন্ট খুলুন', `this.closest('.modal').remove();App.go('depOpen',{member:'${memberId}'})`, 'btn-success') + UI.btn('🖨️ ভর্তি ফর্ম', `Member.printForm('${memberId}')`, 'btn-outline'));
      } finally { busy(false); }
    });
  },
  async printForm(id) {
    const m = await Data.member(id); if (!m) return;
    const n = m.nominee || {};
    printHTML('সদস্য ভর্তি ফর্ম', `<div style="display:flex;gap:14px">${m.photoUrl ? `<img src="${esc(m.photoUrl)}" style="width:110px;height:130px;object-fit:cover;border:1px solid #000">` : ''}<table>${[
      ['সদস্য আইডি', m.memberId], ['নাম', m.name], ['পিতা', m.father], ['মাতা', m.mother], ['স্বামী/স্ত্রী', m.spouse], ['মোবাইল', m.mobile], ['জাতীয় পরিচয়পত্র', m.nid], ['জন্ম তারিখ', fmtD(m.dob)],
      ['বর্তমান ঠিকানা', m.presentAddr], ['স্থায়ী ঠিকানা', m.permAddr], ['সমিতি', m.samity], ['ভর্তির তারিখ', fmtD(m.joinDate)], ['পেশা', m.profession], ['মাসিক আয়', m.income],
      ['শেয়ার', m.shareAdmit], ['ভর্তি ফি', m.admitFee], ['পাসবই ফি', m.passbookFee]].map(([a, b]) => `<tr><th style="width:30%;text-align:left">${a}</th><td>${esc(b == null ? '' : b)}</td></tr>`).join('')}</table></div>
      <h4>নমিনির তথ্য</h4><table>${[['নাম', n.name], ['পিতা', n.father], ['মাতা', n.mother], ['মোবাইল', n.phone], ['সম্পর্ক', n.relation], ['NID', n.nid], ['ঠিকানা', n.address]].map(([a, b]) => `<tr><th style="width:30%;text-align:left">${a}</th><td>${esc(b || '')}</td></tr>`).join('')}</table>
      ${m.signatureUrl ? `<div style="margin-top:20px">সদস্যের স্বাক্ষর: <img src="${esc(m.signatureUrl)}" style="height:50px"></div>` : ''}`, { branchName: m.branch });
  },
};

// ── সদস্য তালিকা ──
App.page('memberList', {
  title: 'সদস্য তালিকা', icon: '📋',
  render: () => `<div class="report-filter">${UI.grid([F.branch, { ...F.samity }, { k: 'name', l: 'সদস্যের নাম' }, { k: 'mobile', l: 'সদস্যের ফোন' }, { k: 'id', l: 'সদস্য আইডি' }, { k: 'nid', l: 'সদস্যের এনআইডি' }, { k: 'status', l: 'সদস্যের অবস্থা', t: 'select', opts: [['', 'All'], ['active', 'Active'], ['pending', 'Pending'], ['closed', 'Closed']] }], 4)}
    <div class="filter-actions">${UI.btn('🔍 সদস্য খুঁজুন', 'MemberList.search(this)')}${UI.btn('🖨️ প্রিন্ট', 'MemberList.print()', 'btn-outline')}${UI.btn('📥 Excel', 'MemberList.excel()', 'btn-outline')}${UI.btn('+ নতুন সদস্য', "App.go('memberAdd')", 'btn-success')}</div></div><div class="card ml"></div>`,
  init: async el => { await Pick.branch(el, 'branch'); await Pick.samity(el, 'samity', 'branch'); MemberList.search(); },
});
const MemberList = {
  cols(full) {
    const c = [
      { h: 'ছবি', f: r => r.photoUrl ? `<img src="${esc(r.photoUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : '' },
      { h: 'সদস্য আইডি', f: r => `<b>${r.id}</b>` }, { h: 'সদস্যের নাম', f: r => esc(r.name) }, { h: 'সমিতির নাম', f: r => esc(r.samity) }, { h: 'পিতার নাম', f: r => esc(r.father || '') },
    ];
    if (full) c.push({ h: 'মাতার নাম', f: r => esc(r.mother || '') }, { h: 'রক্তের গ্রুপ', f: r => r.blood || '' }, { h: 'লিঙ্গ', f: r => r.sex || '' }, { h: 'ধর্ম', f: r => r.religion || '' }, { h: 'বৈবাহিক অবস্থা', f: r => r.marital || '' });
    c.push({ h: 'জাতীয় পরিচয়পত্র', f: r => esc(r.nid || '') });
    if (full) c.push({ h: 'বর্তমান ঠিকানা', f: r => esc(r.presentAddr || '') }, { h: 'খোলার তারিখ', f: r => fmtD(r.joinDate) }, { h: 'জন্ম তারিখ', f: r => fmtD(r.dob) }, { h: 'ইউজার নাম', f: r => r.createdBy || '' });
    c.push({ h: 'মোবাইল', f: r => esc(r.mobile || '') }, { h: 'অবস্থা', f: r => r.status === 'closed' ? '<span class="tag red">Closed</span>' : r.status === 'pending' ? '<span class="tag orange">Pending</span>' : '<span class="tag green">Active</span>' });
    return c;
  },
  search(btn) {
    const el = $('#page-memberList');
    return guard(btn, async () => {
      const f = UI.get($('.report-filter', el));
      let rows, full = false;
      if (f.samity) { rows = (await db.collection('members').where('samity', '==', f.samity).get()).docs.map(d => ({ id: d.id, ...d.data() })); full = true; }
      else if (f.id) { const m = await Data.member(f.id); rows = m ? [m] : []; full = true; }
      else rows = await Data.members(f.branch);
      rows = rows.filter(r => (!f.name || (r.name || '').toLowerCase().includes(f.name.toLowerCase())) && (!f.mobile || (r.mobile || '').includes(f.mobile)) && (!f.id || r.id.includes(f.id)) && (!f.nid || (r.nid || '').includes(f.nid)) && (!f.status || (r.status || 'active') === f.status))
        .sort((a, b) => a.id.localeCompare(b.id));
      el._rows = rows; el._full = full;
      const cols = [...MemberList.cols(full), { h: 'Action', f: r => `<span class="list-actions">${UI.btn('👁️', `MemberList.view('${r.id}')`, 'btn-outline btn-sm')}${UI.btn('✏️', `App.go('memberAdd',{edit:'${r.id}'})`, 'btn-outline btn-sm')}${UI.btn('🖨️', `Member.printForm('${r.id}')`, 'btn-outline btn-sm')}</span>` }];
      $('.ml', el).innerHTML = `<div class="mini">মোট সদস্য: ${rows.length}${full ? '' : ' — বিস্তারিত কলামের জন্য সমিতি বাছাই করুন'}</div>` + UI.table(cols, rows.slice(0, 2000));
    });
  },
  print() { const el = $('#page-memberList'); printHTML('সদস্য তালিকা', UI.table(MemberList.cols(el._full).slice(1), el._rows || []), { landscape: true, noSig: true }); },
  excel() { const el = $('#page-memberList'); downloadExcel('member-list', UI.table(MemberList.cols(el._full).slice(1), el._rows || [])); },
  async view(id) {
    const m = await Data.member(id); if (!m) return;
    const accs = (await db.collection('accounts').where('memberId', '==', id).get()).docs.map(d => d.data());
    UI.modal('👤 ' + esc(m.name) + ' (' + id + ')', `<div style="display:flex;gap:12px;flex-wrap:wrap">${m.photoUrl ? `<img src="${esc(m.photoUrl)}" style="width:100px;height:120px;object-fit:cover;border-radius:8px">` : ''}${m.signatureUrl ? `<img src="${esc(m.signatureUrl)}" style="height:60px">` : ''}</div>`
      + UI.info([['মোবাইল', esc(m.mobile)], ['পিতা', esc(m.father || '')], ['সমিতি', esc(m.samity)], ['ভর্তির তারিখ', fmtD(m.joinDate)], ['NID', esc(m.nid || '')], ['ঠিকানা', esc(m.presentAddr || '')]])
      + '<h4 style="margin:12px 0 6px">একাউন্টসমূহ</h4>' + UI.table([{ h: 'একাউন্ট', f: a => a.accNo }, { h: 'ধরন', f: a => typeFull(a.kind, a.type) }, { h: 'খোলার তারিখ', f: a => fmtD(a.openDate) }, { h: 'ব্যালেন্স/বকেয়া', f: a => amt(a.balance), r: 1 }, { h: 'অবস্থা', f: a => a.status }], accs),
      UI.btn('📒 পাসবুক', `this.closest('.modal').remove();App.go('rptPassbook',{member:'${id}'})`, 'btn-outline') + UI.btn('📄 স্টেটমেন্ট', `this.closest('.modal').remove();App.go('rptMemberStatement',{member:'${id}'})`, 'btn-outline'));
  },
};

// ── সদস্য ক্লোজিং ──
App.page('memberClosing', {
  title: 'সদস্য ক্লোজিং', icon: '🚪',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'সদস্য আইডি', t: 'member', req: 1 }, { k: 'date', l: 'ক্লোজিং তারিখ', t: 'date', req: 1 }, { k: 'reason', l: 'ক্লোজিং মন্তব্য', req: 1 }], 4) + '<div class="maccs"></div>'
    + `<div class="actions">${UI.btn('✅ Submit Closing', 'MemberClose.save(this)', 'btn-danger')}${UI.btn('🗑️ Delete Member', 'MemberClose.del(this)', 'btn-outline')}</div>`)
    + UI.card('🔍 Search Closing', '<div class="cl"></div>'),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch');
    UI.el(el, 'date').value = await businessDate();
    UI.el(el, 'member').addEventListener('picked', async e => {
      if (!e.detail) return $('.maccs', el).innerHTML = '';
      const accs = (await db.collection('accounts').where('memberId', '==', e.detail.id).get()).docs.map(d => d.data()).filter(a => a.status !== 'closed');
      $('.maccs', el).innerHTML = UI.table([{ h: 'একাউন্ট', f: a => a.accNo }, { h: 'ধরন', f: a => typeFull(a.kind, a.type) }, { h: 'ব্যালেন্স/বকেয়া', f: a => amt(a.balance), r: 1 }], accs, { empty: 'কোনো খোলা একাউন্ট নেই' });
    });
    MemberClose.list();
  },
});
const MemberClose = {
  save(btn) {
    const el = $('#page-memberClosing');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      const accs = (await db.collection('accounts').where('memberId', '==', f.member).get()).docs.map(d => d.data()).filter(a => a.status !== 'closed');
      const open = accs.filter(a => r2(a.balance) !== 0);
      if (open.length) fail('এই সদস্যের ' + open.length + ' টি একাউন্টে ব্যালেন্স/বকেয়া আছে — আগে সেগুলো ক্লোজ করুন: ' + open.map(a => a.accNo).join(', '));
      const m = await Data.member(f.member);
      const b = db.batch();
      b.update(db.collection('members').doc(f.member), { status: 'closed', closeDate: f.date, closeReason: f.reason, closedBy: App.user.userId });
      accs.forEach(a => { b.update(db.collection('accounts').doc(a.accNo), { status: 'closed', closeDate: f.date }); Idx.setAccount(b, a.branch, { ...a, status: 'closed' }); if (a.samity) b.set(db.collection('snap').doc(a.samity), { a: { [a.accNo]: { st: 'closed' } } }, { merge: true }); });
      Idx.setMember(b, m.branch, { ...m, memberId: m.id, status: 'closed' });
      b.set(db.collection('memberClosings').doc(), { branch: m.branch, memberId: f.member, date: f.date, reason: f.reason, kind: 'Closing', by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); toast('✅ সদস্য ক্লোজ হয়েছে'); UI.reset(el, ['branch', 'date']); $('.maccs', el).innerHTML = ''; MemberClose.list();
    });
  },
  del(btn) {
    const el = $('#page-memberClosing');
    return guard(btn, async () => {
      const f = UI.get(el); if (!f.member) fail('সদস্য বাছাই করুন'); if (!isBM()) fail('অনুমতি নেই');
      const tx = await db.collection('txns').where('memberId', '==', f.member).limit(5).get();
      if (tx.docs.some(d => !d.data().cancelled)) fail('এই সদস্যের লেনদেন আছে — মুছা যাবে না, ক্লোজ করুন');
      if (!confirm('সদস্য ' + f.member + ' সম্পূর্ণ মুছে ফেলবেন?')) return;
      const m = await Data.member(f.member);
      const accs = (await db.collection('accounts').where('memberId', '==', f.member).get()).docs;
      const b = db.batch();
      accs.forEach(d => { b.delete(d.ref); Idx.delAccount(b, m.branch, d.id); if (d.data().samity) b.update(db.collection('snap').doc(d.data().samity), { ['a.' + d.id]: FV.delete() }); });
      b.delete(db.collection('members').doc(f.member)); Idx.delMember(b, m.branch, f.member);
      b.set(db.collection('memberClosings').doc(), { branch: m.branch, memberId: f.member, date: f.date, reason: f.reason || 'Deleted', kind: 'Delete', by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); toast('🗑️ সদস্য মুছে ফেলা হয়েছে'); MemberClose.list();
    });
  },
  async list() {
    const el = $('#page-memberClosing');
    const s = await db.collection('memberClosings').where('branch', '==', UI.el(el, 'branch').value).get();
    const rows = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('.cl', el).innerHTML = UI.table([{ h: 'Member ID', f: r => r.memberId }, { h: 'Closing Date', f: r => fmtD(r.date) }, { h: 'Closing Reason', f: r => esc(r.reason || '') }, { h: 'Delete/Closing', f: r => r.kind }, { h: 'Closed By', f: r => r.by }, { h: 'Closed On', f: r => tsStr(r.on) }, { h: 'Cancel By', f: r => r.cancelBy || '' },
      { h: 'Action', f: r => r.kind === 'Closing' && !r.cancelBy ? UI.btn('↩️ বাতিল', `MemberClose.undo('${r.id}','${r.memberId}')`, 'btn-outline btn-sm') : '' }], rows);
  },
  async undo(id, memberId) {
    if (!confirm('ক্লোজিং বাতিল করে সদস্য আবার সক্রিয় করবেন?')) return;
    const m = await Data.member(memberId); const b = db.batch();
    b.update(db.collection('members').doc(memberId), { status: 'active' }); Idx.setMember(b, m.branch, { ...m, memberId, status: 'active' });
    b.update(db.collection('memberClosings').doc(id), { cancelBy: App.user.userId, cancelOn: FV.serverTimestamp() });
    await b.commit(); toast('✅ সদস্য আবার সক্রিয়'); MemberClose.list();
  },
};

// ── সদস্য সমিতি স্থানান্তর ──
App.page('memberTransfer', {
  title: 'সদস্য সমিতি স্থানান্তর', icon: '🔀',
  render: () => UI.card('', UI.grid([F.branch, { k: 'member', l: 'Member Name', t: 'member', req: 1 }, { k: 'cur', l: 'বর্তমান সমিতি', ro: 1 }, { k: 'samity', l: 'Transfer Samity', t: 'select', req: 1 }], 4) + `<div class="actions">${UI.btn('🔀 Submit Transfer', 'MemberTransfer.run(this)', 'btn-success')}</div>`),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.member(el, 'member', 'branch'); await Pick.samity(el, 'samity', 'branch', { all: false });
    UI.el(el, 'member').addEventListener('picked', e => { UI.el(el, 'cur').value = e.detail ? e.detail.samity : ''; });
  },
});
const MemberTransfer = {
  run(btn) {
    const el = $('#page-memberTransfer');
    return guard(btn, async () => {
      UI.validate(el); const f = UI.get(el);
      const m = await Data.member(f.member); if (m.samity === f.samity) fail('একই সমিতি');
      const accs = (await db.collection('accounts').where('memberId', '==', f.member).get()).docs.map(d => d.data());
      const oldSnap = (await db.collection('snap').doc(m.samity).get()).data() || { a: {} };
      const b = db.batch();
      b.update(db.collection('members').doc(f.member), { samity: f.samity });
      Idx.setMember(b, m.branch, { ...m, memberId: m.id, samity: f.samity });
      accs.forEach(a => {
        b.update(db.collection('accounts').doc(a.accNo), { samity: f.samity }); Idx.setAccount(b, a.branch, { ...a, samity: f.samity });
        const s = (oldSnap.a || {})[a.accNo];
        if (s) { b.update(db.collection('snap').doc(m.samity), { ['a.' + a.accNo]: FV.delete() }); b.set(db.collection('snap').doc(f.samity), { a: { [a.accNo]: s } }, { merge: true }); }
      });
      b.set(db.collection('memberTransfers').doc(), { branch: m.branch, memberId: m.id, from: m.samity, to: f.samity, date: await businessDate(m.branch), by: App.user.userId, on: FV.serverTimestamp() });
      await b.commit(); toast('✅ সদস্য ' + m.id + ' সমিতি ' + f.samity + ' তে স্থানান্তর হয়েছে'); UI.reset(el, ['branch']);
    });
  },
};
