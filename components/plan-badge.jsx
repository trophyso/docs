export const PlanBadge = ({ plan }) => {
  const styles = `
    .plan-badge {
      background-color: #f0fdf4 !important;
      background-image: linear-gradient(to bottom right, #bbf7d0, #f0fdf4, #bbf7d0) !important;
      color: #4cc74a !important;
      border: 0 !important;
      font-weight: 500 !important;
      box-shadow: inset 0 0 0 1px rgba(78, 200, 76, 0.4) !important;
    }
    .plan-badge-business {
      box-shadow: inset 0 0 0 1px #4cc74a !important;
    }
    .plan-badge-enterprise {
      background-color: #000000 !important;
      background-image: linear-gradient(to bottom right, #737373, #000000, #737373) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      box-shadow: inset 0 0 0 1px #000000 !important;
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
