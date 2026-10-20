import { parseAnswer } from "@/lib/assistant/format-answer";
import type { ReactNode } from "react";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <span
              key={index}
              className="rounded bg-muted px-1 py-px font-medium"
            >
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function List({
  ordered,
  items,
}: {
  ordered: boolean;
  items: string[];
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={
        ordered
          ? "list-decimal space-y-1 pl-4"
          : "list-disc space-y-1 pl-4"
      }
    >
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 24)}`} className="leading-relaxed">
          <Inline text={item} />
        </li>
      ))}
    </Tag>
  );
}

export function AssistantAnswer({ text }: { text: string }) {
  const blocks = parseAnswer(text);
  if (blocks.length === 0) {
    return <p className="leading-relaxed text-muted-foreground">Nu am găsit un răspuns în documente.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, index) => {
        let content: ReactNode;
        if (block.type === "heading") {
          content = (
            <p className="font-semibold leading-snug">
              <Inline text={block.text} />
            </p>
          );
        } else if (block.type === "list") {
          content = <List ordered={block.ordered} items={block.items} />;
        } else if (block.type === "quote") {
          content = (
            <p className="border-l-2 border-border pl-2.5 leading-relaxed text-muted-foreground">
              <Inline text={block.text} />
            </p>
          );
        } else {
          content = (
            <p className="leading-relaxed">
              {block.lines.map((line, lineIndex) => (
                <span key={`${lineIndex}-${line.slice(0, 24)}`}>
                  {lineIndex > 0 ? <br /> : null}
                  <Inline text={line} />
                </span>
              ))}
            </p>
          );
        }
        return <div key={`${block.type}-${index}`}>{content}</div>;
      })}
    </div>
  );
}
