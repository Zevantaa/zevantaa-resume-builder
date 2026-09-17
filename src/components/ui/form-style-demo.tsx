import { SelectField, TextareaField, TextInput } from "./form-controls";

export function FormStyleDemo() {
  return (
    <form className="form-demo" aria-labelledby="form-demo-title">
      <div className="form-demo-header">
        <h2 className="type-heading-3 text-text" id="form-demo-title">
          Form style preview
        </h2>
        <p className="type-supporting text-text-muted">
          Static controls for visual verification only.
        </p>
      </div>

      <TextInput
        id="demo-name"
        label="Full name"
        placeholder="Enter full name"
        required
      />
      <TextInput
        id="demo-email"
        type="email"
        label="Email address"
        placeholder="name@example.com"
        helperText="Use the client’s primary email address."
      />
      <TextInput
        id="demo-phone"
        type="tel"
        label="Phone number"
        defaultValue="+91 00000 00000"
        helperText="Disabled control example."
        disabled
      />
      <SelectField id="demo-market" label="Target market" defaultValue="">
        <option value="" disabled>
          Select a market
        </option>
        <option value="domestic">Indian Domestic Market</option>
        <option value="gcc">GCC and Middle East Market</option>
        <option value="europe">Europass and European Union Market</option>
      </SelectField>
      <TextareaField
        id="demo-summary"
        label="Professional summary"
        placeholder="Add a concise professional summary"
        error="A professional summary is required."
      />
    </form>
  );
}
