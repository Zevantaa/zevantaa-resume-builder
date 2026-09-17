import { Card, SectionCard } from "./cards";
import {
  DataTable,
  TableBody,
  TableCell,
  TableContainer,
  TableEmptyState,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "./data-table";

export function CardTableStyleDemo() {
  return (
    <section className="layout-stack" aria-labelledby="card-table-demo-title">
      <div>
        <h2 className="type-heading-3 text-text" id="card-table-demo-title">
          Card and table preview
        </h2>
        <p className="type-supporting text-text-muted">
          Static examples for visual verification only.
        </p>
      </div>

      <div className="layout-grid sm:grid-cols-2">
        <Card>
          <h3 className="type-heading-4 text-text">Standard content card</h3>
          <p className="type-body text-text-muted">
            A shared surface for grouped application content.
          </p>
        </Card>
        <Card variant="compact">
          <p className="type-label text-text-muted">Compact information</p>
          <p className="type-heading-4 text-text">Example value</p>
        </Card>
      </div>

      <SectionCard
        title="Table presentation"
        description="Responsive table structure with static placeholder content."
      >
        <TableContainer>
          <DataTable caption="Example populated table">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Package</TableHeaderCell>
                <TableHeaderCell>Market</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Example client</TableCell>
                <TableCell>Regional package</TableCell>
                <TableCell>Domestic</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Sample profile</TableCell>
                <TableCell>Global package</TableCell>
                <TableCell>International</TableCell>
              </TableRow>
            </TableBody>
          </DataTable>
        </TableContainer>

        <div className="layout-stack">
          <h4 className="type-heading-4 text-text">Empty table</h4>
          <TableContainer>
            <DataTable caption="Example empty table">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Package</TableHeaderCell>
                  <TableHeaderCell>Market</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmptyState
                  colSpan={3}
                  title="No records yet"
                  description="Table content will appear here when available."
                />
              </TableBody>
            </DataTable>
          </TableContainer>
        </div>
      </SectionCard>
    </section>
  );
}
