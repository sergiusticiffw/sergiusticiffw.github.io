import React, { useState, useEffect } from 'react';
import { useAuthDispatch, useAuthState, useData } from '../../context';
import { useNotification } from '@context/notification';
import { useHighchartsContext } from '@context/highcharts';
import { logout } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Settings,
  BarChart3,
  Palette,
  Coins,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { fetchRequest } from '@utils/utils';
import {
  notificationType,
  themeList,
  availableCharts,
  currencies,
} from '@utils/constants';
import { AuthState } from '@type/types';
import { googleLogout } from '@react-oauth/google';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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

  const handleChange = (value: string) => {
    const fetchOptions = {
      method: 'PATCH',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'JWT-Authorization': 'Bearer ' + token,
      }),
      body: JSON.stringify({ field_currency: [value] }),
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

  const handleThemeChange = (value: string) => {
    localStorage.setItem('theme', JSON.stringify(value));
    dispatch &&
      dispatch({
        type: 'UPDATE_USER',
        payload: { theme: value },
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
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Profile Header */}
      <Card className="border-border/50 shadow-lg bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg shadow-primary/25 border-4 border-background">
              <User className="w-12 h-12 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {userDetails.current_user.name}
              </h1>
              <p className="text-muted-foreground mt-1">Profile Settings</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency" className="text-sm font-medium text-muted-foreground">
                Currency
              </Label>
              <Select value={currency} onValueChange={handleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {sortedCurrencies.map(([id, currencyName]) => (
                    <SelectItem key={id} value={id}>
                      {currencyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme" className="text-sm font-medium text-muted-foreground">
                Theme
              </Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(themeList).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Budget Settings Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Budget Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="weeklyBudget" className="text-sm font-medium text-muted-foreground">
                Weekly Budget
              </Label>
              <Input
                id="weeklyBudget"
                placeholder="Enter weekly budget"
                type="number"
                name="weeklyBudget"
                value={state.weeklyBudget || ''}
                onChange={handleInputChange}
                onBlur={onBlur}
                className="border-border/50 focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyBudget" className="text-sm font-medium text-muted-foreground">
                Monthly Budget
              </Label>
              <Input
                id="monthlyBudget"
                placeholder="Enter monthly budget"
                type="number"
                name="monthlyBudget"
                value={state.monthlyBudget || ''}
                onChange={handleInputChange}
                onBlur={onBlur}
                className="border-border/50 focus:border-primary"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Settings Section */}
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Charts Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="useChartsBackgroundColor"
              id="useChartsBackgroundColor"
              checked={state.useChartsBackgroundColor || false}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
            />
            <Label htmlFor="useChartsBackgroundColor" className="text-sm text-muted-foreground">
              Use Charts Background Color
            </Label>
          </div>

          <div className="border-t border-border/50 my-4" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Charts Visibility</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableCharts.map((chart) => (
                <div key={chart} className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <input
                    type="checkbox"
                    name={chart}
                    id={chart}
                    checked={state.visibleCharts.includes(chart)}
                    onChange={handleChartVisibilityChange}
                    className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
                  />
                  <Label htmlFor={chart} className="text-sm text-muted-foreground cursor-pointer">
                    {chart}
                  </Label>
                  {state.visibleCharts.includes(chart) ? (
                    <Eye className="w-4 h-4 text-green-500 ml-auto" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <LogOut className="w-5 h-5 text-destructive" />
              <h3 className="text-lg font-semibold text-foreground">Sign Out</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to sign out? You'll need to log in again to access your account.
            </p>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25 transition-all duration-200 hover:scale-[1.02] font-semibold"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
