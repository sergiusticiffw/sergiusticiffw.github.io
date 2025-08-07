import { useMemo, useState } from 'react';

interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

export const useSortableData = (
  items: any[],
  config: SortConfig | null = null
) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(config);

  const sortedItems = useMemo(() => {
    const sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle date sorting
        if (sortConfig.key === 'dt') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        return sortConfig.direction === 'ascending'
          ? aValue - bValue
          : bValue - aValue;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { sortedItems, requestSort, sortConfig };
};

export const getClassNamesFor = (
  sortConfig: SortConfig | null,
  name: string
) => (sortConfig && sortConfig.key === name ? sortConfig.direction : '');
