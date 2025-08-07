import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { categories } from '@utils/constants';
import { useData } from '@context/context';
import { Search, X, Filter } from 'lucide-react';
import { DataState } from '@type/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Filters = () => {
  const { data, dataDispatch } = useData() as DataState;

  const [state, setState] = useState({
    category: data.category ?? '',
    textFilter: data.textFilter ?? '',
  });
  const [showTextFilter, setShowTextFilter] = useState(false);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const prevFilterState = useRef(state);

  const handleCategoryChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const category = event.target.value;
    setState((prevState) => ({
      ...prevState,
      category,
    }));
  };

  const handleTextFilterChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const textFilter = event.target.value;
    setState((prevState) => ({
      ...prevState,
      textFilter,
    }));
  };

  const handleClearFilters = () => {
    setState({
      category: '',
      textFilter: '',
    });
    setShowTextFilter(false);
  };

  useEffect(() => {
    if (prevFilterState.current !== state) {
      // Run the effect only when filterState changes
      dataDispatch({
        type: 'FILTER_DATA',
        category: state.category,
        textFilter: state.textFilter,
      });
      prevFilterState.current = state;
    }
  }, [state, dataDispatch]);

  useLayoutEffect(() => {
    if (showTextFilter && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextFilter]);

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-3 w-full">
        {/* Search Input */}
        <div className="relative w-full md:flex-1 md:max-w-md">
          {!showTextFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTextFilter(true)}
              className="w-full justify-start text-muted-foreground hover:text-foreground h-10 md:h-9"
            >
              <Search className="w-4 h-4 mr-2" />
              Search transactions...
            </Button>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={textInputRef}
                type="text"
                value={state.textFilter}
                name="textFilter"
                onChange={handleTextFilterChange}
                placeholder="Search transactions..."
                className="pl-10 pr-10 h-10 md:h-9"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTextFilter(false)}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={state.category || "all"}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, category: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories
                .filter(category => category.value !== '')
                .map((category, id) => (
                  <SelectItem key={id} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear Filters */}
        {(state.textFilter || state.category) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="w-full md:w-auto hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="w-4 h-4 mr-2" />
            <span className="md:hidden">Clear Filters</span>
            <span className="hidden md:inline">Clear</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default Filters;
