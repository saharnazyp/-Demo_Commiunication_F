# FidaMatch — Demo

A live demo of **Fida's intelligent ecosystem matching engine**. FidaMatch uses a language model to match members' **needs, capabilities, and opportunities** with each other.

This version is **a presentation/demo build, not the final product**. Its database consists of a few sample records stored in a JSON file rather than a real PostgreSQL/Vector DB. However, its **AI layer is real and live**.

---

## Architecture

```text
Frontend (index.html, GitHub Pages)
        │  POST { query, records, provider }
        ▼
Backend / LLM Router (worker/worker.js, Cloudflare Worker)
        │  API keys stored here as Secrets only
        ▼
   ┌─────────┬─────────┬─────────┐
   │ Claude  │ OpenAI  │ Gemini  │   ← selected provider
   └─────────┴─────────┴─────────┘
        │  Raw model response (JSON)
        ▼
   Output validation & normalization
        │  { answer, matches: [...] }
        ▼
Frontend — Display answer and result cards
```

### Core Design Principle

**The frontend never exposes an API key and never needs to know which provider is being used.** It only sends a POST request to the Worker and receives a structured response.

Adding or switching providers only requires changes to `worker.js`.

---

## Project Structure

```text
.
├── index.html                ← Main page (Hero, Opportunity Radar,
│                                Trust Engine, 17 Confederations)
│                                + FidaMatch Assistant section
├── awards.html               ← Second page: Asset Barter Calculator
│                                + 12 Annual Awards
├── data/
│   └── fida-records.json    ← Sample database — edit only this file
│                                to add new records
├── worker/
│   └── worker.js             ← Cloudflare Worker (LLM Router)
│                                Paste this into Cloudflare, not your server
└── README.md
```

> **Note:** The Cloudflare Worker is not executed directly from GitHub. The code in `worker/worker.js` must be deployed through the Cloudflare dashboard or via the Wrangler CLI. Keeping the file in this repository is only for documentation and version control.

---

## Design

* **Font:** Estedad (weights 400–800 from the official CDN), with Vazirmatn as a safe fallback if Estedad fails to load. Headings use weights 700/800, body text 400/500, and buttons 500/600.
* **3D Icons:** The `icon-3d` class has been added to icon badges in the `<style>` sections of both files. It provides a glass-like top highlight, inner shadow, colored glow around the icon, and a 3D rotation effect on hover. This effect is most visible in the 12 award cards on `awards.html`.
* **Page Navigation:** The two pages are linked together. `index.html` contains buttons for **FidaMatch** and **Asset Barter Calculator & Awards**, while `awards.html` contains a **Back to Home** button.

---

# Backend Setup

### Complete this section first

## 1. Get Your API Key(s)

* Claude: [Anthropic Console](https://console.anthropic.com?utm_source=chatgpt.com) → API Keys
* OpenAI (optional): [OpenAI Platform](https://platform.openai.com/api-keys?utm_source=chatgpt.com)
* Gemini (optional): [Google AI Studio](https://aistudio.google.com/apikey?utm_source=chatgpt.com)

---

## 2. Deploy the Worker

If you already have a Worker at:

```text
fida.saharnazyaghoobpoor.workers.dev
```

there is no need to create a new Worker. Simply replace its code with the contents of `worker/worker.js`:

1. Open the [Cloudflare Dashboard](https://dash.cloudflare.com?utm_source=chatgpt.com).
2. Go to **Workers & Pages** → select the target Worker.
3. Click **Edit Code**.
4. Replace the entire existing code with the contents of `worker/worker.js`.
5. Click **Deploy**.

---

## 3. Configure API Keys as Secrets

In:

**Worker → Settings → Variables and Secrets → Add**

configure the following:

| Name                | Value                                      | Required?                                                  |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Claude API key                             | Yes (default provider)                                     |
| `OPENAI_API_KEY`    | OpenAI API key                             | Only if using `provider = openai`                          |
| `GEMINI_API_KEY`    | Gemini API key                             | Only if using `provider = gemini`                          |
| `APP_SECRET`        | Any custom string (e.g. a simple password) | Optional — lightweight protection against unauthorized use |

Set all of these as **Secrets**, not plain Text variables, so they are stored securely.

**Never put these values inside the source code or commit them to GitHub.**

---

## 4. Test the Backend Directly

### Do this before testing the frontend

Opening the Worker URL in a browser should return something similar to:

```json
{"status":"ok","service":"FidaMatch LLM Router", ...}
```

This confirms that the Worker has been deployed correctly.

This is a `GET` request. The actual matching logic is executed through `POST`.

### Test with cURL

Replace the URL with your own Worker URL:

```bash
curl -X POST https://fida.saharnazyaghoobpoor.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "query": "دنبال شریک صادراتی برای عراق می‌گردم",
    "provider": "claude",
    "records": [
      {
        "id": 0,
        "name": "فرصت صادرات به عراق",
        "desc": "صادرات خدمات فنی مهندسی به عراق",
        "owner": "تست",
        "meta": "تست",
        "keywords": ["عراق", "صادرات"]
      }
    ]
  }'
```

A successful response should look similar to:

```json
{
  "provider": "claude",
  "answer": "...",
  "matches": [
    {
      "id": 0,
      "match_percent": 90,
      "note": "..."
    }
  ]
}
```

If you receive a **401 error** → check `APP_SECRET` (or add the `X-App-Secret` header to your cURL request).

If you receive an error indicating that `ANTHROPIC_API_KEY` is not configured → go back to Step 3 and verify the Secret configuration.

> **About the previous 405 error:** When the Worker URL is opened directly in a browser, the browser sends a `GET` request. The updated `worker.js` now returns a health/status response for `GET` instead of an error. The actual matching logic is only executed through `POST`.
>
> If you still receive a 405 error after this change, the old Worker version is still deployed. Repeat Step 2 and deploy the updated `worker.js`.

---

# Frontend Setup

## 1. Configure the Worker URL in `index.html`

Near the beginning of the `<script>` section:

```js
const WORKER_URL = "https://fida.saharnazyaghoobpoor.workers.dev"; // your actual Worker URL
const APP_SECRET = ""; // if configured on the Worker, use the same value here
```

---

## 2. Publish on GitHub Pages

The project uses GitHub's default `github.io` domain. **No custom domain or DNS configuration is required.**

1. Commit `index.html` and the `data/` folder to the root of the repository.
2. Go to **Settings → Pages → Build and deployment**.
3. Select **Deploy from a branch**.
4. Choose the `main` branch and the `/ (root)` folder.
5. Click **Save**.

After a few minutes, the final URL should be:

```text
https://saharnazyp.github.io/Demo_Commiunication_F/
```

Open **exactly this URL** in your browser, without adding anything after the repository name.

---

## 3. Test the Frontend

Open the GitHub Pages URL, select one of the suggested queries, watch the pipeline progress at the top of the page, and wait for the real model response.

You can switch between **Claude / OpenAI / Gemini** using the provider buttons at the top of the page.

Only providers whose API keys have been configured in the Worker will work.

---

# Adding New Data

To add new records, simply edit:

```text
data/fida-records.json
```

Each record should follow this structure:

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

### Rules

* `id` must be unique.
* `cls` must be one of:

  * `tag-need`
  * `tag-opportunity`
  * `tag-capability`
* The `cls` value controls the label color.
* No changes to `index.html` or `worker.js` are required when adding records.

---

# Roadmap

* [x] **Phase 1 — Backend / AI:** Multi-provider LLM Router, 405 error fix, separation of data from application code
* [ ] **Phase 2 — Premium / Futuristic UI:** Graphical visualization of the **Need ↔ Capability ↔ Opportunity ↔ Member** network, more advanced animations and micro-interactions, and 3D mode
* [ ] **Phase 3 — Real Database Integration:** Replace the sample JSON database with **PostgreSQL + Vector DB**

---

# Security Notes

* API keys are **never stored in this repository, `index.html`, or Git commits**. They are stored only as Secrets in Cloudflare.
* `APP_SECRET` provides only a **minimal layer of protection**, because the value is also visible in the frontend code if configured there. For meaningful abuse prevention and cost control, configure **Security → WAF → Rate Limiting Rules** in the Cloudflare dashboard for the Worker endpoint.
* In `worker.js`, `Access-Control-Allow-Origin` is restricted to:

```text
https://saharnazyp.github.io
```

This means only the frontend served from your GitHub Pages domain is allowed to make requests to the Worker.

If you later move to a custom domain or a different GitHub username/domain, update this value in `worker.js` accordingly.
