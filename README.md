# शिवतेज ग्रुप वाखारी — नियोजन २०२७

साऊंड सिस्टीम वर्गणीसाठी मराठी Next.js + Supabase वेबसाइट. Public dashboard `/` आणि व्यवस्थापक पृष्ठ `/admin`.

## सध्याची स्थिती

- पूर्ण application source तयार आहे; `npm run build` आणि पंधरा automated tests यशस्वी.
- Supabase project, खरे सदस्य, administrator password आणि Vercel account जोडलेले नाहीत. वेबसाइट live deploy केलेली नाही.
- Supabase URL/key नसल्यास स्पष्टपणे चिन्हांकित **नमुना मोड** दिसतो. त्यातील २२ नावे आणि रक्कम काल्पनिक आहेत; production database मध्ये ती seed केली जात नाहीत.
- नमुना dashboard मधील बदल फक्त त्या browser च्या localStorage मध्ये राहतात. हा खरा admin login नाही. Supabase जोडल्यावर नमुना प्रवेश बंद होतो.
- या execution environment च्या browser preview मध्ये Next.js dev runtime ने `uv_resident_set_memory` (restricted runtime) error दिला. त्यामुळे Next.js server-backed end-to-end browser/mobile QA पूर्ण झालेले नाही. स्वतंत्र `public/preview.html` demo browser मध्ये तपासला: dashboard, filter, search, admin entry, partial-payment save, इतर देणगी, चार महिन्यांची आगाऊ नोंद आणि सार्वजनिक आभारपत्र generation/download यशस्वी. Production build आणि database logic चाचण्या पास आहेत; आपल्या local machine वर खालील acceptance checklist वापरा.

## डाउनलोड केलेला UI लगेच पाहा

`public/preview.html` browser मध्ये उघडा. Node.js किंवा Supabase शिवाय demo चालतो. नावे/रक्कम काल्पनिक; सर्व demo बदल फक्त local browser मध्ये राहतात. Admin लिंक → **नमुना डॅशबोर्ड पाहा**. काही browsers file:// पृष्ठांवर localStorage रोखतात; अशावेळी `npm run dev` वापरा. हा demo पृष्ठ real database किंवा password login शी जोडलेला नाही.

पुन्हा demo build करायचा असल्यास `npm run preview:build`. Production deployment मध्ये स्वतंत्र demo पृष्ठ नको असल्यास `public/preview.html` काढून टाका; मुख्य वेबसाइटवर परिणाम होत नाही.

## प्रथम सुरू करा

Node.js 22.9+ किंवा 24 LTS आणि npm वापरा.

```sh
npm ci
npm run dev
```

`http://localhost:3000` उघडा. `/admin` → **नमुना डॅशबोर्ड पाहा** वापरून फॉर्म तपासा. हा मोड कोणतीही खरी वर्गणी बदलत नाही. खरे Supabase credentials जोडण्यापूर्वीच नमुना मोड वापरा.

## Supabase setup

1. स्वतंत्र Supabase project तयार करा.
2. SQL Editor मध्ये `supabase/schema.sql` पूर्ण एकदा run करा. हे नवीन project साठी initial migration आहे; आधीच tables असलेल्या project वर अंधपणे पुन्हा run करू नका.
3. Migration सर्व tables, RLS, audit triggers, login throttle आणि `payment-proofs` public bucket तयार करते.
4. API settings मधून project URL, publishable key आणि server secret key मिळवा.
5. `.env.example` ची `.env.local` प्रत तयार करा आणि values भरा. `.env.local` Git मध्ये commit करू नका.

| Variable | उपयोग |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public read key; RLS लागू |
| `SUPABASE_SECRET_KEY` | फक्त server वरील admin writes |
| `ADMIN_PASSWORD_HASH` | bcrypt password hash |
| `ADMIN_SESSION_SECRET` | किमान ३२ characters असलेला random secret |
| `APP_ORIGIN` | local साठी `http://localhost:3000`; deployment साठी अचूक HTTPS domain |

पासवर्ड आणि session secret तयार करण्यासाठी:

```sh
npm run admin:credentials
```

स्क्रिप्ट password input लपवते. किमान १२ characters आणि जास्तीत जास्त ७२ UTF-8 bytes वापरा. Password command-line argument किंवा shell history मध्ये टाकू नका. स्क्रिप्ट दिलेला hash व secret योग्य environment fields मध्ये भरा. `.env.local` मध्ये bcrypt hash मधील प्रत्येक `$` हा `\$` असा escape करा, कारण Next.js env files मध्ये `$` interpolation होते; **Vercel dashboard मध्ये unescaped raw value** वापरा. Hash बदलल्यावर आधीच्या session signatures आपोआप invalid होतात.

Environment बदलल्यावर dev server restart करा. Publishable key आहे पण database बंद/चुकीचा असल्यास app error state दाखवते; demo माहिती दाखवत नाही.

## Vercel deployment

1. हा project आपल्या GitHub repository मध्ये commit/push करा. `node_modules`, `.next` आणि `.env.local` commit करू नका.
2. Vercel मध्ये repository import करा. Framework **Next.js**; build `npm run build`; output directory default ठेवा.
3. वरील सहा environment variables जोडा. Production deployment domain मिळाल्यावर `APP_ORIGIN` त्या अचूक origin वर सेट करून redeploy करा. Preview deployments साठी त्यांचा वेगळा अचूक origin आवश्यक आहे.
4. Root पृष्ठ आणि `/admin` उघडा. स्वतःचा पासवर्ड वापरून प्रवेश करा.
5. **सदस्यनिहाय हिशोब → सदस्य जोडा** वापरून २२ खरी नावे, प्रवेश महिना आणि क्रमांक नोंदवा. Default join month जानेवारी २०२७ आहे; आवश्यक असल्यास बदला.
6. एखादी वास्तविक/चाचणी नोंद करून public बाजूवर त्याच रकमेची खात्री करा. चुकीची रक्कम पुन्हा edit करता येते.

## वापर

- महिना slider, मागील/पुढील आणि year selector वापरून कोणत्याही वर्षाचा हिशोब पाहता येतो.
- Admin मधील member row वर **भरले** किंवा **बदला** निवडा; रक्कम, दिनांक, screenshot आणि optional public note भरा.
- `०` रक्कम म्हणजे बाकी; कमी रक्कम म्हणजे अंशतः भरले; अपेक्षित रक्कम किंवा जास्त म्हणजे भरले.
- आधीची पावती स्वतंत्र checkbox ने काढता येते; नवीन पावती दिल्यावर जुनी बदलली जाते.
- सदस्य संपादनात **शेवटचा वर्गणी महिना** दिल्यास त्याच्या पुढील महिन्यापासून नवीन due लागणार नाही. जुना history राहतो. Field रिकामा केल्यास सदस्य पुन्हा active होतो (मधल्या कालावधीची due पुन्हा लागू होते; वेगवेगळे pause/rejoin periods V1 मध्ये नाहीत).
- **सूचना** tab मधून create, edit, hide, delete आणि optional start/end dates बदलता येतात.
- Header मधील settings icon ने पुढील वर्षाचा monthly rate सेट करा. चालू/मागील वर्षाचा दर बदलणे रोखले आहे. नोंदवलेल्या payment चा expected amount snapshot जतन होतो.
- Header मधील download icon CSV export करते. Excel मध्ये मराठी नीट दिसण्यासाठी UTF-8 BOM दिलेला आहे. भविष्यातील काल्पनिक dues CSV मध्ये भरल्या जात नाहीत; भविष्यात नोंदवलेली advance payment मात्र येते.

## हिशोबाचे नियम

- प्रवेश आणि शेवटचा महिना दोन्ही समाविष्ट; `is_active=false` असला तरी त्या महिन्यांचा historic हिशोब दिसतो.
- प्रत्येक सदस्याची बाकी: `max(expected_amount − amount_paid, 0)`.
- मासिक बाकी = सदस्यनिहाय बाकीची बेरीज. एका सदस्याची जास्त रक्कम दुसऱ्याची बाकी कमी करत नाही; त्यामुळे `एकूण बाकी` नेहमी `एकूण अपेक्षित − एकूण जमा` इतकीच असेल असे नाही.
- जास्त भरलेली रक्कम त्या महिन्यात actual received म्हणून दिसते; ती आपोआप पुढील महिन्यात credit केली जात नाही.
- अजून payment record नसल्यास त्या वर्षासाठी लागू rate वापरला जातो; rate नसल्यास आधीचा सर्वात जवळचा rate, अन्यथा ₹३००.
- Payment save करताना expected amount database मध्ये snapshot होतो. Payment edit किंवा future rate change त्याला बदलत नाही.
- Previous dues सर्व eligible वर्षांतून मोजल्या जातात; चालू किंवा पुढील महिन्यांची रक्कम previous arrears मध्ये येत नाही.
- वार्षिक/member paid totals त्या वर्षातील सर्व नोंदवलेली actual amounts समाविष्ट करतात; annual due आणि paid-month denominator फक्त चालू महिन्यापर्यंत.
- Asia/Kolkata हा business timezone आहे. महिना/वर्ष आपोआप बदलते; “नियोजन २०२७” हे स्थिर प्रकल्पाचे नाव आहे.

## सुरक्षा आणि storage

- Member login, Supabase Auth, OTP किंवा payment gateway नाही.
- Server bcrypt password verify करते. Session cookie: HttpOnly, production मध्ये Secure, SameSite=Strict, आठ तास.
- सर्व admin writes आणि logout ला session/origin checks. APP_ORIGIN नसल्यास writes/login fail closed.
- PostgreSQL मध्ये atomic, shared login throttle: १५ मिनिटांत IP hash मागे १० प्रयत्न. Vercel चा trusted `x-vercel-forwarded-for` header वापरला जातो; इतर hosts वर trusted header adapter आवश्यक. Header नसल्यास एक conservative shared bucket लागू होते.
- Public database roles ना read-only grants + RLS. `admin_logs`, throttle table आणि privileged RPCs public कडून inaccessible.
- महत्त्वाच्या database बदलांचे audit logs त्याच transaction मध्ये trigger द्वारे तयार होतात.
- Screenshot browser मध्ये WebP compress; ८०० KB पेक्षा खाली आणण्याचा प्रयत्न; final कमाल २ MB. मूळ input कमाल १५ MB. Server file signature, आकार आणि MIME तपासते.
- Bucket public आहे: upload करण्यापूर्वी sensitive UPI/mobile/bank माहिती crop/blur करावी. पावतीची link माहिती असलेल्या कोणालाही चित्र पाहता येईल; public visibility ही या प्रकल्पाची जाणीवपूर्वक निवड आहे.
- CSV म्हणजे contribution export; **पूर्ण database/storage backup नाही**. Periodically database आणि payment-proofs bucket ची स्वतंत्र प्रत ठेवा. Restore किंवा free-plan retention ची हमी या app कडून दिली जात नाही.
- एक primary payment entry प्रति member/year/month. एकाच वेळी दोन admins ने त्याच नोंदीत बदल केल्यास शेवटचा save लागू होतो; audit log मध्ये बदल राहतात. हा एक-admin workflow आहे.

## चाचण्या

```sh
npm test
npm run build
```

पंधरा tests: membership boundaries, overpayment separation, partial/snapshot amount, cross-year previous dues, future-year arrears आणि database integration (audit, grants/RLS, RPC permissions, login throttle, historic rate). Integration test PGlite PostgreSQL engine वापरते; Supabase Storage upload आणि Vercel live cookies यांची credentials शिवाय प्रत्यक्ष cloud चाचणी झालेली नाही.

Deployment acceptance checklist:

- [ ] ३६०px, ३९०px आणि desktop screen वर clipping नसावे; mobile bottom summary clickable.
- [ ] चालू महिना, मागील महिना, year navigation, search, status filter.
- [ ] चुकीचा आणि योग्य admin password; logout; cookie expiry.
- [ ] ₹३००, ₹२००, ₹० आणि ₹५०० — public status/totals योग्य.
- [ ] Screenshot upload/view/change/delete आणि २ MB limit.
- [ ] January join / April join / August leave यांचा historic हिशोब.
- [ ] Notice create/edit/hide/delete आणि date boundaries.
- [ ] Future rate, CSV Marathi text, real Supabase outage retry.
- [ ] Publishable key ने insert/update/delete व private logs वाचणे नाकारलेले.

## फाइल्स

- `components/dashboard.tsx`: Marathi responsive UI + explicit local demo mode.
- `lib/model.ts`: accounting, dates, Marathi formatting and sample data.
- `lib/server.ts`: server-only Supabase clients and session helpers.
- `app/api`: public data, login/logout, authenticated writes.
- `supabase/schema.sql`: complete initial migration with security and audit.
- `scripts/admin-credentials.mjs`: hidden-input bcrypt/session secret generator.
- `tests`: accounting and PostgreSQL integration checks.

Official references: [Next.js](https://nextjs.org/docs), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).


## नवीन सुविधा — इतर जमा आणि मागील शिल्लक

Admin मध्ये महिना निवडा → **इतर जमा जोडा**. प्रकार निवडा: **देणगी / इतर जमा** किंवा **मागील शिल्लक**. देणगीदाराचे नाव/कारण, रक्कम, कोणत्या महिन्यात जोडायची, नोंदीचा दिनांक आणि optional public note भरा. एकूण निधीवर क्लिक करून नोंद edit/delete करता येते.

उदा. सदस्य वर्गणी ₹५,५०० + बाहेरील देणगी ₹१,५०० + मागील शिल्लक ₹१०,००० = एकूण निधी ₹१७,०००. Member status, अपेक्षित वर्गणी, बाकी आणि progress फक्त member payments वर आधारित राहतात. बाहेरील देणगीदारासाठी member account तयार होत नाही.

Public वापरकर्ते महिन्याच्या total card वर, bottom total वर किंवा annual total/month bar वर क्लिक केल्यास संपूर्ण breakdown पाहतात: सदस्यांची संख्या/वर्गणी, देणग्या आणि opening balance. Member rows expand करता येतात; प्रत्येक अतिरिक्त नोंदीचे नाव, रक्कम, दिनांक, प्रकार आणि टीप दिसतात. CSV मध्ये याच नोंदी त्यांच्या स्वतंत्र प्रकारासह समाविष्ट आहेत.

**एकदाच नोंदवा:** जुनी शिल्लक निवडलेल्या महिन्यात आणि त्याच्या वार्षिक एकूण रकमेत एकदाच मोजली जाते. पुढील महिन्यांत ती आपोआप पुन्हा जोडली जात नाही. हे receipts/starting-funds dashboard आहे; खर्च किंवा running bank balance हिशोब नाही. याच वेबसाइटवर आधीच मोजलेले पैसे त्याच वर्षात पुन्हा opening balance म्हणून टाकू नका. जानेवारी २०२७ मध्ये बाहेरून आलेली २०२६ ची शिल्लक ₹१०,००० नोंदवता येते.

### आधीचा Supabase setup असल्यास

नवीन code deploy करण्यापूर्वी SQL Editor मध्ये `supabase/migrations/002_additional_income.sql` आणि मग `supabase/migrations/003_advance_payments.sql` प्रत्येकी **एकदा** run करा. 002 आधीच लागू असल्यास फक्त 003 run करा. पूर्ण `schema.sql` पुन्हा run करू नका. नवीन installations साठी अद्ययावत `schema.sql` मध्ये सर्व tables/functions आधीच समाविष्ट आहेत; 002/003 वेगळ्या run करू नका. Migration कोणतीही financial entry किंवा ₹१०,००० seed करत नाही.

`additional_income` public-read-only table आहे. Admin changes audit trigger मध्ये transactional नोंदवले जातात. Positive amounts, valid year/month/category/date आणि source नाव server वर validate होतात. Demo मध्ये ₹१०,००० ही स्पष्टपणे चिन्हांकित नमुना नोंद आहे; ती production data नाही.

चाचण्या: additional income totals, unchanged member dues, single counting across months/years, edits/deletion/paise precision, invalid entries, public read-only grants आणि audit history.


## आगाऊ वर्गणी — अनेक महिन्यांची एकत्र नोंद

Admin मध्ये सदस्याच्या **भरले / बदला** बटणावर क्लिक करा → **अनेक महिन्यांची आगाऊ वर्गणी नोंदवा**. सुरुवातीचा महिना आणि १–१२ महिने निवडा (default ४). प्रत्येक महिन्यासाठी उरलेली रक्कम आपोआप येते; गरजेनुसार बदलता येते. उदा. चार महिन्यांसाठी ₹३०० × ४ = ₹१,२००. पैसे प्रत्यक्ष मिळाल्याचा दिनांक द्या; भविष्यातील वर्गणी महिन्यांसाठीही हाच दिनांक वापरला जातो.

**सर्व नोंदी जतन करा** केल्यावर प्रत्येक महिन्यात स्वतंत्र payment entry दिसते. पुढील महिना निवडून एकेक नोंद करणेही चालू आहे. Existing amount मध्ये नवीन रक्कम जोडली जाते; ० असलेली ओळ बदलत नाही. एक receipt अनेक महिन्यांना जोडता येते. एखाद्या महिन्याची पावती बदलली/काढली तरी इतर महिन्यांना आवश्यक असलेली मूळ फाइल काढली जात नाही.

Database transaction मुळे पूर्ण batch एकत्र जतन होते; एखादी ओळ invalid असल्यास कोणतीही नोंद होत नाही. एकाच request च्या retry मुळे duplicate payment वाढत नाही. वर्ष बदलल्यास त्या वर्षाचा लागू दर वापरला जातो; आधीच्या expected-amount snapshots सुरक्षित राहतात. Join/leave eligibility प्रत्येक महिन्यासाठी तपासली जाते.

## मूळ लोगो आणि छोटा splash

दिलेला मूळ लोगो `public/logo.jpg` मध्ये वापरला आहे: header, site icon, आभारपत्र आणि splash. Logo हा मूळ JPEG आहे; SVG tracing केलेले नाही. प्रत्येक browser tab च्या पहिल्या भेटीत साधारण **७०० ms** splash दिसतो. Reduced-motion preference असल्यास splash टाळला जातो. मराठी fonts स्थानिक `public/fonts` मध्ये आहेत; demo मध्ये logo/fonts embed केले आहेत.

## सर्वांसाठी मासिक / वार्षिक आभारपत्र

Public पृष्ठाच्या शेवटी **वर्गणीचे आभारपत्र शेअर करा** → मासिक किंवा वार्षिक आढावा → **चित्र तयार करा**. गटाचे नाव, मूळ लोगो, पार्श्वभूमीत लोगो, सर्व पात्र सदस्यांची नावे, भरले/अंशतः/बाकी, जमा/बाकी रक्कम आणि आभार संदेश असलेले PNG तयार होते. Search किंवा status filter असूनही सर्व पात्र सदस्य समाविष्ट होतात. सदस्य जास्त किंवा नावे मोठी असल्यास चित्रे अनेक पानांत विभागली जातात.

**चित्र डाउनलोड** सर्व browsers मध्ये वापरता येते. **WhatsApp / शेअर** समर्थित HTTPS फोनवर system share menu उघडते; त्यातून WhatsApp निवडा. इतर browsers मध्ये चित्र डाउनलोड करून WhatsApp ला manually जोडा. Website स्वतः कोणालाही message पाठवत नाही. प्रत्यक्ष फोनवरील WhatsApp/native share चाचणी deployment नंतर करावी.

वार्षिक जमा सर्व नोंदवलेल्या payments समाविष्ट करते; वार्षिक बाकी फक्त चालू महिन्यापर्यंत मोजते. पूर्ण भविष्यातील कालावधीसाठी **अद्याप देय नाही** दाखवते. Monthly poster त्या निवडलेल्या महिन्याची अपेक्षित/भरलेली रक्कम दाखवतो. नमुना मोडमधील चित्रावर स्पष्ट नमुना सूचना असते.

नवीन चाचण्यांत future/cross-year advance, invalid batches rollback, idempotent retry, public RPC denial, monthly/yearly poster data, भविष्यकालीन बाकी आणि सर्व सदस्यांचा समावेश तपासला आहे. Browser मध्ये २२ सदस्यांचे PNG डाउनलोड करून मराठी मजकूर, रकमा, watermark आणि footer तपासले आहेत. Live Supabase Storage, production cookies आणि actual WhatsApp delivery credentials/device नसल्यामुळे पडताळलेले नाहीत.

Web sharing reference: [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [MDN Navigator.canShare](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare).
