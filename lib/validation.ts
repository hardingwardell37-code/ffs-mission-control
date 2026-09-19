import { ASSET_OWNERSHIP, ASSET_ROLES, CAMPAIGN_ENTRY_MODES, slugifyCampaignName } from "./domain/campaign";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function required(value: FormDataEntryValue | null, name: string, max = 5000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`${name} is required and must be at most ${max} characters`);
  return text;
}

function optional(value: FormDataEntryValue | null, max = 5000) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, max);
}

export function parseAgent(form: FormData) {
  const slug = required(form.get("slug"), "Slug", 80);
  if (!slugPattern.test(slug)) throw new Error("Slug must use lowercase letters, numbers, and hyphens");
  const runtime = Number(form.get("maxRuntimeSeconds"));
  if (!Number.isInteger(runtime) || runtime < 1 || runtime > 3600) throw new Error("Runtime must be between 1 and 3600 seconds");
  return {
    name: required(form.get("name"), "Name", 120), slug,
    purpose: required(form.get("purpose"), "Purpose", 500),
    description: typeof form.get("description") === "string" ? String(form.get("description")).trim().slice(0, 1000) : "",
    system_instructions: required(form.get("instructions"), "Instructions", 12000),
    model_provider: required(form.get("provider"), "Provider", 80),
    model_name: required(form.get("model"), "Model", 120),
    max_runtime_seconds: runtime,
    status: required(form.get("status"), "Status", 20),
  };
}

export function parseTask(form: FormData) {
  return { agent_id: required(form.get("agentId"), "Agent", 36), title: required(form.get("title"), "Title", 180), input: { prompt: required(form.get("prompt"), "Task input", 12000) }, status: "queued" as const };
}

export function parseCampaign(form: FormData) {
  const name = required(form.get("name"), "Name", 160);
  const slugRaw = optional(form.get("slug"), 80) || slugifyCampaignName(name);
  if (!slugPattern.test(slugRaw)) throw new Error("Slug must use lowercase letters, numbers, and hyphens");
  const entryMode = required(form.get("entryMode"), "Entry mode", 32);
  if (!(CAMPAIGN_ENTRY_MODES as string[]).includes(entryMode)) throw new Error("Invalid entry mode");
  const productUrl = optional(form.get("productUrl"), 2000);
  if (productUrl && !/^https?:\/\//i.test(productUrl)) throw new Error("Product URL must start with http:// or https://");
  if ((entryMode === "product_url" || entryMode === "hybrid") && !productUrl) {
    throw new Error("Product URL is required for product_url and hybrid entry modes");
  }
  return {
    name,
    slug: slugRaw,
    entry_mode: entryMode,
    brief: optional(form.get("brief"), 12000),
    product_url: productUrl || null,
    status: optional(form.get("status"), 20) || "draft",
  };
}

export function parseCampaignBrief(form: FormData) {
  return {
    brief: optional(form.get("brief"), 12000),
    status: optional(form.get("status"), 20) || undefined,
    product_url: (() => {
      const url = optional(form.get("productUrl"), 2000);
      if (url && !/^https?:\/\//i.test(url)) throw new Error("Product URL must start with http:// or https://");
      return url || null;
    })(),
  };
}

export function parseCampaignDna(form: FormData) {
  return {
    positioning: optional(form.get("positioning"), 4000),
    audience: optional(form.get("audience"), 4000),
    tone: optional(form.get("tone"), 2000),
    visual_direction: optional(form.get("visualDirection"), 4000),
    do_not_copy_notes: optional(form.get("doNotCopyNotes"), 4000),
    originality_policy: optional(form.get("originalityPolicy"), 4000) ||
      "Research inspires direction only. Never copy source wording, imagery, footage, or protected creative execution into final work.",
  };
}

export function parseResearchSource(form: FormData) {
  const url = required(form.get("url"), "URL", 2000);
  if (!/^https?:\/\//i.test(url)) throw new Error("URL must start with http:// or https://");
  return {
    url,
    title: optional(form.get("title"), 200),
    notes: optional(form.get("notes"), 4000),
    observation: required(form.get("observation"), "Observation", 8000),
    original_direction: required(form.get("originalDirection"), "Original direction", 8000),
  };
}

export function parseAsset(form: FormData) {
  const role = required(form.get("role"), "Role", 32);
  if (!(ASSET_ROLES as string[]).includes(role)) throw new Error("Invalid asset role");
  const ownership = required(form.get("ownershipStatus"), "Ownership", 32);
  if (!(ASSET_OWNERSHIP as string[]).includes(ownership)) throw new Error("Invalid ownership status");
  const sourceUrl = optional(form.get("sourceUrl"), 2000);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error("Source URL must start with http:// or https://");
  const origin = optional(form.get("origin"), 32) || (sourceUrl ? "url" : "upload");
  if (!["upload", "url", "generated", "import"].includes(origin)) throw new Error("Invalid origin");
  const fileSizeRaw = optional(form.get("fileSize"), 32);
  const fileSize = fileSizeRaw ? Number(fileSizeRaw) : null;
  if (fileSize !== null && (!Number.isFinite(fileSize) || fileSize < 0)) throw new Error("Invalid file size");
  const parent = optional(form.get("parentAssetId"), 36);
  return {
    title: required(form.get("title"), "Title", 200),
    role,
    ownership_status: ownership,
    mime_type: optional(form.get("mimeType"), 120) || null,
    storage_path: optional(form.get("storagePath"), 1000) || null,
    storage_url: optional(form.get("storageUrl"), 2000) || null,
    file_size: fileSize,
    source_url: sourceUrl || null,
    origin,
    parent_asset_id: parent || null,
    section: optional(form.get("section"), 40) || null,
    usage_notes: optional(form.get("usageNotes"), 4000),
    model_provider: optional(form.get("modelProvider"), 80) || null,
    model_name: optional(form.get("modelName"), 120) || null,
    prompt: optional(form.get("prompt"), 12000) || null,
  };
}
