export const PlanBadge = ({ plan }) => {
  // Trophy Daylight: paid plans wear the accent's muted shade with accent
  // text (deep sage in Day, indigo in Night); Enterprise is the ink pill.
  // No gradients.
  const styles = `
    .plan-badge {
      background-color: #ecefd6 !important;
      background-image: none !important;
      color: #5c6914 !important;
      border: 0 !important;
      border-radius: 999px !important;
      font-weight: 600 !important;
      box-shadow: inset 0 0 0 1px rgba(92, 105, 20, 0.2) !important;
    }
    .dark .plan-badge {
      background-color: #24234a !important;
      color: #a9a8ff !important;
      box-shadow: inset 0 0 0 1px rgba(169, 168, 255, 0.25) !important;
    }
    .plan-badge-enterprise {
      background-color: #16161d !important;
      color: #ffffff !important;
      box-shadow: inset 0 0 0 1px #16161d !important;
    }
    .dark .plan-badge-enterprise {
      background-color: #f2f1f6 !important;
      color: #16161d !important;
      box-shadow: inset 0 0 0 1px #f2f1f6 !important;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <Badge className={`plan-badge plan-badge-${plan}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    </>
  );
};
