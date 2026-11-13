"use client";

import { useActionState } from "react";

import { InlineAlert } from "@/components/ui";

import { archiveClientAction, permanentlyDeleteClientAction, restoreClientAction, type ClientLifecycleState } from "./client-lifecycle-actions";
import type { ArchivedClient, ClientDeletionImpact } from "./client-lifecycle-service";

const initial: ClientLifecycleState = { status: "idle" };

export function ArchiveClientControl({ client }: { client: ClientDeletionImpact }) {
  const [state, action, pending] = useActionState(archiveClientAction, initial);
  return <section className="client-lifecycle-danger" id="client-lifecycle">
    <h2 className="type-heading-3">Delete Client</h2>
    <p className="type-supporting">The default action is a recoverable 30-day archive. It disables access and processing while preserving private records.</p>
    <dl className="dashboard-detail-list client-lifecycle-impact">
      <div><dt>Client</dt><dd>{client.fullName}</dd></div><div><dt>Email</dt><dd>{client.email}</dd></div>
      <div><dt>Package</dt><dd>{client.packageCode}</dd></div><div><dt>Stored documents</dt><dd>{client.documentCount}</dd></div>
      <div><dt>Uploaded files</dt><dd>{client.uploadedFileCount}</dd></div>
    </dl>
    <details><summary className="type-button">Archive this client</summary>
      <form action={action} aria-busy={pending} className="client-lifecycle-confirmation">
        <input name="profileId" type="hidden" value={client.profileId} />
        <label className="form-label" htmlFor="archive-confirmation-email">Type {client.email} to confirm</label>
        <input autoComplete="off" className="form-control" id="archive-confirmation-email" name="confirmationEmail" required type="email" />
        <button className="type-button client-lifecycle-danger__button" disabled={pending} type="submit">{pending ? "Archiving…" : "Archive client"}</button>
      </form>
    </details>
    {state.message && <InlineAlert variant={state.status === "success" ? "success" : state.status === "warning" ? "warning" : "error"}>{state.message}</InlineAlert>}
  </section>;
}

export function ArchivedClientControls({ client, recoverable }: { client: ArchivedClient; recoverable: boolean }) {
  const [restoreState, restoreAction, restoring] = useActionState(restoreClientAction, initial);
  const [deleteState, deleteAction, deleting] = useActionState(permanentlyDeleteClientAction, initial);
  return <div className="archived-client-controls">
    <form action={restoreAction}><input name="profileId" type="hidden" value={client.profileId} />
      <button className="type-button dashboard-primary-link" disabled={!recoverable || restoring} type="submit">{restoring ? "Restoring…" : "Restore client"}</button></form>
    <details><summary className="type-button">Permanent deletion</summary>
      <p className="type-supporting">Available only after the recovery period and explicit production safety enablement. This removes private files, documents, assessments and the client Auth account.</p>
      <form action={deleteAction} className="client-lifecycle-confirmation">
        <input name="profileId" type="hidden" value={client.profileId} />
        <label className="form-label" htmlFor={`delete-${client.profileId}`}>Type {client.email} to confirm permanent deletion</label>
        <input autoComplete="off" className="form-control" id={`delete-${client.profileId}`} name="confirmationEmail" required type="email" />
        <button className="type-button client-lifecycle-danger__button" disabled={recoverable || deleting} type="submit">{deleting ? "Deleting…" : "Permanently delete"}</button>
      </form>
    </details>
    {restoreState.message && <InlineAlert variant={restoreState.status === "success" ? "success" : "error"}>{restoreState.message}</InlineAlert>}
    {deleteState.message && <InlineAlert variant={deleteState.status === "success" ? "success" : deleteState.status === "warning" ? "warning" : "error"}>{deleteState.message}</InlineAlert>}
  </div>;
}
