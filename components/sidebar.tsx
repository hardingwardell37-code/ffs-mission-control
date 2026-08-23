import Link from "next/link";

const items = [
  ["/", "Command Center"],
  ["/agents", "Agents"],
  ["/tasks", "Tasks"],
  ["/approvals", "Approvals"],
  ["/activity", "Activity"],
  ["/settings", "Settings"]
];

export function Sidebar({ signOut }: { signOut: () => Promise<void> }) {
  return <aside className="sidebar">
    <div className="brand">FFS <span>/</span> Mission Control</div>
    <nav className="nav">{items.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav><form action={signOut}><button className="nav-signout">Sign out</button></form>
  </aside>;
}
