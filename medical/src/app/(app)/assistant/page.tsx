import { Suspense } from "react";

import { MedicalAssistant } from "@/components/assistant/medical-assistant";
import { PageFallback } from "@/components/layout/page-fallback";
import { getFamilyAccess } from "@/lib/auth";
import { useFamilyCache } from "@/lib/data-cache";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Asistent",
};

const genericSuggestions = [
  "Ce analize recente există în dosar?",
  "Ce consultații sunt în dosar?",
  "Rezumă ultimele documente.",
];

export default function AssistantPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Asistent</h1>
      <Suspense fallback={<PageFallback label="Se încarcă asistentul…" />}>
        <AssistantSection />
      </Suspense>
    </div>
  );
}

async function AssistantSection() {
  "use cache: private";
  useFamilyCache();
  const enabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!enabled) {
    return <MedicalAssistant enabled={false} suggestions={[]} />;
  }

  const family = await getFamilyAccess();
  if (!family.familyId) {
    return <MedicalAssistant enabled suggestions={[]} />;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("family_id", family.familyId)
    .order("display_name", { ascending: true })
    .limit(2);
  const people = (data ?? []) as { display_name: string }[];
  const suggestions = [
    ...people.map((person) => `Ce documente recente are ${person.display_name}?`),
    ...genericSuggestions,
  ].slice(0, 4);

  return <MedicalAssistant enabled suggestions={suggestions} />;
}
