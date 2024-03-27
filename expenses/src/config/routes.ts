import Income from '@pages/Income';
import AddTransaction from '@pages/AddTransaction';
import LazyCharts from '@pages/LazyCharts';
import Profile from '@pages/Profile';
import Login from '@pages/Login';
import Home from '@pages/Home';

const routes = [
  {
    path: '/expenses/login',
    component: Login,
    isPrivate: false,
  },
  {
    path: '/expenses/charts',
    component: LazyCharts,
    isPrivate: true,
  },
  {
    path: '/expenses',
    component: Home,
    isPrivate: true,
  },
  {
    path: '/expenses/user',
    component: Profile,
    isPrivate: true,
  },
  {
    path: '/expenses/add-transaction',
    component: AddTransaction,
    isPrivate: true,
  },
  {
    path: '/expenses/income',
    component: Income,
    isPrivate: true,
  },
];

export default routes;
