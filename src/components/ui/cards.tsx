import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "standard" | "compact";
};

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  children?: ReactNode;
  description?: string;
  title: string;
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function Card({
  className,
  variant = "standard",
  ...props
}: CardProps) {
  return (
    <div
      className={joinClassNames("card", `card--${variant}`, className)}
      {...props}
    />
  );
}

export function SectionCard({
  children,
  className,
  description,
  title,
  ...props
}: SectionCardProps) {
  return (
    <section className={joinClassNames("card card--section", className)} {...props}>
      <header className="card__header">
        <h3 className="type-heading-3 text-text">{title}</h3>
        {description ? (
          <p className="type-supporting text-text-muted">{description}</p>
        ) : null}
      </header>
      {children ? <div className="card__body">{children}</div> : null}
    </section>
  );
}
