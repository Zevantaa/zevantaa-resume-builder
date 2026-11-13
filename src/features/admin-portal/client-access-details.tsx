"use client";

import { useActionState, useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui";

import type { ProvisionedClientDetail } from "./client-account-types";
import { generateClientAccessLinkAction, type ClientAccessLinkState } from "./generate-client-access-link-action";
import { InvitationRetryButton } from "./invitation-retry-button";

const initialLinkState: ClientAccessLinkState = { status: "idle" };

export function ClientAccessDetails({ client, completeMessage, whatsappMessage }: {
  client: ProvisionedClientDetail; completeMessage: string; whatsappMessage: string;
}) {
  const [linkState, linkAction, pending] = useActionState(generateClientAccessLinkAction, initialLinkState);
  const [copyStatus, setCopyStatus] = useState("");
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopyStatus(`${label} copied.`); }
    catch { setCopyStatus(`Could not copy ${label.toLowerCase()}. Select and copy it manually.`); }
  }
  const activation = client.invitation?.acceptedAt ? "Activated" : "Awaiting activation";
  return <div className="client-access-details">
    {!client.smtpVerified && <InlineAlert variant="warning">
      Automatic transactional email is not verified. Copy and share the prepared welcome message and secure setup link manually. A prepared message is not a delivered email.
    </InlineAlert>}
    <dl className="dashboard-detail-list client-access-details__grid">
      <div><dt>Client</dt><dd>{client.fullName}</dd></div>
      <div><dt>Mobile</dt><dd>{client.mobileNumber}</dd></div>
      <div><dt>WhatsApp</dt><dd>{client.whatsappNumber || "Not provided"}</dd></div>
      <div><dt>Login username</dt><dd>{client.email}</dd></div>
      <div><dt>Assigned package</dt><dd>{client.packageName}</dd></div>
      <div><dt>Client portal</dt><dd className="client-access-details__url">{client.clientPortalUrl}</dd></div>
      <div><dt>Account status</dt><dd><StatusBadge variant={client.accountStatus === "active" ? "success" : "neutral"}>{client.accountStatus}</StatusBadge></dd></div>
      <div><dt>Invitation</dt><dd><StatusBadge variant={client.invitation?.deliveryStatus === "failed" ? "error" : client.invitation?.deliveryStatus === "sent" ? "success" : "neutral"}>{client.invitation?.deliveryStatus ?? "not-sent"}</StatusBadge></dd></div>
      <div><dt>Activation</dt><dd>{activation}</dd></div>
      <div><dt>Last invitation</dt><dd>{client.invitation?.lastAttemptAt ? new Date(client.invitation.lastAttemptAt).toLocaleString("en-IN") : "Not sent"}</dd></div>
    </dl>
    <div className="client-access-details__actions">
      <button className="type-button auth-secondary-button" onClick={() => copy(client.email, "Username")} type="button">Copy Username</button>
      <button className="type-button auth-secondary-button" onClick={() => copy(client.clientPortalUrl, "Client portal link")} type="button">Copy Client Portal Link</button>
      <button className="type-button auth-secondary-button" onClick={() => copy(completeMessage, "Complete welcome message")} type="button">Copy Complete Welcome Message</button>
      <button className="type-button auth-secondary-button" onClick={() => copy(whatsappMessage, "WhatsApp welcome message")} type="button">Copy WhatsApp Welcome Message</button>
    </div>
    <details className="client-access-details__message-preview">
      <summary className="type-button">Preview or manually copy prepared messages</summary>
      <label className="type-label" htmlFor="complete-welcome-message">Complete welcome message</label>
      <textarea className="form-control" id="complete-welcome-message" readOnly rows={9} value={completeMessage} />
      <label className="type-label" htmlFor="whatsapp-welcome-message">WhatsApp welcome message</label>
      <textarea className="form-control" id="whatsapp-welcome-message" readOnly rows={7} value={whatsappMessage} />
      <p className="type-supporting text-text-muted">Prepared locally for administrator sharing. This does not indicate email or WhatsApp delivery.</p>
    </details>
    {client.invitation && !client.invitation.acceptedAt && <InvitationRetryButton invitationId={client.invitation.id} label="Resend Invitation" />}
    <form action={linkAction} aria-busy={pending} className="client-access-details__link-form">
      <input name="userId" type="hidden" value={client.userId} />
      <button className="type-button dashboard-primary-link" disabled={pending || client.accountStatus !== "active"} type="submit">
        {pending ? "Generating…" : "Generate Password Setup Link"}
      </button>
      <p className="type-supporting text-text-muted">Use this secure recovery flow to reset or reissue client access. Existing passwords are never retrievable.</p>
    </form>
    {linkState.message && <InlineAlert variant={linkState.status === "success" ? "success" : "error"}>{linkState.message}</InlineAlert>}
    {linkState.setupLink && <div className="client-access-details__one-time">
      <label className="type-label" htmlFor="one-time-setup-link">One-time secure setup link</label>
      <textarea className="form-control" id="one-time-setup-link" readOnly rows={3} value={linkState.setupLink} />
      <button className="type-button auth-secondary-button" onClick={() => copy(linkState.setupLink!, "Password setup link")} type="button">Copy Setup Link</button>
    </div>}
    <span aria-live="polite" className="type-supporting" role="status">{copyStatus}</span>
  </div>;
}
