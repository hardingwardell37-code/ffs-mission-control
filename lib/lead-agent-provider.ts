import "server-only";
import type { ModelProposal } from "@/lib/domain/lead-agent-policy";

export type SafeLeadContext = {
  agents: Array<{ name: string; status: string }>;
  tasks: Array<{ title: string; status: string; agentName: string | null }>;
  approvals: Array<{ title: string; action: string; status: string }>;
  events: Array<{ type: string; entity: string; timestamp: string }>;
};

export type LeadModelResult = { proposal: ModelProposal; provider: string; model: string };
export interface LeadModelProvider { propose(command: string, context: SafeLeadContext): Promise<LeadModelResult | null> }

const proposalSchema = {
  type: "object", additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["read_approvals", "read_agent_work", "read_completed", "read_failed", "create_task", "handoff", "external_action", "destructive_action", "clarify"] },
    responseMode: { type: "string", enum: ["EXECUTE", "DELEGATE", "RECOMMEND", "CHALLENGE", "CLARIFY", "REQUIRE_APPROVAL", "REFUSE"] },
    targetAgent: { type: ["string", "null"] }, targetTask: { type: ["string", "null"] }, proposedAction: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] }, explanation: { type: "string" },
  },
  required: ["intent", "responseMode", "targetAgent", "targetTask", "proposedAction", "confidence", "explanation"],
};

function configuredProvider(): { baseUrl: string; apiKey: string; model: string; identifier: string } | null {
  const baseUrl = process.env.LEAD_AGENT_MODEL_BASE_URL?.trim();
  const apiKey = process.env.LEAD_AGENT_MODEL_API_KEY?.trim();
  const model = process.env.LEAD_AGENT_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model, identifier: process.env.LEAD_AGENT_MODEL_PROVIDER?.trim() || "openai-compatible" };
}

export function createLeadModelProvider(): LeadModelProvider | null {
  const config = configuredProvider();
  if (!config) return null;
  return {
    async propose(command, context) {
      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST", signal: AbortSignal.timeout(8_000),
          headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: config.model, temperature: 0,
            messages: [
              { role: "system", content: "Interpret one Mission Control command. Propose only a bounded intent. Never claim execution. Use only the supplied operational records. Return JSON matching the schema; do not include reasoning or secrets." },
              { role: "user", content: JSON.stringify({ command, context }) },
            ],
            response_format: { type: "json_schema", json_schema: { name: "lead_agent_proposal", strict: true, schema: proposalSchema } },
          }),
        });
        if (!response.ok) return null;
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) return null;
        return { proposal: JSON.parse(content) as ModelProposal, provider: config.identifier, model: config.model };
      } catch { return null; }
    },
  };
}
