import Link from "next/link";

export const metadata = {
  title: "Pagina nu există",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nu am găsit pagina
      </h1>
      <p className="text-base text-muted-foreground">
        Înregistrarea sau persoana căutată nu există sau nu mai este
        disponibilă pentru contul tău.
      </p>
      <Link
        href="/profiles"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        Înapoi la persoane
      </Link>
    </main>
  );
}
