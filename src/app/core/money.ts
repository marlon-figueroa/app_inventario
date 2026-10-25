export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
