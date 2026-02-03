import { Link } from '@tanstack/react-router';
import { useAuthState } from '@shared/context/context';
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
  const { userIsLoggedIn } = useAuthState();
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
      className={`navbar ${cssClass}`}
      // onTouchStart={(touchStartEvent) => handleTouchStart(touchStartEvent)}
      // onTouchMove={(touchMoveEvent) => handleTouchMove(touchMoveEvent)}
    >
      <ul>
        <li>
          <Link
            to="/expenses"
            title={t('nav.home')}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'active' }}
          >
            <FiHome />
          </Link>
        </li>
        <li>
          <Link
            to="/expenses/charts"
            title={t('nav.charts')}
            activeProps={{ className: 'active' }}
          >
            <FiBarChart2 />
          </Link>
        </li>
        {/*<li>*/}
        {/*  <NavLink to="/expenses/add-transaction" title={t('common.add')}>*/}
        {/*    <FaPlus />*/}
        {/*  </NavLink>*/}
        {/*</li>*/}
        <li>
          <Link
            to="/expenses/income"
            title={t('nav.income')}
            activeProps={{ className: 'active' }}
          >
            <FiDollarSign />
          </Link>
        </li>
        <li>
          <Link
            to="/expenses/loans"
            title={t('nav.loans')}
            activeProps={{ className: 'active' }}
          >
            <FiCreditCard />
          </Link>
        </li>
        {userIsLoggedIn ? (
          <li>
            <Link
              to="/expenses/user"
              title={t('nav.profile')}
              activeProps={{ className: 'active' }}
            >
              <FiUser />
            </Link>
          </li>
        ) : (
          ''
        )}
      </ul>
    </div>
  );
};

export default Navbar;
