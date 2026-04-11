export function formatCLP(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("es-CL");
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatSignedCLP(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("es-CL");
  return amount >= 0 ? `+$${formatted}` : `-$${formatted}`;
}
