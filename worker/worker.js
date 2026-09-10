// =====================================================================
// FidaMatch — LLM Router (Cloudflare Worker)
//
// نقش این فایل در معماری:
//   Frontend → این Worker (Backend/API + LLM Router) → OpenAI/Claude/Gemini
//            → تجمیع و اعتبارسنجی خروجی → پاسخ ساخت‌یافته → Frontend
//
// هیچ کلید API داخل این فایل نوشته نمی‌شود. همه‌ی کلیدها باید در تنظیمات
// Worker → Settings → Variables and Secrets اضافه شوند:
//   ANTHROPIC_API_KEY   (برای Claude)
//   OPENAI_API_KEY      (برای OpenAI — اختیاری، اگر آن Provider را می‌خواهید)
//   GEMINI_API_KEY      (برای Gemini — اختیاری)
//   APP_SECRET          (اختیاری — محافظت سبک در برابر استفاده‌ی غیرمجاز)
//
// نکته‌ی مهم درباره‌ی خطای 405 قبلی:
//   اگر آدرس Worker را مستقیم در مرورگر باز کنید، یک درخواست GET ارسال
//   می‌شود. قبلاً این حالت مدیریت نشده بود و باعث سردرگمی می‌شد. الان یک
//   پاسخ سالم و قابل‌فهم برای GET برمی‌گردد (برای تست سریع سلامت سرویس)،
//   و فقط درخواست‌های واقعی POST برای جستجو استفاده می‌شوند.
// =====================================================================

export default {
  async fetch(request, env) {
    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // --- health-check ساده برای تست سریع در مرورگر ---
    if (request.method === "GET") {
      return jsonResponse(
        {
          status: "ok",
          service: "FidaMatch LLM Router",
          message: "این Worker فقط به درخواست‌های POST پاسخ می‌دهد. برای تست واقعی، از فرانت‌اند یا curl استفاده کنید.",
          expected_body: { query: "string", records: "array", provider: "claude | openai | gemini" },
        },
        200
      );
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. از POST استفاده کنید." }, 405);
    }

    // --- محافظت سبک با APP_SECRET (اختیاری) ---
    if (env.APP_SECRET && request.headers.get("X-App-Secret") !== env.APP_SECRET) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // --- خواندن بدنه‌ی درخواست ---
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: "بدنه درخواست باید JSON معتبر باشد." }, 400);
    }

    const { query, records, provider = "claude" } = body;

    if (!query || typeof query !== "string") {
      return jsonResponse({ error: "فیلد query الزامی است." }, 400);
    }
    if (!Array.isArray(records) || records.length === 0) {
      return jsonResponse({ error: "فیلد records باید آرایه‌ای غیرخالی باشد." }, 400);
    }

    const prompt = buildPrompt(query, records);

    try {
      let rawText;
      switch (provider) {
        case "openai":
          rawText = await callOpenAI(prompt, env);
          break;
        case "gemini":
          rawText = await callGemini(prompt, env);
          break;
        case "claude":
        default:
          rawText = await callClaude(prompt, env);
          break;
      }

      const parsed = parseModelJson(rawText);
      return jsonResponse({ provider, answer: parsed.answer, matches: parsed.matches || [] }, 200);
    } catch (err) {
      return jsonResponse({ error: String(err.message || err) }, 502);
    }
  },
};

// ---------------------------------------------------------------------
// پرامپت مشترک — مستقل از Provider
// ---------------------------------------------------------------------
function buildPrompt(query, records) {
  return `شما موتور تطبیق «فیدامچ» هستید، بخشی از لایه RAG اکوسیستم فیدا. کارت این است که نیت واقعی کاربر را از سؤالش بفهمی و در پایگاه‌داده زیر بهترین تطبیق‌ها را پیدا کنی.

پایگاه‌داده (JSON):
${JSON.stringify(records, null, 2)}

سؤال کاربر: "${query}"

فقط و فقط یک شیء JSON خام برگردان (بدون توضیح اضافه، بدون بک‌تیک، بدون markdown) دقیقاً با این ساختار:
{
  "answer": "یک جمله کوتاه فارسی و محاوره‌ای درباره‌ی چیزی که پیدا کردی یا نکردی",
  "matches": [
    {"id": 0, "match_percent": 92, "note": "یک جمله کوتاه فارسی که توضیح بدهد چرا این مورد مرتبط است"}
  ]
}
حداکثر ۳ مورد، فقط مواردی که واقعاً مرتبط‌اند (نه صرفاً هم‌کلمه). "id" باید دقیقاً برابر با فیلد id همان رکورد در پایگاه‌داده باشد. اگر هیچ موردی مرتبط نبود، matches را آرایه خالی بگذار و answer را متناسب با آن بنویس.`;
}

// ---------------------------------------------------------------------
// Provider adapters — هر کدام رشته متن خام مدل را برمی‌گردانند
// ---------------------------------------------------------------------
async function callClaude(prompt, env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY تنظیم نشده است.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function callOpenAI(prompt, env) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY تنظیم نشده است.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(prompt, env) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY تنظیم نشده است.");
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function parseModelJson(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error("پاسخ مدل JSON معتبر نبود: " + text.slice(0, 200));
  }
}

function corsHeaders() {
  return {
    // باز برای همه دامنه‌ها — چون قرار است از چند جا (گیت‌هاب، تست محلی، دامنه‌های مختلف) قابل استفاده باشد.
    // اگر بعداً خواستید امنیت را بالاتر ببرید، این را به دامنه(های) دقیق خودتان محدود کنید.
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
