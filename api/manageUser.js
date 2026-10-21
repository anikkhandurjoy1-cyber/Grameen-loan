// Vercel Serverless — ইউজারের পাসওয়ার্ড রিসেট / নিষ্ক্রিয় / ডিলিট (Firebase Admin)
// Vercel → Project → Settings → Environment Variables:
//   FIREBASE_SERVICE_ACCOUNT = Firebase Console → Project settings → Service accounts → Generate new private key (পুরো JSON)
const admin = require('firebase-admin');

function init() {
  if (admin.apps.length) return;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!sa.project_id) throw new Error('FIREBASE_SERVICE_ACCOUNT সেট করা নেই');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });
  try {
    init();
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, error: 'লগইন নেই' });
    const caller = await admin.auth().verifyIdToken(token);
    const cdoc = await admin.firestore().collection('users').doc(caller.uid).get();
    if (!cdoc.exists || cdoc.data().group !== 'Super Admin' || cdoc.data().status === 'inactive') return res.status(403).json({ success: false, error: 'শুধু Super Admin' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, uid, password } = body;
    if (!uid) return res.status(400).json({ success: false, error: 'uid নেই' });
    if (uid === caller.uid && action !== 'resetPassword') return res.status(400).json({ success: false, error: 'নিজেকে পরিবর্তন করা যাবে না' });
    if (action === 'resetPassword') {
      if (!password || String(password).length < 6) return res.status(400).json({ success: false, error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর' });
      await admin.auth().updateUser(uid, { password: String(password) });
    } else if (action === 'disable' || action === 'enable') {
      await admin.auth().updateUser(uid, { disabled: action === 'disable' });
    } else if (action === 'delete') {
      await admin.auth().deleteUser(uid);
    } else return res.status(400).json({ success: false, error: 'অজানা action' });
    return res.status(200).json({ success: true, uid });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
