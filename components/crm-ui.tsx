import Link from "next/link";
import { moment } from "@/lib/crm";

export const crmNav=[["/crm","Command"],["/crm/companies","Companies"],["/crm/contacts","Contacts"],["/crm/leads","Leads"],["/crm/opportunities","Opportunities"],["/crm/email","Email"]];
export function CrmNav(){return <nav className="crm-nav" aria-label="CRM navigation">{crmNav.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav>}
export function ActivityTimeline({activities}:{activities:Array<{id:string;activity_type:string;subject:string;body:string|null;occurred_at:string}>}){return <div className="crm-timeline">{activities.length?activities.map(item=><article key={item.id}><span className={`crm-activity-mark ${item.activity_type}`}/><div><strong>{item.subject}</strong><small>{item.activity_type.replaceAll("_"," ")} · {moment(item.occurred_at)}</small>{item.body&&<p>{item.body}</p>}</div></article>):<div className="empty">No CRM activity recorded.</div>}</div>}
export function RecordList({items,empty}:{items:Array<{id:string;label:string;meta?:string;href:string}>;empty:string}){return <div className="crm-record-list">{items.length?items.map(item=><Link href={item.href} key={item.id}><div><strong>{item.label}</strong>{item.meta&&<span>{item.meta}</span>}</div><span>→</span></Link>):<div className="empty">{empty}</div>}</div>}
