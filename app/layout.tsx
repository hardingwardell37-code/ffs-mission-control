import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/lib/actions";

export const metadata = {
  title: "FFS Mission Control",
  description: "Private control plane for governed AI agents and workflows."
};
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="shell"><Sidebar signOut={signOut}/><main className="main">{children}</main></div></body></html>;
}
