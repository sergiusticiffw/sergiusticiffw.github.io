import { FaCheckCircle } from 'react-icons/fa';

export const getFinancialStabilityIcon = (savingsRate) => {
  if (savingsRate > 20)
    return (
      <>
        <FaCheckCircle color="green" />{' '}
      </>
    );
  if (savingsRate > 10)
    return (
      <>
        <FaCheckCircle color="yellow" />{' '}
      </>
    );
  if (savingsRate > 0)
    return (
      <>
        <FaCheckCircle color="orange" />{' '}
      </>
    );
  return (
    <>
      <FaCheckCircle color="red" />{' '}
    </>
  );
};
