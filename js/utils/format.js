
export function formatMoney(number) {
  return Number(number).toFixed(2);
}

// Turn an ISO date string into a short, readable date.
export function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
