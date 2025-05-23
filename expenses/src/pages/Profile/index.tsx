import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState, useData } from '../../context';
import { useNotification } from '@context/notification';
import { logout } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import { FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import { fetchRequest } from '@utils/utils';
import {
  notificationType,
  themeList,
  availableCharts,
  currencies,
} from '@utils/constants';
import { AuthState } from '@type/types';
import { googleLogout } from '@react-oauth/google';

const Profile = () => {
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
      JSON.parse(localStorage.getItem('visibleCharts')) || availableCharts,
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

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setState({
      ...state,
      [name]: checked,
    });
    // Persist to localStorage
    localStorage.setItem(name, JSON.stringify(checked));
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

  const handleChartVisibilityChange = (event) => {
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
    <div className="user-page">
      <div className={blink ? 'user-avatar saved' : 'user-avatar'}>
        <FaUserCircle />
      </div>
      <h3>{userDetails.current_user.name}</h3>
      <div className="user-settings">
        <select
          value={currency}
          className="currency"
          name="currency"
          onChange={handleChange}
        >
          {sortedCurrencies.map(([id, currency]) => (
            <option key={id} value={id}>
              {currency}
            </option>
          ))}
        </select>
        <select
          value={theme}
          className="theme"
          name="theme"
          onChange={handleThemeChange}
        >
          {Object.entries(themeList).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Week Budget"
          type="number"
          name="weeklyBudget"
          value={state.weeklyBudget}
          onChange={handleInputChange}
          onBlur={onBlur}
        />
        <input
          required
          placeholder="Month Budget"
          type="number"
          name="monthlyBudget"
          value={state.monthlyBudget}
          onChange={handleInputChange}
          onBlur={onBlur}
        />
        <label htmlFor="useChartsBackgroundColor">
          Use Charts Background Color
          <input
            type="checkbox"
            name="useChartsBackgroundColor"
            id="useChartsBackgroundColor"
            checked={state.useChartsBackgroundColor}
            onChange={handleCheckboxChange}
          />
        </label>
        <h4>Charts Visibility</h4>
        {availableCharts.map((chart) => (
          <label key={chart}>
            <input
              type="checkbox"
              name={chart}
              checked={state.visibleCharts.includes(chart)}
              onChange={handleChartVisibilityChange}
            />
            {chart}
          </label>
        ))}
        <button className="button logout" onClick={handleLogout}>
          <FaSignOutAlt />
        </button>
      </div>
    </div>
  );
};

export default Profile;
