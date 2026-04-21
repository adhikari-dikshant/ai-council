import type { SessionState } from "./council/types";

export type ProposalStatus = "submitted" | "approved" | "rejected" | "revision_required";
export type RiskLevel = "low" | "medium" | "high";
export type DecisionOutcome = "approved" | "rejected" | "revision_required";

export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
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
    created_at: string;
    author?: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
}

export interface Notification {
    id: string;
    user_id: string;
    kind: "status_changed" | "comment_added" | "assigned";
    title: string;
    body: string | null;
    proposal_id: string | null;
    read: boolean;
    created_at: string;
}

export const STATUS_LABEL: Record<ProposalStatus, string> = {
    submitted:         "Submitted",
    approved:          "Approved",
    rejected:          "Rejected",
    revision_required: "Revision required",
};

export const STATUS_STYLE: Record<ProposalStatus, string> = {
    submitted:         "bg-honey/10 text-honey border-honey/30",
    approved:          "bg-agent-cost/10 text-agent-cost border-agent-cost/30",
    rejected:          "bg-agent-security/10 text-agent-security border-agent-security/30",
    revision_required: "bg-honey/10 text-honey border-honey/30",
};
