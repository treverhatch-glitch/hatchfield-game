import type { Game } from '../../game/sim'
import { moneyAbbrev } from '../moneyFormat'
import { assetById } from './AssetMenu'
import { getUiState } from '../uiStore'

export function ToolOptions({
  game,
  onCancel,
}: {
  game: Game
  onCancel: () => void
}) {
  const { tool, assetId, openMenu } = getUiState()
  if (tool === 'pan' || openMenu) return null
  const asset = assetById(assetId)
  const stand = tool === 'stand' || tool === 'stand_s' || tool === 'stand_l'
  const park = tool === 'park_s' || tool === 'park_l' || tool === 'park_g' || tool === 'park_u'
  const label = tool === 'clear' ? 'Bulldoze' : (asset?.name ?? tool)

  return (
    <div className="hf-tools" data-hud-part="tools" data-testid="tool-options" role="toolbar" aria-label="Tool options">
      <strong>{label}</strong>
      {asset ? (
        <span className="hf-muted" data-money-unit="day">
          {moneyAbbrev(asset.cost)} · upkeep {moneyAbbrev(asset.upkeepPerDay)}/day
        </span>
      ) : (
        <span className="hf-muted">Refunds part of the stamp</span>
      )}
      <button type="button" onClick={() => game.rotatePiece()}>
        Rotate {game.facing === 'h' ? 'H' : 'V'}
      </button>
      <span className="hf-muted" title="Stamps sit on the cell grid">
        Snap on
      </span>
      <span className="hf-muted" title="This field is flat">
        Elev 0
      </span>
      {game.news[0]?.tone === 'bad' ? (
        <span className="hf-bad" role="status">
          {game.news[0].text}
        </span>
      ) : null}
      {stand ? (
        <>
          <button
            type="button"
            className={game.standAccessMode === 'remote' ? 'on' : ''}
            onClick={() => game.setStandAccessMode('remote')}
          >
            Remote
          </button>
          <button
            type="button"
            className={game.standAccessMode === 'jetway' ? 'on' : ''}
            onClick={() => game.setStandAccessMode('jetway')}
          >
            Jetway
          </button>
        </>
      ) : null}
      {park ? (
        <>
          <button
            type="button"
            className={game.parkTerm === 'short' ? 'on' : ''}
            onClick={() => game.setParkTerm('short')}
          >
            Short
          </button>
          <button
            type="button"
            className={game.parkTerm === 'long' ? 'on' : ''}
            onClick={() => game.setParkTerm('long')}
          >
            Long
          </button>
        </>
      ) : null}
      {asset && !game.sandbox && game.cash < asset.cost ? (
        <span className="hf-bad">Short on cash</span>
      ) : null}
      <button type="button" className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
