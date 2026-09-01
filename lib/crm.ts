import type { SupabaseClient } from "@supabase/supabase-js";

type Relation<T>=T|T[]|null; export const one=<T,>(value:Relation<T>)=>Array.isArray(value)?value[0]??null:value;
export const money=(value:number|string|null,currency="USD")=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(Number(value??0));
export const moment=(value:string|null)=>value?new Intl.DateTimeFormat("en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"Not scheduled";

export async function getCrmOptions(supabase:SupabaseClient,organizationId:string){
  const [companies,contacts,leads,agents,members]=await Promise.all([
    supabase.from("companies").select("id,name").eq("organization_id",organizationId).is("archived_at",null).order("name"),
    supabase.from("contacts").select("id,display_name").eq("organization_id",organizationId).is("archived_at",null).order("display_name"),
    supabase.from("leads").select("id,title").eq("organization_id",organizationId).is("archived_at",null).order("title"),
    supabase.from("agents").select("id,name").eq("organization_id",organizationId).is("archived_at",null).order("name"),
    supabase.from("organization_memberships").select("user_id,profiles(display_name)").eq("organization_id",organizationId).eq("status","active")
  ]);
  return {companies:(companies.data??[]).map(x=>({id:x.id,name:x.name})),contacts:(contacts.data??[]).map(x=>({id:x.id,name:x.display_name})),leads:(leads.data??[]).map(x=>({id:x.id,name:x.title})),agents:(agents.data??[]).map(x=>({id:x.id,name:x.name})),owners:(members.data??[]).map((x,index)=>({id:x.user_id,name:(one(x.profiles as Relation<{display_name:string|null}>)?.display_name)||`Organization member ${index+1}`}))};
}
