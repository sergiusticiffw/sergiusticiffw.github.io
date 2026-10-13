import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { LoginNotice } from "@/components/auth/login-notice";

export const metadata = {
  title: "Autentificare",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Autentificare"
      description="Intră în dosarul medical al familiei."
    >
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <LoginForm />
    </AuthShell>
  );
}
