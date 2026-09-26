import Link from "next/link";

import {
  DataTable,
  StatusBadge,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@/components/ui";

import { listProvisionedClients } from "./client-account-service";

export async function ClientListPage() {
  const clients = await listProvisionedClients();

  return (
    <div className="dashboard-page">
      <div className="layout-container layout-stack">
        <header className="admin-page-header">
          <div>
            <p className="type-label text-text-muted">Admin portal</p>
            <h1 className="type-heading-1 text-text">Client accounts</h1>
            <p className="type-body text-text-muted">
              Open a provisioned client to manage access and package assignment.
            </p>
          </div>
          <Link
            className="type-button auth-submit auth-action-link"
            href="/admin/clients/new"
          >
            Create client account
          </Link>
        </header>

        <TableContainer>
          <DataTable caption="Provisioned client accounts">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Package</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableEmptyState
                  colSpan={5}
                  description="Create a client account to begin account administration."
                  title="No linked client accounts"
                />
              ) : (
                clients.map((client) => (
                  <TableRow key={client.userId}>
                    <TableCell>{client.fullName}</TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>{client.packageName}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          client.accountStatus === "active" ? "success" : "neutral"
                        }
                      >
                        {client.accountStatus === "active" ? "Active" : "Disabled"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="type-label admin-table-link"
                        href={`/admin/clients/${client.userId}/edit`}
                      >
                        Edit account
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </DataTable>
        </TableContainer>

        <Link className="type-label admin-table-link" href="/admin">
          Return to admin portal
        </Link>
      </div>
    </div>
  );
}
