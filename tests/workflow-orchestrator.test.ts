import { describe, expect, it } from "vitest";
import { governAgentProposal, type AgentIntelligenceContext } from "../lib/domain/agent-intelligence";
import { parseLeadCommand } from "../lib/domain/lead-agent";
import { applyOrchestratorApproval, completionReady, initializeOrchestratorState, orchestratorAuditEvent, recordStageResult, resolveStageAgent, selectWorkflowDefinition, workflowDefinitions } from "../lib/domain/workflow-orchestrator";

const marketing = workflowDefinitions[0]; const research = workflowDefinitions[1];
const agents = [
  { id: "z", name: "Zulu Research", status: "active", role: "Research specialist", department: "Marketing", skills: ["Evidence"] },
  { id: "a", name: "Alpha Research", status: "active", role: "Market intelligence", department: "Marketing", skills: ["Research"] },
  { id: "r", name: "Review Desk", status: "active", role: "Quality reviewer", department: "Governance", skills: ["Review"] },
];

describe("workflow orchestrator definitions", () => {
  it("selects the marketing workflow", () => expect(selectWorkflowDefinition("marketing_content", "Campaign brief")?.key).toBe("marketing_content"));
  it("selects the research workflow", () => expect(selectWorkflowDefinition("internal_research", "Internal analysis")?.key).toBe("internal_research"));
  it("resolves agents deterministically from registry capabilities", () => expect(resolveStageAgent(research.stages[0], agents, [])?.id).toBe("a"));
  it("stops safely when a required capability is missing", () => expect(resolveStageAgent(marketing.stages[1], agents, [])).toBeNull());
  it("advances exactly one stage per result", () => { const initial = initializeOrchestratorState("task", research); const next = recordStageResult(initial, research, research.stages[0], "a", { responseMode: "RECOMMEND", blocker: null, clarification: null, approvalRequired: false, output: "Research ready" }); expect(next).toMatchObject({ currentStageIndex: 1, stepCount: 1, completedStageKeys: ["research"] }); });
  it("pauses when a stage requires approval", () => { const initial = initializeOrchestratorState("task", research); expect(recordStageResult(initial, research, research.stages[0], "a", { responseMode: "REQUIRE_APPROVAL", blocker: null, clarification: null, approvalRequired: true, output: null }).status).toBe("paused"); });
  it("resumes only after approval", () => { const paused = { ...initializeOrchestratorState("task", marketing), status: "paused" as const }; expect(applyOrchestratorApproval(paused, "approved")).toMatchObject({ status: "active", approvalSatisfied: true }); });
  it("enforces reviewer completion", () => { const state = { ...initializeOrchestratorState("task", research), completedStageKeys: ["research"], currentStageIndex: 1 }; expect(completionReady(state, research)).toBe(false); });
  it("enforces all completion conditions", () => { const state = { ...initializeOrchestratorState("task", research), completedStageKeys: ["research", "review"], currentStageIndex: 2, visitedAgentIds: ["a", "r"], stepCount: 2 }; expect(completionReady(state, research)).toBe(true); });
  it("preserves repeated-agent and step protections", () => { const state = { ...initializeOrchestratorState("task", research), visitedAgentIds: ["a"] }; expect(recordStageResult(state, research, research.stages[0], "a", { responseMode: "RECOMMEND", blocker: null, clarification: null, approvalRequired: false, output: null }).status).toBe("stopped"); });
  it("fails safely when no model proposal exists", () => { const context: AgentIntelligenceContext = { agent: { id: "a", name: "A", department: null, role: "Research", purpose: "Research", skills: [], tools: [] }, currentTask: null, organization: { agents: [], tasks: [], approvals: [], events: [] }, governance: { previewMode: false, directMutationAllowed: false, externalActionsRequireApproval: true } }; expect(governAgentProposal(null, context)).toMatchObject({ responseMode: "CLARIFY", accepted: false }); });
  it("creates concise audit metadata", () => { const event = orchestratorAuditEvent("orchestrator.workflow_selected", initializeOrchestratorState("task", research)); expect(event).toMatchObject({ eventType: "orchestrator.workflow_selected", metadata: { workflowKey: "internal_research", stepCount: 0 } }); expect(event.metadata).not.toHaveProperty("prompt"); });
  it("exposes explicit Lead Agent workflow invocation", () => expect(parseLeadCommand("Advance workflow for Campaign Research")).toMatchObject({ kind: "advance_workflow", taskQuery: "Campaign Research" }));
});
