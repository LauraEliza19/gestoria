export function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

export function formatCurrency(value) {
  return "R$ " + value.toLocaleString("pt-BR");
}

export function formatMoney(value) {
  return (
    "R$ " +
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function parsePriceBR(value) {
  if (!value) return 0;
  const cleaned = String(value)
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

export function formatDateBR(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonthYearLabel(isoString) {
  const date = new Date(isoString);
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}
