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
  FaTools,
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
  // Handle both English and Romanian category names
  const categoryLower = category.toLowerCase();
  
  // Check for English category names
  if (categoryLower.includes('clothing') || categoryLower.includes('îmbrăcăminte')) {
    return <FaTshirt color="#4A90E2" />;
  }
  if (categoryLower.includes('entertainment') || categoryLower.includes('divertisment')) {
    return <FaMusic color="#F5A623" />;
  }
  if (categoryLower.includes('food') || categoryLower.includes('mâncare')) {
    return <FaUtensils color="#7ED321" />;
  }
  if (categoryLower.includes('gifts') || categoryLower.includes('cadouri')) {
    return <FaGift color="#D0021B" />;
  }
  if (categoryLower.includes('household') || categoryLower.includes('articole casnice')) {
    return <FaTools color="#9B9B9B" />;
  }
  if (categoryLower.includes('housing') || categoryLower.includes('locuință')) {
    return <FaHome color="#8B572A" />;
  }
  if (categoryLower.includes('health') || categoryLower.includes('sănătate')) {
    return <FaHeartbeat color="#50E3C2" />;
  }
  if (categoryLower.includes('personal')) {
    return <FaUser color="#BD10E0" />;
  }
  if (categoryLower.includes('transport')) {
    return <FaCar color="#F8E71C" />;
  }
  if (categoryLower.includes('utilities')) {
    return <FaLightbulb color="#ADD8E6" />;
  }
  if (categoryLower.includes('travel') || categoryLower.includes('călătorii')) {
    return <FaPlane color="#417505" />;
  }
  if (categoryLower.includes('family') || categoryLower.includes('familie')) {
    return <FaUsers color="#FF7F50" />;
  }
  if (categoryLower.includes('investment') || categoryLower.includes('investiții')) {
    return <FaChartLine color="#FFD700" />;
  }
  if (categoryLower.includes('education') || categoryLower.includes('educație')) {
    return <FaChartLine color="#9370DB" />;
  }
  if (categoryLower.includes('bills') || categoryLower.includes('facturi')) {
    return <FaLightbulb color="#FF6347" />;
  }
  if (categoryLower.includes('other') || categoryLower.includes('altele')) {
    return <FaTools color="#808080" />;
  }
  if (categoryLower.includes('shopping') || categoryLower.includes('cumpărături')) {
    return <FaGift color="#FF69B4" />;
  }
  
  return null;
};
