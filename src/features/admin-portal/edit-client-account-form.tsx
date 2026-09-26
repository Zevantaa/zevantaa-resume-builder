"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert, SelectField, TextInput } from "@/components/ui";

import type { ProvisionedClientDetail } from "./client-account-types";
import { initialEditClientAccountFormState } from "./client-account-types";
import { editClientAccountAction } from "./edit-client-account-action";

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
  }, [router, state.status]);

  return (
    <form action={formAction} className="client-account-form">
      <input name="userId" type="hidden" value={client.userId} />

      {state.message ? (
        <InlineAlert variant={state.status === "success" ? "success" : "error"}>
          {state.message}
        </InlineAlert>
      ) : null}

      <TextInput
        autoComplete="email"
        defaultValue={client.email}
        error={state.fieldErrors?.email}
        helperText="Updates both the Supabase Auth sign-in and linked candidate email."
        id="client-email"
        label="Client email"
        name="email"
        required
        type="email"
      />

      <SelectField
        defaultValue={client.packageCode}
        error={state.fieldErrors?.packageCode}
        id="package-code"
        label="Assigned package"
        name="packageCode"
        required
      >
        {client.packages.map((packageOption) => (
          <option key={packageOption.code} value={packageOption.code}>
            {packageOption.displayName}
          </option>
        ))}
      </SelectField>

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
