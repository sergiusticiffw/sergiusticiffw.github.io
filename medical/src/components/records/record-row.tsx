import Link from "next/link";

import { formatBirthDate } from "@/lib/format";

export type RecordRowData = {
  id: string;
  title: string;
  date: string | null;
  category?: string | null;
  snippet?: string | null;
  fileCount?: number;
  profileName?: string | null;
};

/**
 * One record in any list (overview, person page, search). The date comes
 * first because medical history is read chronologically.
 */
export function RecordRow({
  record,
  showPerson = false,
}: {
  record: RecordRowData;
  showPerson?: boolean;
}) {
  const meta = [
    record.date ? formatBirthDate(record.date) : "Fără dată",
    record.category,
    showPerson ? record.profileName : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/records/${record.id}`}
      prefetch
      className="flex min-h-16 flex-col gap-1 rounded-xl border bg-card px-4 py-3 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="text-sm text-muted-foreground">{meta.join(" · ")}</span>
      <span className="line-clamp-2 text-base font-medium">
        {record.title || "Fără titlu"}
      </span>
      {record.snippet ? (
        <span className="line-clamp-2 text-sm text-muted-foreground">
          {record.snippet}
        </span>
      ) : null}
      {record.fileCount && record.fileCount > 0 ? (
        <span className="text-sm text-muted-foreground">
          {record.fileCount === 1 ? "1 fișier" : `${record.fileCount} fișiere`}
        </span>
      ) : null}
    </Link>
  );
}
