import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaTimesCircle,
} from 'react-icons/fa';
import {
  FaTshirt,
  FaFilm,
  FaUtensils,
  FaGift,
  FaWarehouse,
  FaHome,
  FaUserMd,
  FaUser,
  FaCar,
  FaPlug,
  FaPlane,
  FaUserFriends,
  FaPiggyBank,
} from 'react-icons/fa';

export const getFinancialStabilityIcon = (
  savingsRate: number,
  isFiltered = false
) => {
  if (isFiltered) return null;
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

export const getIconForCategory = (category) => {
  switch (category) {
    case 'Clothing':
      return (
        <>
          <FaTshirt color="blue" />{' '}
        </>
      );
    case 'Entertainment':
      return (
        <>
          <FaFilm color="orange" />{' '}
        </>
      );
    case 'Food':
      return (
        <>
          <FaUtensils color="green" />{' '}
        </>
      );
    case 'Gifts':
      return (
        <>
          <FaGift color="red" />{' '}
        </>
      );
    case 'Household Items/Supplies':
      return (
        <>
          <FaWarehouse color="brown" />{' '}
        </>
      );
    case 'Housing':
      return (
        <>
          <FaHome color="purple" />{' '}
        </>
      );
    case 'Medical / Healthcare':
      return (
        <>
          <FaUserMd color="teal" />{' '}
        </>
      );
    case 'Personal':
      return (
        <>
          <FaUser color="pink" />{' '}
        </>
      );
    case 'Transportation':
      return (
        <>
          <FaCar color="yellow" />{' '}
        </>
      );
    case 'Utilities':
      return (
        <>
          <FaPlug color="gray" />{' '}
        </>
      );
    case 'Travel':
      return (
        <>
          <FaPlane color="lightblue" />{' '}
        </>
      );
    case 'Family':
      return (
        <>
          <FaUserFriends color="coral" />{' '}
        </>
      );
    case 'Investment':
      return (
        <>
          <FaPiggyBank color="gold" />{' '}
        </>
      );
    default:
      return null; // Return null or a default icon if the category is not recognized
  }
};
