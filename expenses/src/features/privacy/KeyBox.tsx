import { FiCheck, FiCopy } from 'react-icons/fi';

interface KeyBoxProps {
  value: string;
  copied?: boolean;
  onCopy?: () => void;
  copyLabel?: string;
  copiedLabel?: string;
}

const KeyBox = ({ value, copied = false, onCopy, copyLabel, copiedLabel }: KeyBoxProps) => (
  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3.5">
    <p className="m-0 font-mono text-[13px] leading-6 tracking-wide text-app-primary">
      {value.split('-').map((part, index, all) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < all.length - 1 && (
            <>
              -<wbr />
            </>
          )}
        </span>
      ))}
    </p>
    {onCopy && (
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-app-primary cursor-pointer hover:bg-white/[0.08]"
      >
        {copied ? <FiCheck className="text-emerald-400" aria-hidden /> : <FiCopy aria-hidden />}
        {copied ? copiedLabel : copyLabel}
      </button>
    )}
  </div>
);

export default KeyBox;
