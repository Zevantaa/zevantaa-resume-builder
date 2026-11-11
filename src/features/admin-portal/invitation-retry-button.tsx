"use client";

import { useActionState } from "react";

import { retryClientInvitationAction, type InvitationRetryState } from "./retry-client-invitation-action";

const initialState: InvitationRetryState = { status: "idle" };

export function InvitationRetryButton({ invitationId, label = "Send new setup email" }: {
  invitationId: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(retryClientInvitationAction, initialState);
  return <form action={action} aria-busy={pending} className="invitation-retry-form">
    <input name="invitationId" type="hidden" value={invitationId} />
    <button className="auth-secondary-button type-button" disabled={pending} type="submit">
      {pending ? "Sending..." : label}
    </button>
    {state.message ? <span aria-live="polite" className={`type-supporting invitation-retry-message invitation-retry-message--${state.status}`} role="status">
      {state.message}
    </span> : null}
  </form>;
}
