import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";

export const metadata = {
  title: "Recuperare acces",
};

export default function RecoveryPage() {
  return (
    <AuthShell
      title="Recuperare acces"
      description="Primești un link pe email ca să alegi o parolă nouă."
    >
      <RecoveryForm />
    </AuthShell>
  );
}
