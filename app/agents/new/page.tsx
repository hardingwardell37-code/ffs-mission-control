import { AgentForm } from "@/components/agent-form"; import { createAgent } from "@/lib/actions";
export default function NewAgentPage(){return <><div className="eyebrow">Registry / New</div><h1>Register an agent.</h1><p className="lede">Define purpose and operating bounds. Tool access remains denied until explicitly granted.</p><AgentForm action={createAgent}/></>}
