"use client";

import { useActionState, useState } from "react";
import {
  resetPasswordAction,
  type AuthActionState,
} from "@/views/users/actions";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submitButton";
import { AuthMessage } from "./authMessage";
import { PasswordInput } from "./passwordInput";
import { z } from "zod";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    resetPasswordAction,
    null,
  );

  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [passwordValue, setPasswordValue] = useState("");

  function touchPassword(value: string) {
    setPasswordValue(value);
    setTouched((t) => ({ ...t, password: true }));
    const r = passwordSchema.safeParse(value);
    setErrors((e) => ({
      ...e,
      password: r.success ? undefined : r.error.issues[0]?.message,
    }));
  }

  function onPasswordChange(value: string) {
    setPasswordValue(value);
    if (!touched.password) return;
    const r = passwordSchema.safeParse(value);
    setErrors((e) => ({
      ...e,
      password: r.success ? undefined : r.error.issues[0]?.message,
    }));
  }

  function touchConfirm(value: string) {
    setTouched((t) => ({ ...t, confirm: true }));
    setErrors((e) => ({
      ...e,
      confirm: value !== passwordValue ? "Passwords do not match." : undefined,
    }));
  }

  function onConfirmChange(value: string) {
    if (!touched.confirm) return;
    setErrors((e) => ({
      ...e,
      confirm: value !== passwordValue ? "Passwords do not match." : undefined,
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AuthMessage state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          onBlur={(e) => touchPassword((e.target as HTMLInputElement).value)}
          onChange={(e) => onPasswordChange((e.target as HTMLInputElement).value)}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          onBlur={(e) => touchConfirm((e.target as HTMLInputElement).value)}
          onChange={(e) => onConfirmChange((e.target as HTMLInputElement).value)}
          aria-invalid={!!errors.confirm}
        />
        {errors.confirm && (
          <p className="text-xs text-destructive">{errors.confirm}</p>
        )}
      </div>

      <SubmitButton className="mt-2 w-full">Update password</SubmitButton>
    </form>
  );
}
