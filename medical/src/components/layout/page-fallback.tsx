export function PageFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
      <div className="h-16 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
