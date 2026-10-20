import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFallback } from "@/components/layout/page-fallback";
import { RecordDetail } from "@/components/records/record-detail";
import { getFamilyAccess, requireProfileWriter } from "@/lib/auth";
import { loadFamilyRecord } from "@/lib/records";

export const metadata = {
  title: "Înregistrare",
};

export default function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/records" prefetch className="text-sm text-muted-foreground hover:underline">
        Toate înregistrările
      </Link>
      <Suspense fallback={<PageFallback label="Se încarcă înregistrarea…" />}>
        <RecordSection params={params} />
      </Suspense>
    </div>
  );
}

async function RecordSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const family = await getFamilyAccess();
  if (!family.familyId) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {family.error}
      </p>
    );
  }

  const loaded = await loadFamilyRecord(family.familyId, id);
  if (loaded.error || !loaded.record) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {loaded.error ?? "Înregistrarea nu a fost găsită."}
      </p>
    );
  }

  if (loaded.record.id !== id) {
    redirect(`/records/${loaded.record.id}`);
  }

  const writer = await requireProfileWriter(loaded.record.profileId);
  return (
    <RecordDetail
      record={loaded.record}
      canEdit={Boolean(writer.familyId)}
    />
  );
}
