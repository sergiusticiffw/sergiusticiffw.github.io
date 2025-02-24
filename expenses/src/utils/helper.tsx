import {
  FaCheckCircle,
  FaExclamationCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaTshirt,
  FaMusic,
  FaUtensils,
  FaGift,
  FaHome,
  FaHeartbeat,
  FaUser,
  FaCar,
  FaLightbulb,
  FaPlane,
  FaUsers,
  FaChartLine,
  FaTools
} from 'react-icons/fa';

export const getFinancialStabilityIcon = (
  savingsRate: number,
  isFiltered = false
) => {
  if (isFiltered) return null;
  if (savingsRate > 20) return <FaCheckCircle color="green" />;
  if (savingsRate > 10) return <FaExclamationCircle color="yellow" />;
  if (savingsRate > 0) return <FaExclamationTriangle color="orange" />;
  return <FaTimesCircle color="red" />;
};

export const getIconForCategory = (category: string) => {
  switch (category) {
    case 'Clothing':
      return <FaTshirt color="#4A90E2" />;
    case 'Entertainment':
      return <FaMusic color="#F5A623" />;
    case 'Food':
      return <FaUtensils color="#7ED321" />;
    case 'Gifts':
      return <FaGift color="#D0021B" />;
    case 'Household Items/Supplies':
      return <FaTools color="#9B9B9B" />;
    case 'Housing':
      return <FaHome color="#8B572A" />;
    case 'Medical / Healthcare':
      return <FaHeartbeat color="#50E3C2" />;
    case 'Personal':
      return <FaUser color="#BD10E0" />;
    case 'Transportation':
      return <FaCar color="#F8E71C" />;
    case 'Utilities':
      return <FaLightbulb color="#ADD8E6" />;
    case 'Travel':
      return <FaPlane color="#417505" />;
    case 'Family':
      return <FaUsers color="#FF7F50" />;
    case 'Investment':
      return <FaChartLine color="#FFD700" />;
    default:
      return null;
  }
};
