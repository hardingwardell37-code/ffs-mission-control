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
    department: typeof form.get("department") === "string" ? String(form.get("department")).trim().slice(0, 80) || null : null,
  };
}

export function parseSkill(form: FormData) {
  const slug = required(form.get("slug"), "Slug", 80);
  if (!slugPattern.test(slug)) throw new Error("Slug must use lowercase letters, numbers, and hyphens");
  const sourceUrl = required(form.get("sourceUrl"), "Source URL", 500);
  try { new URL(sourceUrl); } catch { throw new Error("Source URL must be valid"); }
  return {
    name: required(form.get("name"), "Name", 120), slug,
    category: typeof form.get("category") === "string" ? String(form.get("category")).trim().slice(0, 80) || null : null,
    description: typeof form.get("description") === "string" ? String(form.get("description")).trim().slice(0, 1000) : "",
    source_name: required(form.get("sourceName"), "Source name", 120),
    source_url: sourceUrl,
    source_version: typeof form.get("sourceVersion") === "string" ? String(form.get("sourceVersion")).trim().slice(0, 80) || null : null,
    instruction_reference: typeof form.get("instructionReference") === "string" ? String(form.get("instructionReference")).trim().slice(0, 500) || null : null,
    status: required(form.get("status"), "Status", 20),
  };
}

export function parseTask(form: FormData) {
  return { agent_id: required(form.get("agentId"), "Agent", 36), title: required(form.get("title"), "Title", 180), input: { prompt: required(form.get("prompt"), "Task input", 12000) }, status: "queued" as const };
}

const optional = (form:FormData,name:string,max=1000) => typeof form.get(name)==="string" ? String(form.get(name)).trim().slice(0,max) || null : null;
const optionalNumber = (form:FormData,name:string) => { const value=optional(form,name,40); if(value===null)return null; const number=Number(value); if(!Number.isFinite(number))throw new Error(`${name} must be a number`); return number; };

export function parseCompany(form:FormData){return {name:required(form.get("name"),"Name",160),domain:optional(form,"domain",255),website_url:optional(form,"websiteUrl",500),phone:optional(form,"phone",80),industry:optional(form,"industry",120),employee_size:optional(form,"employeeSize",80),address_line_1:optional(form,"addressLine1",200),address_line_2:optional(form,"addressLine2",200),city:optional(form,"city",120),state_region:optional(form,"stateRegion",120),postal_code:optional(form,"postalCode",40),country:optional(form,"country",120),status:required(form.get("status"),"Status",20),owner_user_id:optional(form,"ownerUserId",36),source:optional(form,"source",120),notes:optional(form,"notes",5000)};}
export function parseContact(form:FormData){const first=required(form.get("firstName"),"First name",120),last=optional(form,"lastName",120)??"";return {company_id:optional(form,"companyId",36),first_name:first,last_name:last,display_name:optional(form,"displayName",200)??`${first} ${last}`.trim(),job_title:optional(form,"jobTitle",160),email:optional(form,"email",320),phone:optional(form,"phone",80),mobile_phone:optional(form,"mobilePhone",80),linkedin_url:optional(form,"linkedinUrl",500),preferred_channel:optional(form,"preferredChannel",20),status:required(form.get("status"),"Status",20),source:optional(form,"source",120),notes:optional(form,"notes",5000)};}
export function parseLead(form:FormData){return {contact_id:optional(form,"contactId",36),company_id:optional(form,"companyId",36),title:required(form.get("title"),"Title",180),source:optional(form,"source",120),status:required(form.get("status"),"Status",30),score:optionalNumber(form,"score"),estimated_value:optionalNumber(form,"estimatedValue"),currency:(optional(form,"currency",3)??"USD").toUpperCase(),owner_user_id:optional(form,"ownerUserId",36),assigned_agent_id:optional(form,"assignedAgentId",36),next_action_at:optional(form,"nextActionAt",40),notes:optional(form,"notes",5000)};}
export function parseOpportunity(form:FormData){return {company_id:optional(form,"companyId",36),primary_contact_id:optional(form,"primaryContactId",36),lead_id:optional(form,"leadId",36),name:required(form.get("name"),"Name",180),stage:required(form.get("stage"),"Stage",30),status:required(form.get("status"),"Status",20),estimated_value:optionalNumber(form,"estimatedValue")??0,currency:(optional(form,"currency",3)??"USD").toUpperCase(),probability:optionalNumber(form,"probability"),expected_close_date:optional(form,"expectedCloseDate",20),owner_user_id:optional(form,"ownerUserId",36),assigned_agent_id:optional(form,"assignedAgentId",36),next_action_at:optional(form,"nextActionAt",40),lost_reason:optional(form,"lostReason",1000),notes:optional(form,"notes",5000)};}
export function parseCrmActivity(form:FormData){return {company_id:optional(form,"companyId",36),contact_id:optional(form,"contactId",36),lead_id:optional(form,"leadId",36),opportunity_id:optional(form,"opportunityId",36),activity_type:required(form.get("activityType"),"Activity type",30),subject:required(form.get("subject"),"Subject",180),body:optional(form,"body",5000),occurred_at:optional(form,"occurredAt",40)??new Date().toISOString()};}
