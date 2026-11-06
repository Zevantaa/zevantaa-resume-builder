type DashboardRouteLoadingProps = {
  portal: "administrator" | "client";
};

export function DashboardRouteLoading({ portal }: DashboardRouteLoadingProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="dashboard-page dashboard-route-loading"
      role="status"
    >
      <span className="sr-only">Loading {portal} workspace.</span>
      <div aria-hidden="true" className="route-skeleton route-skeleton--heading">
        <span className="route-skeleton__line route-skeleton__line--eyebrow" />
        <span className="route-skeleton__line route-skeleton__line--title" />
        <span className="route-skeleton__line route-skeleton__line--copy" />
      </div>
      <div aria-hidden="true" className="route-skeleton-grid">
        <span className="route-skeleton route-skeleton--card" />
        <span className="route-skeleton route-skeleton--card" />
        <span className="route-skeleton route-skeleton--card" />
      </div>
      <div aria-hidden="true" className="route-skeleton route-skeleton--panel">
        <span className="route-skeleton__line route-skeleton__line--section" />
        <span className="route-skeleton__line" />
        <span className="route-skeleton__line route-skeleton__line--short" />
      </div>
    </div>
  );
}
