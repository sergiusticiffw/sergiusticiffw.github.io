import Link from "next/link";

import type { AssistantSource } from "@/lib/assistant/types";
import { formatBirthDate } from "@/lib/format";

export function AssistantSources({ sources }: { sources: AssistantSource[] }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t pt-2.5">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Surse</p>
      <ul className="flex flex-col gap-1">
        {sources.map((source) => {
          const label = [
            source.date ? formatBirthDate(source.date) : null,
            source.profile,
            source.title,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={source.id} className="text-xs leading-snug">
              {source.href ? (
                <Link
                  href={source.href}
                  prefetch
                  className="text-foreground underline-offset-2 hover:underline"
                >
                  {label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
