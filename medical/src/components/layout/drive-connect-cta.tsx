import Link from "next/link";

export function DriveConnectCta({
  canConnect = false,
  className,
}: {
  canConnect?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={
        className ??
        "flex flex-col gap-2 rounded-lg border border-dashed border-amber-600/40 bg-amber-50 px-3 py-3 text-sm dark:bg-amber-950/30"
      }
    >
      <p>
        Google Drive nu este conectat. Fără el nu poți încărca sau atașa
        documente.
      </p>
      {canConnect ? (
        <Link
          href="/api/google/connect"
          className="font-medium underline-offset-4 hover:underline"
        >
          Conectează Google Drive
        </Link>
      ) : (
        <p className="text-muted-foreground">
          Cere administratorului familiei să conecteze Drive din{" "}
          <Link href="/profile" className="underline-offset-4 hover:underline">
            Cont
          </Link>
          .
        </p>
      )}
    </div>
  );
}
