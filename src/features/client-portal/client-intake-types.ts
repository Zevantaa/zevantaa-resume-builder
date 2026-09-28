export type IntakeActionState = {
  status: "idle" | "success" | "warning" | "error";
  message?: string;
  errors?: Record<string, string>;
  savedAt?: number;
};

export const initialIntakeActionState: IntakeActionState = { status: "idle" };
