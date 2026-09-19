import type { CampaignApprovalActionKey, CampaignEntryMode, AssetRole, AssetOwnership } from "../../types/domain";

export const CAMPAIGN_ENTRY_MODES: CampaignEntryMode[] = ["research", "product_url", "upload", "hybrid"];
export const ASSET_ROLES: AssetRole[] = ["source", "reference", "locked", "generated"];
export const ASSET_OWNERSHIP: AssetOwnership[] = ["owned", "licensed", "generated", "unknown"];

export const CAMPAIGN_APPROVAL_KEYS: CampaignApprovalActionKey[] = [
  "campaign_concept",
  "campaign_storyboard",
  "campaign_assets",
  "campaign_editorial",
  "campaign_final_master",
  "campaign_export",
];

export function isCampaignApprovalKey(value: string): value is CampaignApprovalActionKey {
  return (CAMPAIGN_APPROVAL_KEYS as string[]).includes(value);
}

export function slugifyCampaignName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campaign";
}

export function defaultSectionForRole(role: AssetRole): string {
  if (role === "reference") return "references";
  if (role === "generated") return "generated_images";
  if (role === "locked") return "uploaded_assets";
  return "uploaded_assets";
}
