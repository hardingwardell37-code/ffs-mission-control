import { describe, expect, it, vi } from "vitest";
import { canTransitionTask, assertTaskTransition } from "../lib/domain/task-state";
import { assertApprovalResolution } from "../lib/domain/approval";
import { evaluateToolPermission } from "../lib/domain/permissions";
import { parseAgent, parseAsset, parseCampaign, parseCampaignDna, parseGenerationJob, parseResearchSource, parseTask } from "../lib/validation";
import { writeAudit } from "../lib/audit";
import { CAMPAIGN_APPROVAL_KEYS, GENERATION_PROVIDERS, isCampaignApprovalKey, slugifyCampaignName } from "../lib/domain/campaign";

describe("deny-by-default permissions", () => {
  it("rejects unregistered tools", () => expect(evaluateToolPermission(undefined, "write").allowed).toBe(false));
  it("requires approval for granted writes", () => expect(evaluateToolPermission({ toolKey:"mail", canRead:false, canWrite:true, requiresApproval:true }, "write")).toMatchObject({ allowed:true, requiresApproval:true }));
});
describe("task lifecycle", () => {
  it("allows the queued execution contract", () => expect(canTransitionTask("queued", "running")).toBe(true));
  it("rejects terminal state mutation", () => expect(() => assertTaskTransition("completed", "running")).toThrow("Invalid task transition"));
});
describe("approval invariants", () => {
  it("allows a pending decision", () => expect(() => assertApprovalResolution("pending", "approved")).not.toThrow());
  it("prevents repeated decisions", () => expect(() => assertApprovalResolution("approved", "rejected")).toThrow("Only pending"));
});
describe("server validation", () => {
  it("accepts a complete agent", () => { const f=new FormData(); Object.entries({name:"Scout",slug:"scout",purpose:"Research",instructions:"Stay bounded",provider:"openai",model:"gpt",maxRuntimeSeconds:"300",status:"draft"}).forEach(([k,v])=>f.set(k,v)); expect(parseAgent(f).slug).toBe("scout"); });
  it("creates queued tasks only", () => { const f=new FormData(); f.set("agentId","00000000-0000-0000-0000-000000000001"); f.set("title","Inspect"); f.set("prompt","Read only"); expect(parseTask(f).status).toBe("queued"); });
});
describe("campaign validation", () => {
  it("slugifies campaign names", () => expect(slugifyCampaignName("Spring Drop!")).toBe("spring-drop"));
  it("parses research entry campaigns", () => {
    const f = new FormData();
    f.set("name", "Spring Drop");
    f.set("entryMode", "research");
    f.set("brief", "Brand film");
    expect(parseCampaign(f)).toMatchObject({ name: "Spring Drop", entry_mode: "research", slug: "spring-drop" });
  });
  it("requires product URL for product_url mode", () => {
    const f = new FormData();
    f.set("name", "URL Start");
    f.set("entryMode", "product_url");
    expect(() => parseCampaign(f)).toThrow(/Product URL/);
  });
  it("parses DNA and research originality fields", () => {
    const dna = new FormData();
    dna.set("positioning", "Premium");
    dna.set("audience", "Adults 25-44");
    expect(parseCampaignDna(dna).originality_policy).toMatch(/Research inspires/);
    const src = new FormData();
    src.set("url", "https://example.com");
    src.set("observation", "Minimal text");
    src.set("originalDirection", "Bold original type");
    expect(parseResearchSource(src).original_direction).toBe("Bold original type");
  });
  it("requires provenance fields on assets", () => {
    const f = new FormData();
    f.set("title", "Hero");
    f.set("role", "source");
    f.set("ownershipStatus", "owned");
    f.set("origin", "upload");
    expect(parseAsset(f)).toMatchObject({ title: "Hero", role: "source", ownership_status: "owned" });
  });
  it("exposes campaign approval action keys", () => {
    expect(CAMPAIGN_APPROVAL_KEYS).toContain("campaign_concept");
    expect(CAMPAIGN_APPROVAL_KEYS).toContain("campaign_assets");
    expect(isCampaignApprovalKey("campaign_export")).toBe(true);
    expect(isCampaignApprovalKey("random")).toBe(false);
  });
});
describe("audit writes", () => {
  it("inserts actor identity and organization context", async () => { const insert=vi.fn().mockReturnValue({error:null}); const client={from:vi.fn().mockReturnValue({insert})}; await writeAudit(client as never,{organizationId:"org",actorId:"user",eventType:"agent.created",entityType:"agent",entityId:"a"}); expect(insert).toHaveBeenCalledWith(expect.objectContaining({organization_id:"org",actor_id:"user",event_type:"agent.created"})); });
});

describe("generation validation", () => {
  it("parses generation job forms", () => {
    const f = new FormData();
    f.set("modality", "image");
    f.set("provider", "auto");
    f.set("prompt", "Original directional light on a brushed steel bottle");
    f.set("negativePrompt", "watermark");
    expect(parseGenerationJob(f)).toMatchObject({
      modality: "image",
      provider: "auto",
      negative_prompt: "watermark",
    });
  });
  it("rejects copycat exact-ad prompts", () => {
    const f = new FormData();
    f.set("modality", "image");
    f.set("provider", "openai_image");
    f.set("prompt", "Please copy this exact Nike ad layout");
    expect(() => parseGenerationJob(f)).toThrow(/original direction/i);
  });
  it("exposes generation provider ids", () => {
    expect(GENERATION_PROVIDERS).toContain("auto");
    expect(GENERATION_PROVIDERS).toContain("runway");
    expect(GENERATION_PROVIDERS).toContain("grok_imagine");
    expect(GENERATION_PROVIDERS).toContain("fal_minimax_h3");
  });
});
