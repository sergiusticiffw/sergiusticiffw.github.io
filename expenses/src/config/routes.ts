import React from 'react';

const AddTransaction = React.lazy(() => import('@pages/AddTransaction'));
const Charts = React.lazy(() => import('@pages/Charts'));
const Income = React.lazy(() => import('@pages/Income'));
const Profile = React.lazy(() => import('@pages/Profile'));
const Login = React.lazy(() => import('@pages/Login'));
const Home = React.lazy(() => import('@pages/Home'));

const routes = [
  {
    path: '/expenses/login',
    component: Login,
    isPrivate: false,
  },
  {
    path: '/expenses/charts',
    component: Charts,
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
