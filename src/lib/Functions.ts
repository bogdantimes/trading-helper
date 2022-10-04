import { PriceMove } from "./Types";

export function getPrecision(a: number): number {
  if (!isFinite(a)) return 0;
  let e = 1;
  let p = 0;
  while (Math.round(a * e) / e !== a) {
    e *= 10;
    p++;
  }
  return p;
}

export function floor(value: number, decimals: number): number {
  return +`${Math.floor(Number(`${value}e+${decimals}`))}e-${decimals}`;
}

export function sumWithMaxPrecision(a: number, b: number): number {
  const aSplit = `${a}`.split(`.`);
  const bSplit = `${b}`.split(`.`);
  const precision = Math.max(
    (aSplit[1] || aSplit[0]).length,
    (bSplit[1] || bSplit[0]).length
  );
  return +(a + b).toFixed(precision);
}

export function getRandomFromList<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function absPercentageChange(v1: number, v2: number): number {
  // |100 x (v2 - v1) / |v1||
  return f2(Math.abs((100 * (v2 - v1)) / Math.abs(v1)));
}

export function f0(n: number): number {
  return +n.toFixed(0);
}

export function f2(n: number): number {
  return +n.toFixed(2);
}

export function f8(n: number): number {
  return +n.toFixed(8);
}

/**
 * Returns the number of consecutive prices that are increasing.
 * The result is negative if prices are decreasing.
 * @example [3, 2, 1] => -2
 * @example [2, 2, 1] => -1
 * @example [1, 2, 2] => 0
 * @example [2, 2, 3] => 1
 * @example [1, 2, 3] => 2
 * @param prices
 */
export function getPriceChangeIndex(prices: number[]): number {
  let result = 0;
  // if next price greater than current price, increase result
  // otherwise decrease result
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      result++;
    } else if (prices[i] < prices[i - 1]) {
      result--;
    }
  }
  return result;
}

export function getPriceMove(maxCapacity: number, prices: number[]): PriceMove {
  const index = getPriceChangeIndex(prices);
  return +(
    ((index + maxCapacity) / (2 * maxCapacity)) *
    PriceMove.STRONG_UP
  ).toFixed(0);
}

export function enumKeys<T>(enumType: any): T[] {
  return Object.keys(enumType).filter((k) =>
    isNaN(Number(k))
  ) as unknown as T[];
}

export interface ExecParams {
  context?: any;
  runnable: (arg0: any) => any;
  interval?: number;
  attempts?: number;
}

export const INTERRUPT = `INTERRUPT`;
export const SERVICE_LIMIT = `Service invoked too many times`;

export function execute({
  context,
  runnable,
  interval = 500,
  attempts = 5,
}: ExecParams): any {
  let err: Error | any;
  do {
    try {
      err = null;
      return runnable(context);
    } catch (e: any) {
      err = e;
      if (e.message.includes(INTERRUPT) || e.message.includes(SERVICE_LIMIT)) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval);
    }
  } while (--attempts > 0);

  if (err) {
    throw err;
  }
}
