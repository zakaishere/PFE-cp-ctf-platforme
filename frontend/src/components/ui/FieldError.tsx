import { AlertCircle } from "lucide-react";

interface FieldErrorProps {
  errors:    Record<string, string>;
  fieldName: string;
}

export function FieldError({ errors, fieldName }: FieldErrorProps) {
  const message = errors[fieldName];
  if (!message) return null;
  return (
    <p style={{ color: "var(--danger-ink)", fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
      <AlertCircle size={12} />
      {message}
    </p>
  );
}
