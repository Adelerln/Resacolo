import type { ReactNode } from 'react';

type OrganizerPageHeaderProps = {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
};

export default function OrganizerPageHeader({
  title,
  subtitle = null,
  actions = null
}: OrganizerPageHeaderProps) {
  return (
    <header className="organizer-page-header">
      <div className="space-y-1">
        <h1 className="organizer-page-title">{title}</h1>
        {subtitle ? <p className="organizer-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="organizer-page-header-actions">{actions}</div> : null}
    </header>
  );
}
