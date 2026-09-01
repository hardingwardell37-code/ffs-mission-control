import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function updatePassword(form: FormData) {
    "use server";

    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12 || password !== confirmation) {
      redirect("/reset-password?error=invalid-password");
    }

    const supabase = await createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      redirect("/reset-password?error=recovery-expired");
    }

    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?reset=1");
  }

export function ResetPasswordForm() {
  return <form className="form" action={updatePassword}><label>New password<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label><label>Confirm new password<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" /></label><button className="button" type="submit">Update password</button></form>;
}
