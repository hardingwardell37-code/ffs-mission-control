"use client";

import { useActionState } from "react";
import { initialLeadAgentState, runLeadAgentCommand } from "@/lib/lead-agent";

export function LeadAgentPanel({ previewMode }: { previewMode: boolean }) {
  const [state, action, pending] = useActionState(runLeadAgentCommand, initialLeadAgentState);
  return <section className="lead-command" aria-labelledby="lead-command-title">
    <div className="lead-command-head"><div><span>LEAD AGENT / COMMAND LAYER V1</span><h2 id="lead-command-title">Direct operations</h2></div><em>{previewMode ? "READ ONLY" : "GOVERNED"}</em></div>
    <form action={action}>
      <label htmlFor="lead-command-input">Operational command</label>
      <div><input id="lead-command-input" name="command" maxLength={500} placeholder="What is waiting for approval?" required autoComplete="off" /><button disabled={pending}>{pending ? "Interpreting…" : "Issue command"}</button></div>
    </form>
    <div className="lead-command-result" aria-live="polite"><strong>{state.mode ?? "READY"}</strong><p>{state.response}</p><dl><div><dt>Action</dt><dd>{state.action}</dd></div><div><dt>Approval</dt><dd>{state.approval}</dd></div></dl></div>
    <p className="lead-command-scope">Reads operational state · creates bounded internal tasks · delegates running work {previewMode ? "· preview mutations blocked" : ""}</p>
  </section>;
}
