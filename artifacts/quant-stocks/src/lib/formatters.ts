export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  
  const absValue = Math.abs(value);
  if (absValue >= 1e12) {
    return (value / 1e12).toFixed(2) + "T";
  }
  if (absValue >= 1e9) {
    return (value / 1e9).toFixed(2) + "B";
  }
  if (absValue >= 1e6) {
    return (value / 1e6).toFixed(2) + "M";
  }
  if (absValue >= 1e3) {
    return (value / 1e3).toFixed(2) + "K";
  }
  
  return formatNumber(value);
}

export function formatLargeCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  
  const absValue = Math.abs(value);
  if (absValue >= 1e12) {
    return "$" + (value / 1e12).toFixed(2) + "T";
  }
  if (absValue >= 1e9) {
    return "$" + (value / 1e9).toFixed(2) + "B";
  }
  if (absValue >= 1e6) {
    return "$" + (value / 1e6).toFixed(2) + "M";
  }
  if (absValue >= 1e3) {
    return "$" + (value / 1e3).toFixed(2) + "K";
  }
  
  return formatCurrency(value);
}
