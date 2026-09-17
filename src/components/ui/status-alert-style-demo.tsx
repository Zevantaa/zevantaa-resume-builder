import { AlertPanel, InlineAlert, StatusBadge } from "./status-alert";

export function StatusAlertStyleDemo() {
  return (
    <section className="layout-stack" aria-labelledby="status-alert-demo-title">
      <div>
        <h2 className="type-heading-3 text-text" id="status-alert-demo-title">
          Status and alert preview
        </h2>
        <p className="type-supporting text-text-muted">
          Static variants for visual verification only.
        </p>
      </div>

      <div className="layout-cluster" aria-label="Status badge examples">
        <StatusBadge variant="success">Complete</StatusBadge>
        <StatusBadge variant="warning">Needs review</StatusBadge>
        <StatusBadge variant="error">Action required</StatusBadge>
        <StatusBadge variant="information">In progress</StatusBadge>
        <StatusBadge>Not started</StatusBadge>
      </div>

      <InlineAlert variant="information">
        This is a reusable informational message.
      </InlineAlert>
      <InlineAlert variant="error">
        This example requires attention before continuing.
      </InlineAlert>

      <AlertPanel variant="warning" title="Review recommended">
        Confirm the information before moving to the next step.
      </AlertPanel>
    </section>
  );
}
