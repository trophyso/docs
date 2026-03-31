export const RateLimitBadge = ({ tier, noTooltip = false }) => {
  const getColor = (tier) => {
    switch (tier) {
      case 1:
        return "yellow";
      case 2:
        return "green";
      default:
        return "gray";
    }
  };

  const getLimit = (tier) => {
    switch (tier) {
      case 1:
        return 10;
      case 2:
        return 100;
    }
  };

  return (
    noTooltip ? (
      <Badge stroke color={getColor(tier)}>Nivel {tier}</Badge>
    ) : (
      <Tooltip
        headline="Rate Limit"
        tip={`Este endpoint tiene un límite de velocidad de ${getLimit(tier)} req/s`}
        cta="Aprende sobre el límite de solicitudes" href="/es/api-reference/rate-limiting"
      >
        <Badge stroke color={getColor(tier)}>Nivel {tier}</Badge>
      </Tooltip>
    )
  );
};
