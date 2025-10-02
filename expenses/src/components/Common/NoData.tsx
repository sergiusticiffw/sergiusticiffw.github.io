import React, { ReactNode } from 'react';
import './NoData.scss';

interface NoDataProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const NoData: React.FC<NoDataProps> = ({ icon, title, description, action }) => {
  return (
    <div className="no-data">
      <div className="no-data-icon">{icon}</div>
      <h3 className="no-data-title">{title}</h3>
      <p className="no-data-description">{description}</p>
      {action && (
        <button onClick={action.onClick} className="no-data-action">
          {action.label}
        </button>
      )}
    </div>
  );
};

export default NoData;

