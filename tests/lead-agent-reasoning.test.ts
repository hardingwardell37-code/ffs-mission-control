import { describe, expect, it } from "vitest";
import { governModelProposal, governedMode, type ModelProposal } from "../lib/domain/lead-agent-policy";

const context = { agentNames: ["Market Intelligence", "Content Strategist"], taskTitles: ["Campaign Research"], previewMode: false };
const proposal = (values: Partial<ModelProposal>): ModelProposal => ({ intent: "create_task", responseMode: "EXECUTE", targetAgent: "Market Intelligence", targetTask: null, proposedAction: "Research competitors", confidence: "high", explanation: "Bounded internal research.", ...values });

describe("Lead Agent reasoning policy", () => {
  it("accepts a safe model proposal", () => expect(governModelProposal("Research competitors", proposal({}), context)).toMatchObject({ modelAccepted: true, intent: { kind: "create_task" } }));
  it("overrides a model proposal with an approval rule", () => expect(governedMode(governModelProposal("Publish the approved campaign", proposal({}), context))).toBe("REQUIRE_APPROVAL"));
  it("refuses a destructive model proposal", () => expect(governedMode(governModelProposal("Clean up old data", proposal({ intent: "destructive_action" }), context))).toBe("REFUSE"));
  it("clarifies a hallucinated target", () => expect(governedMode(governModelProposal("Give this to Phantom Agent", proposal({ targetAgent: "Phantom Agent" }), context))).toBe("CLARIFY"));
  it("falls back to deterministic intent without a provider proposal", () => expect(governModelProposal("What is waiting for approval?", null, context).intent.kind).toBe("read_approvals"));
  it("rejects preview mutations", () => expect(governedMode(governModelProposal("Research competitors", proposal({}), { ...context, previewMode: true }))).toBe("REFUSE"));
});
