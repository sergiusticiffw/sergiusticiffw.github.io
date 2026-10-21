import { PreflightCheck } from '../../crypto/migration';

interface PreflightListProps {
  checks: PreflightCheck[];
  t: (key: string) => string;
}

const PreflightList = ({ checks, t }: PreflightListProps) => (
  <ul className="flex flex-col gap-2 m-0 p-0 list-none">
    {checks.map((check) => {
      const count = check.hint?.match(/\d+/)?.[0];
      const hint = check.ok
        ? ''
        : count
          ? t(`privacy.hint.${check.id}`).replace('{count}', count)
          : t(`privacy.hint.${check.id}`);
      return (
        <li
          key={check.id}
          className="flex items-start gap-2.5 text-sm text-app-secondary"
        >
          <span
            className={`mt-0.5 shrink-0 ${check.ok ? 'text-emerald-400' : 'text-amber-300'}`}
            aria-hidden
          >
            {check.ok ? '✓' : '•'}
          </span>
          <span>
            <span className="text-app-primary">{t(`privacy.check.${check.id}`)}</span>
            {!check.ok && hint && (
              <span className="block text-xs text-app-muted mt-0.5">{hint}</span>
            )}
          </span>
        </li>
      );
    })}
  </ul>
);

export default PreflightList;
