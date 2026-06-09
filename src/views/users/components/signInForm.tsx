"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  signInAction,
  signInWithGoogleAction,
  type AuthActionState,
} from "@/views/users/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "./submitButton";
import { AuthMessage } from "./authMessage";
import { PasswordInput } from "./passwordInput";
import { z } from "zod";

const emailSchema = z.string().email("Enter a valid email address.");
const passwordSchema = z.string().min(1, "Password is required.");

function fieldError(schema: z.ZodType, value: string): string | undefined {
  const r = schema.safeParse(value);
  return r.success ? undefined : r.error.issues[0]?.message;
}

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    signInAction,
    null,
  );

  const [touched, setTouched] = useState({ email: false, password: false });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [googlePending, startGoogle] = useTransition();
  const [googleError, setGoogleError] = useState<string | null>(null);

  function touch(field: "email" | "password", value: string) {
    setTouched((t) => ({ ...t, [field]: true }));
    const schema = field === "email" ? emailSchema : passwordSchema;
    setErrors((e) => ({ ...e, [field]: fieldError(schema, value) }));
  }

  function validate(field: "email" | "password", value: string) {
    if (!touched[field]) return;
    const schema = field === "email" ? emailSchema : passwordSchema;
    setErrors((e) => ({ ...e, [field]: fieldError(schema, value) }));
  }

  function handleGoogle() {
    setGoogleError(null);
    startGoogle(async () => {
      const result = await signInWithGoogleAction();
      if (result?.error) setGoogleError(result.error);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthMessage state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          onBlur={(e) => touch("email", e.target.value)}
          onChange={(e) => validate("email", e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          onBlur={(e) => touch("password", (e.target as HTMLInputElement).value)}
          onChange={(e) => validate("password", (e.target as HTMLInputElement).value)}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password}</p>
        )}
      </div>

      <SubmitButton className="mt-2 w-full">Sign in</SubmitButton>

      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {googleError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {googleError}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={googlePending}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="text-foreground hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
