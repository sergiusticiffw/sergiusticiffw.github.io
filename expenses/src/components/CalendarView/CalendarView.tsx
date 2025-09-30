import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { formatNumber } from '@utils/utils';
import { FaTimes } from 'react-icons/fa';
import TransactionList from '@components/TransactionList';
import Month from '@components/Home/Month';
import './CalendarView.scss';

interface Transaction {
  id: string;
  dsc: string;
  sum: number | string;
  cat: string;
  dt: string;
}

interface CalendarViewProps {
  transactions: Transaction[];
  currentMonth: string;
  categoryLabels: Array<{ value: string; label: string }>;
  onMonthChange: (direction: 'prev' | 'next') => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  transactions,
  currentMonth,
  categoryLabels,
  onMonthChange,
  onEdit,
  onDelete,
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  // Group transactions by date
  const transactionsByDate = transactions.reduce(
    (acc, transaction) => {
      const date = transaction.dt;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(transaction);
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  // Calculate total per day
  const dailyTotals = Object.entries(transactionsByDate).map(
    ([date, dayTransactions]) => {
      const total = dayTransactions.reduce(
        (sum, t) =>
          sum + (typeof t.sum === 'string' ? parseFloat(t.sum) : t.sum),
        0
      );
      return {
        date,
        total,
        count: dayTransactions.length,
      };
    }
  );

  // Create events for calendar
  const events = dailyTotals.map(({ date, total, count }) => ({
    id: date, // Add id for event click
    date,
    title: `${formatNumber(total)}`,
    allDay: true,
    extendedProps: {
      total,
      count,
    },
  }));

  // Determine color based on amount
  const getColorClass = (amount: number) => {
    if (amount < 1000) return 'amount-low';
    if (amount < 3000) return 'amount-medium';
    return 'amount-high';
  };

  // Get category label
  const getCategoryLabel = (catValue: string) => {
    return (
      categoryLabels.find((cat) => cat.value === catValue)?.label || catValue
    );
  };

  // Get month index from name
  const getMonthIndex = (monthName: string) => {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return months.indexOf(monthName);
  };

  // Handle event click (when clicking on days with transactions)
  const handleEventClick = (event: { event: { id?: string } }) => {
    const clickedDate = event.event.id;
    if (clickedDate) {
      const dayTransactions = transactionsByDate[clickedDate];

      if (dayTransactions && dayTransactions.length > 0) {
        setSelectedDate(clickedDate);
        setShowDayModal(true);
      }
    }
  };

  // Swipe navigation - copied from original calendar
  let touchStartX = 0;
  let touchEndX = 0;
  let isSwiping = false;

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchEndX = event.touches[0].clientX;
    isSwiping = true;
  };

  const handleTouchEnd = () => {
    if (isSwiping) {
      const deltaX = touchEndX - touchStartX;
      const thresholdPercentage = 0.25;
      const containerWidth = window.innerWidth;
      const threshold = containerWidth * thresholdPercentage;

      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          // Swiped right - go to previous month (older)
          onMonthChange('prev');
        } else {
          // Swiped left - go to next month (newer)
          onMonthChange('next');
        }
      }
    }
    isSwiping = false;
  };

  // Get transactions for selected date
  const selectedDayTransactions = selectedDate
    ? transactionsByDate[selectedDate] || []
    : [];
  const selectedDayTotal = selectedDayTransactions.reduce(
    (sum, t) => sum + (typeof t.sum === 'string' ? parseFloat(t.sum) : t.sum),
    0
  );

  return (
    <div
      className="calendar-view-component"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <FullCalendar
        key={currentMonth}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={
          currentMonth
            ? new Date(
                currentMonth.split(' ')[1],
                getMonthIndex(currentMonth.split(' ')[0]),
                1
              )
            : new Date()
        }
        events={events}
        headerToolbar={{
          left: '',
          center: '',
          right: '',
        }}
        height="auto"
        eventClick={handleEventClick}
        eventContent={(eventInfo) => {
          const amount = eventInfo.event.extendedProps.total;
          const count = eventInfo.event.extendedProps.count;
          const colorClass = getColorClass(amount);

          return (
            <div className={`calendar-event ${colorClass}`}>
              <div className="event-amount">{eventInfo.event.title}</div>
              <div className="event-count">{count} items</div>
            </div>
          );
        }}
        dayCellClassNames="calendar-day-cell"
        dayHeaderClassNames="calendar-day-header"
      />

      {/* Month Chart */}
      <div className="month-chart-wrapper">
        <Month month={currentMonth} />
      </div>

      {/* Day Transactions Modal */}
      {showDayModal && selectedDate && (
        <div
          className="day-modal-overlay"
          onClick={() => setShowDayModal(false)}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className="day-modal-content"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="day-modal-header">
              <h3>
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowDayModal(false)}
              >
                <FaTimes />
              </button>
            </div>

            <div className="day-modal-total">
              Total: <strong>{formatNumber(selectedDayTotal)}</strong>
            </div>

            <div className="day-transactions-list">
              <TransactionList
                transactions={selectedDayTransactions}
                categoryLabels={categoryLabels}
                onEdit={(id) => {
                  setShowDayModal(false);
                  onEdit?.(id);
                }}
                onDelete={(id) => {
                  setShowDayModal(false);
                  onDelete?.(id);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
