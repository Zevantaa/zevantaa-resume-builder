import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export function TableContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("table-container", className)} {...props} />;
}

type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  caption: string;
};

export function DataTable({
  caption,
  children,
  className,
  ...props
}: DataTableProps) {
  return (
    <table className={joinClassNames("data-table", className)} {...props}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={joinClassNames("data-table__header", className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={joinClassNames("data-table__body", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={joinClassNames("data-table__row", className)} {...props} />;
}

export function TableHeaderCell({
  className,
  scope = "col",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={joinClassNames("data-table__header-cell", className)}
      scope={scope}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={joinClassNames("data-table__cell", className)} {...props} />;
}

type TableEmptyStateProps = TdHTMLAttributes<HTMLTableCellElement> & {
  description: string;
  title: string;
};

export function TableEmptyState({
  className,
  description,
  title,
  ...props
}: TableEmptyStateProps) {
  return (
    <TableRow className="data-table__row--empty">
      <td
        className={joinClassNames("data-table__empty-cell", className)}
        {...props}
      >
        <div className="data-table__empty-content">
          <strong className="type-body text-text">{title}</strong>
          <span className="type-supporting">{description}</span>
        </div>
      </td>
    </TableRow>
  );
}
