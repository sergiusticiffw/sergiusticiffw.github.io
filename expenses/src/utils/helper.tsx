import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';

export const getFinancialStabilityIcon = (savingsRate: number) => {
  if (savingsRate > 20)
    return (
      <>
        <FaCheckCircle color="green" />{' '}
      </>
    );
  if (savingsRate > 10)
    return (
      <>
        <FaExclamationCircle color="yellow" />{' '}
      </>
    );
  if (savingsRate > 0)
    return (
      <>
        <FaExclamationTriangle color="orange" />{' '}
      </>
    );
  return (
    <>
      <FaTimesCircle color="red" />{' '}
    </>
  );
};
