import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState } from '../../context';
import { useExpenseData } from '@stores/expenseStore';
import {
  useSettingsCurrency,
  setSettingsCurrency,
  useSettingsTheme,
  setSettingsTheme,
  useChartsBackground,
  setChartsBackground,
  useQuickAddSuggestion,
  setQuickAddSuggestion,
} from '@stores/settingsStore';
import { APP_THEMES } from '@shared/constants/themes';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { logout } from '@shared/context/actions';
import { useNavigate } from '@tanstack/react-router';
import { FiUser, FiLogOut, FiSettings, FiBarChart2, FiDroplet, FiZap, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { fetchRequest, API_BASE_URL } from '@shared/utils/utils';
import {
  notificationType,
  availableCharts,
  currencies,
  getCategories,
} from '@shared/utils/constants';
import { PAGE_CONTAINER_CLASS } from '@shared/utils/layoutClasses';
import { googleLogout } from '@react-oauth/google';

const Profile = () => {
  const showNotification = useNotification();
  const { language, setLanguage, t } = useLocalization();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useExpenseData();
  const { userDetails, token } = useAuthState();
  const currency = useSettingsCurrency();
  const currentTheme = useSettingsTheme();
  const useChartsBackgroundColor = useChartsBackground();
  const quickAdd = useQuickAddSuggestion();
  const localizedCategories = getCategories();
  const [state, setState] = useState({
    visibleCharts:
      JSON.parse(localStorage.getItem('visibleCharts')) || availableCharts,
  });
  const [quickAddAccordionOpen, setQuickAddAccordionOpen] = useState(false);
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
    } else if (name === 'quickAddSuggestionEnabled') {
      setQuickAddSuggestion({ ...quickAdd, enabled: checked });
      showNotification(
        t('notification.profileUpdated'),
        notificationType.SUCCESS
      );
    } else {
      setState({ ...state, [name]: checked });
      localStorage.setItem(name, JSON.stringify(checked));
    }
    dispatch({ type: 'UPDATE_USER', payload: { [name]: checked } });
  };

  const handleQuickAddChange = (
    field: 'amount' | 'category' | 'description',
    value: string
  ) => {
    setQuickAddSuggestion({ ...quickAdd, [field]: value });
  };

  const daysOfWeek = quickAdd.daysOfWeek ?? [];
  const timeSlots = quickAdd.timeSlots ?? [];

  const handleQuickAddDayToggle = (day: number, checked: boolean) => {
    const next = checked
      ? [...daysOfWeek, day].sort((a, b) => a - b)
      : daysOfWeek.filter((d) => d !== day);
    setQuickAddSuggestion({ ...quickAdd, daysOfWeek: next });
  };

  const handleQuickAddTimeSlotChange = (
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    const next = timeSlots.map((slot, i) =>
      i === index ? { ...slot, [field]: value } : slot
    );
    setQuickAddSuggestion({ ...quickAdd, timeSlots: next });
  };

  const handleQuickAddAddSlot = () => {
    setQuickAddSuggestion({
      ...quickAdd,
      timeSlots: [...timeSlots, { start: '08:00', end: '09:00' }],
    });
  };

  const handleQuickAddRemoveSlot = (index: number) => {
    setQuickAddSuggestion({
      ...quickAdd,
      timeSlots: timeSlots.filter((_, i) => i !== index),
    });
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
    <div className={`${PAGE_CONTAINER_CLASS} flex flex-col items-center pt-5 md:pt-4`}>
      {/* Header */}
      <div className="text-left mb-6 w-full max-w-[600px] md:mb-5">
        <h1 className="text-2xl md:text-xl font-semibold text-app-primary m-0 tracking-tight">
          {t('profile.title')}
        </h1>
      </div>

      {/* Settings Sections */}
      <div className="flex flex-col gap-4 w-full max-w-[600px] md:gap-3.5">
        {/* Account Section */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiUser />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.account')}
            </h3>
          </div>
          <div className="flex items-center gap-3 py-3 md:py-2.5">
            <div className="w-10 h-10 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] shrink-0" />
            <div className="text-[0.9rem] md:text-sm text-app-secondary font-medium tracking-tight">
              {userDetails.current_user.name}
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiDroplet />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.theme')}
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-2">
            {APP_THEMES.map((theme) => {
              const isActive = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSettingsTheme(theme.id);
                    window.dispatchEvent(
                      new CustomEvent('localStorageChange', {
                        detail: { key: 'theme', value: theme.id },
                      })
                    );
                    showNotification(
                      t('notification.profileUpdated'),
                      notificationType.SUCCESS
                    );
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                    isActive
                      ? 'border-[var(--color-app-accent)] bg-[var(--color-app-accent)]/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{
                      background: theme.bg,
                      boxShadow: `inset 0 0 0 2px ${theme.accent}`,
                    }}
                  />
                  <span className="text-xs font-medium text-app-secondary truncate w-full text-center">
                    {t(theme.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language & Currency Settings */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl py-5 px-5 md:py-4 md:px-4 md:rounded-[10px] transition-colors active:border-white/10">
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiSettings />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.personalInfo')}
            </h3>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="language" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.language')}
            </label>
            <select
              id="language"
              value={language}
              name="language"
              onChange={handleLanguageChange}
              className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary [&_option]:p-2"
            >
              <option value="en">{t('profile.english')}</option>
              <option value="ro">{t('profile.romanian')}</option>
            </select>
          </div>

          <div className="mb-4 last:mb-0 md:mb-3.5">
            <label htmlFor="currency" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
              {t('profile.currency')}
            </label>
            <select
              id="currency"
              value={currency}
              name="currency"
              onChange={handleChange}
              className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary [&_option]:p-2"
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
          <div className="flex items-center gap-2.5 mb-4 md:mb-3.5 [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:text-[var(--color-app-accent)]">
            <FiBarChart2 />
            <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
              {t('profile.chartsSettings')}
            </h3>
          </div>

          <div className="flex items-center gap-2.5 mb-2 py-2 md:py-1.5 relative [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:min-w-[18px] [&_input]:min-h-[18px] [&_input]:accent-[var(--color-app-accent)] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:inline-block [&_input]:opacity-100 [&_input]:visible [&_label]:text-sm md:[&_label]:text-xs [&_label]:text-app-secondary [&_label]:cursor-pointer [&_label]:flex-1 [&_label]:select-none [&_label]:m-0">
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
            <h4 className="text-xs font-semibold text-app-muted m-0 mb-3 md:mb-2.5 uppercase tracking-wider">
              {t('profile.chartsVisibility')}
            </h4>
            <div className="grid grid-cols-1 gap-0">
              {availableCharts.map((chart) => (
                <div key={chart} className="flex items-center gap-2.5 mb-2 py-2 md:py-1.5 last:mb-0 [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:min-w-[18px] [&_input]:min-h-[18px] [&_input]:accent-[var(--color-app-accent)] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:inline-block [&_label]:text-sm md:[&_label]:text-xs [&_label]:text-app-secondary [&_label]:cursor-pointer [&_label]:flex-1 [&_label]:select-none [&_label]:m-0">
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

        {/* Quick Add Suggestion (accordion, closed by default) */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden md:rounded-[10px] transition-colors active:border-white/10">
          <button
            type="button"
            onClick={() => setQuickAddAccordionOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2.5 py-5 px-5 md:py-4 md:px-4 text-left bg-transparent border-none cursor-pointer [&_svg]:text-lg md:[&_svg]:text-base [&_svg]:shrink-0"
            aria-expanded={quickAddAccordionOpen}
          >
            <div className="flex items-center gap-2.5 [&_svg]:text-[var(--color-app-accent)]">
              <FiZap />
              <h3 className="text-base md:text-sm font-semibold text-app-primary m-0 tracking-tight">
                {t('profile.quickAddSuggestion')}
              </h3>
            </div>
            {quickAddAccordionOpen ? (
              <FiChevronUp className="text-app-muted" aria-hidden />
            ) : (
              <FiChevronDown className="text-app-muted" aria-hidden />
            )}
          </button>
          {quickAddAccordionOpen && (
            <div className="px-5 pb-5 pt-0 md:px-4 md:pb-4 border-t border-white/[0.06]">
          <p className="text-xs text-app-muted mb-4 md:mb-3.5">
            {t('profile.quickAddSuggestionDesc')}
          </p>
          <div className="flex items-center gap-2.5 mb-4 py-2 md:py-1.5 relative [&_input]:w-[18px] [&_input]:h-[18px] [&_input]:min-w-[18px] [&_input]:min-h-[18px] [&_input]:accent-[var(--color-app-accent)] [&_input]:cursor-pointer [&_input]:shrink-0 [&_input]:inline-block [&_input]:opacity-100 [&_input]:visible [&_label]:text-sm md:[&_label]:text-xs [&_label]:text-app-secondary [&_label]:cursor-pointer [&_label]:flex-1 [&_label]:select-none [&_label]:m-0">
            <input
              type="checkbox"
              name="quickAddSuggestionEnabled"
              id="quickAddSuggestionEnabled"
              checked={quickAdd.enabled}
              onChange={handleCheckboxChange}
            />
            <label htmlFor="quickAddSuggestionEnabled">
              {t('profile.quickAddSuggestionEnabled')}
            </label>
          </div>
          {quickAdd.enabled && (
            <div className="space-y-4 pt-2 border-t border-white/[0.05]">
              <div>
                <label htmlFor="quickAddAmount" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.quickAddAmount')}
                </label>
                <input
                  id="quickAddAmount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={quickAdd.amount}
                  onChange={(e) => handleQuickAddChange('amount', e.target.value)}
                  placeholder="0"
                  className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5"
                />
              </div>
              <div>
                <label htmlFor="quickAddCategory" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.quickAddCategory')}
                </label>
                <select
                  id="quickAddCategory"
                  value={quickAdd.category}
                  onChange={(e) => handleQuickAddChange('category', e.target.value)}
                  className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5 [&_option]:bg-[var(--color-app-bg)] [&_option]:text-app-primary [&_option]:p-2"
                >
                  <option value="">{t('form.selectCategory')}</option>
                  {localizedCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="quickAddDescription" className="block text-xs text-app-muted mb-2 md:mb-1.5 font-medium uppercase tracking-wider">
                  {t('profile.quickAddDescription')}
                </label>
                <input
                  id="quickAddDescription"
                  type="text"
                  value={quickAdd.description}
                  onChange={(e) => handleQuickAddChange('description', e.target.value)}
                  placeholder={t('transactionForm.description')}
                  className="w-full py-3 px-4 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm md:text-[0.875rem] font-normal transition-all outline-none focus:border-[var(--color-app-accent)]/50 focus:bg-[var(--color-app-accent)]/5"
                />
              </div>

              <div className="pt-2 border-t border-white/[0.05]">
                <h4 className="text-xs font-semibold text-app-muted m-0 mb-2 uppercase tracking-wider">
                  {t('profile.quickAddDaysOfWeek')}
                </h4>
                <p className="text-xs text-app-muted mb-3">
                  {t('profile.quickAddDaysHint')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg border border-app-subtle cursor-pointer hover:border-[var(--color-app-accent)]/30 [&_input]:accent-[var(--color-app-accent)]"
                    >
                      <input
                        type="checkbox"
                        checked={daysOfWeek.includes(day)}
                        onChange={(e) => handleQuickAddDayToggle(day, e.target.checked)}
                      />
                      <span className="text-sm text-app-secondary">
                        {t(`profile.quickAddDay${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.05]">
                <h4 className="text-xs font-semibold text-app-muted m-0 mb-2 uppercase tracking-wider">
                  {t('profile.quickAddTimeSlots')}
                </h4>
                <p className="text-xs text-app-muted mb-3">
                  {t('profile.quickAddTimeSlotsHint')}
                </p>
                <div className="space-y-3">
                  {timeSlots.map((slot, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => handleQuickAddTimeSlotChange(index, 'start', e.target.value)}
                        className="py-2.5 px-3 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm outline-none focus:border-[var(--color-app-accent)]/50"
                      />
                      <span className="text-app-muted text-sm">–</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => handleQuickAddTimeSlotChange(index, 'end', e.target.value)}
                        className="py-2.5 px-3 bg-app-surface border border-app-subtle rounded-lg text-app-primary text-sm outline-none focus:border-[var(--color-app-accent)]/50"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAddRemoveSlot(index)}
                        className="py-2 px-3 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        {t('profile.quickAddRemoveSlot')}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleQuickAddAddSlot}
                    className="py-2.5 px-4 text-sm font-medium text-[var(--color-app-accent)] border border-[var(--color-app-accent)]/40 rounded-lg hover:bg-[var(--color-app-accent)]/10 transition-colors"
                  >
                    {t('profile.quickAddAddSlot')}
                  </button>
                </div>
              </div>
            </div>
          )}
            </div>
          )}
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
