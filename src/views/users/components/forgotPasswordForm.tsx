"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  forgotPasswordAction,
  type AuthActionState,
} from "@/views/users/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submitButton";
import { AuthMessage } from "./authMessage";
import { z } from "zod";

const emailSchema = z.string().email("Enter a valid email address.");

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    forgotPasswordAction,
    null,
  );

  const [touched, setTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();

  function touch(value: string) {
    setTouched(true);
    validate(value);
  }

  function validate(value: string) {
    const r = emailSchema.safeParse(value);
    setEmailError(r.success ? undefined : r.error.issues[0]?.message);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <AuthMessage state={state} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          onBlur={(e) => touch(e.target.value)}
          onChange={(e) => { if (touched) validate(e.target.value); }}
          aria-invalid={!!emailError}
        />
        {emailError && (
          <p className="text-xs text-destructive">{emailError}</p>
        )}
      </div>
      <SubmitButton className="mt-2 w-full">Send reset link</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/sign-in" className="text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
