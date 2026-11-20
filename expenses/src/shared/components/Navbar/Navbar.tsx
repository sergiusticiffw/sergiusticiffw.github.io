import { Link, useLocation } from '@tanstack/react-router';
import type { LinkProps } from '@tanstack/react-router';
import { useLocalization } from '@shared/context/localization';
import { useGoalsEnabled } from '@stores/settingsStore';
import {
  FiHome,
  FiBarChart2,
  FiDollarSign,
  FiCreditCard,
  FiShield,
  FiUser,
  FiZap,
} from 'react-icons/fi';
import type { ReactNode } from 'react';

type NavItemProps = {
  to: LinkProps['to'];
  label: string;
  icon: ReactNode;
  /** Exact match only (used for Home so it is not active on every page). */
  exact?: boolean;
  /** Mark as the current section even when the URL is a different route. */
  forceActive?: boolean;
};

const NAV_ITEM_CLASS =
  'text-app-muted h-full w-full min-w-0 flex flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-200 hover:text-app-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-app-accent)] [&.active]:!text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5]';

const NavItem = ({ to, label, icon, exact, forceActive }: NavItemProps) => (
  <li className="h-full flex-1 min-w-0 flex items-center justify-center">
    <Link
      to={to}
      aria-label={label}
      title={label}
      aria-current={forceActive ? 'page' : undefined}
      activeOptions={exact ? { exact: true } : undefined}
      activeProps={{ className: 'active' }}
      className={`${forceActive ? 'active ' : ''}${NAV_ITEM_CLASS}`}
    >
      <span className="text-[22px] leading-none" aria-hidden="true">
        {icon}
      </span>
    </Link>
  </li>
);

const Navbar = () => {
  const { t } = useLocalization();
  const goalsEnabled = useGoalsEnabled();
  const pathname = useLocation({ select: (location) => location.pathname });
  // The loan details page (/expenses/loan/:id) belongs to the Loans tab.
  const onLoanDetails = /\/loan\/[^/]+/.test(pathname);
  // Net worth has no tab of its own; it is reached from Charts.
  const onNetWorth = /\/net-worth/.test(pathname);

  return (
    <nav
      aria-label={t('ux.mainNavigation')}
      className="fixed left-0 right-0 bottom-0 z-[9999] isolate touch-none backdrop-blur-[12px] bg-[var(--color-app-bg)] border-t border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0))] h-[calc(64px+env(safe-area-inset-bottom,0))] w-full max-w-[100vw] [-webkit-backface-visibility:hidden] [backface-visibility:hidden] min-[1024px]:max-w-[1100px] min-[1024px]:left-1/2 min-[1024px]:-translate-x-1/2 min-[1024px]:right-auto"
    >
      <ul className="m-0 list-none p-0 h-full flex items-center justify-around gap-1">
        <NavItem
          to="/expenses"
          label={t('nav.home')}
          icon={<FiHome />}
          exact
        />
        <NavItem
          to="/expenses/charts"
          label={t('nav.charts')}
          icon={<FiBarChart2 />}
          forceActive={onNetWorth}
        />
        <NavItem
          to="/expenses/income"
          label={t('nav.income')}
          icon={<FiDollarSign />}
        />
        <NavItem
          to="/expenses/loans"
          label={t('nav.loans')}
          icon={<FiCreditCard />}
          forceActive={onLoanDetails}
        />
        {goalsEnabled && (
          <NavItem
            to="/expenses/goals"
            label={t('nav.goals')}
            icon={<FiShield />}
          />
        )}
        <NavItem
          to="/expenses/assistant"
          label={t('nav.assistant')}
          icon={<FiZap />}
        />
        <NavItem
          to="/expenses/user"
          label={t('nav.profile')}
          icon={<FiUser />}
        />
      </ul>
    </nav>
  );
};

export default Navbar;
