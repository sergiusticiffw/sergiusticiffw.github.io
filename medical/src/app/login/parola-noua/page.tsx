import { connection } from "next/server";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Parolă nouă",
};

export default function NewPasswordPage() {
  return (
    <AuthShell
      title="Parolă nouă"
      description="Alege o parolă pentru contul de administrator."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Se încarcă…</p>}>
        <NewPasswordGate />
      </Suspense>
    </AuthShell>
  );
}

async function NewPasswordGate() {
  await connection();
  let status: "ready" | "expired" | "config" = "expired";

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    status = data.user ? "ready" : "expired";
  } catch {
    status = "config";
  }

  if (status === "config") {
    return (
      <p role="alert" className="text-sm text-destructive">
        Conexiunea cu Supabase nu este configurată.
      </p>
    );
  }

  if (status === "expired") {
    return (
      <p className="text-sm text-muted-foreground">
        Linkul de recuperare a expirat. Cere un link nou din pagina de
        recuperare.
      </p>
    );
  }

  return <NewPasswordForm />;
}
