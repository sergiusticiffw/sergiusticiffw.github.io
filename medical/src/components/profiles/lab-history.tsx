"use client";

import Link from "next/link";
import { useId, useMemo } from "react";

import { formatBirthDate } from "@/lib/format";
import {
  buildLabSeries,
  compareToReference,
  type LabPoint,
  type LabResultRow,
  type LabSeries,
} from "@/lib/labs";

const COMPARISON_LABEL = {
  below: "sub intervalul din document",
  above: "peste intervalul din document",
  within: "în intervalul din document",
} as const;

function valueLabel(point: LabPoint, unit: string) {
  const base = point.value !== null ? String(point.value) : (point.text ?? "—");
  return unit ? `${base} ${unit}` : base;
}

function referenceLabel(point: LabPoint) {
  if (point.referenceText) {
    return point.referenceText;
  }
  if (point.referenceMin !== null && point.referenceMax !== null) {
    return `${point.referenceMin} - ${point.referenceMax}`;
  }
  return "—";
}

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { left: 40, right: 12, top: 12, bottom: 28 };

/**
 * Plain SVG trend. Values keep their original unit, every point carries a
 * title, and the same data is available as a table below the chart.
 */
export function LabTrendChart({ series }: { series: LabSeries }) {
  const titleId = useId();
  const numeric = series.points
    .filter((point) => point.value !== null && point.date)
    .map((point) => ({ ...point, value: point.value as number }))
    .sort((left, right) => (left.date as string).localeCompare(right.date as string));

  if (numeric.length < 2) {
    return null;
  }

  const latest = numeric[numeric.length - 1];
  const bandMin = latest.referenceMin;
  const bandMax = latest.referenceMax;
  const values = numeric.map((point) => point.value);
  const domainValues = [
    ...values,
    ...(bandMin !== null ? [bandMin] : []),
    ...(bandMax !== null ? [bandMax] : []),
  ];
  let low = Math.min(...domainValues);
  let high = Math.max(...domainValues);
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const margin = (high - low) * 0.1;
  low -= margin;
  high += margin;

  const times = numeric.map((point) =>
    new Date(`${point.date}T00:00:00Z`).getTime(),
  );
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const span = maxTime - minTime || 1;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (time: number) => PAD.left + ((time - minTime) / span) * plotWidth;
  const y = (value: number) =>
    PAD.top + (1 - (value - low) / (high - low)) * plotHeight;

  const path = numeric
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(times[index]).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(" ");
  const first = numeric[0];
  const summary = `Evoluția ${series.name}${series.unit ? ` în ${series.unit}` : ""}: ${numeric.length} valori, de la ${first.value} la ${latest.value}, între ${formatBirthDate(first.date as string)} și ${formatBirthDate(latest.date as string)}.`;

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={titleId}
        className="h-auto w-full"
      >
        <title id={titleId}>{summary}</title>
        {bandMin !== null || bandMax !== null ? (
          <rect
            x={PAD.left}
            width={plotWidth}
            y={y(bandMax ?? high)}
            height={Math.max(
              0,
              y(bandMin ?? low) - y(bandMax ?? high),
            )}
            className="fill-success-soft"
          />
        ) : null}
        <line
          x1={PAD.left}
          x2={PAD.left}
          y1={PAD.top}
          y2={HEIGHT - PAD.bottom}
          className="stroke-border"
        />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={HEIGHT - PAD.bottom}
          y2={HEIGHT - PAD.bottom}
          className="stroke-border"
        />
        <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {Number(high.toFixed(2))}
        </text>
        <text x={PAD.left - 4} y={HEIGHT - PAD.bottom} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {Number(low.toFixed(2))}
        </text>
        <text x={PAD.left} y={HEIGHT - 8} textAnchor="start" className="fill-muted-foreground text-[10px]">
          {formatBirthDate(first.date as string)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {formatBirthDate(latest.date as string)}
        </text>
        <path d={path} fill="none" strokeWidth={2} className="stroke-primary" />
        {numeric.map((point, index) => (
          <circle
            key={`${point.recordId}-${index}`}
            cx={x(times[index])}
            cy={y(point.value)}
            r={4}
            className="fill-primary stroke-background"
            strokeWidth={1.5}
          >
            <title>{`${formatBirthDate(point.date as string)}: ${valueLabel(point, series.unit)}`}</title>
          </circle>
        ))}
      </svg>
      {bandMin !== null || bandMax !== null ? (
        <figcaption className="text-xs text-muted-foreground">
          Banda verde este intervalul de referință tipărit pe ultimul rezultat.
        </figcaption>
      ) : null}
    </figure>
  );
}

function SeriesCard({ series }: { series: LabSeries }) {
  const latest = series.points[0];
  const comparison = compareToReference(latest);

  return (
    <li className="rounded-xl border bg-card">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <span className="min-w-0">
            <span className="block truncate text-base font-medium">
              {series.name}
            </span>
            <span className="block text-sm text-muted-foreground">
              {latest.date ? formatBirthDate(latest.date) : "Fără dată"}
              {series.points.length > 1
                ? ` · ${series.points.length} valori`
                : ""}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-base font-semibold">
              {valueLabel(latest, series.unit)}
            </span>
            {comparison ? (
              <span className="block text-xs text-muted-foreground">
                {COMPARISON_LABEL[comparison]}
              </span>
            ) : null}
          </span>
        </summary>
        <div className="flex flex-col gap-3 border-t px-3 py-3">
          <LabTrendChart series={series} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Toate valorile pentru {series.name}
              </caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Valoare
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Interval din document
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Înregistrare</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.points.map((point, index) => (
                  <tr key={`${point.recordId}-${index}`} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {point.date ? formatBirthDate(point.date) : "Fără dată"}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {valueLabel(point, series.unit)}
                    </td>
                    <td className="py-2 pr-3">{referenceLabel(point)}</td>
                    <td className="py-2">
                      <Link
                        href={`/records/${point.recordId}`}
                        className="inline-flex min-h-11 items-center underline underline-offset-4"
                      >
                        Deschide
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Valorile sunt afișate exact cum au fost introduse. Compararea cu
            intervalul din document nu este o interpretare medicală.
          </p>
        </div>
      </details>
    </li>
  );
}

export function LabHistory({ rows }: { rows: LabResultRow[] }) {
  const series = useMemo(() => buildLabSeries(rows), [rows]);
  if (series.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="lab-history-title"
      className="flex flex-col gap-3 border-t pt-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="lab-history-title" className="text-base font-semibold">
          Evoluția analizelor
        </h2>
        <p className="text-sm text-muted-foreground">
          {series.length === 1 ? "1 analiză" : `${series.length} analize`}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {series.map((item) => (
          <SeriesCard key={item.key} series={item} />
        ))}
      </ul>
    </section>
  );
}
