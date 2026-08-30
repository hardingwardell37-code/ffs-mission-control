import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/lib/actions";
import { isPreviewMode } from "@/lib/preview-mode";

export const metadata = {
  title: "FFS Mission Control",
  description: "Private control plane for governed AI agents and workflows."
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const previewMode = isPreviewMode();
  return <html lang="en"><body className={previewMode ? "preview-mode" : undefined}><div className="shell"><Sidebar signOut={signOut} previewMode={previewMode}/><main className="main">{children}</main></div></body></html>;
}
