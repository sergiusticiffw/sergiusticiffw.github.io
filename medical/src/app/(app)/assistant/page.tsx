import { Suspense } from "react";

import { MedicalAssistant } from "@/components/assistant/medical-assistant";
import { PageFallback } from "@/components/layout/page-fallback";
import { loadRecordsIndex, suggestFromIndex } from "@/lib/assistant/catalog";
import { getPageFamilyAccess } from "@/lib/auth";

export const metadata = {
  title: "Asistent",
};

export const maxDuration = 60;

const genericSuggestions = [
  "Ce analize recente există în dosar?",
  "Ce consultații sunt în dosar?",
  "Rezumă ultimele documente.",
  "Compară analizele recente din dosar.",
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
  const enabled = Boolean(process.env.GEMINI_API_KEY?.trim());
  if (!enabled) {
    return <MedicalAssistant enabled={false} suggestions={[]} />;
  }

  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return <MedicalAssistant enabled suggestions={[]} />;
  }

  const index = await loadRecordsIndex(family.familyId);
  const fromDosar =
    !index.error && index.records.length > 0
      ? suggestFromIndex(index.records, index.people)
      : [];
  const suggestions = [
    ...fromDosar,
    ...genericSuggestions.filter(
      (prompt) =>
        !fromDosar.some(
          (item) => item.toLocaleLowerCase("ro") === prompt.toLocaleLowerCase("ro"),
        ),
    ),
  ].slice(0, 4);

  return (
    <MedicalAssistant
      enabled
      suggestions={suggestions}
      people={index.people.map((person) => ({
        id: person.id,
        display_name: person.display_name,
      }))}
    />
  );
}
