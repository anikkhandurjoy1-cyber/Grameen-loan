// ═══════════════════════════════════════════════════════════════
// Reference data — eKisti (grammenasharalo.ekisti.com) থেকে হুবহু নেওয়া
// Chart of Accounts, ডিপোজিট/লোন প্রোডাক্ট, DPS শিডিউল, মেনু
// ═══════════════════════════════════════════════════════════════
window.REF = (function () {
  // [code, name, parent, leaf]
  const COA = [
    ['10000000','ASSET','',0],['11100000','CASH & BANK BALANCE','10000000',0],['11110001','Cash In Hand','11100000',1],['11120001','Sonali Bank Limited','11100000',1],
    ['11200000','LOAN TO MEMBER','10000000',0],['11200001','General Loan','11200000',1],['11200002','Product Loan','11200000',1],['11200003','CC Loan','11200000',1],['11200004','Loan Against FDR','11200000',1],
    ['11250000','LOAN TO STAFF','10000000',0],['11250001','Staff Loan','11250000',1],
    ['11300000','LOAN PROFIT RECEIBABLE','10000000',0],['11300001','Profit Receivable General Loan','11300000',1],['11300002','Profit Receivable Product  Loan','11300000',1],['11300003','Profit Receivable CC Loan','11300000',1],['11300004','Interest Receivable Loan Against FDR','11300000',1],
    ['11700000','FIXED ASSET','10000000',0],['11700001','Office Equipment','11700000',1],['11700002','Furniture & Fixture','11700000',1],['11700003','Land & Building','11700000',1],
    ['11800000','INTER BRANCH LEDGER','10000000',0],['11800001','Other Branch Receivable','11800000',1],
    ['11900000','INVENTORY','10000000',0],['11900001','Cost of Good Sold','11900000',1],
    ['20000000','LIABILITIES & EQUITY','',0],['20010000','Adjustment','20000000',1],
    ['21100000','MEMBER SAVING FUND','20000000',0],['21100001','General Savings','21100000',1],['21100002','Member Share','21100000',1],['21100003','Security Savings','21100000',1],
    ['21200000','MEMBER DPS FUND','20000000',0],['21200001','3 Year MDPS','21200000',1],['21200002','5 Year MDPS','21200000',1],['21200003','7 Year MDPS','21200000',1],['21200004','10 Year MDPS','21200000',1],
    ['21300000','MEMBER FIXED DEPOSIT FUND','20000000',0],['21300001','FDR ( Monthly profit)','21300000',1],['21300002','2 Year FDR','21300000',1],['21300003','FDR ( Yearty profit)','21300000',1],['21300004','FDR ( Maturity profit)','21300000',1],['21300005','5 Year FDR','21300000',1],
    ['21500000','PROFIT PAYABLE (SAVINGS )','20000000',0],['21500002','Profit Payable General Savings','21500000',1],['21500003','Profit Payable Security Savings','21500000',1],
    ['21600000','PROFIT PAYABLE (DPS)','20000000',0],['21600001','Profit Payable 3 Year MDPS','21600000',1],['21600002','Profit Payable 5 Year MDPS','21600000',1],['21600003','Profit Payable 7 Year MDPS','21600000',1],['21600004','Profit Payable 10 Year MDPS','21600000',1],
    ['21700000','PROFIT PAYABLE (FDR)','20000000',0],['21700001','Profit Payable (Monthly Profit)','21700000',1],['21700002','Profit Payable 2 Year FDR','21700000',1],['21700003','Profit Payable (Yearly Profit)','21700000',1],['21700004','Profit Payable (Maturity Profit)','21700000',1],['21700005','Profit Payable 5 Year FDR','21700000',1],
    ['21800000','DIRECTOR FUND','20000000',0],['21800001','Director Account','21800000',1],
    ['21900000','SUPPLIER BILL PAYABLE','20000000',0],['21900001','Supplier Payable','21900000',1],
    ['21910000','STUFF LIABILITIES','20000000',0],['21910001','Employee Salary','21910000',1],['21910002','Provident Fund','21910000',1],['21910003','Gratuity Fund','21910000',1],['21910004','Staff Security Deposit','21910000',1],
    ['22000000','INTER BRANCH LEDGER','20000000',0],['22000001','Other Branch Payable','22000000',1],
    ['28000000','OTHERS LIABILITIES','20000000',0],['28000001','Insurance Fees','28000000',1],['28000002','হাওলাদ হিসাব','28000000',1],
    ['29000000','PROFIT AND LOSS','20000000',0],['29000001','Current Profit And Loss','29000000',1],
    ['30000000','INCOME','',0],['31000000','INCOME ON LOAN','30000000',0],['31000001','Service Charge General Loan','31000000',1],['31000002','Service Charge Product Loan','31000000',1],['31000003','Service Charge CC Loan','31000000',1],['31000004','Service Charge Loan Against FDR','31000000',1],['31000005','Service Charge Staff Loan','31000000',1],
    ['32000000','FEES AND CHARGES','30000000',0],['32000001','Loan Form Fee','32000000',1],['32000002','Loan Document Fee','32000000',1],['32000003','Admission Fee','32000000',1],['32000004','Insurance Fee','32000000',1],['32000005','Closing Fee','32000000',1],['32000006','Passbook Fee','32000000',1],['32000007','Loan Penalty Fee','32000000',1],['32000008','Document Fees','32000000',1],['32000009','Others Fee','32000000',1],['32000010','Health Service Fee','32000000',1],['32000011','Checkbook Fee','32000000',1],['32000012','EMI Locker Fee','32000000',1],
    ['38000000','OTHERS INCOME','30000000',0],['38000001','Bank Interest','38000000',1],['38000002','Donation Receive','38000000',1],['38000003','Others Charges / Penalty','38000000',1],
    ['39000000','SALES INCOME','30000000',0],['39000001','Income On Product Sales','39000000',1],
    ['40000000','EXPENSE','',0],['41100000','SALARY AND ALLOWANCE','40000000',0],['41100001','Basic Salary','41100000',1],['41100002','House Rent','41100000',1],['41100003','Medical Allowance','41100000',1],['41100004','Transport Allowance','41100000',1],['41100005','Credit Allowance','41100000',1],['41100006','Lunch Allowance','41100000',1],['41100007','Intensive Allowance','41100000',1],['41100008','Festival Salary','41100000',1],['41100009','Employee Salary','41100000',1],
    ['42100000','PROFIT PAYMENT (SAVINGS )','40000000',0],['42100001','Profit Payment General Savings','42100000',1],['42100002','Profit Payment Share','42100000',1],['42100003','Profit Payment Security Savings','42100000',1],
    ['42200000','PROFIT PAYMENT (DPS)','40000000',0],['42200001','Profit Payment 3 Year MDPS','42200000',1],['42200002','Profit Payment 5 Year MDPS','42200000',1],['42200003','Profit Payment 7 Year MDPS','42200000',1],['42200004','Profit Payment 10 Year MDPS','42200000',1],
    ['42300000','PROFIT PAYMENT (FDR)','40000000',0],['42300001','Profit Payment (Monhly Profit)','42300000',1],['42300002','Profit Payment 2 Year FDR','42300000',1],['42300003','Profit Payment (Yearly Profit)','42300000',1],['42300004','Profit Payment (Maturity Profit)','42300000',1],['42300005','Profit Payment 5 Year FDR','42300000',1],
    ['43000000','ADMINISTRATIVE EXPENCES','40000000',0],['43000001','Office Rent','43000000',1],['43000002','Printing, Stationery','43000000',1],['43000003','Travelling & Transportation','43000000',1],['43000004','Internet / Wifi Bill','43000000',1],['43000005','Mobile Bill','43000000',1],['43000006','Software Bill','43000000',1],['43000007','Fuel Cost','43000000',1],['43000008','Entertainment Expenses','43000000',1],['43000009','Electric Bill','43000000',1],['43000010','Donation Exp.','43000000',1],['43000011','Photocopy Bill','43000000',1],['43000012','Commission Exp','43000000',1],['43000013','Bank Charge& Commission','43000000',1],['43000014','Training Expense','43000000',1],['43000015','Legal Expense','43000000',1],['43000016','Registration & Renewal Fees','43000000',1],['43000017','Staff Meeting / Seminer Expense','43000000',1],['43000018','Miscellaneous Expense','43000000',1],['43000019','Appyan Expense','43000000',1],['43000020','বালতি বাবদ খরচ','43000000',1],['43000021','বাৎসরিক ডিপিএস খরচ','43000000',1],['43000022','পাসবুক বিল','43000000',1],['43000023','পল্লিবিদ্যুত বিল','43000000',1],['43000050','Others expenses','43000000',1],
    ['48000000','OTHERS EXPENCES','40000000',0],['48000001','Loan Waiver','48000000',1],
  ];

  // ডিপোজিট প্রোডাক্ট (eKisti account type params)
  const DEP = {
    '2001': { name:'General Savings', short:'GS', dtype:'SB', rate:5, gl:'21100001', payGl:'21500002', expGl:'42100001', feeGl:'32000005', payAllowed:true, comp:false, freq:[] },
    '2002': { name:'Security Savings', short:'SS', dtype:'SB', rate:7, gl:'21100003', payGl:'21500003', expGl:'42100003', feeGl:'32000005', payAllowed:true, comp:true, freq:['D','W'] },
    '2003': { name:'FDR (Monthly profit)', short:'FDR-M', dtype:'FD', rate:14.4, gl:'21300001', payGl:'21700001', expGl:'42300001', feeGl:'32000005', payAllowed:false, profitPay:'M', profitTo:'2001', freq:[] },
    '2004': { name:'FDR (Yearly profit)', short:'FDR-Y', dtype:'FD', rate:20.4, gl:'21300003', payGl:'21700003', expGl:'42300003', feeGl:'32000005', payAllowed:false, profitPay:'Y', profitTo:'2001', freq:[] },
    '2005': { name:'FDR (Maturity profit)', short:'FDR-MAT', dtype:'FD', rate:25, gl:'21300004', payGl:'21700004', expGl:'42300004', feeGl:'32000005', payAllowed:false, profitPay:'C', profitTo:'2001', freq:[] },
    '2007': { name:'3 Year Monthly DPS', short:'MDPS-3', dtype:'RD', rate:10, gl:'21200001', payGl:'21600001', expGl:'42200001', feeGl:'32000005', payAllowed:false, freq:['M'], n:36 },
    '2008': { name:'5 Year Monthly DPS', short:'MDPS-5', dtype:'RD', rate:12, gl:'21200002', payGl:'21600002', expGl:'42200002', feeGl:'32000005', payAllowed:false, freq:['M'], n:60 },
    '2009': { name:'7 Year Monthly DPS', short:'MDPS-7', dtype:'RD', rate:12, gl:'21200003', payGl:'21600003', expGl:'42200003', feeGl:'32000005', payAllowed:false, freq:['M'], n:84 },
    '2010': { name:'10 Year Monthly DPS', short:'MDPS-10', dtype:'RD', rate:12, gl:'21200004', payGl:'21600004', expGl:'42200004', feeGl:'32000005', payAllowed:false, freq:['M'], n:120 },
  };
  // DPS/FDR শিডিউল: [code, type, name, n, instAmount, rate, maturityMonths]
  const SCHED = [];
  const amts = [100,200,300,400,500,600,700,800,900,1000,2000,3000,4000,5000,6000,7000,8000,9000,10000];
  [['2007',40001,36,10,'3 Year'],['2008',40020,60,12,'5 Year'],['2009',40039,84,12,'7 Year'],['2010',40058,120,12,'10 Year']].forEach(([t,start,n,rate,lbl]) => {
    amts.forEach((a,i) => SCHED.push([String(start+i), t, `${lbl} Monthly DPS ${a}`, n, a, rate, n]));
  });
  SCHED.push(['50005','2003','প্রতি লাখে ১৫০০ টাকা লাভ',0,0,18,60]);

  // লোন প্রোডাক্ট
  const LOAN = {
    '3001': { name:'General Loan', short:'GL', gl:'11200001', incGl:'31000001', recGl:'11300001' },
    '3101': { name:'Staff Loan', short:'SL', gl:'11250001', incGl:'31000005', recGl:'11300001', staff:true },
  };
  // কিস্তি সেটিংস (eKisti: micfin-emiinstset)
  const INST_SET = [
    { id:'E00000003', type:'3001', freq:'D', n:120, rate:20 },
    { id:'E00000005', type:'3001', freq:'W', n:24, rate:20 },
    { id:'E00000008', type:'3001', freq:'M', n:6, rate:20 },
  ];
  const PURPOSES = [{ code:'000001', cat:'Business', name:'Business' }];
  const FREQ = { D:'D - Daily', W:'W - Weekly', M:'M - Monthly', Q:'Q - Quarterly', H:'H - Half Yearly', Y:'Y - Yearly', F:'F - Fifteen Days Interval', S:'S - Single Installment', C:'At Maturity', N:'N - Not Applicable' };

  // অন্যান্য একাউন্ট (finance-accountopen) ধরন
  const OTHER = {
    '5001': { name:'Director Deposit', gl:'21800001' },
    '5002': { name:'Employee Salary Account', gl:'21910001' },
    '5003': { name:'Staff Security Deposit', gl:'21910004' },
    '5004': { name:'Provident Fund', gl:'21910002' },
    '5005': { name:'হাওলাদ হিসাব', gl:'28000002' },
  };
  // একাউন্ট লেনদেন (finance-account-transaction) ধরন: [code, name, otherType, direction]
  const ACC_TT = [
    ['000017','Director Deposit Receive','5001','R'], ['000016','Director Deposit Payment','5001','P'],
    ['000014','Employee Salary Payment','5002','P'], ['000015','Employee Salary Receive','5002','R'],
    ['000022','Staff Security Receive','5003','R'], ['000023','Staff Security Payment','5003','P'],
    ['000024','Provident Fund Receive','5004','R'], ['000025','Provident Fund Payment','5004','P'],
    ['000020','হাওলাদ গ্রহন','5005','R'], ['000021','হাওলাদ প্রদান/ফেরত','5005','P'],
  ];
  // লেজার লেনদেন ধরন: [code, name, kind]  kind: BD=bank deposit, BW=bank withdraw, EXP, INC
  const LEDGER_TT = [['000003','Bank Deposit','BD'],['000004','Bank Widthwral','BW'],['000013','Expense Entry','EXP'],['000018','Income Entry','INC']];

  const GL = {
    cash:'11110001', share:'21100002', admission:'32000003', passbook:'32000006', formFee:'32000001', docFee:'32000002',
    risk:'28000001', health:'32000010', locker:'32000012', othersFee:'32000009', penalty:'32000007', closing:'32000005',
    waiver:'48000001', ibReceivable:'11800001', ibPayable:'22000001', salaryExp:'41100009', salaryPayable:'21910001',
    pf:'21910002', shareProfit:'42100002', pl:'29000001',
  };
  return { COA, DEP, SCHED, LOAN, INST_SET, PURPOSES, FREQ, OTHER, ACC_TT, LEDGER_TT, GL };
})();
