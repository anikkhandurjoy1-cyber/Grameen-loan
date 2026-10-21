// ═══════════════════════════════════════════════════════════════
// ইউজার সিটিং — নতুন ইউজার, তালিকা, পদ/ইউজার ভিত্তিক পারমিশন
// ═══════════════════════════════════════════════════════════════
const USER_API = '/api/manageUser'; // Vercel serverless (পাসওয়ার্ড রিসেট/ডিলিট)
const genPass = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let p = ''; for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)]; return p; };
async function groupNames() { const s = await db.collection('permGroups').get(); const n = s.docs.map(d => d.id); return n.length ? n : Object.keys(DEFAULT_GROUPS); }
// লিমিট চেক: সীমা ছাড়ালে লেনদেন অনুমোদনের জন্য pending
function needsAuth(kind, amount) {
  if (!App.user || isBM()) return false;
  const lim = num((App.user.limits || {})[kind]);
  return lim > 0 && num(amount) > lim;
}

const USER_FIELDS = [
  { k: 'branch', l: 'Branch Name', t: 'select', req: 1 }, { k: 'empId', l: 'Select Employee', t: 'select' }, { k: 'userId', l: 'User ID', req: 1, hint: 'লগইনের জন্য (ইংরেজি, স্পেস ছাড়া)' },
  { k: 'name', l: 'নাম', req: 1 }, { k: 'group', l: 'Permission Group', t: 'select', req: 1 }, { k: 'password', l: 'Password (খালি = অটো)', t: 'text' },
  { k: 'withdraw', l: 'Withdraw Limit', t: 'number', v: 0 }, { k: 'deposit', l: 'Deposit Limit', t: 'number', v: 0 }, { k: 'vrcv', l: 'Voucher Receive Limit', t: 'number', v: 0 },
  { k: 'vpay', l: 'Voucher Payment Limit', t: 'number', v: 0 }, { k: 'cash', l: 'Total Cash Limit', t: 'number', v: 0 }, { k: 'mobile', l: 'Mobile Number' },
  { k: 'email', l: 'Email Address' },
  { t: 'html', span: 3, html: '<div class="form-group"><label>Branch Permissions (অতিরিক্ত শাখা)</label><select data-k="branches" multiple size="4"></select></div>' },
  { k: 'hideBal', l: 'Hide Account Balance', t: 'checkbox' }, { k: 'controlling', l: 'Controlling Office User', t: 'checkbox' }, { k: 'bm', l: 'Branch Manager', t: 'checkbox' }, { k: 'backDate', l: 'Back Date Posting', t: 'checkbox' },
];
App.page('userCreate', {
  title: 'নতুন ইউজার তৈরি', icon: '👤',
  render: () => UI.card('', UI.grid(USER_FIELDS, 3) + `<div class="actions">${UI.btn('✅ Create New User', 'Users.create(this)', 'btn-success')}</div><div class="newcred"></div>`),
  init: async el => {
    await Pick.branch(el, 'branch'); await Pick.employee(el, 'empId', 'branch', { blank: '- Select an option -' });
    UI.fill(UI.el(el, 'group'), await groupNames(), g => g, g => g, '- Select an option -');
    const bs = await Data.branches(); UI.el(el, 'branches').innerHTML = UI.opts(bs, b => b.code, b => b.code + '-' + b.name, null);
    UI.el(el, 'empId').addEventListener('change', async () => { const e = (await Data.employees(UI.el(el, 'branch').value)).find(x => x.empId === UI.el(el, 'empId').value); if (e) { UI.el(el, 'name').value = e.name; UI.el(el, 'mobile').value = e.mobile || ''; } });
  },
});
const Users = {
  create(btn) {
    const el = $('#page-userCreate');
    return guard(btn, async () => {
      if (!isAdmin()) fail('শুধু Super Admin ইউজার তৈরি করতে পারবেন');
      UI.validate(el); const f = UI.get(el);
      const userId = f.userId.toLowerCase().replace(/\s+/g, '');
      if (!/^[a-z0-9._-]{3,}$/.test(userId)) fail('User ID শুধু ইংরেজি অক্ষর/সংখ্যা (কমপক্ষে ৩)');
      const dup = await db.collection('users').where('userId', '==', userId).get(); if (!dup.empty) fail('এই User ID আগে থেকে আছে');
      const pass = f.password || genPass(); if (pass.length < 6) fail('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর');
      const email = userId + LOGIN_DOMAIN;
      const sec = firebase.apps.find(a => a.name === 'sec') || firebase.initializeApp(firebaseConfig, 'sec');
      const cred = await sec.auth().createUserWithEmailAndPassword(email, pass);
      const uid = cred.user.uid; try { await sec.auth().signOut(); } catch (e) {}
      const branches = [...UI.el(el, 'branches').selectedOptions].map(o => o.value);
      await db.collection('users').doc(uid).set({
        uid, userId, email, name: f.name, empId: f.empId || '', branch: f.branch, branches, group: f.group, mobile: f.mobile, contactEmail: f.email,
        limits: { withdraw: num(f.withdraw), deposit: num(f.deposit), vrcv: num(f.vrcv), vpay: num(f.vpay), cash: num(f.cash) },
        flags: { hideBal: f.hideBal, controlling: f.controlling, bm: f.bm, backDate: f.backDate }, status: 'active', pages: [],
        createdBy: App.user.userId, createdAt: FV.serverTimestamp(),
      });
      $('.newcred', el).innerHTML = `<div class="alert alert-success" style="margin-top:10px">✅ ইউজার তৈরি হয়েছে — <b>User ID: ${esc(userId)}</b> &nbsp; <b>Password: ${esc(pass)}</b> (কপি করে রাখুন)</div>`;
      UI.reset(el, ['branch']);
    });
  },
  async resetPass(uid, userId) {
    if (!confirm(userId + ' এর পাসওয়ার্ড রিসেট করবেন?')) return;
    const pass = genPass();
    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch(USER_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'resetPassword', uid, password: pass }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'API কাজ করছে না');
      await db.collection('users').doc(uid).update({ passwordResetAt: FV.serverTimestamp(), passwordResetBy: App.user.userId });
      UI.modal('🔑 নতুন পাসওয়ার্ড', `<div class="alert alert-success">User ID: <b>${esc(userId)}</b><br>নতুন Password: <b>${esc(pass)}</b></div>`);
    } catch (e) { toast('রিসেট ব্যর্থ: ' + e.message, 'error'); }
  },
  async toggle(uid, st) {
    await db.collection('users').doc(uid).update({ status: st === 'active' ? 'inactive' : 'active' });
    // Firebase Auth-এও নিষ্ক্রিয়/সক্রিয় (Vercel API থাকলে)
    try { const token = await auth.currentUser.getIdToken(); await fetch(USER_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: st === 'active' ? 'disable' : 'enable', uid }) }); } catch (e) {}
    toast('✅ পরিবর্তন হয়েছে'); App.render('userList');
  },
  async edit(uid) {
    const d = (await db.collection('users').doc(uid).get()).data();
    const fields = USER_FIELDS.filter(f => !['userId', 'password', 'empId'].includes(f.k));
    const m = UI.modal('✏️ ইউজার এডিট — ' + esc(d.userId), UI.grid(fields, 3), UI.btn('💾 সংরক্ষণ', 'Users.saveEdit(this)', 'btn-success'));
    m.dataset.uid = uid;
    await Pick.branch(m, 'branch'); UI.fill(UI.el(m, 'group'), await groupNames(), g => g, g => g, null);
    const bs = await Data.branches(); UI.el(m, 'branches').innerHTML = UI.opts(bs, b => b.code, b => b.code + '-' + b.name, null);
    UI.set(m, { ...d, ...(d.limits || {}), ...(d.flags || {}), email: d.contactEmail || '' });
    [...UI.el(m, 'branches').options].forEach(o => o.selected = (d.branches || []).includes(o.value));
  },
  saveEdit(btn) {
    const m = btn.closest('.modal');
    return guard(btn, async () => {
      const f = UI.get(m);
      await db.collection('users').doc(m.dataset.uid).update({
        name: f.name, branch: f.branch, group: f.group, mobile: f.mobile, contactEmail: f.email, branches: [...UI.el(m, 'branches').selectedOptions].map(o => o.value),
        limits: { withdraw: num(f.withdraw), deposit: num(f.deposit), vrcv: num(f.vrcv), vpay: num(f.vpay), cash: num(f.cash) },
        flags: { hideBal: f.hideBal, controlling: f.controlling, bm: f.bm, backDate: f.backDate }, updatedBy: App.user.userId, updatedAt: FV.serverTimestamp(),
      });
      m.remove(); toast('✅ আপডেট হয়েছে'); App.render('userList');
    });
  },
};
App.page('userList', {
  title: 'ইউজার তালিকা', icon: '👥',
  render: () => `<div class="report-filter">${UI.grid([{ k: 'branch', l: 'Branch Name', t: 'select' }, { k: 'q', l: 'User ID / নাম' }], 4)}<div class="filter-actions">${UI.btn('🔍 Search User', "App.render('userList')")}</div></div><div class="card ul"></div>`,
  init: async el => {
    await Pick.branch(el, 'branch', { all: true });
    const f = UI.get(el); let rows = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    if (f.branch) rows = rows.filter(r => r.branch === f.branch || (r.branches || []).includes(f.branch));
    if (f.q) rows = rows.filter(r => (r.userId + ' ' + r.name).toLowerCase().includes(f.q.toLowerCase()));
    $('.ul', el).innerHTML = UI.table([
      { h: 'Branch Code', f: r => r.branch || 'সব' }, { h: 'Employee ID', f: r => r.empId || '' }, { h: 'Name', f: r => esc(r.name || '') }, { h: 'User Name', f: r => esc(r.userId || r.email) },
      { h: 'Group', f: r => esc(r.group || '') }, { h: 'User Status', f: r => r.status === 'inactive' ? '<span class="tag red">Inactive</span>' : '<span class="tag green">Active</span>' }, { h: 'Last Activity', f: r => tsStr(r.lastActivity) },
      { h: 'Action', f: r => `<span class="list-actions">${UI.btn('✏️', `Users.edit('${r.id}')`, 'btn-outline btn-sm')}${UI.btn('🔑', `Users.resetPass('${r.id}','${esc(r.userId)}')`, 'btn-warning btn-sm')}${r.id !== App.user.uid ? UI.btn(r.status === 'inactive' ? '✅' : '⛔', `Users.toggle('${r.id}','${r.status || 'active'}')`, 'btn-secondary btn-sm') : ''}</span>` },
    ], rows);
  },
});

// ── পারমিশন চেকলিস্ট ──
function permChecklist(selected) {
  const sel = new Set(selected || []);
  return MENU.map(sec => {
    const items = sec.page ? [[sec.t, sec.page]] : sec.items;
    const uniq = items.filter(([, p], i) => items.findIndex(x => x[1] === p) === i);
    return `<div class="perm-sec" style="margin-bottom:10px"><label style="font-weight:700;color:var(--primary)"><input type="checkbox" onchange="$$('input[data-p]',this.closest('.perm-sec')).forEach(c=>c.checked=this.checked)"> ${esc(sec.t)}</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px 10px;padding-left:18px">${uniq.map(([t, p]) => `<label style="font-size:13px"><input type="checkbox" data-p="${p}" ${sel.has(p) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div></div>`;
  }).join('');
}
const readPerms = root => [...new Set($$('input[data-p]:checked', root).map(c => c.dataset.p))];
App.page('groupPerm', {
  title: 'পদ ভিত্তিক পারমিশন', icon: '🛡️',
  render: () => UI.card('', UI.grid([{ k: 'group', l: 'Group Name', t: 'select' }, { k: 'newGroup', l: 'নতুন Group Name (ঐচ্ছিক)' }], 3) + '<div class="pl"></div>' + `<div class="actions">${UI.btn('💾 Save', 'GroupPerm.save(this)', 'btn-success')}</div>`),
  init: async el => {
    UI.fill(UI.el(el, 'group'), await groupNames(), g => g, g => g, null);
    const load = async () => { const g = await db.collection('permGroups').doc(UI.el(el, 'group').value).get(); $('.pl', el).innerHTML = UI.el(el, 'group').value === 'Super Admin' ? '<div class="alert alert-info">Super Admin সব পেজ দেখতে পারে।</div>' : permChecklist(g.exists ? g.data().pages : []); };
    UI.el(el, 'group').addEventListener('change', load); await load();
  },
});
const GroupPerm = {
  save(btn) {
    const el = $('#page-groupPerm');
    return guard(btn, async () => {
      if (!isAdmin()) fail('শুধু Super Admin');
      const f = UI.get(el); const name = (f.newGroup || f.group).trim(); if (!name) fail('Group দিন');
      await db.collection('permGroups').doc(name).set({ name, pages: readPerms(el), updatedBy: App.user.userId, updatedAt: FV.serverTimestamp() });
      toast('✅ ' + name + ' পারমিশন সংরক্ষণ হয়েছে');
    });
  },
};
App.page('userPerm', {
  title: 'ইউজার ভিত্তিক পারমিশন', icon: '🛡️',
  render: () => UI.card('', UI.grid([{ k: 'branch', l: 'Branch Name', t: 'select' }, { k: 'user', l: 'User Name', t: 'select' }], 3) + '<div class="mini">টিক দেওয়া থাকলে গ্রুপের বদলে এই পারমিশন কাজ করবে। সব টিক তুলে সংরক্ষণ করলে আবার গ্রুপের পারমিশন চলবে।</div><div class="pl" style="margin-top:8px"></div>' + `<div class="actions">${UI.btn('💾 Save', 'UserPerm.save(this)', 'btn-success')}</div>`),
  init: async el => {
    await Pick.branch(el, 'branch', { all: true });
    const users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const fillU = () => { const b = UI.el(el, 'branch').value; UI.fill(UI.el(el, 'user'), users.filter(u => !b || u.branch === b), u => u.id, u => (u.userId || u.email) + ' — ' + (u.group || ''), '------------'); };
    const load = () => { const u = users.find(x => x.id === UI.el(el, 'user').value); $('.pl', el).innerHTML = u ? permChecklist(u.pages || []) : ''; };
    UI.el(el, 'branch').addEventListener('change', () => { fillU(); load(); }); UI.el(el, 'user').addEventListener('change', load); fillU();
  },
});
const UserPerm = {
  save(btn) {
    const el = $('#page-userPerm');
    return guard(btn, async () => { if (!isAdmin()) fail('শুধু Super Admin'); const uid = UI.el(el, 'user').value; if (!uid) fail('ইউজার বাছাই করুন'); await db.collection('users').doc(uid).update({ pages: readPerms(el) }); toast('✅ সংরক্ষণ হয়েছে'); });
  },
};
