import Income from '@pages/Income';
import AddTransaction from '@pages/AddTransaction';
import LazyCharts from '@pages/LazyCharts';
import Profile from '@pages/Profile';
import Login from '@pages/Login';
import Home from '@pages/Home';
import Home1 from '@pages/Home1';
import Loans from '@pages/Loans';
import Loan from '@pages/Loan';

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
    component: Home1,
    isPrivate: true,
  },
  {
    path: '/expenses/home1',
    component: Home1,
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
  {
    path: '/expenses/loans',
    component: Loans,
    isPrivate: true,
  },
  {
    path: '/expenses/loan/:id',
    component: Loan,
    isPrivate: true,
  },
];

export default routes;
