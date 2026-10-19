import { Suspense } from "react";

import { MedicalAssistant } from "@/components/assistant/medical-assistant";
import { loadMedicalCatalog, suggestQuestions } from "@/lib/assistant/catalog";
import { getFamilyAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Asistent",
};

export default function AssistantPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Asistent</h1>
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Se încarcă documentele…</p>}
      >
        <AssistantSection />
      </Suspense>
    </div>
  );
}

async function AssistantSection() {
  const enabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!enabled) {
    return <MedicalAssistant enabled={false} suggestions={[]} />;
  }

  const family = await getFamilyAccess();
  if (!family.familyId) {
    return <MedicalAssistant enabled suggestions={[]} />;
  }

  const supabase = await createClient();
  const catalog = await loadMedicalCatalog(supabase, family.familyId);
  return (
    <MedicalAssistant
      enabled
      suggestions={catalog.error ? [] : suggestQuestions(catalog.records)}
    />
  );
}
