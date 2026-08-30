import "server-only";
import { createAgentIntelligenceProvider } from "@/lib/agent-intelligence-provider";
import { governAgentProposal, type AgentIntelligenceContext, type GovernedAgentProposal } from "@/lib/domain/agent-intelligence";

export type AgentIntelligenceResult = { governed: GovernedAgentProposal; provider: string | null; model: string | null; audit: { invokingAgentId: string; taskId: string | null; interpretedIntent: string; governedResponseMode: string; proposedAction: string; handoffDestination: string | null; provider: string | null; model: string | null } };
export async function invokeAgentIntelligence(command: string, context: AgentIntelligenceContext): Promise<AgentIntelligenceResult> {
  const provider = createAgentIntelligenceProvider(); const result = provider ? await provider.propose(command.slice(0, 500), context) : null;
  const governed = governAgentProposal(result?.proposal ?? null, context); const providerId = result?.provider ?? null; const model = result?.model ?? null;
  return { governed, provider: providerId, model, audit: { invokingAgentId: context.agent.id, taskId: context.currentTask?.id ?? null, interpretedIntent: governed.interpretedIntent, governedResponseMode: governed.responseMode, proposedAction: governed.proposedAction, handoffDestination: governed.targetAgent, provider: providerId, model } };
}
