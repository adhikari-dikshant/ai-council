export interface ChairpersonAnalysis {
  intent: string;
  dimensions: string[];
  context: string;
  scope: string;
}

export interface AgentOpinion {
  agentId: string;
  agentName: string;
  emoji: string;
  role: string;
  color: AgentColor;
  model: string;
  modelLabel: string;
  assessment: string;
  content: string;
  confidence: number;
}

export interface Deliberation {
  fromAgentId: string;
  fromAgentName: string;
  emoji: string;
  critique: string;
  agreement: "agree" | "partial" | "disagree";
}

export interface Consensus {
  recommendation: string;
  reasoning: string;
  keyPoints: string[];
  dissent: string;
  confidence: number;
}

export type AgentColor = "blue" | "red" | "green" | "purple";

export type CouncilPhase =
  | "idle"
  | "analyzing"
  | "thinking"
  | "deliberating"
  | "synthesizing"
  | "done"
  | "error";

export interface SessionState {
  phase: CouncilPhase;
  statusMessage: string;
  chairperson?: ChairpersonAnalysis;
  opinions: AgentOpinion[];
  deliberations: Deliberation[];
  consensus?: Consensus;
  error?: string;
}
