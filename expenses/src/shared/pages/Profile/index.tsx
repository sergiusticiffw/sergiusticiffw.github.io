import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState } from '../../context';
import { useExpenseData } from '@stores/expenseStore';
import {
  useSettingsCurrency,
  setSettingsCurrency,
  useChartsBackground,
  setChartsBackground,
} from '@stores/settingsStore';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { logout } from '@shared/context/actions';
import { useNavigate } from '@tanstack/react-router';
import { FiUser, FiLogOut, FiSettings, FiBarChart2 } from 'react-icons/fi';
import { fetchRequest, API_BASE_URL } from '@shared/utils/utils';
import {
  notificationType,
  availableCharts,
  currencies,
} from '@shared/utils/constants';
import { googleLogout } from '@react-oauth/google';

const Profile = () => {
  const showNotification = useNotification();
  const { language, setLanguage, t } = useLocalization();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useExpenseData();
  const { userDetails, token } = useAuthState();
  const currency = useSettingsCurrency();
  const useChartsBackgroundColor = useChartsBackground();
  const [state, setState] = useState({
    visibleCharts:
      JSON.parse(localStorage.getItem('visibleCharts')) || availableCharts,
  });
  const navigate = useNavigate();

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newLanguage = event.target.value as 'en' | 'ro';
    setLanguage(newLanguage);
    showNotification(
      t('notification.profileUpdated'),
      notificationType.SUCCESS
    );
  };

  const handleLogout = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    googleLogout();
    logout(dispatch, dataDispatch);
    navigate({ to: '/expenses/login' });
  };

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const fetchOptions = {
      method: 'PATCH',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': 'Bearer ' + token,
      }),
      body: JSON.stringify({ field_currency: [event.target.value] }),
    };
    const url = `${API_BASE_URL}/user/${userDetails.current_user.uid}?_format=json`;
    fetchRequest(
      url,
      fetchOptions,
      dataDispatch,
      dispatch,
      (data: { uid?: number; field_currency?: { value: string }[] }) => {
        if (data.uid && data.field_currency?.[0]) {
          const newCurrency = data.field_currency[0].value;
          userDetails.current_user.currency = newCurrency;
          localStorage.setItem('currentUser', JSON.stringify(userDetails));
          setSettingsCurrency(newCurrency);
          dispatch({
            type: 'UPDATE_USER',
            payload: { currency: newCurrency },
          });
          setBlink(true);
          setTimeout(() => setBlink(false), 2000);
        } else {
          showNotification(t('error.unknown'), notificationType.ERROR);
        }
      }
    );
  };

  const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const name = event.target.name;
    event.preventDefault();
    localStorage.setItem(name, JSON.stringify(value));
    dispatch && dispatch({ type: 'UPDATE_USER', payload: { [name]: value } });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const name = event.target.name;
    event.preventDefault();
    setState({
      ...state,
      [name]: value,
    });
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    if (name === 'useChartsBackgroundColor') {
      setChartsBackground(checked);
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: name, value: checked },
        })
      );
    } else {
      setState({ ...state, [name]: checked });
      localStorage.setItem(name, JSON.stringify(checked));
    }
    dispatch({ type: 'UPDATE_USER', payload: { [name]: checked } });
  };

  const sortedCurrencies = Object.entries(currencies).sort((a, b) => {
    return a[1] < b[1] ? -1 : 1;
  });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    localStorage.setItem('visibleCharts', JSON.stringify(state.visibleCharts));
  }, [state.visibleCharts]);

  const handleChartVisibilityChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    setState((prevState) => {
      let updatedCharts;
      if (checked) {
        updatedCharts = [...prevState.visibleCharts, name]; // Append at the end
      } else {
        updatedCharts = prevState.visibleCharts.filter(
          (chart) => chart !== name
        ); // Remove but keep order
      }
      return { ...prevState, visibleCharts: updatedCharts };
    });
  };

  return (
    <div className="bg-[#1a1a1a] p-4 pb-[calc(80px+env(safe-area-inset-bottom,0))] max-w-full overflow-x-hidden overflow-y-auto -webkit-overflow-scrolling-touch box-border flex flex-col items-center min-h-dvh w-full [&_*]:box-border md:p-[0.875rem] md:pb-[calc(80px+env(safe-area-inset-bottom,0))]">
      {/* Header */}
      <div className="text-left mb-6 w-full max-w-[600px] md:mb-5">
        <h1 className="text-2xl md:text-xl font-semibold text-white m-0 tracking-tight">
          {t('profile.title')}
        </h1>
      </div>

      {/* Settings Sections */}
      <div className="flex flex-col gap-4 w-full max-w-[600px] md:gap-3.5">
        {/* Account Section */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[#5b8def]">
            <FiUser />
            <h3 className="text-base md:text-sm font-semibold text-white m-0 tracking-tight">
              {t('profile.account')}
            </h3>
          </div>
          <div className="flex items-center gap-3 py-3 md:py-2.5">
            <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] shrink-0" />
            <div className="text-[0.9rem] md:text-sm text-white/90 font-medium tracking-tight">
              {userDetails.current_user.name}
            </div>
          </div>
        </div>

        {/* Language & Currency Settings */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[#5b8def]">
            <FiSettings />
            <h3 className="text-base md:text-sm font-semibold text-white m-0 tracking-tight">
              {t('profile.personalInfo')}
            </h3>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="language" className="block text-xs text-white/50 mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.language')}
            </label>
            <select
              id="language"
              value={language}
              name="language"
              onChange={handleLanguageChange}
              className="w-full py-3 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[rgba(91,141,239,0.5)] focus:bg-[rgba(91,141,239,0.05)] [&_option]:bg-[#1a1a1a] [&_option]:text-white [&_option]:p-2"
            >
              <option value="en">{t('profile.english')}</option>
              <option value="ro">{t('profile.romanian')}</option>
            </select>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="currency" className="block text-xs text-white/50 mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.currency')}
            </label>
            <select
              id="currency"
              value={currency}
              name="currency"
              onChange={handleChange}
              className="w-full py-3 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[rgba(91,141,239,0.5)] focus:bg-[rgba(91,141,239,0.05)] [&_option]:bg-[#1a1a1a] [&_option]:text-white [&_option]:p-2"
            >
              {sortedCurrencies.map(([id, currency]) => (
                <option key={id} value={id}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Charts Settings */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[#5b8def]">
            <FiBarChart2 />
            <h3 className="text-base md:text-sm font-semibold text-white m-0 tracking-tight">
              {t('profile.chartsSettings')}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 mb-2 py-2 md:py-1.5 relative [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:min-w-[18px] [&_input]:min-h-[18px] [&_input]:accent-[#5b8def] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:inline-block [&_input]:opacity-100 [&_input]:visible [&_label]:text-sm md:[&_label]:text-xs [&_label]:text-white/75 [&_label]:cursor-pointer [&_label]:flex-1 [&_label]:select-none [&_label]:m-0">
            <input
              type="checkbox"
              name="useChartsBackgroundColor"
              id="useChartsBackgroundColor"
              checked={useChartsBackgroundColor}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="useChartsBackgroundColor">
              {t('profile.useChartsBackgroundColor')}
            </label>
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.05] md:mt-4 md:pt-4">
            <h4 className="text-xs font-semibold text-white/50 m-0 mb-3 md:mb-2.5 uppercase tracking-wider">
              {t('profile.chartsVisibility')}
            </h4>
            <div className="grid grid-cols-1 gap-0">
              {availableCharts.map((chart) => (
                <div key={chart} className="flex items-center gap-2.5 mb-2 py-2 md:py-1.5 last:mb-0 [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:min-w-[18px] [&_input]:min-h-[18px] [&_input]:accent-[#5b8def] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:inline-block [&_label]:text-sm md:[&_label]:text-xs [&_label]:text-white/75 [&_label]:cursor-pointer [&_label]:flex-1 [&_label]:select-none [&_label]:m-0">
                  <input
                    type="checkbox"
                    id={chart}
                    name={chart}
                    checked={state.visibleCharts.includes(chart)}
                    onChange={handleChartVisibilityChange}
                  />
                  <label htmlFor={chart}>{chart}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          className="flex items-center justify-center gap-2.5 w-full py-3.5 px-5 md:py-3 md:px-4 bg-transparent border border-red-500/30 rounded-xl text-red-400 text-sm md:text-[0.875rem] font-medium cursor-pointer transition-all active:bg-red-500/5 active:border-red-500/50 [&_svg]:text-lg md:[&_svg]:text-base"
          onClick={handleLogout}
        >
          <FiLogOut />
          {t('profile.signOut')}
        </button>
      </div>
    </div>
  );
};

export default Profile;
