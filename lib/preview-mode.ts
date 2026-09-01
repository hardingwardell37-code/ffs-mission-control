const authRoutes = ["/login", "/forgot-password", "/reset-password", "/auth"];

export function isPreviewMode() {
  const context = process.env.CONTEXT;
  const branch = process.env.BRANCH;

  if (context === "production" || branch === "main") return false;
  return process.env.NODE_ENV === "development" || context === "deploy-preview" || context === "branch-deploy";
}

export function isAuthRoute(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
