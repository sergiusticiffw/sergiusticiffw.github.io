import { Spinner } from "@/components/layout/spinner";

export function PageFallback({ label }: { label: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 py-16"
      aria-busy="true"
    >
      <Spinner />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
