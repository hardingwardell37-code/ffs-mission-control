import Link from "next/link";

const items = [
  ["/", "Overview"],
  ["/campaigns", "Campaigns"],
  ["/agents", "Agents"],
  ["/tasks", "Tasks"],
  ["/approvals", "Approvals"],
  ["/activity", "Activity"],
  ["/settings", "Settings"]
];

export function Sidebar({ signOut }: { signOut: () => Promise<void> }) {
  return <aside className="sidebar">
    <div className="brand">F&amp;P <span>/</span> Studio</div>
    <nav className="nav">{items.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav><form action={signOut}><button className="nav-signout">Sign out</button></form>
  </aside>;
}
