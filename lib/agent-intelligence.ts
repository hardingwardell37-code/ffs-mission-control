import "server-only";
import { AgentProviderError, agentModelConfigurationStatus, createAgentIntelligenceProvider } from "@/lib/agent-intelligence-provider";
import { governAgentProposal, type AgentIntelligenceContext, type AgentProposal, type GovernedAgentProposal } from "@/lib/domain/agent-intelligence";

export type AgentIntelligenceResult = { governed: GovernedAgentProposal; provider: string | null; model: string | null; audit: { invokingAgentId: string; taskId: string | null; interpretedIntent: string; governedResponseMode: string; proposedAction: string; handoffDestination: string | null; provider: string | null; model: string | null } };

function unavailableProposal(error: AgentProviderError): AgentProposal {
  const status = error.status ? ` HTTP status: ${error.status}.` : "";
  const failure = error.kind === "request_failed" ? "Agent provider request failed." : "Agent provider returned an invalid response.";
  return { interpretedIntent: "clarify", responseMode: "CLARIFY", proposedAction: "", actionKey: null, targetTask: null, targetAgent: null, result: null, confidence: "low", blocker: `${failure} Provider: ${error.provider}. Model: ${error.model}.${status}`, clarificationRequest: "Specialist reasoning could not continue safely.", approvalRequired: false, explanation: "No action was executed because specialist intelligence was unavailable." };
}

function unconfiguredProposal(): AgentProposal {
  const status = agentModelConfigurationStatus();
  const missing = [
    ["AGENT_MODEL_BASE_URL", status.baseUrl],
    ["AGENT_MODEL_API_KEY", status.apiKey],
    ["AGENT_MODEL", status.model],
    ["AGENT_MODEL_PROVIDER", status.provider],
  ].filter(([, present]) => !present).map(([name]) => name);
  return { interpretedIntent: "clarify", responseMode: "CLARIFY", proposedAction: "", actionKey: null, targetTask: null, targetAgent: null, result: null, confidence: "low", blocker: `No model provider is configured. Missing runtime variables: ${missing.join(", ") || "unknown"}.`, clarificationRequest: "Configure the missing server-side model variables for this deployment context.", approvalRequired: false, explanation: "No action was executed because specialist intelligence was unavailable." };
}

export async function invokeAgentIntelligence(command: string, context: AgentIntelligenceContext): Promise<AgentIntelligenceResult> {
  const provider = createAgentIntelligenceProvider();
  let result = null;
  let providerFailure: AgentProviderError | null = null;
  if (provider) {
    try {
      result = await provider.propose(command.slice(0, 500), context);
    } catch (error) {
      if (!(error instanceof AgentProviderError)) throw error;
      providerFailure = error;
    }
  }
  const governed = governAgentProposal(providerFailure ? unavailableProposal(providerFailure) : result?.proposal ?? (provider ? null : unconfiguredProposal()), context);
  const providerId = result?.provider ?? providerFailure?.provider ?? null;
  const model = result?.model ?? providerFailure?.model ?? null;
  return { governed, provider: providerId, model, audit: { invokingAgentId: context.agent.id, taskId: context.currentTask?.id ?? null, interpretedIntent: governed.interpretedIntent, governedResponseMode: governed.responseMode, proposedAction: governed.proposedAction, handoffDestination: governed.targetAgent, provider: providerId, model } };
}
