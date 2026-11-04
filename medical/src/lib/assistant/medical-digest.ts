/**
 * Build a compact medical digest from OCR: drop letterheads/footers and
 * prefer conclusions, labs, recommendations over the document head.
 */

const USEFUL =
  /\b(concluz|diagnostic|recomand|tratament|terapie|epicriz|anamnez|rezultat|analiz|investig|simptom|diagnosticat|prescrip|medicat|doz[ae]|evolu|observat|interpret|referin[tț]|valoare|anormal|pozitiv|negativ|hemoglob|glicem|leucoc|tromboc|creatin|colesterol|tsh|tgo|tgp|ast|alt|pcr|vsh|ecograf|radiograf|ct\b|irm\b|rmn\b)/i;

const NOISE_LINE =
  /^(tel\.?|fax\.?|www\.|http|e-?mail|page\s*\d|pagina\s*\d|str\.|bd\.|bulevard|municipi|cod\s*fiscal|cui\s*:|idnp\s*:?\s*\d{0,13}$|copyright|all rights|scanned with|powered by)/i;

const UNITISH =
  /\b\d+([.,]\d+)?\s*(mg\/?d?l|g\/?l|mmol|µ?mol|ui\/?l|u\/?l|%|mm\/?h|mmhg|ng\/?ml|pg\/?ml|fl|fL|×10)/i;

function foldKey(line: string) {
  return line
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitBlocks(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim(),
    )
    .filter((block) => block.length >= 12);
}

function repeatedLineKeys(text: string) {
  const counts = new Map<string, number>();
  for (const line of text.split("\n")) {
    const key = foldKey(line);
    if (key.length < 8 || key.length > 120) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= 3) {
      repeated.add(key);
    }
  }
  return repeated;
}

function isNoiseBlock(block: string, repeated: Set<string>) {
  const lines = block.split("\n");
  let noise = 0;
  for (const line of lines) {
    const key = foldKey(line);
    if (
      repeated.has(key) ||
      NOISE_LINE.test(key) ||
      (/@/.test(line) && line.length < 80) ||
      (/^\+?\d[\d\s().-]{7,}$/.test(line) && line.length < 40)
    ) {
      noise += 1;
    }
  }
  return noise >= Math.max(1, Math.ceil(lines.length * 0.6));
}

function scoreBlock(block: string, index: number, total: number) {
  const folded = foldKey(block);
  let score = 0;
  if (USEFUL.test(block)) {
    score += 8;
  }
  if (UNITISH.test(block)) {
    score += 5;
  }
  if (/\b(recomand|concluz|diagnostic|tratament)\b/i.test(block)) {
    score += 6;
  }
  // Prefer the end of clinical notes (conclusions often land there).
  const position = total <= 1 ? 1 : index / (total - 1);
  score += Math.round(position * 4);
  // Mild length preference, capped.
  score += Math.min(4, Math.floor(block.length / 180));
  // Penalize very short leftover crumbs.
  if (block.length < 40 && score < 8) {
    score -= 2;
  }
  if (/^(dr\.|doctor|clinica|laborator)\b/i.test(folded) && !USEFUL.test(block)) {
    score -= 1;
  }
  return score;
}

/** Prefer the document tail when a single OCR run must be clipped. */
function clipPreferringTail(text: string, max: number) {
  if (text.length <= max) {
    return text;
  }
  const slice = text.slice(Math.max(0, text.length - max)).trim();
  return slice.length < max ? slice : `…${slice.slice(1)}`;
}

function joinSelected(
  blocks: { text: string; index: number }[],
  maxChars: number,
) {
  const ordered = [...blocks].sort((left, right) => left.index - right.index);
  const parts: string[] = [];
  let used = 0;
  for (const block of ordered) {
    const next = block.text;
    const extra = (parts.length > 0 ? 2 : 0) + next.length;
    if (used + extra > maxChars) {
      const room = maxChars - used - (parts.length > 0 ? 2 : 0);
      if (room >= 80) {
        parts.push(clipPreferringTail(next, room));
      }
      break;
    }
    parts.push(next);
    used += extra;
  }
  return parts.join("\n\n").trim();
}

/**
 * Produce assistant-facing OCR: strip repeated headers/footers and keep
 * medically useful blocks (conclusions, labs, recommendations).
 */
export function buildMedicalDigest(raw: string, maxChars: number) {
  const text = String(raw ?? "")
    .replace(/\u0000/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) {
    return "";
  }
  if (text.length <= maxChars) {
    // Still drop obvious repeated letterheads on short docs.
    const repeated = repeatedLineKeys(text);
    const blocks = splitBlocks(text).filter(
      (block) => !isNoiseBlock(block, repeated),
    );
    const cleaned = blocks.join("\n\n").trim() || text;
    return cleaned.slice(0, maxChars);
  }

  const repeated = repeatedLineKeys(text);
  const blocks = splitBlocks(text)
    .map((block, index, all) => ({
      text: block,
      index,
      score: isNoiseBlock(block, repeated)
        ? -100
        : scoreBlock(block, index, all.length),
    }))
    .filter((block) => block.score > -50);

  if (blocks.length === 0) {
    // Fallback: keep the tail (usually conclusions) rather than the header.
    return text.slice(Math.max(0, text.length - maxChars)).trim();
  }

  const ranked = [...blocks].sort((left, right) => right.score - left.score);
  const picked: { text: string; index: number }[] = [];
  let used = 0;
  for (const block of ranked) {
    const extra = (picked.length > 0 ? 2 : 0) + block.text.length;
    if (used + extra > maxChars && picked.length > 0) {
      continue;
    }
    if (used + extra > maxChars) {
      const room = maxChars - used;
      if (room >= 80) {
        picked.push({
          text: clipPreferringTail(block.text, room),
          index: block.index,
        });
        used = maxChars;
      }
      break;
    }
    picked.push({ text: block.text, index: block.index });
    used += extra;
    if (used >= maxChars) {
      break;
    }
  }

  // Ensure the document tail is represented when high-score head dominated.
  const tail = blocks.slice(-Math.min(3, blocks.length));
  for (const block of tail) {
    if (picked.some((item) => item.index === block.index)) {
      continue;
    }
    const extra = 2 + block.text.length;
    if (used + extra > maxChars) {
      continue;
    }
    picked.push({ text: block.text, index: block.index });
    used += extra;
  }

  const digest = joinSelected(picked, maxChars);
  if (digest.length >= Math.min(maxChars * 0.4, 400)) {
    return digest;
  }
  // Sparse OCR: fall back to end-weighted window.
  return text.slice(Math.max(0, text.length - maxChars)).trim();
}
