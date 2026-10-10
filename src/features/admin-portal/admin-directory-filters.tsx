"use client";

import { useState } from "react";

import { V1_PACKAGE_DEFINITIONS } from "@/types/package";

import type { AdminDirectoryFilters } from "./admin-directory-model";

export function AdminDirectoryFilterForm({ base, filters }: { base: string; filters: AdminDirectoryFilters }) {
  const [submitting, setSubmitting] = useState(false);
  const invalidPackageFilter = !!filters.packageCode &&
    !V1_PACKAGE_DEFINITIONS.some((item) => item.code === filters.packageCode);
  return <form action={base} aria-busy={submitting} aria-label="Search and filter clients"
    className="admin-directory-filters" method="get" onSubmit={() => setSubmitting(true)}>
    <label><span className="type-label">Search clients</span>
      <input className="form-control" defaultValue={filters.search} maxLength={80} name="q"
        placeholder="Name, email, phone or LinkedIn" type="search" /></label>
    <label><span className="type-label">Package</span>
      <select className="form-control" defaultValue={filters.packageCode} name="package">
        <option value="">All packages</option>
        {invalidPackageFilter && <option value={filters.packageCode}>Unknown package filter</option>}
        {V1_PACKAGE_DEFINITIONS.map((item) => <option key={item.code} value={item.code}>{item.displayName}</option>)}
      </select></label>
    <label><span className="type-label">Resume status</span>
      <select className="form-control" defaultValue={filters.status} name="status">
        <option value="all">All statuses</option>
        <option value="needs-resume">Needs resume</option>
        <option value="under-review">Under review</option>
        <option value="reviewed">Reviewed/confirmed</option>
      </select></label>
    <button className="type-button dashboard-primary-link" disabled={submitting} type="submit">
      {submitting ? "Applying filters…" : "Apply filters"}
    </button>
    {submitting && <span className="type-supporting" role="status">Loading matching clients…</span>}
  </form>;
}
