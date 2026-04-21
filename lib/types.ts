import type { SessionState } from "./council/types";

export type UserRole = "admin" | "council_member" | "reviewer" | "proposer";

export type ProposalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "revision_required";

export type RiskLevel = "low" | "medium" | "high";
export type DecisionOutcome = "approved" | "rejected" | "revision_required";
export type CommentVote = "approve" | "reject" | "revise";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  author_id: string;
  title: string;
  project_type: string | null;
  description: string;
  status: ProposalStatus;
  ai_review: SessionState | null;
  ai_decision: DecisionOutcome | null;
  risk_level: RiskLevel | null;
  final_decision: DecisionOutcome | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalWithAuthor extends Proposal {
  author?: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
}

export interface Comment {
  id: string;
  proposal_id: string;
  author_id: string;
  body: string;
  vote: CommentVote | null;
  created_at: string;
  author?: Pick<Profile, "full_name" | "email" | "avatar_url" | "role"> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: "status_changed" | "comment_added" | "role_changed" | "assigned";
  title: string;
  body: string | null;
  proposal_id: string | null;
  read: boolean;
  created_at: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  council_member: "Council member",
  reviewer: "Reviewer",
  proposer: "Proposer",
};

export const STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  revision_required: "Revision required",
};

export const STATUS_STYLE: Record<ProposalStatus, string> = {
  draft:             "bg-paper-beige text-ink-muted border-line",
  submitted:         "bg-honey/10 text-honey border-honey/30",
  under_review:      "bg-rust/10 text-rust border-rust/30",
  approved:          "bg-agent-cost/10 text-agent-cost border-agent-cost/30",
  rejected:          "bg-agent-security/10 text-agent-security border-agent-security/30",
  revision_required: "bg-honey/10 text-honey border-honey/30",
};

export function canReview(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "council_member" || role === "reviewer";
}

export function canManageRoles(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function canChangeStatus(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "council_member";
}
