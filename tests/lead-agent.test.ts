import { describe, expect, it } from "vitest";
import { modeForIntent, parseLeadCommand, previewAllowsIntent } from "../lib/domain/lead-agent";

describe("Lead Agent command routing", () => {
  it("reads pending approvals", () => expect(parseLeadCommand("What is waiting for approval?").kind).toBe("read_approvals"));
  it("creates a bounded internal task", () => expect(parseLeadCommand("Create a competitor research task for Market Intelligence")).toMatchObject({ kind: "create_task", agentQuery: "Market Intelligence", title: "competitor research" }));
  it("challenges premature external execution", () => { const intent = parseLeadCommand("Launch the campaign now"); expect(modeForIntent(intent)).toBe("CHALLENGE"); });
  it("clarifies vague commands", () => { const intent = parseLeadCommand("Make everything better"); expect(modeForIntent(intent)).toBe("CLARIFY"); });
  it("requires governed approval for external execution", () => { const intent = parseLeadCommand("Publish the approved campaign"); expect(modeForIntent(intent)).toBe("REQUIRE_APPROVAL"); });
  it("refuses destructive CRM commands", () => { const intent = parseLeadCommand("Delete all CRM leads"); expect(modeForIntent(intent)).toBe("REFUSE"); });
  it("rejects preview writes while retaining reads", () => { expect(previewAllowsIntent(parseLeadCommand("Create a research task for Market Intelligence"))).toBe(false); expect(previewAllowsIntent(parseLeadCommand("What is waiting for approval?"))).toBe(true); });
});
