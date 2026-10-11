const KWACHA = /^\d{1,10}(\.\d{1,2})?$/;

/** '' is 0; whole kwacha or up to two decimals is the number; anything else (commas, signs, exponents) is null. */
export function parseKwacha(input: string): number | null {
  const s = input.trim();
  if (s === '') return 0;
  return KWACHA.test(s) ? Number(s) : null;
}

/** Sums in whole ngwee so 0.1 + 0.2 is 0.3. */
export const sumKwacha = (...amounts: number[]): number => amounts.reduce((total, n) => total + Math.round(n * 100), 0) / 100;
