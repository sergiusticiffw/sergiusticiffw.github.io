import { Link } from '@tanstack/react-router';
import { useLocalization } from '@shared/context/localization';
import {
  FiHome,
  FiBarChart2,
  FiDollarSign,
  FiCreditCard,
  FiUser,
} from 'react-icons/fi';
import React, { useState } from 'react';

const Navbar = () => {
  const { t } = useLocalization();
  const [cssClass, setCssClass] = useState('closed');
  // const [xDown, setXDown] = useState<number | null>(null);
  // const [yDown, setYDown] = useState<number | null>(null);

  // const handleTouchStart = (event: React.TouchEvent) => {
  //   const firstTouch = event.touches[0];
  //   setXDown(firstTouch.clientX);
  //   setYDown(firstTouch.clientY);
  // };

  // const handleTouchMove = (event: React.TouchEvent) => {
  //   if (!xDown || !yDown) {
  //     return;
  //   }
  //   const xUp = event.touches[0].clientX;
  //   const yUp = event.touches[0].clientY;
  //   const xDiff = xDown - xUp;
  //   const yDiff = yDown - yUp;
  //   if (Math.abs(xDiff) < Math.abs(yDiff)) {
  //     if (yDiff > 0) {
  //       setCssClass('open');
  //     } else {
  //       setCssClass('closed');
  //     }
  //   }
  //   /* reset values */
  //   setXDown(null);
  //   setYDown(null);
  // };

  return (
    <div
      className={`fixed left-0 right-0 bottom-0 z-[9999] touch-none backdrop-blur-[12px] bg-[var(--color-app-bg)] border-t border-white/[0.08] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0))] h-[calc(64px+env(safe-area-inset-bottom,0))] w-full max-w-[100vw] transform-none ${cssClass}`}
    >
      <ul className="m-0 list-none p-0 h-full flex items-center justify-around gap-2">
        <li className="h-full flex-1 flex items-center justify-center">
          <Link
            to="/expenses"
            title={t('nav.home')}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'active' }}
            className="text-app-muted text-[28px] h-full w-full flex items-center justify-center transition-all duration-200 hover:text-app-secondary hover:[&_svg]:scale-110 [&.active]:text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5] [&.active_svg]:[filter:drop-shadow(0_2px_8px_var(--color-app-accent-shadow))]"
          >
            <FiHome />
          </Link>
        </li>
        <li className="h-full flex-1 flex items-center justify-center">
          <Link
            to="/expenses/charts"
            title={t('nav.charts')}
            activeProps={{ className: 'active' }}
            className="text-app-muted text-[28px] h-full w-full flex items-center justify-center transition-all duration-200 hover:text-app-secondary hover:[&_svg]:scale-110 [&.active]:text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5] [&.active_svg]:[filter:drop-shadow(0_2px_8px_var(--color-app-accent-shadow))]"
          >
            <FiBarChart2 />
          </Link>
        </li>
        <li className="h-full flex-1 flex items-center justify-center">
          <Link
            to="/expenses/income"
            title={t('nav.income')}
            activeProps={{ className: 'active' }}
            className="text-app-muted text-[28px] h-full w-full flex items-center justify-center transition-all duration-200 hover:text-app-secondary hover:[&_svg]:scale-110 [&.active]:text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5] [&.active_svg]:[filter:drop-shadow(0_2px_8px_var(--color-app-accent-shadow))]"
          >
            <FiDollarSign />
          </Link>
        </li>
        <li className="h-full flex-1 flex items-center justify-center">
          <Link
            to="/expenses/loans"
            title={t('nav.loans')}
            activeProps={{ className: 'active' }}
            className="text-app-muted text-[28px] h-full w-full flex items-center justify-center transition-all duration-200 hover:text-app-secondary hover:[&_svg]:scale-110 [&.active]:text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5] [&.active_svg]:[filter:drop-shadow(0_2px_8px_var(--color-app-accent-shadow))]"
          >
            <FiCreditCard />
          </Link>
        </li>
        <li className="h-full flex-1 flex items-center justify-center">
          <Link
            to="/expenses/user"
            title={t('nav.profile')}
            activeProps={{ className: 'active' }}
            className="text-app-muted text-[28px] h-full w-full flex items-center justify-center transition-all duration-200 hover:text-app-secondary hover:[&_svg]:scale-110 [&.active]:text-[var(--color-app-accent)] [&.active_svg]:[stroke-width:2.5] [&.active_svg]:[filter:drop-shadow(0_2px_8px_var(--color-app-accent-shadow))]"
          >
            <FiUser />
          </Link>
        </li>
      </ul>
    </div>
  );
};

export default Navbar;
