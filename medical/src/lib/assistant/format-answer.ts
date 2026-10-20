export type AnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string };

const IDNP = /\b(?:IDNP\s*:?\s*)?\d{13}\b/gi;
const FENCE = /```(?:[\w-]+)?\n?([\s\S]*?)```/g;
const LINK = /\[([^\]]+)\]\([^)]+\)/g;
const RULE = /^\s*[-*_=]{3,}\s*$/gm;

function cellsFrom(row: string) {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function convertTables(text: string) {
  return text.replace(/(?:^\|.+\|[ \t]*\n?)+/gm, (block) => {
    const rows = block
      .trim()
      .split("\n")
      .filter((row) => !/^\|[\s:|-]+\|$/.test(row.trim()))
      .map(cellsFrom)
      .filter((cells) => cells.length > 0);
    if (rows.length === 0) {
      return "";
    }
    const body = rows.length > 1 ? rows.slice(1) : rows;
    return `${body
      .map((cells) =>
        cells.length === 2 ? `- **${cells[0]}:** ${cells[1]}` : `- ${cells.join(" · ")}`,
      )
      .join("\n")}\n`;
  });
}

function stripOpeners(text: string) {
  let next = text.trimStart();
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next
      .replace(/^(?:sigur|desigur|bineînțeles|bineinteles)[,!.]?\s*/i, "")
      .replace(
        /^(?:iat[aă]\s+(?:ce\s+)?(?:am\s+g[aă]sit|rezultatul|informația|informatia)[:.]?\s*)/i,
        "",
      )
      .trimStart();
  }
  return next;
}

function tidyLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function polishAnswer(text: string) {
  return tidyLines(
    stripOpeners(
      convertTables(
        text
          .replace(/\r\n/g, "\n")
          .replace(FENCE, "$1")
          .replace(/```/g, "")
          .replace(LINK, "$1")
          .replace(RULE, "")
          .replace(IDNP, " "),
      ).replace(IDNP, " "),
    ),
  );
}

function heading(line: string) {
  const match = /^(#{1,3})\s+(.+)$/.exec(line);
  return match ? match[2].trim() : null;
}

function unordered(line: string) {
  const match = /^[-*•]\s+(.+)$/.exec(line);
  return match ? match[1].trim() : null;
}

function ordered(line: string) {
  const match = /^\d+[.)]\s+(.+)$/.exec(line);
  return match ? match[1].trim() : null;
}

function quote(line: string) {
  const match = /^>\s?(.*)$/.exec(line);
  return match ? match[1].trim() : null;
}

export function parseAnswer(text: string): AnswerBlock[] {
  const lines = polishAnswer(text).split("\n");
  const blocks: AnswerBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      continue;
    }

    const title = heading(line);
    if (title) {
      blocks.push({ type: "heading", text: title });
      continue;
    }

    const quoted = quote(line);
    if (quoted !== null) {
      const parts = [quoted];
      while (index + 1 < lines.length) {
        const next = quote(lines[index + 1] ?? "");
        if (next === null) {
          break;
        }
        parts.push(next);
        index += 1;
      }
      blocks.push({ type: "quote", text: parts.filter(Boolean).join(" ") });
      continue;
    }

    const bullet = unordered(line);
    if (bullet !== null) {
      const items = [bullet];
      while (index + 1 < lines.length) {
        const next = unordered(lines[index + 1] ?? "");
        if (next === null) {
          break;
        }
        items.push(next);
        index += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    const number = ordered(line);
    if (number !== null) {
      const items = [number];
      while (index + 1 < lines.length) {
        const next = ordered(lines[index + 1] ?? "");
        if (next === null) {
          break;
        }
        items.push(next);
        index += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const gathered = [line.trim()];
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? "";
      if (
        !next.trim() ||
        heading(next) ||
        unordered(next) !== null ||
        ordered(next) !== null ||
        quote(next) !== null
      ) {
        break;
      }
      gathered.push(next.trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: gathered });
  }

  return blocks.reduce<AnswerBlock[]>((merged, block) => {
    const last = merged.at(-1);
    if (
      last?.type === "list" &&
      block.type === "list" &&
      last.ordered === block.ordered
    ) {
      last.items.push(...block.items);
      return merged;
    }
    merged.push(block);
    return merged;
  }, []);
}
