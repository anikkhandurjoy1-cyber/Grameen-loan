// ═══════════════════════════════════════════════════════════════
// রসিদ / ভাউচার প্রিন্ট — eKisti এর হুবহু ফরম্যাট
// Installment Receive Voucher, Installment Collection Voucher, Deposit Receive/Payment Voucher,
// Payment / Receipt / Journal Voucher (টাকা কথায় সহ)
// ═══════════════════════════════════════════════════════════════
const RCPT_CSS = `<style>.rv{font-size:14px}.rv .row2{display:flex;justify-content:space-between}.rv .row2>div{width:50%}.rv .row2>div:last-child{text-align:left;padding-left:30%}
  .rv table td{font-size:13px;padding:3px 4px}.rv .big{display:flex;justify-content:flex-end;gap:30px;font-size:22px;font-weight:700;color:#0a5c0a;margin:8px 0}
  .rv .sg{display:flex;justify-content:space-between;margin-top:60px}.rv .sg div{width:42%;border-top:1px solid #000;text-align:center;font-weight:700;padding-top:3px;font-size:13px}
  table.vh thead th{background:#1d3557!important;color:#fff;font-size:12px;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .vmeta{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}.vbox{border:1px solid #ccc;background:#f6f7f9;text-align:center;padding:6px;margin:6px 0;font-size:13px}
  .vsg{display:flex;justify-content:space-between;margin-top:55px}.vsg div{width:30%;border-top:1px solid #000;text-align:center;padding-top:3px;font-size:13px}</style>`;

// টাকার অংক কথায় (eKisti: "Twelve Thousand, One Hundred And Fifty Taka Only")
function amountInWords(n) {
  n = Math.round(num(n));
  if (!n) return 'Zero Taka Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const h = x => { let s = ''; if (x >= 100) { s += a[Math.floor(x / 100)] + ' Hundred'; x %= 100; if (x) s += ' And '; } if (x >= 20) { s += t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''); } else if (x) s += a[x]; return s; };
  const parts = []; const units = [[10000000, 'Crore'], [100000, 'Lac'], [1000, 'Thousand']];
  let x = Math.abs(n);
  for (const [v, w] of units) if (x >= v) { parts.push(h(Math.floor(x / v)) + ' ' + w); x %= v; }
  if (x) parts.push(h(x));
  return (n < 0 ? 'Minus ' : '') + parts.join(', ') + ' Taka Only';
}

const Receipt = {
  // লেনদেনের আগে/পরে একাউন্ট ব্যালেন্স
  async balances(accNo, v, delta) {
    const a = await Data.account(accNo); if (!a) return { before: 0, after: 0, a: {} };
    const ts = (await db.collection('txns').where('accNo', '==', accNo).get()).docs.map(d => d.data()).filter(t => !t.cancelled);
    const later = sum(ts.filter(t => t.date > v.date || (t.date === v.date && t.vno > v.vno)), t => t.delta);
    const after = r2(num(a.balance) - later); return { before: r2(after - num(delta)), after, a };
  },
  async print(vno) {
    const vd = await db.collection('vouchers').doc(vno).get(); if (!vd.exists) return toast('ভাউচার পাওয়া যায়নি', 'error');
    const v = vd.data();
    const ts = (await db.collection('txns').where('vno', '==', vno).get()).docs.map(d => d.data()).filter(t => t.accNo).sort((a, b) => a.accNo.localeCompare(b.accNo));
    const mid = (ts.find(t => t.memberId) || {}).memberId; const m = mid ? await Data.member(mid) : null;
    const kinds = new Set(ts.map(t => t.kind)); const accs = new Set(ts.map(t => t.accNo));
    if (!ts.length || !m) return Voucher.print(vno);
    if (accs.size > 1 || v.type === 'SHEET' || v.type === 'MEMBER_COLL' || /SHEET|COLL/.test(v.type || '')) return Receipt.collection(v, ts, m);
    if (kinds.has('loan')) return Receipt.emi(v, ts[0], m);
    return Receipt.deposit(v, ts[0], m);
  },
  head(v, m, extraLeft = '', extraRight = '') {
    return `<div class="row2"><div><b>Voucher No :</b> ${v.vno}</div><div><b>Posting Time :</b> ${tsStr(v.on)}</div></div>
      <div class="row2"><div><b>Member Details :</b> ${esc(m.memberId + ' - ' + m.name)}</div><div><b>Receive Date :</b> ${fmtD(v.date)}</div></div>
      <div class="row2"><div><b>Phone :</b> ${esc(m.mobile || '')}</div><div>${extraRight}</div></div>${extraLeft}`;
  },
  sign(v) { return `<div class="sg"><div>Receipt By: ${esc(v.byName || '')}</div><div>Customer Signature</div></div>`; },
  // কিস্তি জমার রসিদ — Installment Receive Voucher
  async emi(v, t, m) {
    const { before, after, a } = await Receipt.balances(t.accNo, v, t.delta);
    const body = RCPT_CSS + `<div class="rv">${Receipt.head(v, m)}
      <table><tr><td><b>Loan No</b></td><td>${a.accNo || t.accNo}</td><td><b>Balance Before Payment</b></td><td class="r">${amt(before)}</td></tr>
      <tr><td><b>Expire Date</b></td><td>${fmtD(a.expDate)}</td><td><b>Balance After Payment</b></td><td class="r">${amt(after)}</td></tr>
      <tr><td><b>Installment Amount</b></td><td>${amt(a.instAmount)}</td><td><b>Charge Receive</b></td><td class="r">${amt(t.penalty || 0)}</td></tr></table>
      <div class="big"><span>Todays Receive</span><span style="font-weight:400">${amt(num(t.amount) + num(t.penalty))}</span></div>${Receipt.sign(v)}</div>`;
    printHTML('Installment Receive Voucher', body, { addr: true, noSig: true });
  },
  // সঞ্চয়/শেয়ার জমা-ফেরত — Deposit Receive / Payment Voucher
  async deposit(v, t, m) {
    const { before, after, a } = await Receipt.balances(t.accNo, v, t.delta);
    const isRcv = t.dc === 'C';
    const body = RCPT_CSS + `<div class="rv">${Receipt.head(v, m)}
      <table><tr><td><b>Account No</b></td><td>${t.accNo}</td><td><b>Balance Before ${isRcv ? 'Deposit' : 'Payment'}</b></td><td class="r">${amt(before)}</td></tr>
      <tr><td><b>Account Type</b></td><td>${esc(typeFull(t.kind, t.type))}</td><td><b>Balance After ${isRcv ? 'Deposit' : 'Payment'}</b></td><td class="r">${amt(after)}</td></tr>
      ${a.instAmount ? `<tr><td><b>Installment Amount</b></td><td>${amt(a.instAmount)}</td><td><b>Document No</b></td><td>${esc(t.docNo || v.docNo || '')}</td></tr>` : ''}</table>
      <div class="big"><span>Todays ${isRcv ? 'Receive' : 'Payment'}</span><span style="font-weight:400">${amt(t.amount)}</span></div>
      <div style="font-size:12px">${esc(amountInWords(t.amount))}</div>${Receipt.sign(v)}</div>`;
    printHTML(isRcv ? 'Deposit Receive Voucher' : 'Deposit Payment Voucher', body, { addr: true, noSig: true });
  },
  // একাধিক একাউন্ট — Installment Collection Voucher
  async collection(v, ts, m) {
    const rows = [];
    for (const t of ts) { const b = await Receipt.balances(t.accNo, v, t.delta); rows.push({ t, bal: b.after }); }
    const tot = sum(ts, t => num(t.amount) + num(t.penalty));
    const body = RCPT_CSS + `<div class="rv"><div class="row2"><div><b>Member Name :</b> ${esc(m.name)}</div><div><b>Member ID :</b> ${esc(m.memberId)}</div></div>
      <div class="row2"><div><b>Receive Date :</b> ${fmtD(v.date)}</div><div><b>Voucher No :</b> ${v.vno}</div></div>`
      + UI.table([{ h: 'ক্রমিক নং', sl: 1 }, { h: 'Account Type', f: x => esc(typeName(x.t.kind, x.t.type)) }, { h: 'Account ID', f: x => x.t.accNo }, { h: 'Todays Receive', f: x => amt(x.t.amount), r: 1 }, { h: 'Penalty', f: x => amt(x.t.penalty || 0), r: 1 }, { h: 'Balance', f: x => amt(x.bal), r: 1 }], rows)
      + `<div class="big" style="font-size:18px"><span>Total Receive :</span><span style="font-weight:400">${amt(tot)}</span></div>${Receipt.sign(v)}</div>`;
    printHTML('Installment Collection Voucher', body, { noSig: true });
  },
};

// সাধারণ ভাউচার — Payment / Receipt / Journal Voucher (eKisti finance-report-voucher)
const Voucher = {
  async print(vno) {
    const vd = await db.collection('vouchers').doc(vno).get(); if (!vd.exists) return toast('ভাউচার পাওয়া যায়নি', 'error');
    const v = vd.data(); const lm = await Data.ledgerMap();
    const cashGl = Object.keys(lm).filter(c => lm[c].cashBank || c.startsWith('111'));
    const cashDr = sum(v.lines.filter(l => cashGl.includes(l.gl)), l => l.dr), cashCr = sum(v.lines.filter(l => cashGl.includes(l.gl)), l => l.cr);
    const title = cashCr && !cashDr ? 'Payment Voucher' : cashDr && !cashCr ? 'Receipt Voucher' : 'Journal Voucher';
    const titles = {}; for (const l of v.lines) if (l.accNo && !titles[l.accNo]) { const a = await Data.account(l.accNo); titles[l.accNo] = a ? a.title : l.accNo; }
    const person = Object.values(titles)[0] || v.payer || '';
    const personPhone = ((v.ref || {}).payerPhone) || '';
    const lines = v.lines.map(l => ({ ...l, part: l.accNo ? titles[l.accNo] : (lm[l.gl] || {}).name || l.gl }));
    const tot = sum(lines, l => l.dr);
    const body = RCPT_CSS + `<div class="vmeta"><span><b>Voucher No. :</b> ${v.vno}</span><span><b>Posting Time :</b> ${tsStr(v.on)}</span></div>
      <div class="vmeta"><span><b>Dated :</b> ${fmtD(v.date)}</span><span><b>Transaction Type :</b> ${esc(v.type || '—')}</span></div>
      ${person || personPhone ? `<div class="vbox">Person Name : <b>${esc(person)}</b> &nbsp;|&nbsp; Person Phone : <b>${esc(personPhone)}</b></div>` : ''}`
      + UI.table([{ h: 'ক্রমিক নং', sl: 1 }, { h: 'Particulars', f: l => esc(l.part) }, { h: 'Details', f: l => esc(l.memo || v.narration || '') }, { h: 'Doc No', f: l => esc(l.accNo || v.docNo || '') }, { h: 'Debit', f: l => l.dr ? amt(l.dr) : '', r: 1, sum: 1, v: l => l.dr }, { h: 'Credit', f: l => l.cr ? amt(l.cr) : '', r: 1, sum: 1, v: l => l.cr }], lines, { cls: 'vh', totalLabel: 'Total' })
      + `<div style="margin-top:8px;font-size:13px"><b>Amount In Words:</b> ${esc(amountInWords(tot))}</div><div style="font-size:13px"><b>Comments:</b> ${esc(v.narration || '')}</div>
      <div class="vsg"><div>${esc(v.byName || '')}<br>Prepared By</div><div>${esc(v.authBy || v.byName || '')}<br>Authorized By</div><div><br>Director</div></div>`
      + (v.status === 'cancelled' ? '<div style="color:#c00;font-weight:700;text-align:center;margin-top:8px">*** বাতিলকৃত ভাউচার ***</div>' : '');
    printHTML(title, body, { addr: true, noSig: true, info: [['Mobile', esc(App.org.mobile || '')]] });
  },
};
