import DOMPurify from 'dompurify';
import React from 'react';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const inline = (value: string) => {
  let text = escapeHtml(value);
  text = text.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">$1</code>'
  );
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return text;
};

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isTableRow = (line: string) => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
};

const isSeparator = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());

const isHeading = (line: string) => /^#{1,3}\s+\S/.test(line);
const isBullet = (line: string) => /^\s*[-*]\s+\S/.test(line);
const isOrdered = (line: string) => /^\s*\d+\.\s+\S/.test(line);

const tableHtml = (header: string[], rows: string[][]) => {
  const head = header
    .map(
      (cell) =>
        `<th class="border border-white/10 px-2 py-1.5 text-left font-medium">${inline(cell)}</th>`
    )
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td class="border border-white/10 px-2 py-1.5 align-top">${inline(cell)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<div class="my-2 overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
};

const markdownToHtml = (source: string) => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isTableRow(line) && isSeparator(lines[i + 1] || '')) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isSeparator(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      html.push(tableHtml(header, rows));
      continue;
    }

    if (isHeading(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 2;
      const tag = `h${Math.min(level, 3)}`;
      html.push(
        `<${tag} class="mt-3 mb-1 font-semibold text-app-primary">${inline(line.replace(/^#+\s+/, ''))}</${tag}>`
      );
      i += 1;
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ul class="my-2 list-disc space-y-1 pl-5">${items.join('')}</ul>`);
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol class="my-2 list-decimal space-y-1 pl-5">${items.join('')}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i]) &&
      !(isTableRow(lines[i]) && isSeparator(lines[i + 1] || ''))
    ) {
      paragraph.push(inline(lines[i]));
      i += 1;
    }
    html.push(`<p class="my-2">${paragraph.join('<br/>')}</p>`);
  }

  return html.join('');
};

const AiMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const html = DOMPurify.sanitize(markdownToHtml(text), {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'code',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'div',
    ],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className="ai-markdown text-[0.95rem] leading-relaxed text-app-secondary [&_strong]:text-app-primary"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default React.memo(AiMarkdown);
