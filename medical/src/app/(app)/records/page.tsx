import { Suspense } from "react";

import { PageFallback } from "@/components/layout/page-fallback";
import { RecordsList } from "@/components/records/records-list";
import { loadRecordsIndex } from "@/lib/assistant/catalog";
import { getPageFamilyAccess } from "@/lib/auth";

export const metadata = {
  title: "Înregistrări",
};

export default function RecordsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Înregistrări</h1>
        <p className="text-sm text-muted-foreground">
          Caută în tot dosarul. Filtrează după tip, persoană sau lună.
        </p>
      </div>
      <Suspense fallback={<PageFallback label="Se încarcă înregistrările…" />}>
        <RecordsSection />
      </Suspense>
    </div>
  );
}

async function RecordsSection() {
  const family = await getPageFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const catalog = await loadRecordsIndex(family.familyId);
  if (catalog.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {catalog.error}
      </p>
    );
  }

  return <RecordsList people={catalog.people} records={catalog.records} />;
}
