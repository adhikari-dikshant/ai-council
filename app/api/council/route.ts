import { NextRequest } from "next/server";
import { COUNCIL_AGENTS } from "@/lib/council/agents";
import {
  runChairperson,
  getAgentOpinion,
  runDeliberation,
  runPeerRanking,
  buildConsensus,
} from "@/lib/council/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { prompt } = await request.json();
  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // ① Chairperson analysis
        send("status", { phase: "analyzing", message: "The Chairperson is analyzing your request…" });
        const analysis = await runChairperson(prompt);
        send("chairperson", analysis);

        // ② Council agents think in parallel
        send("status", { phase: "thinking", message: "Council agents are formulating their positions…" });
        const opinions = await Promise.all(
          COUNCIL_AGENTS.map(async (agent) => {
            const opinion = await getAgentOpinion(agent, prompt, analysis);
            send("agent_opinion", opinion);
            return opinion;
          })
        );

        // ③ Deliberation round
        send("status", { phase: "deliberating", message: "The council is deliberating…" });
        const deliberations = await runDeliberation(opinions, prompt);
        deliberations.forEach((d) => send("deliberation", d));

        // ④ Peer ranking — each agent anonymously ranks the others' responses
        send("status", { phase: "ranking", message: "Agents are anonymously ranking each other's responses…" });
        const peerRankings = await runPeerRanking(opinions);
        peerRankings.forEach((r) => send("peer_ranking", r));

        // ⑤ Consensus
        send("status", { phase: "synthesizing", message: "Building consensus…" });
        const consensus = await buildConsensus(opinions, deliberations, prompt, peerRankings);
        send("consensus", consensus);

        send("done", {});
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
