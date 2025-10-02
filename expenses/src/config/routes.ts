import Income from '@pages/Income';
import LazyCharts from '@pages/LazyCharts';
import Profile from '@pages/Profile';
import Login from '@pages/Login';
import NewHome from '@pages/NewHome';
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
    component: NewHome,
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
  {
    path: '/expenses/user',
    component: Profile,
    isPrivate: true,
  },
];

export default routes;
