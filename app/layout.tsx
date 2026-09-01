import "./globals.css";
import { headers } from "next/headers";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/lib/actions";
import { isPreviewMode } from "@/lib/preview-mode";

export const metadata = {
  title: "FFS Mission Control",
  description: "Private control plane for governed AI agents and workflows."
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const host = (await headers()).get("host")?.toLowerCase();
  const previewMode = isPreviewMode() || Boolean(host?.startsWith("deploy-preview-") && host.endsWith("--ffs-mission-control.netlify.app"));
  return <html lang="en"><body className={previewMode ? "preview-mode" : undefined}><div className="shell"><Sidebar signOut={signOut} previewMode={previewMode}/><main className="main">{children}</main></div></body></html>;
}
