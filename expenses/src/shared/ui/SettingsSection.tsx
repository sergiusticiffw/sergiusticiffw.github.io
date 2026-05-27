import React from 'react';
import { cn } from './cn';
import { Card } from './Card';

export interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn('mb-6', className)}>
      <div className="mb-3">
        <h2 className="text-heading text-app-primary m-0">{title}</h2>
        {description && (
          <p className="text-caption text-app-muted mt-1 m-0">{description}</p>
        )}
      </div>
      <Card variant="surface" padding="md">
        {children}
      </Card>
    </section>
  );
}
