import { SelectField, TextInput } from "@/components/ui";

import type { AdminProfileInput } from "./admin-profile-validation";
import type { PackageAssignmentOption } from "./client-account-types";

export function AdminProfileFields({
  values,
  packages,
  errors,
}: {
  values: AdminProfileInput;
  packages: PackageAssignmentOption[];
  errors?: Partial<Record<keyof AdminProfileInput, string>>;
}) {
  return (
    <div className="client-contact-grid">
      <TextInput id="admin-full-name" name="fullName" label="Full name" required maxLength={120}
        defaultValue={values.fullName} error={errors?.fullName} />
      <TextInput id="admin-email" name="email" label="Primary email / login username" required type="email" maxLength={254}
        defaultValue={values.email} error={errors?.email}
        helperText="The client's Auth login email and profile email are kept in sync." />
      <TextInput id="admin-mobile" name="mobileNumber" label="Mobile number" required type="tel" maxLength={32}
        defaultValue={values.mobileNumber} error={errors?.mobileNumber} />
      <TextInput id="admin-whatsapp" name="whatsappNumber" label="WhatsApp number (optional)" type="tel" maxLength={32}
        defaultValue={values.whatsappNumber} error={errors?.whatsappNumber} />
      <TextInput id="admin-linkedin" name="linkedinUrl" label="LinkedIn profile URL (optional)" type="url" maxLength={2048}
        defaultValue={values.linkedinUrl} error={errors?.linkedinUrl} />
      <TextInput id="admin-location" name="currentLocation" label="Current location" required maxLength={160}
        defaultValue={values.currentLocation} error={errors?.currentLocation} />
      <SelectField id="admin-relocation" name="relocationPreference" label="Relocation preference" required
        defaultValue={values.relocationPreference} error={errors?.relocationPreference}>
        <option value="not-specified">Not specified yet</option>
        <option value="open">Open to relocation</option>
        <option value="conditional">Open under certain conditions</option>
        <option value="not-open">Not open to relocation</option>
      </SelectField>
      <SelectField id="admin-package" name="packageCode" label="Assigned package" required
        defaultValue={values.packageCode} error={errors?.packageCode}>
        <option value="">Select a package</option>
        {packages.map((item) => <option key={item.code} value={item.code}>{item.displayName}</option>)}
      </SelectField>
    </div>
  );
}
