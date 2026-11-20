import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type EmergencyInfo = {
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  emergency_notes: string | null;
};

function WarningGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
      aria-hidden
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Row({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt
        className={
          emphasis
            ? "flex items-center gap-1.5 text-sm font-semibold text-warning"
            : "text-sm font-medium text-muted-foreground"
        }
      >
        {emphasis ? <WarningGlyph /> : null}
        {label}
      </dt>
      <dd className="text-base whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export function hasEmergencyInfo(info: EmergencyInfo) {
  return Boolean(
    info.blood_type ||
      info.allergies ||
      info.chronic_conditions ||
      info.current_medications ||
      info.emergency_notes,
  );
}

/**
 * The first thing a doctor or a parent in an emergency needs. Everything here
 * is entered by the family and says so; nothing is inferred or verified.
 */
export function EmergencyCard({
  info,
  onEdit,
}: {
  info: EmergencyInfo;
  onEdit?: () => void;
}) {
  if (!hasEmergencyInfo(info)) {
    return (
      <section
        aria-labelledby="emergency-heading"
        className="flex flex-col gap-2 rounded-xl border border-dashed p-4"
      >
        <h2 id="emergency-heading" className="text-base font-semibold">
          Fișă de urgență
        </h2>
        <p className="text-base text-muted-foreground">
          Alergii, grupa de sânge și medicamentele curente nu sunt completate
          încă.
        </p>
        {onEdit ? (
          <Button type="button" variant="outline" className="sm:w-fit" onClick={onEdit}>
            Completează fișa
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="emergency-heading"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="emergency-heading" className="text-base font-semibold">
          Fișă de urgență
        </h2>
        {info.blood_type ? (
          <p className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <span className="sr-only">Grupa de sânge: </span>
            {info.blood_type}
          </p>
        ) : null}
      </div>
      <dl className="flex flex-col gap-3">
        {info.allergies ? (
          <Row label="Alergii" emphasis>
            {info.allergies}
          </Row>
        ) : null}
        {info.chronic_conditions ? (
          <Row label="Afecțiuni cronice">{info.chronic_conditions}</Row>
        ) : null}
        {info.current_medications ? (
          <Row label="Medicamente curente">{info.current_medications}</Row>
        ) : null}
        {info.emergency_notes ? (
          <Row label="Note de urgență">{info.emergency_notes}</Row>
        ) : null}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Completat de familie. Nu este verificat de un medic.
        </p>
        {onEdit ? (
          <Button type="button" variant="outline" onClick={onEdit}>
            Modifică fișa
          </Button>
        ) : null}
      </div>
    </section>
  );
}
