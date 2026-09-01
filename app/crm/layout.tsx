import { CrmNav } from "@/components/crm-ui";
export default function CrmLayout({children}:{children:React.ReactNode}){return <div className="crm-shell"><CrmNav/>{children}</div>}
