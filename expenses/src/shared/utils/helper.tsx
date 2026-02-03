import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiXCircle,
  FiShoppingBag,
  FiMusic,
  FiShoppingCart,
  FiGift,
  FiHome,
  FiHeart,
  FiUser,
  FiTruck,
  FiZap,
  FiMap,
  FiUsers,
  FiTrendingUp,
  FiTool,
} from 'react-icons/fi';

export const getFinancialStabilityIcon = (
  savingsRate: number,
  isFiltered = false
) => {
  if (isFiltered) return null;
  if (savingsRate > 20) return <FiCheckCircle color="green" />;
  if (savingsRate > 10) return <FiAlertCircle color="yellow" />;
  if (savingsRate > 0) return <FiAlertTriangle color="orange" />;
  return <FiXCircle color="red" />;
};

export const getIconForCategory = (category: string) => {
  // Handle both English and Romanian category names
  const categoryLower = category.toLowerCase();

  // Check for English category names
  if (
    categoryLower.includes('clothing') ||
    categoryLower.includes('îmbrăcăminte')
  ) {
    return <FiShoppingBag color="#4A90E2" />;
  }
  if (
    categoryLower.includes('entertainment') ||
    categoryLower.includes('divertisment')
  ) {
    return <FiMusic color="#F5A623" />;
  }
  if (categoryLower.includes('food') || categoryLower.includes('mâncare')) {
    return <FiShoppingCart color="#7ED321" />;
  }
  if (categoryLower.includes('gifts') || categoryLower.includes('cadouri')) {
    return <FiGift color="#D0021B" />;
  }
  if (
    categoryLower.includes('household') ||
    categoryLower.includes('articole casnice')
  ) {
    return <FiTool color="#9B9B9B" />;
  }
  if (categoryLower.includes('housing') || categoryLower.includes('locuință')) {
    return <FiHome color="#8B572A" />;
  }
  if (categoryLower.includes('health') || categoryLower.includes('sănătate')) {
    return <FiHeart color="#50E3C2" />;
  }
  if (categoryLower.includes('personal')) {
    return <FiUser color="#BD10E0" />;
  }
  if (categoryLower.includes('transport')) {
    return <FiTruck color="#F8E71C" />;
  }
  if (categoryLower.includes('utilities')) {
    return <FiZap color="#ADD8E6" />;
  }
  if (categoryLower.includes('travel') || categoryLower.includes('călătorii')) {
    return <FiMap color="#417505" />;
  }
  if (categoryLower.includes('family') || categoryLower.includes('familie')) {
    return <FiUsers color="#FF7F50" />;
  }
  if (
    categoryLower.includes('investment') ||
    categoryLower.includes('investiții')
  ) {
    return <FiTrendingUp color="#FFD700" />;
  }
  if (
    categoryLower.includes('education') ||
    categoryLower.includes('educație')
  ) {
    return <FiTrendingUp color="#9370DB" />;
  }
  if (categoryLower.includes('bills') || categoryLower.includes('facturi')) {
    return <FiZap color="#FF6347" />;
  }
  if (categoryLower.includes('other') || categoryLower.includes('altele')) {
    return <FiTool color="#808080" />;
  }
  if (
    categoryLower.includes('shopping') ||
    categoryLower.includes('cumpărături')
  ) {
    return <FiGift color="#FF69B4" />;
  }

  return null;
};
