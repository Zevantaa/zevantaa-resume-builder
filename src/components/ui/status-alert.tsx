import type { HTMLAttributes, ReactNode } from "react";

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "information"
  | "neutral";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: StatusVariant;
};

type InlineAlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: StatusVariant;
};

type AlertPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title: string;
  variant?: StatusVariant;
};

const statusSymbols: Record<StatusVariant, string> = {
  success: "✓",
  warning: "!",
  error: "×",
  information: "i",
  neutral: "•",
};

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function getAlertRole(variant: StatusVariant): "alert" | "status" {
  return variant === "error" ? "alert" : "status";
}

function AlertIndicator({ variant }: { variant: StatusVariant }) {
  return (
    <span className="alert__indicator" aria-hidden="true">
      {statusSymbols[variant]}
    </span>
  );
}

export function StatusBadge({
  children,
  className,
  variant = "neutral",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={joinClassNames(
        "type-label status-badge",
        `status--${variant}`,
        className,
      )}
      {...props}
    >
      <span className="status-indicator" aria-hidden="true" />
      {children}
    </span>
  );
}

export function InlineAlert({
  children,
  className,
  role,
  variant = "information",
  ...props
}: InlineAlertProps) {
  return (
    <div
      className={joinClassNames(
        "type-supporting alert alert--inline",
        `status--${variant}`,
        className,
      )}
      role={role ?? getAlertRole(variant)}
      {...props}
    >
      <AlertIndicator variant={variant} />
      <div className="alert__content">{children}</div>
    </div>
  );
}

export function AlertPanel({
  children,
  className,
  role,
  title,
  variant = "neutral",
  ...props
}: AlertPanelProps) {
  return (
    <div
      className={joinClassNames(
        "alert alert--panel",
        `status--${variant}`,
        className,
      )}
      role={role ?? getAlertRole(variant)}
      {...props}
    >
      <AlertIndicator variant={variant} />
      <div className="alert__content">
        <strong className="type-body alert__title">{title}</strong>
        <div className="type-supporting alert__message">{children}</div>
      </div>
    </div>
  );
}
