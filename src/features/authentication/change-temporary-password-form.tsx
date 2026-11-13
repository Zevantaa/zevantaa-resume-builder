"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert, TextInput } from "@/components/ui";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { changeTemporaryPasswordAction, type ChangeTemporaryPasswordState } from "./change-temporary-password-action";

const initial: ChangeTemporaryPasswordState = { ok: false, message: "" };

export function ChangeTemporaryPasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(changeTemporaryPasswordAction, initial);
  useEffect(() => {
    if (!state.ok) return;
    void createBrowserSupabaseClient().auth.refreshSession().finally(() => {
      router.replace("/client");
      router.refresh();
    });
  }, [router, state.ok]);
  return <form action={action} aria-busy={pending} className="auth-form">
    {state.message && <InlineAlert variant={state.ok ? "success" : "error"}>{state.message}</InlineAlert>}
    <TextInput autoComplete="new-password" disabled={pending} helperText="Use 12–128 characters with upper- and lowercase letters, a number, and a symbol." id="temporary-new-password" label="New private password" minLength={12} name="password" required type="password" />
    <TextInput autoComplete="new-password" disabled={pending} id="temporary-confirmation" label="Confirm new password" minLength={12} name="confirmation" required type="password" />
    <button className="type-button auth-submit" disabled={pending || state.ok} type="submit">{pending ? "Updating…" : "Replace temporary password"}</button>
  </form>;
}
