import type { HTMLAttributes, ReactNode } from "react";

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={joinClassNames("dashboard-workspace-intro premium-page-header", className)}
      {...props}
    >
      <div className="premium-page-header__copy">
        <p className="type-label dashboard-kicker">{eyebrow}</p>
        <h1 className="type-heading-1">{title}</h1>
        <p className="type-body text-text-muted">{description}</p>
      </div>
      {actions ? <div className="premium-page-header__actions">{actions}</div> : null}
    </header>
  );
}
