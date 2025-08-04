import React from 'react';
import { FaPlus, FaPen, FaTrash, FaSave, FaTimes } from 'react-icons/fa';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  icon?: 'plus' | 'edit' | 'delete' | 'save' | 'close' | 'none';
  onClick?: () => void;
  className?: string;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  icon = 'none',
  onClick,
  className = '',
  fullWidth = false,
}) => {
  const getIcon = () => {
    if (loading) return null;
    
    switch (icon) {
      case 'plus':
        return <FaPlus />;
      case 'edit':
        return <FaPen />;
      case 'delete':
        return <FaTrash />;
      case 'save':
        return <FaSave />;
      case 'close':
        return <FaTimes />;
      default:
        return null;
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'btn-secondary';
      case 'danger':
        return 'btn-danger';
      case 'success':
        return 'btn-success';
      case 'outline':
        return 'btn-outline';
      default:
        return 'btn-primary';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'btn-sm';
      case 'lg':
        return 'btn-lg';
      default:
        return 'btn-md';
    }
  };

  const buttonClasses = [
    'btn',
    getVariantClasses(),
    getSizeClasses(),
    fullWidth ? 'btn-full' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <div className="loader">
          <span></span>
          <span></span>
          <span></span>
        </div>
      ) : (
        <>
          {getIcon()}
          {children}
        </>
      )}
    </button>
  );
};

// Specialized button components
export const SubmitButton: React.FC<Omit<ButtonProps, 'type' | 'variant'> & {
  text?: string;
  icon?: 'plus' | 'edit' | 'save';
}> = ({ text, icon = 'save', ...props }) => (
  <Button
    type="submit"
    variant="primary"
    icon={icon}
    {...props}
  >
    {text}
  </Button>
);

export const AddButton: React.FC<Omit<ButtonProps, 'variant' | 'icon'> & { text?: string }> = ({ text = 'Add', ...props }) => (
  <Button variant="primary" icon="plus" {...props}>
    {text}
  </Button>
);

export const EditButton: React.FC<Omit<ButtonProps, 'variant' | 'icon'> & { text?: string }> = ({ text = 'Edit', ...props }) => (
  <Button variant="outline" icon="edit" {...props}>
    {text}
  </Button>
);

export const DeleteButton: React.FC<Omit<ButtonProps, 'variant' | 'icon'> & { text?: string }> = ({ text = 'Delete', ...props }) => (
  <Button variant="danger" icon="delete" {...props}>
    {text}
  </Button>
);

export const CancelButton: React.FC<Omit<ButtonProps, 'variant' | 'icon'> & { text?: string }> = ({ text = 'Cancel', ...props }) => (
  <Button variant="outline" icon="close" {...props}>
    {text}
  </Button>
);

export default Button; 