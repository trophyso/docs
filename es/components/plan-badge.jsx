export const PlanBadge = ({ plan }) => {
  return (
    <div>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '0.375rem',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          fontSize: '0.75rem',
          lineHeight: '1rem',
          fontWeight: plan === 'pro' ? '600' : '500',
          backgroundColor: plan === 'free' ? '#fefce8' : '#f0fdf4',
          color: plan === 'free' ? '#ca8a04' : '#4CC74A',
          boxShadow: plan === 'free' ? 'inset 0 0 0 1px rgba(200, 138, 4, 0.4)' : plan === 'starter' ? 'inset 0 0 0 1px rgba(78, 200, 76, 0.4)' : 'inset 0 0 0 1px #4CC74A',
          backgroundImage: plan === 'pro' ? 'linear-gradient(to bottom right, #bbf7d0, #f0fdf4, #bbf7d0)' : 'none',
        }}
      >
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </span>
    </div>
  );
};
