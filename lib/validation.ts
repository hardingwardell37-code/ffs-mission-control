const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function required(value: FormDataEntryValue | null, name: string, max = 5000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > max) throw new Error(`${name} is required and must be at most ${max} characters`);
  return text;
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
