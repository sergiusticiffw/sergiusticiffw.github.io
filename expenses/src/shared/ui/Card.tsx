import React from 'react';
import { cn } from './cn';

type CardVariant = 'surface' | 'elevated' | 'interactive';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<CardVariant, string> = {
  surface: 'bg-app-surface border border-app-subtle',
  elevated:
    'bg-[var(--color-surface-elevated)] border border-[var(--color-border-strong)] shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  interactive:
    'bg-app-surface border border-app-subtle hover:bg-app-surface-hover hover:border-[var(--color-border-accent)] transition-colors cursor-pointer',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({
  variant = 'surface',
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-3', className)} {...props}>
      {children}
    </div>
  );
}

function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mt-4 pt-3 border-t border-app-subtle', className)} {...props}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
