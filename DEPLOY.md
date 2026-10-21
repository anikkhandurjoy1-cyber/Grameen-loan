# গ্রামীন আশার আলো — v2 (eKisti-এর মতো সম্পূর্ণ সিস্টেম)

## ফাইল কাঠামো
- `index.html` — মূল পেজ (লগইন + অ্যাপ শেল)
- `css/app.css` — ডিজাইন
- `js/` — core (Firebase, UI), engine (ডাবল এন্ট্রি), txn, menu, ref-data (eKisti COA/প্রোডাক্ট)
- `js/pages/` — মডিউলভিত্তিক পেজ (সদস্য, ঋণ, সঞ্চয়, কালেকশন, AIS, বেতন, রিপোর্ট...)
- `api/manageUser.js` — Vercel সার্ভার ফাংশন (ইউজারের পাসওয়ার্ড রিসেট/নিষ্ক্রিয়)
- `firestore.rules` — Firestore সিকিউরিটি রুলস
- `index-old.html` — পুরোনো v1 (ব্যাকআপ, দরকার হলে মুছে দিন)

## ১. Firebase প্রস্তুতি (grameen-52d86)
1. Firestore-এর পুরোনো টেস্ট ডেটা মুছে ফেলুন (users কালেকশন ও Authentication-এর Admin ইউজার রেখে দিন)।
2. Firestore → Rules → `firestore.rules` ফাইলের পুরোটা পেস্ট → Publish।
3. Authentication → Settings → Authorized domains → Vercel ডোমেইন যোগ করুন (যেমন `grameen-loan.vercel.app`)।
4. Project settings → Service accounts → **Generate new private key** → JSON ফাইলটি রাখুন (Vercel-এ লাগবে)।

## ২. Vercel (DokanGo অ্যাকাউন্টে আলাদা প্রজেক্ট)
1. GitHub-এ কোড push করুন (repo: anikkhandurjoy1-cyber/Grameen-loan)।
2. Vercel → Add New → Project → এই repo Import করুন।
   - DokanGo-র Vercel অ্যাকাউন্টের GitHub-এ এই repo না দেখালে: Vercel → Settings → Git → GitHub App-এ repo-র অ্যাক্সেস দিন।
3. Framework Preset: **Other**, Build Command: খালি, Output Directory: খালি (রুট)।
4. Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT` = Service account JSON ফাইলের পুরো লেখা।
5. Deploy।

## ৩. প্রথমবার চালানো
1. Admin হিসেবে লগইন করুন (পুরোনো Admin ইউজার স্বয়ংক্রিয়ভাবে Super Admin হবে)।
2. সেটিংস → **প্রাথমিক সেটআপ (COA/প্রোডাক্ট)** → "সেটআপ চালান" (একবারই)।
3. সেটিংস → **eKisti ডেটা ইমপোর্ট** → eKisti থেকে এক্সপোর্ট করা JSON ফাইল দিয়ে সদস্য/একাউন্ট আনুন।
   - ফ্রি প্ল্যানে দিনে ২০,০০০ লেখা সীমা — বড় শাখা আলাদা দিনে ইমপোর্ট করুন।
4. ইউজার সিটিং থেকে মাঠকর্মী/ম্যানেজারদের ইউজার তৈরি করুন, পদ ভিত্তিক পারমিশন ঠিক করুন।

## Firebase ফ্রি (Spark) প্ল্যানে চালানোর নিয়ম
- রিপোর্ট সমিতির snapshot থেকে চলে (প্রতি সমিতি ১ রিড) — ৪-৫ হাজার সদস্যেও দৈনিক সীমার মধ্যে থাকে।
- ড্যাশবোর্ড ১০ মিনিট ক্যাশ থাকে।
- কোনো Composite Index লাগে না।
