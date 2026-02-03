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
import './Profile.scss';

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
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        <h1>{t('profile.title')}</h1>
      </div>

      {/* Settings Sections */}
      <div className="profile-sections">
        {/* Account Section */}
        <div className="profile-section">
          <div className="section-header">
            <FiUser />
            <h3>{t('profile.account')}</h3>
          </div>
          <div className="user-info">
            <div className="user-name">{userDetails.current_user.name}</div>
          </div>
        </div>

        {/* Language & Currency Settings */}
        <div className="profile-section">
          <div className="section-header">
            <FiSettings />
            <h3>{t('profile.personalInfo')}</h3>
          </div>

          <div className="form-field">
            <label htmlFor="language">{t('profile.language')}</label>
            <select
              id="language"
              value={language}
              name="language"
              onChange={handleLanguageChange}
            >
              <option value="en">{t('profile.english')}</option>
              <option value="ro">{t('profile.romanian')}</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="currency">{t('profile.currency')}</label>
            <select
              id="currency"
              value={currency}
              name="currency"
              onChange={handleChange}
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
        <div className="profile-section">
          <div className="section-header">
            <FiBarChart2 />
            <h3>{t('profile.chartsSettings')}</h3>
          </div>

          <div className="checkbox-item">
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

          <div className="charts-visibility">
            <h4>{t('profile.chartsVisibility')}</h4>
            <div className="charts-grid">
              {availableCharts.map((chart) => (
                <div key={chart} className="checkbox-item">
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
        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut />
          {t('profile.signOut')}
        </button>
      </div>
    </div>
  );
};

export default Profile;
