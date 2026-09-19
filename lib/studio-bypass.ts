export const BYPASS_COOKIE = "fp_studio_bypass";
export const BYPASS_ORG_SLUG = "fp-studio-personal";
export const BYPASS_ORG_NAME = "F&P Studio";
export const BYPASS_OPERATOR_EMAIL = "wardell@fp-studio.local";

export function isPersonalBypassEnabled() {
  return process.env.FP_STUDIO_PERSONAL_BYPASS === "true";
}
