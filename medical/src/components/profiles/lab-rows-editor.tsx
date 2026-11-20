"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyLabTest,
  MAX_LAB_ROWS,
  type LabDraft,
} from "@/lib/validation/extraction";

type Row = LabDraft & { key: number };

let nextKey = 1;

function newRow(): Row {
  return { ...emptyLabTest(), key: nextKey++ };
}

function strip(row: Row): LabDraft {
  return {
    testName: row.testName,
    category: row.category,
    sampleDate: row.sampleDate,
    result: row.result,
    unit: row.unit,
    reference: row.reference,
    laboratory: row.laboratory,
    notes: row.notes,
  };
}

/**
 * Manual entry of lab values copied from the paper or PDF result. Nothing is
 * guessed or filled in automatically: whatever is saved is what was typed.
 */
export function LabRowsEditor({
  onChange,
}: {
  onChange?: (rows: LabDraft[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const groupId = useId();

  function update(next: Row[]) {
    setRows(next);
    onChange?.(next.map(strip));
  }

  function patch(key: number, field: keyof LabDraft, value: string) {
    update(
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  const serialised = JSON.stringify(rows.map(strip));

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border px-3 py-3">
      <legend className="px-1 text-sm font-medium">
        Valori din analize (opțional)
      </legend>
      <p className="text-sm text-muted-foreground">
        Copiază exact ce scrie pe rezultat. Valorile nu sunt interpretate. Cu ele
        poți vedea evoluția în timp.
      </p>
      <input type="hidden" name="labRows" value={serialised} />
      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const base = `${groupId}-${index}`;
          return (
            <li
              key={row.key}
              className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3"
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${base}-name`}>
                  Analiza {rows.length > 1 ? index + 1 : ""}
                </Label>
                <Input
                  id={`${base}-name`}
                  value={row.testName}
                  maxLength={200}
                  autoComplete="off"
                  placeholder="ex. Hemoglobină"
                  onChange={(event) =>
                    patch(row.key, "testName", event.target.value)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${base}-result`}>Rezultat</Label>
                  <Input
                    id={`${base}-result`}
                    value={row.result}
                    maxLength={500}
                    autoComplete="off"
                    inputMode="decimal"
                    onChange={(event) =>
                      patch(row.key, "result", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`${base}-unit`}>Unitate</Label>
                  <Input
                    id={`${base}-unit`}
                    value={row.unit}
                    maxLength={40}
                    autoComplete="off"
                    placeholder="g/dL"
                    onChange={(event) =>
                      patch(row.key, "unit", event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${base}-ref`}>Interval de referință</Label>
                <Input
                  id={`${base}-ref`}
                  value={row.reference}
                  maxLength={200}
                  autoComplete="off"
                  placeholder="ex. 12 - 16"
                  onChange={(event) =>
                    patch(row.key, "reference", event.target.value)
                  }
                />
              </div>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => update(rows.filter((item) => item.key !== row.key))}
                >
                  Șterge rândul
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {rows.length < MAX_LAB_ROWS ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => update([...rows, newRow()])}
        >
          Adaugă altă analiză
        </Button>
      ) : null}
    </fieldset>
  );
}
