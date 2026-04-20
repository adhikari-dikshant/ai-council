import { callModel } from "../openrouter";
import { COUNCIL_AGENTS, CHAIRPERSON_MODEL, CONSENSUS_MODEL, formatModelLabel } from "./agents";
import type { ChairpersonAnalysis, AgentOpinion, Deliberation, Consensus } from "./types";

const CHAIRPERSON_PROMPT = `You are the Chairperson of an AI Council. Analyze incoming requests and structure them for the council.

Return ONLY valid JSON (no markdown code fences) in this exact shape:
{
  "intent": "clear statement of what needs to be decided",
  "dimensions": ["dimension1", "dimension2", "dimension3", "dimension4"],
  "context": "relevant constraints and context",
  "scope": "brief description of decision scope"
}`;

const CONSENSUS_PROMPT = `You are the Consensus Engine of an AI Council. You receive expert opinions and deliberation from council agents. Synthesize them into a unified recommendation.

Weigh areas of agreement heavily. Acknowledge valid unresolved critiques. Be actionable.

Return ONLY valid JSON (no markdown code fences) in this exact shape:
{
  "recommendation": "clear, actionable recommendation",
  "reasoning": "why this is the best path given all perspectives",
  "keyPoints": ["insight1", "insight2", "insight3"],
  "dissent": "notable minority opinion worth flagging",
  "confidence": 85
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

export async function runChairperson(prompt: string): Promise<ChairpersonAnalysis> {
  const response = await callModel({
    model: CHAIRPERSON_MODEL,
    systemPrompt: CHAIRPERSON_PROMPT,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  try {
    return JSON.parse(extractJson(response)) as ChairpersonAnalysis;
  } catch {
    return {
      intent: prompt,
      dimensions: ["Technical feasibility", "Risk & security", "Cost efficiency", "Failure modes"],
      context: "General council review",
      scope: "Full multi-agent analysis",
    };
  }
}

export async function getAgentOpinion(
  agent: (typeof COUNCIL_AGENTS)[number],
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
  };
}

export async function runDeliberation(
  opinions: AgentOpinion[],
  userPrompt: string
): Promise<Deliberation[]> {
  return Promise.all(
    opinions.map(async (current) => {
      const agent = COUNCIL_AGENTS.find((a) => a.id === current.agentId)!;
      const othersSummary = opinions
        .filter((o) => o.agentId !== current.agentId)
        .map((o) => `${o.agentName} (${o.role}): ${o.assessment}`)
        .join("\n");

      const deliberationPrompt = `The council is deliberating on: "${userPrompt}"

Other agents' positions:
${othersSummary}

React briefly (2-3 sentences) from your ${current.role} perspective. Start your response with exactly one of: AGREE, PARTIAL, or DISAGREE — then explain.`;

      const response = await callModel({
        model: resolvedModel(agent.model),
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

export async function buildConsensus(
  opinions: AgentOpinion[],
  deliberations: Deliberation[],
  userPrompt: string
): Promise<Consensus> {
  const opinionsText = opinions
    .map((o) => `### ${o.agentName} (${o.role}, via ${o.modelLabel})\n${o.content}`)
    .join("\n\n---\n\n");

  const deliberationsText = deliberations
    .map((d) => `${d.fromAgentName}: ${d.critique}`)
    .join("\n\n");

  const consensusPrompt = `Original request: "${userPrompt}"

INITIAL OPINIONS:
${opinionsText}

DELIBERATION ROUND:
${deliberationsText}

Synthesize a final council recommendation.`;

  const response = await callModel({
    model: CONSENSUS_MODEL,
    systemPrompt: CONSENSUS_PROMPT,
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
