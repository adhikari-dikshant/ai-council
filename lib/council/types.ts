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
  vote?: "approve" | "reject" | "revise";
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
  decision?: "approved" | "rejected" | "revision_required";
  riskLevel?: "low" | "medium" | "high";
}

export type AgentColor = "blue" | "red" | "green" | "purple";

export interface PeerRank {
  targetAgentId: string;
  rank: number;
  justification: string;
}

export interface PeerRankingEntry {
  rankerAgentId: string;
  rankerAgentName: string;
  emoji: string;
  rankings: PeerRank[];
}

export type CouncilPhase =
  | "idle"
  | "analyzing"
  | "thinking"
  | "deliberating"
  | "ranking"
  | "synthesizing"
  | "done"
  | "error";

export interface SessionState {
  phase: CouncilPhase;
  statusMessage: string;
  chairperson?: ChairpersonAnalysis;
  opinions: AgentOpinion[];
  deliberations: Deliberation[];
  peerRankings?: PeerRankingEntry[];
  consensus?: Consensus;
  error?: string;
}
