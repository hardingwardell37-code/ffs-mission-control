import Link from "next/link";

const items = [
  ["/", "Command Center"],
  ["/agents", "Agents"],
  ["/skills", "Skills"],
  ["/crm", "CRM"],
  ["/tasks", "Tasks"],
  ["/approvals", "Approvals"],
  ["/activity", "Activity"],
  ["/settings", "Settings"]
];

export function Sidebar({ signOut, previewMode = false }: { signOut: () => Promise<void>; previewMode?: boolean }) {
  return <aside className="sidebar">
    <div className="brand">FFS <span>/</span> Mission Control</div>{previewMode && <div className="preview-indicator">Preview mode · read only</div>}
    <nav className="nav">{items.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav>{!previewMode && <form action={signOut}><button className="nav-signout">Sign out</button></form>}
  </aside>;
}
