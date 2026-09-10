// =====================================================================
// FidaMatch — AI Agent / LLM Router
//
// Frontend
//    ↓
// Cloudflare Worker
//    ↓
// LLM
//    ↓
// Tool Selection
//    ↓
// API #1 / API #2 / API #3
//    ↓
// LLM
//    ↓
// Final Answer
//
// Cloudflare Secrets:
//   OPENAI_API_KEY
//   ANTHROPIC_API_KEY
//   GEMINI_API_KEY
//   API1_URL
//   API1_KEY
//   API2_URL
//   API2_KEY
//   API3_URL
//   API3_KEY
//   APP_SECRET (optional)
//
// =====================================================================

export default {
  async fetch(request, env) {

    // ---------------------------------------------------------------
    // CORS
    // ---------------------------------------------------------------
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // ---------------------------------------------------------------
    // Health check
    // ---------------------------------------------------------------
    if (request.method === "GET") {
      return jsonResponse({
        status: "ok",
        service: "FidaMatch AI Agent",
        version: "2.0",
        architecture: "LLM + API Tools",
        tools: [
          "api_1",
          "api_2",
          "api_3"
        ]
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({
        error: "Method not allowed. Use POST."
      }, 405);
    }

    // ---------------------------------------------------------------
    // Optional application authentication
    // ---------------------------------------------------------------
    if (
      env.APP_SECRET &&
      request.headers.get("X-App-Secret") !== env.APP_SECRET
    ) {
      return jsonResponse({
        error: "Unauthorized"
      }, 401);
    }

    // ---------------------------------------------------------------
    // Read JSON
    // ---------------------------------------------------------------
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonResponse({
        error: "Request body must be valid JSON."
      }, 400);
    }

    const query = body.query;

    if (!query || typeof query !== "string") {
      return jsonResponse({
        error: "query is required."
      }, 400);
    }

    // ---------------------------------------------------------------
    // Provider
    //
    // Default = Claude
    // fallback = OpenAI
    // fallback = Gemini
    // ---------------------------------------------------------------
    const provider = body.provider || "claude";

    try {

      const result = await runAgent(
        query,
        provider,
        env
      );

      return jsonResponse({
        success: true,
        ...result
      });

    } catch (error) {

      return jsonResponse({
        success: false,
        error: error?.message || String(error)
      }, 502);
    }
  }
};


// =====================================================================
// AGENT
// =====================================================================

async function runAgent(query, provider, env) {

  // ---------------------------------------------------------------
  // STEP 1
  // Ask LLM what it needs to do
  // ---------------------------------------------------------------

  const systemPrompt = buildSystemPrompt();

  const firstResponse = await callLLM(
    provider,
    systemPrompt,
    query,
    env
  );

  // ---------------------------------------------------------------
  // STEP 2
  // Parse LLM decision
  // ---------------------------------------------------------------

  const decision = parseJSON(firstResponse);

  // No tool required
  if (
    !decision.tool ||
    decision.tool === "none"
  ) {

    return {
      provider,
      tool: null,
      answer: decision.answer || firstResponse,
      matches: decision.matches || []
    };
  }

  // ---------------------------------------------------------------
  // STEP 3
  // Execute selected API
  // ---------------------------------------------------------------

  const toolResult = await executeTool(
    decision.tool,
    decision.arguments || {},
    env
  );

  // ---------------------------------------------------------------
  // STEP 4
  // Send API result back to LLM
  // ---------------------------------------------------------------

  const finalPrompt = `
سؤال کاربر:

${query}

ابزار انتخاب شده:

${decision.tool}

نتیجه API:

${JSON.stringify(toolResult, null, 2)}

اکنون بر اساس نتیجه واقعی API به کاربر پاسخ بده.

قوانین:

1. فارسی پاسخ بده.
2. اطلاعاتی که در API وجود ندارد اختراع نکن.
3. پاسخ کوتاه و طبیعی باشد.
4. اگر نتیجه‌ای پیدا نشد واضح بگو.
5. اگر چند نتیجه وجود دارد حداکثر 3 مورد مهم را نمایش بده.
6. پاسخ فقط JSON معتبر باشد.

فرمت:

{
  "answer": "پاسخ فارسی",
  "matches": [
    {
      "id": "شناسه",
      "match_percent": 95,
      "note": "دلیل ارتباط"
    }
  ]
}
`;

  const finalResponse = await callLLM(
    provider,
    systemPrompt,
    finalPrompt,
    env
  );

  const finalJSON = parseJSON(finalResponse);

  return {
    provider,
    tool: decision.tool,
    answer: finalJSON.answer || "",
    matches: finalJSON.matches || [],
    api_result: toolResult
  };
}


// =====================================================================
// SYSTEM PROMPT
// =====================================================================

function buildSystemPrompt() {

  return `
شما FidaMatch AI Agent هستید.

وظیفه شما این است که سؤال کاربر را بفهمید و تشخیص دهید
آیا برای پاسخ دادن باید یکی از APIهای سیستم را صدا بزنید یا خیر.

سه ابزار در اختیار شماست:

api_1
api_2
api_3

قوانین:

- اگر برای پاسخ به اطلاعات سیستم نیاز داری، یکی از APIها را انتخاب کن.
- اگر سؤال نیاز به API ندارد، tool را none قرار بده.
- حدس نزن.
- اطلاعات ساختگی تولید نکن.
- اگر مطمئن نیستی، مناسب‌ترین API را انتخاب کن.

پاسخ تصمیم‌گیری باید دقیقاً JSON باشد.

فرمت:

{
  "tool": "api_1",
  "arguments": {
    "query": "..."
  }
}

یا:

{
  "tool": "none",
  "answer": "..."
}

اگر API لازم است، arguments باید شامل query اصلی کاربر باشد.
`;
}


// =====================================================================
// TOOL ROUTER
// =====================================================================

async function executeTool(tool, args, env) {

  switch (tool) {

    case "api_1":
      return await callAPI1(args, env);

    case "api_2":
      return await callAPI2(args, env);

    case "api_3":
      return await callAPI3(args, env);

    default:
      throw new Error(
        `Unknown tool: ${tool}`
      );
  }
}


// =====================================================================
// API #1
// =====================================================================

async function callAPI1(args, env) {

  if (!env.API1_URL) {
    throw new Error("API1_URL تنظیم نشده است.");
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (env.API1_KEY) {
    headers["Authorization"] =
      `Bearer ${env.API1_KEY}`;
  }

  const response = await fetch(
    env.API1_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: args.query || ""
      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `API #1 Error ${response.status}: ${text}`
    );
  }

  return await response.json();
}


// =====================================================================
// API #2
// =====================================================================

async function callAPI2(args, env) {

  if (!env.API2_URL) {
    throw new Error("API2_URL تنظیم نشده است.");
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (env.API2_KEY) {
    headers["Authorization"] =
      `Bearer ${env.API2_KEY}`;
  }

  const response = await fetch(
    env.API2_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: args.query || ""
      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `API #2 Error ${response.status}: ${text}`
    );
  }

  return await response.json();
}


// =====================================================================
// API #3
// =====================================================================

async function callAPI3(args, env) {

  if (!env.API3_URL) {
    throw new Error("API3_URL تنظیم نشده است.");
  }

  const headers = {
    "Content-Type": "application/json"
  };

  if (env.API3_KEY) {
    headers["Authorization"] =
      `Bearer ${env.API3_KEY}`;
  }

  const response = await fetch(
    env.API3_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: args.query || ""
      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `API #3 Error ${response.status}: ${text}`
    );
  }

  return await response.json();
}


// =====================================================================
// LLM ROUTER
// =====================================================================

async function callLLM(
  provider,
  systemPrompt,
  userPrompt,
  env
) {

  // ---------------------------------------------------------------
  // Claude
  // ---------------------------------------------------------------

  if (provider === "claude") {

    try {

      return await callClaude(
        systemPrompt,
        userPrompt,
        env
      );

    } catch (error) {

      console.log(
        "Claude failed, trying OpenAI..."
      );

      if (env.OPENAI_API_KEY) {

        try {

          return await callOpenAI(
            systemPrompt,
            userPrompt,
            env
          );

        } catch {}

      }

      if (env.GEMINI_API_KEY) {

        return await callGemini(
          systemPrompt,
          userPrompt,
          env
        );
      }

      throw error;
    }
  }


  // ---------------------------------------------------------------
  // OpenAI
  // ---------------------------------------------------------------

  if (provider === "openai") {

    try {

      return await callOpenAI(
        systemPrompt,
        userPrompt,
        env
      );

    } catch (error) {

      if (env.ANTHROPIC_API_KEY) {

        return await callClaude(
          systemPrompt,
          userPrompt,
          env
        );
      }

      throw error;
    }
  }


  // ---------------------------------------------------------------
  // Gemini
  // ---------------------------------------------------------------

  if (provider === "gemini") {

    return await callGemini(
      systemPrompt,
      userPrompt,
      env
    );
  }


  throw new Error(
    `Unknown provider: ${provider}`
  );
}


// =====================================================================
// CLAUDE
// =====================================================================

async function callClaude(
  systemPrompt,
  userPrompt,
  env
) {

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY تنظیم نشده است."
    );
  }

  const response = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },

      body: JSON.stringify({

        model: "claude-sonnet-4-6",

        max_tokens: 1500,

        system: systemPrompt,

        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `Claude API Error ${response.status}: ${text}`
    );
  }

  const data = await response.json();

  return (
    data.content
      ?.filter(
        block => block.type === "text"
      )
      .map(
        block => block.text
      )
      .join("\n")
      || ""
  );
}


// =====================================================================
// OPENAI
// =====================================================================

async function callOpenAI(
  systemPrompt,
  userPrompt,
  env
) {

  if (!env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY تنظیم نشده است."
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${env.OPENAI_API_KEY}`
      },

      body: JSON.stringify({

        model: "gpt-4o-mini",

        temperature: 0.1,

        max_tokens: 1500,

        messages: [

          {
            role: "system",
            content: systemPrompt
          },

          {
            role: "user",
            content: userPrompt
          }

        ]
      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `OpenAI API Error ${response.status}: ${text}`
    );
  }

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content
    || ""
  );
}


// =====================================================================
// GEMINI
// =====================================================================

async function callGemini(
  systemPrompt,
  userPrompt,
  env
) {

  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY تنظیم نشده است."
    );
  }

  const prompt = `
${systemPrompt}

USER:
${userPrompt}
`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },

      body: JSON.stringify({

        contents: [

          {
            parts: [
              {
                text: prompt
              }
            ]
          }

        ],

        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500
        }

      })
    }
  );

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `Gemini API Error ${response.status}: ${text}`
    );
  }

  const data = await response.json();

  return (
    data.candidates
      ?.[0]
      ?.content
      ?.parts
      ?.map(
        part => part.text || ""
      )
      .join("")
    || ""
  );
}


// =====================================================================
// SAFE JSON PARSER
// =====================================================================

function parseJSON(text) {

  if (!text) {
    throw new Error(
      "LLM پاسخ خالی برگرداند."
    );
  }

  let clean = text.trim();

  // Remove markdown fences
  clean = clean
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  // Direct parse
  try {
    return JSON.parse(clean);
  } catch {}

  // Try extracting JSON object
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");

  if (
    start !== -1 &&
    end !== -1 &&
    end > start
  ) {

    const jsonPart =
      clean.slice(start, end + 1);

    try {
      return JSON.parse(jsonPart);
    } catch {}
  }

  throw new Error(
    "پاسخ LLM JSON معتبر نبود: " +
    clean.slice(0, 500)
  );
}


// =====================================================================
// CORS
// =====================================================================

function corsHeaders() {

  return {

    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, X-App-Secret",

    "Access-Control-Max-Age":
      "86400"
  };
}


// =====================================================================
// JSON RESPONSE
// =====================================================================

function jsonResponse(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        ...corsHeaders()
      }
    }
  );
}
