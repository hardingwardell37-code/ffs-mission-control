import "server-only";
import type { AgentIntelligenceContext, AgentProposal } from "@/lib/domain/agent-intelligence";

export type AgentModelResult = { proposal: AgentProposal; provider: string; model: string };
export interface AgentIntelligenceProvider { propose(command: string, context: AgentIntelligenceContext): Promise<AgentModelResult | null> }
export class AgentProviderError extends Error {
  constructor(
    public readonly kind: "request_failed" | "invalid_response",
    public readonly provider: string,
    public readonly model: string,
    public readonly status?: number,
  ) {
    super(`Agent provider ${kind.replace("_", " ")} (${provider}/${model}${status ? `, HTTP ${status}` : ""}).`);
    this.name = "AgentProviderError";
  }
}
const proposalSchema = { type: "object", additionalProperties: false, properties: {
  interpretedIntent: { type: "string", enum: ["read_approvals", "read_agent_work", "read_completed", "read_failed", "create_task", "handoff", "external_action", "destructive_action", "clarify", "specialist_work"] }, responseMode: { type: "string", enum: ["EXECUTE", "DELEGATE", "RECOMMEND", "CHALLENGE", "CLARIFY", "REQUIRE_APPROVAL", "REFUSE"] }, proposedAction: { type: "string" }, actionKey: { type: ["string", "null"] }, targetTask: { type: ["string", "null"] }, targetAgent: { type: ["string", "null"] }, result: { type: ["string", "null"] }, confidence: { type: "string", enum: ["low", "medium", "high"] }, blocker: { type: ["string", "null"] }, clarificationRequest: { type: ["string", "null"] }, approvalRequired: { type: "boolean" }, explanation: { type: "string" },
}, required: ["interpretedIntent", "responseMode", "proposedAction", "actionKey", "targetTask", "targetAgent", "result", "confidence", "blocker", "clarificationRequest", "approvalRequired", "explanation"] };

function configuration() {
  const baseUrl = (process.env.AGENT_MODEL_BASE_URL ?? process.env.LEAD_AGENT_MODEL_BASE_URL)?.trim(); const apiKey = (process.env.AGENT_MODEL_API_KEY ?? process.env.LEAD_AGENT_MODEL_API_KEY)?.trim(); const model = (process.env.AGENT_MODEL ?? process.env.LEAD_AGENT_MODEL)?.trim();
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model, identifier: (process.env.AGENT_MODEL_PROVIDER ?? process.env.LEAD_AGENT_MODEL_PROVIDER)?.trim() || "openai-compatible" };
}
export function createAgentIntelligenceProvider(): AgentIntelligenceProvider | null {
  const config = configuration(); if (!config) return null;
  return { async propose(command, context) {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/responses`, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          instructions: "Act only as the registered Mission Control agent described by context. Use its role, department, assigned skills, current task, tools, and governance. Propose; never execute. Challenge unsupported instructions, clarify missing facts, and delegate work outside the role. Return only schema JSON without chain-of-thought.",
          input: JSON.stringify({ command, context }),
          text: { format: { type: "json_schema", name: "agent_proposal", strict: true, schema: proposalSchema } },
        }),
      });
    } catch {
      throw new AgentProviderError("request_failed", config.identifier, config.model);
    }

    if (!response.ok) {
      throw new AgentProviderError("request_failed", config.identifier, config.model, response.status);
    }

    let payload: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    try {
      payload = await response.json() as typeof payload;
    } catch {
      throw new AgentProviderError("invalid_response", config.identifier, config.model, response.status);
    }

    const content = payload.output_text ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")
      ?.text;

    if (!content) {
      throw new AgentProviderError("invalid_response", config.identifier, config.model, response.status);
    }

    try {
      return { proposal: JSON.parse(content) as AgentProposal, provider: config.identifier, model: config.model };
    } catch {
      throw new AgentProviderError("invalid_response", config.identifier, config.model, response.status);
    }
  } };
}
