import { callModel } from "../openrouter";
import { CHAIRPERSON_MODEL, CONSENSUS_MODEL, CHAT_CHAIRPERSON_PROMPT, CHAT_CONSENSUS_PROMPT, formatModelLabel } from "./agents";
import type { AgentConfig } from "./agents";
import type { ChairpersonAnalysis, AgentOpinion, Deliberation, Consensus, PeerRank, PeerRankingEntry } from "./types";

const CHAIRPERSON_PROMPT = `You are the Chairperson of an AI Council. Analyze incoming requests and structure them for the council.

Return ONLY valid JSON (no markdown code fences) in this exact shape:
{
  "intent": "clear statement of what needs to be decided",
  "dimensions": ["dimension1", "dimension2", "dimension3", "dimension4"],
  "context": "relevant constraints and context",
  "scope": "brief description of decision scope"
}`;

const CONSENSUS_PROMPT = `You are the Consensus Engine of an AI Council reviewing AI project proposals. You receive expert opinions and deliberation from council agents. Synthesize them into a unified decision report.

Weigh areas of agreement heavily. Acknowledge valid unresolved critiques. Be actionable.

For "decision":
- "approved" = majority vote APPROVE with no critical blockers
- "rejected" = majority vote REJECT or critical unresolvable risks
- "revision_required" = concerns can be addressed; proposal should be revised and resubmitted

For "riskLevel":
- "low" = minor issues, safe to proceed
- "medium" = meaningful risks that need mitigation
- "high" = serious ethical, legal, security, or operational risks

Return ONLY valid JSON (no markdown code fences) in this exact shape:
{
  "recommendation": "clear, actionable recommendation",
  "reasoning": "why this is the best path given all perspectives",
  "keyPoints": ["insight1", "insight2", "insight3"],
  "dissent": "notable minority opinion worth flagging",
  "confidence": 85,
  "decision": "approved" | "rejected" | "revision_required",
  "riskLevel": "low" | "medium" | "high"
}`;

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text.trim();
}

function resolvedModel(agentModel: string): string {
  return process.env.COUNCIL_MODEL ?? agentModel;
}

export async function runChairperson(prompt: string, mode?: "chat" | "proposal"): Promise<ChairpersonAnalysis> {
  const response = await callModel({
    model: CHAIRPERSON_MODEL,
    systemPrompt: mode === "chat" ? CHAT_CHAIRPERSON_PROMPT : CHAIRPERSON_PROMPT,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  try {
    return JSON.parse(extractJson(response)) as ChairpersonAnalysis;
  } catch {
    if (mode === "chat") {
      return {
        intent: prompt,
        dimensions: ["Logic & Evidence", "Practical Impact", "Long-term View", "Critical Challenge"],
        context: "Open-ended question requiring multiple perspectives",
        scope: "Full multi-angle analysis",
        agents: [
          { name: "Analyst",          emoji: "🔍", role: "Logic & Evidence",    focus: "Apply clear reasoning and evidence to evaluate the question objectively." },
          { name: "Pragmatist",       emoji: "🎯", role: "Practical Impact",    focus: "Focus on real-world implications and practical outcomes." },
          { name: "Visionary",        emoji: "🦅", role: "Long-term View",      focus: "Consider long-term consequences and second-order effects." },
          { name: "Devil's Advocate", emoji: "😈", role: "Critical Challenge",  focus: "Challenge assumptions and find flaws in the prevailing view." },
        ],
      };
    }
    return {
      intent: prompt,
      dimensions: ["Technical feasibility", "Risk & security", "Cost efficiency", "Failure modes"],
      context: "General council review",
      scope: "Full multi-agent analysis",
    };
  }
}

export async function getAgentOpinion(
  agent: AgentConfig,
  userPrompt: string,
  analysis: ChairpersonAnalysis
): Promise<AgentOpinion> {
  const usedModel = resolvedModel(agent.model);

  const contextMessage = `Task: ${userPrompt}

Chairperson's briefing:
- Intent: ${analysis.intent}
- Dimensions to cover: ${analysis.dimensions.join(", ")}
- Context: ${analysis.context}
- Scope: ${analysis.scope}

Provide your expert analysis.`;

  const response = await callModel({
    model: usedModel,
    systemPrompt: agent.systemPrompt,
    messages: [{ role: "user", content: contextMessage }],
    temperature: 0.75,
  });

  const confidenceMatch = response.match(/\*\*Confidence:\*\*\s*(\d+)/);
  const confidence = confidenceMatch ? Math.min(100, parseInt(confidenceMatch[1])) : 75;

  const assessmentMatch = response.match(/\*\*Assessment:\*\*\s*([^\n]+)/);
  const assessment = assessmentMatch ? assessmentMatch[1].trim() : "";

  const voteMatch = response.match(/\*\*Vote:\*\*\s*(APPROVE|REJECT|REVISE)/i);
  const voteRaw = voteMatch?.[1]?.toLowerCase();
  const vote: AgentOpinion["vote"] =
    voteRaw === "approve" ? "approve" : voteRaw === "reject" ? "reject" : voteRaw === "revise" ? "revise" : undefined;

  return {
    agentId: agent.id,
    agentName: agent.name,
    emoji: agent.emoji,
    role: agent.role,
    color: agent.color,
    model: usedModel,
    modelLabel: formatModelLabel(usedModel),
    assessment,
    content: response,
    confidence,
    vote,
  };
}

export async function runDeliberation(
  opinions: AgentOpinion[],
  userPrompt: string
): Promise<Deliberation[]> {
  return Promise.all(
    opinions.map(async (current) => {
      const othersSummary = opinions
        .filter((o) => o.agentId !== current.agentId)
        .map((o) => `${o.agentName} (${o.role}): ${o.assessment}`)
        .join("\n");

      const deliberationPrompt = `The council is deliberating on: "${userPrompt}"

Other agents' positions:
${othersSummary}

React briefly (2-3 sentences) from your ${current.role} perspective. Start your response with exactly one of: AGREE, PARTIAL, or DISAGREE — then explain.`;

      const response = await callModel({
        model: resolvedModel(current.model),
        systemPrompt: `You are the ${current.agentName} on an AI Council (${current.role}). Be direct and opinionated.`,
        messages: [{ role: "user", content: deliberationPrompt }],
        temperature: 0.8,
      });

      const match = response.match(/^(AGREE|PARTIAL|DISAGREE)/i);
      const raw = match?.[1]?.toLowerCase() ?? "partial";
      const agreement = (["agree", "partial", "disagree"].includes(raw) ? raw : "partial") as
        | "agree"
        | "partial"
        | "disagree";

      return {
        fromAgentId: current.agentId,
        fromAgentName: current.agentName,
        emoji: current.emoji,
        critique: response,
        agreement,
      };
    })
  );
}

export async function runPeerRanking(opinions: AgentOpinion[]): Promise<PeerRankingEntry[]> {
  return Promise.all(
    opinions.map(async (rater) => {
      const others = opinions.filter((o) => o.agentId !== rater.agentId);
      // Shuffle to prevent positional bias in ranking
      const shuffled = [...others].sort(() => Math.random() - 0.5);
      const LABELS = ["Response A", "Response B", "Response C"];
      const labeled = shuffled.map((o, i) => ({ label: LABELS[i], opinion: o }));

      const responsesText = labeled
        .map(({ label, opinion }) => `### ${label}\n${opinion.content}`)
        .join("\n\n---\n\n");

      const rankingPrompt = `You are reviewing ${others.length} anonymous peer responses to the same proposal. Rank them from BEST (rank 1) to WORST (rank ${others.length}) based on depth, accuracy, and actionability.

PEER RESPONSES:
${responsesText}

Return ONLY valid JSON (no markdown fences):
{
  "rankings": [
    { "label": "Response A", "rank": 1, "justification": "one concise sentence" },
    { "label": "Response B", "rank": 2, "justification": "one concise sentence" },
    { "label": "Response C", "rank": 3, "justification": "one concise sentence" }
  ]
}`;

      const response = await callModel({
        model: resolvedModel(rater.model),
        systemPrompt: `You are ${rater.agentName}, providing objective peer review of anonymous council responses.`,
        messages: [{ role: "user", content: rankingPrompt }],
        temperature: 0.3,
      });

      let rankings: PeerRank[] = [];
      try {
        const parsed = JSON.parse(extractJson(response)) as {
          rankings: { label: string; rank: number; justification: string }[];
        };
        rankings = parsed.rankings.map((r) => {
          const match = labeled.find((lm) => lm.label === r.label);
          return {
            targetAgentId: match?.opinion.agentId ?? r.label,
            rank: r.rank,
            justification: r.justification,
          };
        });
      } catch {
        rankings = others.map((o, i) => ({ targetAgentId: o.agentId, rank: i + 1, justification: "" }));
      }

      return { rankerAgentId: rater.agentId, rankerAgentName: rater.agentName, emoji: rater.emoji, rankings };
    })
  );
}

export async function buildConsensus(
  opinions: AgentOpinion[],
  deliberations: Deliberation[],
  userPrompt: string,
  peerRankings?: PeerRankingEntry[],
  mode?: "chat" | "proposal",
): Promise<Consensus> {
  const opinionsText = opinions
    .map((o) => `### ${o.agentName} (${o.role}, via ${o.modelLabel})\n${o.content}`)
    .join("\n\n---\n\n");

  const deliberationsText = deliberations
    .map((d) => `${d.fromAgentName}: ${d.critique}`)
    .join("\n\n");

  let rankingSummary = "";
  if (peerRankings && peerRankings.length > 0) {
    const scores: Record<string, number[]> = {};
    peerRankings.forEach((pr) => pr.rankings.forEach((r) => { (scores[r.targetAgentId] ??= []).push(r.rank); }));
    const sorted = Object.entries(scores)
      .map(([id, ranks]) => ({ name: opinions.find((o) => o.agentId === id)?.agentName ?? id, avg: ranks.reduce((a, b) => a + b, 0) / ranks.length }))
      .sort((a, b) => a.avg - b.avg);
    rankingSummary = `\nPEER RANKINGS (rank 1 = most valued by peers):\n${sorted.map((s) => `- ${s.name}: avg rank ${s.avg.toFixed(2)}`).join("\n")}\n`;
  }

  const consensusPrompt = `Original request: "${userPrompt}"

INITIAL OPINIONS:
${opinionsText}

DELIBERATION ROUND:
${deliberationsText}
${rankingSummary}
Synthesize a final council recommendation.`;

  const response = await callModel({
    model: CONSENSUS_MODEL,
    systemPrompt: mode === "chat" ? CHAT_CONSENSUS_PROMPT : CONSENSUS_PROMPT,
    messages: [{ role: "user", content: consensusPrompt }],
    temperature: 0.4,
  });

  try {
    return JSON.parse(extractJson(response)) as Consensus;
  } catch {
    return {
      recommendation: response,
      reasoning: "Based on full council deliberation.",
      keyPoints: [],
      dissent: "",
      confidence: 80,
    };
  }
}
