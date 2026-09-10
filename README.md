# فیدامچ / FidaMatch — Demo

دموی زنده‌ی موتور جستجوی هوشمند اکوسیستم فیدا: نیاز، ظرفیت و فرصت اعضا را با کمک یک مدل زبانی به هم تطبیق می‌دهد.

این نسخه **یک دمو برای ارائه** است، نه محصول نهایی — پایگاه‌داده آن چند رکورد نمونه در یک فایل JSON است، نه PostgreSQL/Vector DB واقعی. اما لایه‌ی هوش مصنوعی آن واقعی و زنده است.

---

## معماری

```
Frontend (index.html, GitHub Pages)
        │  POST { query, records, provider }
        ▼
Backend / LLM Router (worker/worker.js, Cloudflare Worker)
        │  کلیدهای API فقط اینجا، به‌صورت Secret
        ▼
   ┌─────────┬─────────┬─────────┐
   │ Claude  │ OpenAI  │ Gemini  │   ← provider انتخابی
   └─────────┴─────────┴─────────┘
        │  پاسخ خام مدل (JSON)
        ▼
   اعتبارسنجی و نرمال‌سازی خروجی
        │  { answer, matches: [...] }
        ▼
Frontend — نمایش پاسخ و کارت‌های نتیجه
```

اصل طراحی: **frontend هیچ‌وقت کلید API نمی‌بیند و هیچ‌وقت نمی‌داند از کدام Provider استفاده می‌شود** — فقط یک درخواست POST به Worker می‌زند و یک پاسخ ساخت‌یافته پس می‌گیرد. اضافه‌کردن یا عوض‌کردن Provider فقط در `worker.js` انجام می‌شود.

---

## ساختار پروژه

```
.
├── index.html               ← صفحه اصلی (Hero, رادار فرصت‌ها، موتور اعتماد، ۱۷ کنفدراسیون) + بخش دستیار فیدامچ درون همین صفحه
├── awards.html               ← صفحه دوم: ماشین‌حساب تهاتر دارایی‌ها + جوایز دوازده‌گانه سال
├── data/
│   └── fida-records.json   ← پایگاه‌داده نمونه — برای اضافه‌کردن داده جدید فقط همین فایل را ویرایش کنید
├── worker/
│   └── worker.js            ← کد Cloudflare Worker (LLM Router) — این را در Cloudflare paste می‌کنید، نه در سرور خودتان
└── README.md
```

> نکته: خود Cloudflare Worker از GitHub مستقیماً اجرا نمی‌شود؛ کد `worker/worker.js` را باید داخل داشبورد Cloudflare (یا با Wrangler CLI) Deploy کنید. نگه‌داشتنش داخل همین ریپازیتوری فقط برای مستندسازی و کنترل نسخه است.

### درباره طراحی

- **فونت:** Estedad (وزن‌های ۴۰۰ تا ۸۰۰ از CDN رسمی) با Vazirmatn به‌عنوان جایگزین امن اگر Estedad بارگذاری نشد. تیترها وزن ۷۰۰/۸۰۰، متن بدنه ۴۰۰/۵۰۰، دکمه‌ها ۵۰۰/۶۰۰.
- **آیکون‌های سه‌بعدی:** کلاس `icon-3d` (در `<style>` هر دو فایل) به بج‌های آیکون اضافه شده — نور شیشه‌ای از بالا، سایه داخلی، درخشش رنگی دور آیکون، و چرخش سه‌بعدی هنگام hover. بیشترین نمود این افکت را در ۱۲ کارت جایزه‌ی `awards.html` می‌بینید.
- دو صفحه به هم لینک شده‌اند: دکمه «فیدامچ» و «ماشین‌حساب تهاتر و جوایز» در `index.html`، و دکمه «بازگشت به صفحه اصلی» در `awards.html`.

---

## راه‌اندازی Backend (اول این بخش را کامل کنید)

### ۱) کلید(های) API را بگیرید
- Claude: https://console.anthropic.com → API Keys
- OpenAI (اختیاری): https://platform.openai.com/api-keys
- Gemini (اختیاری): https://aistudio.google.com/apikey

### ۲) Worker را Deploy کنید
اگر از قبل Worker با آدرس `fida.saharnazyaghoobpoor.workers.dev` دارید، نیازی به ساخت Worker جدید نیست — فقط کد را با محتوای `worker/worker.js` جایگزین کنید:

1. وارد `dash.cloudflare.com` → Workers & Pages → Worker موردنظر شوید.
2. روی **Edit Code** بزنید.
3. کل محتوای `worker/worker.js` را جایگزین کد فعلی کنید.
4. **Deploy** را بزنید.

### ۳) کلیدها را به‌صورت Secret تنظیم کنید
در صفحه‌ی Worker → **Settings → Variables and Secrets → Add**:

| نام | مقدار | الزامی؟ |
|---|---|---|
| `ANTHROPIC_API_KEY` | کلید Claude | بله (Provider پیش‌فرض) |
| `OPENAI_API_KEY` | کلید OpenAI | فقط اگر می‌خواهید Provider = openai کار کند |
| `GEMINI_API_KEY` | کلید Gemini | فقط اگر می‌خواهید Provider = gemini کار کند |
| `APP_SECRET` | یک رشته دلخواه (مثلاً یک پسورد ساده) | اختیاری — محافظت سبک در برابر استفاده غیرمجاز |

نوع همه‌ی این‌ها را روی **Secret** (نه Text) بگذارید تا رمزنگاری‌شده ذخیره شوند.

**هرگز این مقادیر را داخل کد یا GitHub commit نکنید.**

### ۴) تست مستقیم Backend (قبل از تست frontend)

باز کردن آدرس Worker در مرورگر باید این را نشان بدهد (این یعنی درست دیپلوی شده — این حالت GET، نه خطا):

```json
{"status":"ok","service":"FidaMatch LLM Router", ...}
```

تست واقعی با `curl` (آدرس خودتان را جایگزین کنید):

```bash
curl -X POST https://fida.saharnazyaghoobpoor.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "query": "دنبال شریک صادراتی برای عراق می‌گردم",
    "provider": "claude",
    "records": [
      {"id":0,"name":"فرصت صادرات به عراق","desc":"صادرات خدمات فنی مهندسی به عراق","owner":"تست","meta":"تست","keywords":["عراق","صادرات"]}
    ]
  }'
```

پاسخ موفق باید چیزی شبیه این باشد:

```json
{"provider":"claude","answer":"...", "matches":[{"id":0,"match_percent":90,"note":"..."}]}
```

اگر خطای ۴۰۱ گرفتید → `APP_SECRET` را چک کنید (یا هدر `X-App-Secret` را به curl اضافه کنید).
اگر خطای مربوط به `ANTHROPIC_API_KEY تنظیم نشده است` گرفتید → مرحله ۳ را دوباره چک کنید.

> **درباره‌ی خطای قبلی ۴۰۵:** اگر آدرس Worker مستقیم در مرورگر باز شود، یک درخواست `GET` ارسال می‌شود. نسخه‌ی جدید `worker.js` برای `GET` یک پیام سلامت برمی‌گرداند (نه خطا)، و فقط منطق تطبیق واقعی از طریق `POST` اجرا می‌شود. اگر بعد از این تغییر باز هم ۴۰۵ گرفتید، یعنی هنوز نسخه‌ی قدیمی Worker deploy شده — مرحله ۲ را دوباره انجام دهید.

---

## راه‌اندازی Frontend

### ۱) آدرس Worker را در `index.html` تنظیم کنید
نزدیک ابتدای بخش `<script>`:

```js
const WORKER_URL = "https://fida.saharnazyaghoobpoor.workers.dev"; // آدرس واقعی خودتان
const APP_SECRET = ""; // اگر روی Worker تنظیم کردید، همان مقدار را اینجا هم بگذارید
```

### ۲) روی GitHub Pages منتشر کنید
از دامنه پیش‌فرض خود GitHub استفاده می‌کنیم (`github.io`) — نیازی به خرید دامنه یا تنظیم DNS نیست.

1. `index.html` و پوشه‌ی `data/` را در ریشه‌ی همین ریپازیتوری Commit کنید.
2. Settings → Pages → Build and deployment → **Deploy from a branch** → شاخه `main`، پوشه `/ (root)` → Save.
3. بعد از چند دقیقه، آدرس نهایی این خواهد بود:
   ```
   https://saharnazyp.github.io/Demo_Commiunication_F/
   ```
   دقیقاً همین آدرس (بدون هیچ چیز اضافه بعد از اسم ریپازیتوری) باید در مرورگر باز شود.

### ۳) تست frontend
لینک را باز کنید، یکی از پیشنهادها را بزنید، پیشرفت پایپ‌لاین بالای صفحه را ببینید، و منتظر پاسخ واقعی از مدل بمانید. با دکمه‌های Claude/OpenAI/Gemini بالای صفحه می‌توانید Provider را عوض کنید (هرکدام که کلیدش را در Worker تنظیم کرده باشید کار می‌کند).

---

## اضافه‌کردن داده جدید

فقط `data/fida-records.json` را ویرایش کنید — هر رکورد باید این شکل را داشته باشد:

```json
{
  "id": 6,
  "type": "need",
  "tag": "نیاز",
  "cls": "tag-need",
  "name": "...",
  "owner": "...",
  "desc": "...",
  "meta": "...",
  "keywords": ["..."]
}
```

`id` باید یکتا باشد. `cls` یکی از `tag-need` / `tag-opportunity` / `tag-capability` (برای رنگ برچسب). نیازی به تغییر `index.html` یا `worker.js` نیست.

---

## نقشه راه

- [x] فاز ۱ — Backend/AI: LLM Router با پشتیبانی چند Provider، رفع خطای ۴۰۵، جداسازی داده از کد
- [ ] فاز ۲ — طراحی Premium/Futuristic UI: نمایش گرافیکی شبکه‌ی ارتباط نیاز↔ظرفیت↔فرصت↔اعضا، انیمیشن و Micro-interaction پیشرفته‌تر، حالت 3D
- [ ] فاز ۳ — اتصال به پایگاه‌داده واقعی (PostgreSQL + Vector DB) به‌جای فایل JSON نمونه

---

## نکات امنیتی

- کلیدهای API **هرگز** در این ریپازیتوری، در `index.html`، یا در پیام‌های commit قرار نمی‌گیرند — فقط به‌صورت Secret روی Cloudflare.
- `APP_SECRET` یک لایه محافظتی حداقلی است (چون در کد frontend هم دیده می‌شود)؛ برای جلوگیری جدی از سوءاستفاده و کنترل هزینه، از **Security → WAF → Rate Limiting Rules** در داشبورد Cloudflare روی آدرس Worker استفاده کنید.
- در `worker.js`، `Access-Control-Allow-Origin` روی `https://saharnazyp.github.io` قفل شده — یعنی فقط فرانت‌اندی که از دامنه GitHub Pages خودتان لود شده اجازه دارد به Worker وصل شود. اگر روزی از دامنه سفارشی یا نام کاربری دیگری استفاده کردید، همین مقدار را در `worker.js` به‌روز کنید.
