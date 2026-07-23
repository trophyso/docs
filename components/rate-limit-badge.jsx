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
        return 5;
      case 2:
        return 50;
    }
  };

  return (
    noTooltip ? (
      <Badge stroke color={getColor(tier)}>Tier {tier}</Badge>
    ) : (
      <Tooltip
        headline="Rate Limit"
        tip={`This endpoint is rate limited to ${getLimit(tier)} req/s`}
        cta="Learn about rate limiting" href="/api-reference/rate-limiting"
      >
        <Badge stroke color={getColor(tier)}>Tier {tier}</Badge>
      </Tooltip>
    )
  );
};
