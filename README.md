# 🏛️ AI Council

> **Round-table intelligence, not one lonely model doing all the thinking.**

AI Council is a multi-agent reasoning system built on [OpenRouter](https://openrouter.ai). Instead of asking one AI for an answer, it convenes a council of specialized agents that think in parallel, debate each other, and reach a consensus verdict — exposing the full deliberation, not just the conclusion.

---

## How It Works

```
User Prompt
    ↓
⚖️  Chairperson  — understands intent, defines dimensions
    ↓
🏗️ 🔐 💸 😈  Council agents think in parallel (4 simultaneous LLM calls)
    ↓
💬  Deliberation  — each agent critiques the others
    ↓
🏛️  Consensus Engine  — synthesizes a final verdict
    ↓
User sees everything: raw opinions, debate, and the verdict
```

Everything streams live via SSE — you watch the council think in real time.

---

## The Council

| Agent | Role | Bias |
|---|---|---|
| 🏗️ **Architect** | System design & scalability | Clean patterns, long-term thinking |
| 🔐 **Security** | Threats & risk analysis | Paranoid by design, assumes breach |
| 💸 **Cost Optimizer** | Economics & efficiency | Complexity is a liability |
| 😈 **Devil's Advocate** | Failure analysis & blind spots | Finds what everyone else missed |
| ⚖️ **Chairperson** | Task analysis & routing | Delegates, never solves |
| 🏛️ **Consensus Engine** | Final synthesis | Weighs all perspectives |

All agents run on the same model (configurable), with different system prompts and intentional biases.

---

## Quickstart

### 1. Clone

```bash
git clone https://github.com/adhikari-dikshant/ai-council.git
cd ai-council
```

### 2. Install

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env.local
```

Open `.env.local` and add your keys:

```env
# Required — get yours at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-...

# Optional — any model on OpenRouter (default: openai/gpt-4o-mini)
COUNCIL_MODEL=openai/gpt-4o-mini
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), type a question, and convene the council.

---

## Choosing a Model

The `COUNCIL_MODEL` env var controls which model all agents use. Any model available on OpenRouter works.

| Model | Speed | Quality | Cost |
|---|---|---|---|
| `openai/gpt-4o-mini` | ⚡ Fast | Good | $ (default) |
| `anthropic/claude-3.5-haiku` | ⚡ Fast | Great | $ |
| `openai/gpt-4o` | Medium | Excellent | $$$ |
| `anthropic/claude-3.5-sonnet` | Medium | Excellent | $$$ |
| `google/gemini-flash-1.5` | ⚡ Fast | Good | $ |
| `meta-llama/llama-3.1-70b-instruct` | Medium | Good | $ |

For production / high-stakes decisions: `anthropic/claude-3.5-sonnet` or `openai/gpt-4o`.
For fast exploration: `openai/gpt-4o-mini` (default).

---

## Project Structure

```
ai-council/
├── app/
│   ├── api/
│   │   └── council/
│   │       └── route.ts        # SSE streaming endpoint — orchestrates the full council flow
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Full UI: input form + live council session display
│
├── lib/
│   ├── openrouter.ts           # OpenRouter API wrapper
│   └── council/
│       ├── agents.ts           # Agent definitions (role, emoji, color, system prompt)
│       ├── session.ts          # Orchestration: chairperson → agents → deliberation → consensus
│       └── types.ts            # TypeScript interfaces for all council data
│
├── .env.example                # Environment variable template
└── next.config.mjs
```

---

## Customising Agents

Agents are plain objects in `lib/council/agents.ts`. To add or swap one:

```ts
// lib/council/agents.ts
export const COUNCIL_AGENTS: AgentConfig[] = [
  {
    id: "lawyer",
    name: "Legal Counsel",
    emoji: "⚖️",
    role: "Legal & Compliance Risk",
    color: "blue",                    // blue | red | green | purple
    systemPrompt: `You are the Legal Counsel on an AI Council...`,
  },
  // ... other agents
];
```

The orchestrator in `lib/council/session.ts` picks up all agents automatically — no other changes needed.

---

## Customising the Model Per Agent

By default every agent uses the same `COUNCIL_MODEL`. If you want different models per role, edit `lib/council/session.ts`:

```ts
// Give the Devil's Advocate a more creative model
const opinion = await callModel({
  model: "anthropic/claude-3-opus",   // override for this agent only
  systemPrompt: agent.systemPrompt,
  messages: [...],
});
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Yes | — | Your OpenRouter API key |
| `COUNCIL_MODEL` | No | `openai/gpt-4o-mini` | Model used by all council agents |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Sent as `HTTP-Referer` to OpenRouter |

---

## Tech Stack

- **[Next.js 14](https://nextjs.org)** — App Router, API Route Handlers
- **[OpenRouter](https://openrouter.ai)** — unified API for 200+ LLMs
- **[Tailwind CSS](https://tailwindcss.com)** — styling
- **Server-Sent Events (SSE)** — real-time streaming of council phases

---

## API Reference

### `POST /api/council`

Streams the full council session as SSE events.

**Request body**
```json
{ "prompt": "Design a scalable SaaS architecture for a startup..." }
```

**SSE events** (in order)

| Event | Payload | When |
|---|---|---|
| `status` | `{ phase, message }` | Phase transitions |
| `chairperson` | `ChairpersonAnalysis` | After intent analysis |
| `agent_opinion` | `AgentOpinion` | As each agent completes (parallel) |
| `deliberation` | `Deliberation` | As each agent critiques the others |
| `consensus` | `Consensus` | Final verdict |
| `done` | `{}` | Session complete |
| `error` | `{ message }` | On failure |

**Consuming the stream**
```ts
const res = await fetch("/api/council", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
let currentEvent = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
    else if (line.startsWith("data: ") && currentEvent) {
      const data = JSON.parse(line.slice(6));
      console.log(currentEvent, data);
      currentEvent = "";
    }
  }
}
```

---

## Perfect For

- Architecture decisions
- Product strategy & roadmaps
- Code review from multiple angles
- UX critiques
- Startup brainstorming
- Any decision where one opinion isn't enough

---

## Roadmap

- [ ] Model-diverse council (different model per agent seat)
- [ ] Long-term council memory (past debates, agent trust scores)
- [ ] Simulation mode (run the same prompt with conservative / aggressive / experimental bias sets)
- [ ] Recursive sub-councils for complex multi-part decisions
- [ ] Export session as PDF / Markdown

---

## License

MIT
