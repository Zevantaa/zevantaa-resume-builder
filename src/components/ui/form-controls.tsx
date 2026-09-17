import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldShellProps = {
  children: ReactNode;
  descriptionId?: string;
  error?: string;
  helperText?: string;
  id: string;
  label: string;
  required?: boolean;
};

type SharedFieldProps = Omit<FieldShellProps, "children" | "descriptionId">;

type TextInputProps = SharedFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required">;

type TextareaFieldProps = SharedFieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "required">;

type SelectFieldProps = SharedFieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "required">;

function FieldShell({
  children,
  descriptionId,
  error,
  helperText,
  id,
  label,
  required,
}: FieldShellProps) {
  return (
    <div className="form-field">
      <label className="type-label form-label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span className="form-required-indicator" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="type-supporting form-error" id={descriptionId}>
          Error: {error}
        </p>
      ) : helperText ? (
        <p className="type-supporting form-helper" id={descriptionId}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

function getDescriptionId(
  id: string,
  helperText?: string,
  error?: string,
) {
  return helperText || error ? `${id}-description` : undefined;
}

function getControlClassName(error?: string, className?: string) {
  return ["form-control", error ? "form-control--error" : null, className]
    .filter(Boolean)
    .join(" ");
}

export function TextInput({
  className,
  error,
  helperText,
  id,
  label,
  required,
  type = "text",
  ...props
}: TextInputProps) {
  const descriptionId = getDescriptionId(id, helperText, error);

  return (
    <FieldShell
      descriptionId={descriptionId}
      error={error}
      helperText={helperText}
      id={id}
      label={label}
      required={required}
    >
      <input
        {...props}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={getControlClassName(error, className)}
        id={id}
        required={required}
        type={type}
      />
    </FieldShell>
  );
}

export function TextareaField({
  className,
  error,
  helperText,
  id,
  label,
  required,
  rows = 4,
  ...props
}: TextareaFieldProps) {
  const descriptionId = getDescriptionId(id, helperText, error);

  return (
    <FieldShell
      descriptionId={descriptionId}
      error={error}
      helperText={helperText}
      id={id}
      label={label}
      required={required}
    >
      <textarea
        {...props}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={getControlClassName(
          error,
          ["form-textarea", className].filter(Boolean).join(" "),
        )}
        id={id}
        required={required}
        rows={rows}
      />
    </FieldShell>
  );
}

export function SelectField({
  children,
  className,
  error,
  helperText,
  id,
  label,
  required,
  ...props
}: SelectFieldProps) {
  const descriptionId = getDescriptionId(id, helperText, error);

  return (
    <FieldShell
      descriptionId={descriptionId}
      error={error}
      helperText={helperText}
      id={id}
      label={label}
      required={required}
    >
      <select
        {...props}
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        className={getControlClassName(error, className)}
        id={id}
        required={required}
      >
        {children}
      </select>
    </FieldShell>
  );
}
