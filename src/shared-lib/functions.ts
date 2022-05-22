export function sumWithMaxPrecision(a: number, b: number): number {
  const aSplit = `${a}`.split('.')
  const bSplit = `${b}`.split('.')
  const precision = Math.max(
    (aSplit[1] || aSplit[0]).length,
    (bSplit[1] || bSplit[0]).length,
  )
  return +(a + b).toFixed(precision)
}

export function getRandomFromList(list) {
  return list[Math.floor(Math.random() * list.length)]
}

export function absPercentageChange(v1: number, v2: number): number {
  // |100 x (v2 - v1) / |v1||
  return f2(Math.abs(100 * (v2 - v1) / Math.abs(v1)))
}

export function f2(n: number): number {
  return +n.toFixed(2)
}
