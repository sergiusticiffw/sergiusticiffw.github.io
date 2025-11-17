import { NavLink } from 'react-router-dom';
import { useAuthState } from '@context/context';
import { useLocalization } from '@context/localization';
import {
  FiHome,
  FiBarChart2,
  FiDollarSign,
  FiCreditCard,
  FiUser,
} from 'react-icons/fi';
import React, { useState } from 'react';
import { AuthState } from '@type/types';

const Navbar = () => {
  const { userIsLoggedIn } = useAuthState() as AuthState;
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
          <NavLink to="/expenses/" end title={t('nav.home')}>
            <FiHome />
          </NavLink>
        </li>
        <li>
          <NavLink to="/expenses/charts" title={t('nav.charts')}>
            <FiBarChart2 />
          </NavLink>
        </li>
        {/*<li>*/}
        {/*  <NavLink to="/expenses/add-transaction" title={t('common.add')}>*/}
        {/*    <FaPlus />*/}
        {/*  </NavLink>*/}
        {/*</li>*/}
        <li>
          <NavLink to="/expenses/income" title={t('nav.income')}>
            <FiDollarSign />
          </NavLink>
        </li>
        <li>
          <NavLink to="/expenses/loans" title={t('nav.loans')}>
            <FiCreditCard />
          </NavLink>
        </li>
        {userIsLoggedIn ? (
          <li>
            <NavLink to="/expenses/user" title={t('nav.profile')}>
              <FiUser />
            </NavLink>
          </li>
        ) : (
          ''
        )}
      </ul>
    </div>
  );
};

export default Navbar;
