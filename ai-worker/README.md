# ZigFlames "Talk to it" AI worker

This is a tiny Cloudflare Worker behind the Prompt Machine's **Talk to it** box (`studio/app/assets/ai-talk.js`).
The page sends the user's sentence and the machine's real button ids. The worker asks a cheap
OpenRouter model to pick buttons and a short idea, checks the answer, and returns:

```json
{ "settings": { "look": "onlyfans-creator", "heat": "spicy", "neonPick": "electric blue", "switches": { "uniqueFaces": true } },
  "idea": "McDonald's uniform on a rooftop at night", "extra_words": ["glossy"], "usage": { "est_usd": 0.00035 } }
```

The model never writes prompt text. The page builds prompts from its own banks. Both the worker
and the page throw out any id that isn't on the machine. Both also enforce adults 21+ (age, teen,
school and family words are stripped) and SFW gating.

Until this worker is deployed, the page uses a free on-device keyword matcher and shows
"AI not connected yet".

## Deploy (about 5 minutes)

1. Get an OpenRouter key at https://openrouter.ai/keys and add a few dollars of credit.
2. Log in to Cloudflare and deploy from this folder:
   ```bash
   cd ai-worker
   npx wrangler login                          # opens the browser once
   npx wrangler secret put OPENROUTER_API_KEY  # paste your key when asked
   npx wrangler deploy                         # prints https://zigflames-ai.<your-subdomain>.workers.dev
   ```
   If `wrangler deploy` complains about `[[ratelimits]]` (older wrangler or plan), delete that block in
   `wrangler.toml`. The worker then falls back to a built-in per-instance limit of 20 requests/min per IP.
3. Connect the page by setting `AI_ENDPOINT` near the top of `studio/app/assets/ai-talk.js`:
   ```js
   var AI_ENDPOINT = "https://zigflames-ai.<your-subdomain>.workers.dev";
   ```
   Then bump the `?v=` cache-buster and push. To test without editing, run this in the browser console:
   `localStorage.setItem("pm_ai_endpoint","https://…workers.dev")`. Remove it again with `localStorage.removeItem("pm_ai_endpoint")`.

## Settings

| What | Where | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | secret (`wrangler secret put`) | required |
| `MODEL` | `wrangler.toml` `[vars]` | `google/gemini-2.5-flash-lite` |
| Rate limit | `[[ratelimits]]` (20/min per IP) or `RATE_LIMIT_PER_MIN` fallback | 20/min |
| CORS | `ALLOWED` in `worker.js` | zigflames.com, www.zigflames.com, localhost, 127.0.0.1 |
| `max_tokens` / temperature | `worker.js` | 220 / 0.3 |

Other cheap models that do JSON mode: `mistralai/mistral-small-3.2-24b-instruct` ($0.075/$0.20 per M) and
`meta-llama/llama-3.3-70b-instruct` ($0.10/$0.32 per M). Avoid moderated models such as `openai/gpt-4o-mini`,
which may refuse 18+ requests.

## Cost

The default model costs $0.10 per million input tokens and $0.40 per million output tokens.
A typical call is about 3,000 input tokens (the option list plus instructions) and about 150 output tokens:

- about **$0.00036 per Make it**
- about **$0.36 per 1,000** calls
- about **$3.60 per 10,000** calls

Each response includes `usage.est_usd`, and the worker logs it (`npx wrangler tail`). Cloudflare Workers' free plan covers 100k requests a day.

## Local test

`node` with a mocked `fetch` (see `/workspace/pmtest/worker_test.mjs`), or `npx wrangler dev` plus
`localStorage.pm_ai_endpoint = "http://localhost:8787"`.
