import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState, useData } from '../../context';
import { useNotification } from '@context/notification';
import { useHighchartsContext } from '@context/highcharts';
import { logout } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import {
  FaUserCircle,
  FaSignOutAlt,
  FaCog,
  FaChartBar,
  FaPalette,
  FaCoins,
} from 'react-icons/fa';
import { fetchRequest } from '@utils/utils';
import {
  notificationType,
  themeList,
  availableCharts,
  currencies,
} from '@utils/constants';
import { AuthState } from '@type/types';
import { googleLogout } from '@react-oauth/google';
import './Profile.scss';

const Profile: React.FC = () => {
  const showNotification = useNotification();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useData();
  const {
    userDetails,
    token,
    currency,
    weeklyBudget,
    monthlyBudget,
    useChartsBackgroundColor,
  } = useAuthState() as AuthState;
  let { theme } = useAuthState() as AuthState;
  const [state, setState] = useState({
    weeklyBudget: weeklyBudget,
    monthlyBudget: monthlyBudget,
    useChartsBackgroundColor: useChartsBackgroundColor,
    visibleCharts:
      JSON.parse(localStorage.getItem('visibleCharts') || '[]') || availableCharts,
  });
  theme = themeList[theme as keyof typeof themeList]
    ? theme
    : 'blue-pink-gradient';
  const navigate = useNavigate();
  
  const handleLogout = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    googleLogout();
    logout(dispatch, dataDispatch);
    navigate('/expenses/login'); //navigate to logout page on logout
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
    const url = `https://dev-expenses-api.pantheonsite.io/user/${userDetails.current_user.uid}?_format=json`;
    fetchRequest(url, fetchOptions, dataDispatch, dispatch, (data: any) => {
      if (data.uid) {
        userDetails.current_user.currency = data.field_currency[0].value;
        localStorage.setItem('currentUser', JSON.stringify(userDetails));
        dispatch &&
          dispatch({
            type: 'UPDATE_USER',
            payload: { currency: data.field_currency[0].value },
          });
        setBlink(true);
        setTimeout(() => setBlink(false), 2000);
      } else {
        showNotification(
          'Something went wrong, please contact Constantin :)',
          notificationType.ERROR
        );
      }
    });
  };

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    localStorage.setItem('theme', JSON.stringify(event.target.value));
    dispatch &&
      dispatch({
        type: 'UPDATE_USER',
        payload: { theme: event.target.value },
      });
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

  const { setUseChartsBackgroundColor } = useHighchartsContext();

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setState({
      ...state,
      [name]: checked,
    });

    // Handle Highcharts background color setting
    if (name === 'useChartsBackgroundColor') {
      setUseChartsBackgroundColor(checked);
      // Dispatch custom event for immediate update
      window.dispatchEvent(
        new CustomEvent('localStorageChange', {
          detail: { key: name, value: checked },
        })
      );
    } else {
      // Persist to localStorage for other settings
      localStorage.setItem(name, JSON.stringify(checked));
    }

    dispatch &&
      dispatch({
        type: 'UPDATE_USER',
        payload: { [name]: checked },
      });
  };

  const sortedCurrencies = Object.entries(currencies).sort((a, b) => {
    return a[1] < b[1] ? -1 : 1;
  });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    localStorage.setItem('visibleCharts', JSON.stringify(state.visibleCharts));
  }, [state.visibleCharts]);

  const handleChartVisibilityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      {/* Profile Header */}
      <div className="profile-header">
        <div className="avatar">
          <FaUserCircle />
        </div>
        <div className="user-name">{userDetails.current_user.name}</div>
        <div className="user-subtitle">Profile Settings</div>
      </div>

      {/* Settings Grid */}
      <div className="settings-grid">
        {/* General Settings Card */}
        <div className="settings-card">
          <div className="card-header">
            <FaCog />
            <h3>General Settings</h3>
          </div>

          <div className="form-field">
            <label htmlFor="currency">Currency</label>
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

          <div className="form-field">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={theme}
              name="theme"
              onChange={handleThemeChange}
            >
              {Object.entries(themeList).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Budget Settings Card */}
        <div className="settings-card">
          <div className="card-header">
            <FaCoins />
            <h3>Budget Settings</h3>
          </div>

          <div className="form-field">
            <label htmlFor="weeklyBudget">Weekly Budget</label>
            <input
              id="weeklyBudget"
              required
              placeholder="Enter weekly budget"
              type="number"
              name="weeklyBudget"
              value={state.weeklyBudget || ''}
              onChange={handleInputChange}
              onBlur={onBlur}
            />
          </div>

          <div className="form-field">
            <label htmlFor="monthlyBudget">Monthly Budget</label>
            <input
              id="monthlyBudget"
              required
              placeholder="Enter monthly budget"
              type="number"
              name="monthlyBudget"
              value={state.monthlyBudget || ''}
              onChange={handleInputChange}
              onBlur={onBlur}
            />
          </div>
        </div>
      </div>

      {/* Charts Settings Section */}
      <div className="charts-section-profile">
        <div className="section-header">
          <FaChartBar />
          <h3>Charts Settings</h3>
        </div>

        <div className="checkbox-item">
          <input
            type="checkbox"
            name="useChartsBackgroundColor"
            id="useChartsBackgroundColor"
            checked={state.useChartsBackgroundColor || false}
            onChange={handleCheckboxChange}
          />
          <label htmlFor="useChartsBackgroundColor">
            Use Charts Background Color
          </label>
        </div>

        <h4>Charts Visibility</h4>
        <div className="charts-grid">
          {availableCharts.map((chart) => (
            <div key={chart} className="checkbox-item">
              <input
                type="checkbox"
                name={chart}
                checked={state.visibleCharts.includes(chart)}
                onChange={handleChartVisibilityChange}
              />
              <label htmlFor={chart}>{chart}</label>
            </div>
          ))}
        </div>
      </div>

      {/* Logout Section */}
      <div className="logout-section">
        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
