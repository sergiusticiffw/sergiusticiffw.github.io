import React, { useMemo, useState } from 'react';
import { FiCheck, FiChevronDown, FiCopy } from 'react-icons/fi';
import {
  AiDebugKind,
  AiDebugStep,
  AiDebugTrace,
  formatDebugMs,
} from '../../../ai/debug';

const kindLabel: Record<AiDebugKind, string> = {
  info: 'Info',
  request: 'Request',
  response: 'Response',
  tool: 'Tool',
  warn: 'Warning',
  error: 'Error',
};

const kindDotClass: Record<AiDebugKind, string> = {
  info: 'border-white/20 text-white/65',
  request: 'border-sky-300 text-sky-300',
  response: 'border-emerald-300 text-emerald-300',
  tool: 'border-[var(--color-app-accent)] text-[var(--color-app-accent)]',
  warn: 'border-amber-400 text-amber-400',
  error: 'border-red-300 text-red-300',
};

const kindTextClass: Record<AiDebugKind, string> = {
  info: 'text-white/45',
  request: 'text-sky-300',
  response: 'text-emerald-300',
  tool: 'text-[var(--color-app-accent)]',
  warn: 'text-amber-400',
  error: 'text-red-300',
};

const formatClock = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const JsonNode: React.FC<{ name?: string; value: unknown; depth?: number }> = ({
  name,
  value,
  depth = 0,
}) => {
  if (value === null || value === undefined) {
    return (
      <div className="break-words">
        {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
        <span className="text-white/40">null</span>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="break-words">
        {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
        <span className="text-[#c4a5ff]">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="break-words">
        {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
        <span className="text-[#f7b257]">{value}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    const multiline = value.includes('\n') || value.length > 160;
    if (multiline) {
      return (
        <details
          className="my-0.5"
          open={depth < 1 && value.length < 400}
        >
          <summary className="cursor-pointer">
            {name ? (
              <span className="text-[#9cbcff]">{name}</span>
            ) : (
              <span>string</span>
            )}
            <span className="ml-1.5 text-white/40">
              {value.length.toLocaleString()} chars
            </span>
          </summary>
          <pre className="mt-1.5 m-0 whitespace-pre-wrap break-words text-[#a8e6a1]">
            {value}
          </pre>
        </details>
      );
    }
    return (
      <div className="break-words">
        {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
        <span className="text-[#a8e6a1]">"{value}"</span>
      </div>
    );
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item] as const)
      : Object.entries(value);
    const empty = entries.length === 0;
    const label = Array.isArray(value)
      ? `[${value.length}]`
      : `{${entries.length}}`;
    if (empty) {
      return (
        <div className="break-words">
          {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
          <span className="text-white/40">
            {Array.isArray(value) ? '[]' : '{}'}
          </span>
        </div>
      );
    }
    const children = entries.map(([key, item]) => (
      <JsonNode key={key} name={key} value={item} depth={depth + 1} />
    ));
    if (!name && depth === 0) {
      return <div>{children}</div>;
    }
    return (
      <details className="my-0.5" open={depth < 1}>
        <summary className="cursor-pointer">
          <span className="text-[#9cbcff]">{name}</span>
          <span className="ml-1.5 text-white/40">{label}</span>
        </summary>
        <div className="ml-2.5 border-l border-white/[0.08] pl-1.5">
          {children}
        </div>
      </details>
    );
  }

  return (
    <div className="break-words">
      {name ? <span className="text-[#9cbcff]">{name}: </span> : null}
      <span>{String(value)}</span>
    </div>
  );
};

const DebugStep: React.FC<{ step: AiDebugStep; index: number }> = ({
  step,
  index,
}) => {
  const [copied, setCopied] = useState(false);
  const hasData = step.data !== undefined;

  const copy = () => {
    void navigator.clipboard
      ?.writeText(JSON.stringify({ ...step, data: step.data }, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  };

  return (
    <li className="relative mt-2.5 flex gap-2.5">
      <span
        className={`z-[1] mt-2.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border bg-[#1a1d2e] text-[0.62rem] font-bold ${kindDotClass[step.kind]}`}
        aria-hidden
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 rounded-lg bg-white/[0.04] px-2.5 py-2">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={`text-[0.65rem] font-bold tracking-wider uppercase ${kindTextClass[step.kind]}`}
            >
              {kindLabel[step.kind]}
            </span>
            <strong className="break-words text-[0.82rem] font-semibold text-white">
              {step.title}
            </strong>
            {step.subtitle ? (
              <span className="break-words text-[0.72rem] leading-snug text-white/50">
                {step.subtitle}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[0.68rem] tabular-nums text-white/40">
            {step.durationMs !== undefined ? (
              <span>{formatDebugMs(step.durationMs)}</span>
            ) : null}
            <span>{formatClock(step.at)}</span>
            {hasData && (
              <button
                type="button"
                onClick={copy}
                aria-label="Copy step"
                className="flex border-none bg-transparent p-0.5 text-inherit hover:text-[var(--color-app-accent)]"
              >
                {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
              </button>
            )}
          </div>
        </div>
        {step.summary ? (
          <p className="mt-2 mb-0 rounded-lg bg-[color-mix(in_srgb,var(--color-app-accent)_10%,transparent)] px-2.5 py-2 text-[0.8rem] leading-snug break-words text-white/90">
            {step.summary}
          </p>
        ) : null}
        {hasData && (
          <details className="mt-1.5 text-[0.72rem] text-white/55">
            <summary className="cursor-pointer font-semibold">Payload</summary>
            <div className="mt-1.5 max-h-[280px] overflow-auto rounded-lg bg-black/30 px-2.5 py-2 font-mono text-[0.72rem] leading-snug">
              <JsonNode value={step.data} />
            </div>
          </details>
        )}
      </div>
    </li>
  );
};

const AiDebugPanel: React.FC<{ trace: AiDebugTrace }> = ({ trace }) => {
  const [copied, setCopied] = useState(false);
  const totalMs = (trace.endedAt || Date.now()) - trace.startedAt;
  const counts = useMemo(() => {
    const result = { request: 0, tool: 0, error: 0 };
    for (const step of trace.steps) {
      if (step.kind === 'request') result.request += 1;
      if (step.kind === 'tool') result.tool += 1;
      if (step.kind === 'error') result.error += 1;
    }
    return result;
  }, [trace.steps]);

  const copy = () => {
    void navigator.clipboard?.writeText(JSON.stringify(trace, null, 2)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    );
  };

  const summary = [
    `${trace.steps.length} step${trace.steps.length === 1 ? '' : 's'}`,
    counts.request
      ? `${counts.request} request${counts.request === 1 ? '' : 's'}`
      : '',
    counts.tool ? `${counts.tool} tool${counts.tool === 1 ? '' : 's'}` : '',
    formatDebugMs(totalMs),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <details
      className="group mt-3.5 rounded-xl border border-white/10 bg-black/30 open:[&_.ai-debug-chevron]:rotate-180"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <FiChevronDown
          size={16}
          className="ai-debug-chevron shrink-0 text-white/40 transition-transform duration-200"
          aria-hidden
        />
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--color-app-accent)_18%,transparent)] px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide text-[var(--color-app-accent)] uppercase">
          Debug
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-white/55">
          {summary}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border-none bg-transparent px-1.5 py-0.5 text-[0.72rem] text-white/50 hover:text-[var(--color-app-accent)]"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            copy();
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
          {copied ? 'Copied' : 'Copy all'}
        </button>
      </summary>
      <ol className="relative m-0 list-none px-2.5 pb-3 pl-[1.15rem] before:absolute before:top-1.5 before:bottom-3.5 before:left-[1.4rem] before:w-px before:bg-white/10">
        {trace.steps.map((step, index) => (
          <DebugStep key={step.id} step={step} index={index} />
        ))}
      </ol>
    </details>
  );
};

export default AiDebugPanel;
