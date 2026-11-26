"use client";

import { useFormStatus } from "react-dom";
import { btnDanger, btnPrimary, btnSecondary } from "./ui";

const variants = {
  primary: btnPrimary,
  secondary: btnSecondary,
  danger: btnDanger,
};

export function SubmitButton({
  children,
  pendingText = "Salvando...",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof variants;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variants[variant]} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
