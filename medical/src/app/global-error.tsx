"use client";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, sans-serif",
          background: "#f4f8f8",
          color: "#171717",
        }}
      >
        <div role="alert" style={{ maxWidth: "26rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            Ceva nu a funcționat
          </h1>
          <p style={{ fontSize: "1rem", lineHeight: 1.5, color: "#525252" }}>
            Aplicația nu a putut porni. Datele tale nu au fost modificate.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              fontSize: "1rem",
              borderRadius: "0.5rem",
              border: 0,
              background: "#0f5f66",
              color: "#fff",
            }}
          >
            Încearcă din nou
          </button>
        </div>
      </body>
    </html>
  );
}
