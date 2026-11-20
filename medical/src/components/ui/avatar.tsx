import { initials } from "@/lib/format";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-xl",
} as const;

/** Initials in a calm teal circle. Decorative: the name is always next to it. */
export function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
