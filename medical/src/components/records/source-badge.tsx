export type RecordSource = "document" | "manual";

const LABELS: Record<RecordSource, { text: string; hint: string }> = {
  document: {
    text: "Document încărcat",
    hint: "Textul este citit automat din fișier și poate conține erori. Originalul rămâne neschimbat.",
  },
  manual: {
    text: "Introdus de familie",
    hint: "Scris de un membru al familiei, nu verificat de un medic.",
  },
};

/** Says where a record's information came from. Text, never color alone. */
export function SourceBadge({
  source,
  showHint = false,
}: {
  source: RecordSource;
  showHint?: boolean;
}) {
  const label = LABELS[source];
  return (
    <span className="flex flex-col gap-0.5">
      <span className="inline-flex w-fit rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {label.text}
      </span>
      {showHint ? (
        <span className="text-sm text-muted-foreground">{label.hint}</span>
      ) : null}
    </span>
  );
}
