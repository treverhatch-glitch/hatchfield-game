import { money } from '../game/catalog.ts'
import { PREMIUM_RULES, premiumBoard, type PremiumItemId, type PremiumState } from '../premium/index.ts'

/** The slice of Game this panel reads. It stays inside the bottom chrome. */
export interface PremiumPanelGame {
  fieldLevel(): number
  hasCtScanners(): boolean
  deskStaff: number
  premium: PremiumState
  buyPremium(id: PremiumItemId): boolean
  hirePremiumOfficer(): boolean
  setPremiumFee(on: boolean): void
}

/**
 * Side-panel body for premium check-in and fast-track.
 * The parent chrome is the Cities: Skylines rollout; this section does not cover the field.
 */
export function PremiumPanel({ game }: { game: PremiumPanelGame }) {
  const board = premiumBoard(
    game.premium,
    { security_officer: game.premium.securityOfficers, terminal_staff: game.deskStaff },
    { fieldLevel: game.fieldLevel(), hasCt: game.hasCtScanners() },
  )
  return (
    <section className="premium-panel" data-testid="premium-panel">
      <p className="muted">
        Business, first, premium, and VIP passengers use these when they are open. Economy stays in the
        general line. Officers come off the shared roster. An idle lane still costs its upkeep.
      </p>
      <p className="muted">
        Field level {game.fieldLevel()}
        {game.hasCtScanners() ? ' · CT scanners online' : ' · no CT scanners'}
        {' · '}
        {board.officers} officer{board.officers === 1 ? '' : 's'}
        {' · '}
        {game.deskStaff} desk agent{game.deskStaff === 1 ? '' : 's'}
        {' · '}
        upkeep {money(board.upkeepPerDay)}/day
        {board.lanesOpen ? ` · ${board.lanesOpen} lane${board.lanesOpen === 1 ? '' : 's'} open` : ''}
        {board.vipOpen ? ' · private room open' : ''}
      </p>
      <div className="row">
        <button type="button" onClick={() => game.hirePremiumOfficer()}>
          Hire officer {money(PREMIUM_RULES.officerHireCost)}
        </button>
        <button type="button" onClick={() => game.setPremiumFee(!board.feeEnabled)}>
          {board.feeEnabled ? `Fast-track fee on ${money(board.feeAmount)}` : `Fast-track fee off`}
        </button>
      </div>
      {board.rows.map((row) => (
        <section key={row.id}>
          <h3>
            {row.name}
            {row.owned ? ` · ${row.owned} built` : ''}
            {row.open ? ` · ${row.open} staffed` : ''}
          </h3>
          <p className="muted">
            {row.blurb} Unlocks at field level {row.unlockFieldLevel}. {money(row.cost)} to build,{' '}
            {money(row.upkeepPerDay)}/day, {row.staff} {row.staffRole}
            {row.staff === 1 ? '' : 's'}
            {row.throughputPerHour > 0 ? `, ${row.throughputPerHour} pax/hr` : ''}
            {row.needsCt ? ', needs CT' : ''}.
          </p>
          <button
            type="button"
            className="wide"
            disabled={row.reason != null}
            onClick={() => game.buyPremium(row.id)}
          >
            {row.reason ?? `Build ${row.name} · ${money(row.cost)}`}
          </button>
        </section>
      ))}
    </section>
  )
}
