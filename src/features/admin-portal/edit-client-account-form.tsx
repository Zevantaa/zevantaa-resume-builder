"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert, SelectField } from "@/components/ui";

import type { ProvisionedClientDetail } from "./client-account-types";
import { initialEditClientAccountFormState } from "./client-account-types";
import { editClientAccountAction } from "./edit-client-account-action";
import { AdminProfileFields } from "./admin-profile-fields";

export function EditClientAccountForm({
  client,
}: {
  client: ProvisionedClientDetail;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    editClientAccountAction,
    initialEditClientAccountFormState,
  );
  const [accountStatus, setAccountStatus] = useState(client.accountStatus);
  const requiresDeactivationConfirmation =
    client.accountStatus === "active" && accountStatus === "disabled";

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status, state.saveRevision]);

  return (
    <form action={formAction} aria-busy={isPending} className="client-account-form">
      <input name="userId" type="hidden" value={client.userId} />

      {state.message ? (
        <InlineAlert variant={state.status === "success" ? "success" : "error"}>
          {state.message}
        </InlineAlert>
      ) : null}

      <AdminProfileFields key={JSON.stringify([client.fullName, client.email, client.mobileNumber,
        client.whatsappNumber, client.linkedinUrl, client.currentLocation,
        client.relocationPreference, client.packageCode])}
        packages={client.packages} errors={state.fieldErrors}
        values={{
          fullName: client.fullName,
          email: client.email,
          mobileNumber: client.mobileNumber,
          whatsappNumber: client.whatsappNumber,
          linkedinUrl: client.linkedinUrl,
          currentLocation: client.currentLocation,
          relocationPreference: client.relocationPreference,
          packageCode: client.packageCode,
        }} />

      <SelectField
        error={state.fieldErrors?.accountStatus}
        id="account-status"
        label="Account status"
        name="accountStatus"
        onChange={(event) =>
          setAccountStatus(
            event.target.value === "disabled" ? "disabled" : "active",
          )
        }
        required
        value={accountStatus}
      >
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </SelectField>

      {requiresDeactivationConfirmation ? (
        <div className="deactivation-confirmation">
          <label className="type-body" htmlFor="confirm-deactivation">
            <input
              aria-describedby="confirm-deactivation-help"
              id="confirm-deactivation"
              name="confirmDeactivation"
              required
              type="checkbox"
            />
            <span>
              Confirm that client portal access should be disabled. The Auth
              user, candidate profile and historical data will not be deleted.
            </span>
          </label>
          {state.fieldErrors?.confirmation ? (
            <p className="type-supporting form-error" id="confirm-deactivation-help">
              Error: {state.fieldErrors.confirmation}
            </p>
          ) : null}
        </div>
      ) : null}

      <button className="type-button auth-submit" disabled={isPending} type="submit">
        {isPending ? "Saving changes…" : "Save client account"}
      </button>
    </form>
  );
}
