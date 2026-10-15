/** One line for the schedule footer. Figures are the fuel desk's, not a second ledger. */
export function fuelFooterLine(input: {
  upliftLitres: number
  tankLitres: number
  tankCapacity: number
  supplier: string
}): { text: string; short: boolean } {
  const n = (v: number) => Math.max(0, Math.round(v)).toLocaleString('en-US')
  const uplift = Math.max(0, input.upliftLitres)
  const tank = Math.max(0, input.tankLitres)
  return {
    text: `Bank uplift ${n(uplift)} L · tank ${n(tank)} / ${n(input.tankCapacity)} L · ${input.supplier}`,
    short: uplift > 0 && tank + 1e-6 < uplift,
  }
}
