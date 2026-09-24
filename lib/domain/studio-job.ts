import type {
  JobRevisionApprovalStatus,
  JobWorkflowApprovalStatus,
  StudioJobApprovalActionKey,
  StudioJobDecision,
  StudioJobSource,
  StudioJobStatus,
} from "../../types/domain";

export const STUDIO_JOB_SOURCES: StudioJobSource[] = [
  "upwork",
  "fiverr",
  "contra",
  "email",
  "intake",
  "other",
];

export const STUDIO_JOB_STATUSES: StudioJobStatus[] = [
  "new",
  "needs_review",
  "approved",
  "generating",
  "qa",
  "delivered",
  "rejected",
];

export const STUDIO_JOB_DECISIONS: StudioJobDecision[] = ["accept", "review", "reject"];

export const JOB_WORKFLOW_APPROVAL_STATUSES: JobWorkflowApprovalStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
];

export const JOB_REVISION_APPROVAL_STATUSES: JobRevisionApprovalStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
];

/** Approvals.action_key vocabulary for Job Operator gates (text column; not a DB enum). */
export const STUDIO_JOB_APPROVAL_KEYS: StudioJobApprovalActionKey[] = [
  "job_workflow",
  "job_budget",
  "job_rights",
  "job_delivery",
];

export function isStudioJobApprovalKey(value: string): value is StudioJobApprovalActionKey {
  return (STUDIO_JOB_APPROVAL_KEYS as string[]).includes(value);
}

export function isStudioJobSource(value: string): value is StudioJobSource {
  return (STUDIO_JOB_SOURCES as string[]).includes(value);
}

export function isStudioJobStatus(value: string): value is StudioJobStatus {
  return (STUDIO_JOB_STATUSES as string[]).includes(value);
}

export type MarginInputs = {
  quotedPriceCents: number;
  estimatedGenCents: number;
  contingencyBps: number;
  channelFeeBps: number;
};

export type MarginBreakdown = {
  channelFeeCents: number;
  genWithContingencyCents: number;
  expectedGrossMarginCents: number;
};

/**
 * expected_gross_margin = quote - channel_fee - estimated_gen * (1 + contingency_bps/10000)
 * channel_fee = quote * channel_fee_bps / 10000
 * Integer cents via Math.round on fee/contingency products.
 */
export function computeExpectedGrossMargin(input: MarginInputs): MarginBreakdown {
  const quoted = Math.max(0, Math.trunc(input.quotedPriceCents));
  const estimatedGen = Math.max(0, Math.trunc(input.estimatedGenCents));
  const contingencyBps = clampBps(input.contingencyBps);
  const channelFeeBps = clampBps(input.channelFeeBps);

  const channelFeeCents = Math.round((quoted * channelFeeBps) / 10000);
  const genWithContingencyCents = Math.round(estimatedGen * (1 + contingencyBps / 10000));
  const expectedGrossMarginCents = quoted - channelFeeCents - genWithContingencyCents;

  return { channelFeeCents, genWithContingencyCents, expectedGrossMarginCents };
}

function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10000, Math.max(0, Math.trunc(value)));
}
