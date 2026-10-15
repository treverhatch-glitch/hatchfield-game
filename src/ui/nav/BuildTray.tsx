import { useEffect, useRef, useState } from 'react'
import { BUILDINGS, TOOL_LABEL } from '../../game/catalog.ts'
import type { Tool } from '../../game/types.ts'
import { lateIdForTool, lateStampLabel } from '../../game/lateBuildings.ts'
import type { Game } from '../../game/sim.ts'
import { capstoneCost } from '../../progression/specializations.ts'
import { PROGRESSION_BUILDABLES } from '../../progression/unlocks.ts'
import { buildingById } from '../../tier3plus/index.ts'
import { requestKit } from './kitFocus.ts'
import { stampCard, toolStampInput, type StampCard, type UnlockLink } from './stampFacts.ts'
import { STAMP_HOVER_MS, type BuildMenu, type FurnishEntry } from './taxonomy.ts'

function TrayMark({ tool }: { tool: string }) {
  const kind = tool.includes('runway')
    ? 'strip'
    : tool === 'taxi' || tool === 'road' || tool === 'belt'
      ? 'path'
      : tool.startsWith('stand')
        ? 'stand'
        : tool === 'clear'
          ? 'clear'
          : tool.includes('hotel') ||
            tool.startsWith('park') ||
            tool === 'bus' ||
            tool === 'curb_lane' ||
            tool === 'taxi_rank' ||
            tool === 'rail' ||
            tool === 'rail_link'
            ? 'land'
            : 'ops'
  return (
    <svg className="tray-ico" viewBox="0 0 32 32" aria-hidden>
      {kind === 'strip' ? <rect x="3" y="13" width="26" height="6" rx="1" fill="currentColor" /> : null}
      {kind === 'path' ? <path d="M6 24 L16 8 L26 24" fill="none" stroke="currentColor" strokeWidth="2.4" /> : null}
      {kind === 'stand' ? <circle cx="16" cy="16" r="8" fill="none" stroke="currentColor" strokeWidth="2.4" /> : null}
      {kind === 'clear' ? <path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" strokeWidth="2.4" /> : null}
      {kind === 'land' ? <rect x="6" y="10" width="20" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="2" /> : null}
      {kind === 'ops' ? <rect x="8" y="8" width="16" height="16" rx="2" fill="currentColor" /> : null}
    </svg>
  )
}

function LockMark() {
  return (
    <svg className="lock-pad" viewBox="0 0 16 16" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor" />
      <path d="M5 7 V5 a3 3 0 0 1 6 0 V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function HoverCard({ card, onOpen }: { card: StampCard; onOpen: (link: UnlockLink) => void }) {
  return (
    <div className="stamp-card" data-testid="stamp-card" role="tooltip">
      <header>
        <strong>{card.name}</strong>
        <span>{card.price}</span>
      </header>
      {card.blurb ? <p>{card.blurb}</p> : null}
      <dl>
        <div>
          <dt>Upkeep</dt>
          <dd>{card.upkeep}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>{card.capacity}</dd>
        </div>
        <div>
          <dt>Noise</dt>
          <dd>{card.noise}</dd>
        </div>
      </dl>
      {card.badge?.kind === 'research' ? (
        <p className="stamp-research" data-testid="stamp-research">
          {card.badge.label}
        </p>
      ) : null}
      {card.sentence ? <p className="stamp-lock">{card.sentence}</p> : null}
      {card.link ? (
        <button type="button" data-testid="stamp-unlock" onClick={() => onOpen(card.link!)}>
          Open {card.link.label}
        </button>
      ) : null}
    </div>
  )
}

function StampSlot({
  testId,
  badgeId,
  mark,
  name,
  selected,
  card,
  onUse,
  onOpen,
}: {
  testId: string
  badgeId: string
  mark: string
  name: string
  selected: boolean
  card: StampCard
  onUse: () => void
  onOpen: (link: UnlockLink) => void
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), STAMP_HOVER_MS)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }
  return (
    <div className="tray-slot" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <button
        type="button"
        className={`tray-item${selected ? ' on' : ''}${card.locked ? ' is-locked' : ''}`}
        data-testid={testId}
        data-hover-ms={STAMP_HOVER_MS}
        onClick={() => {
          if (card.locked && card.link) onOpen(card.link)
          else onUse()
        }}
      >
        {card.badge?.kind === 'research' ? (
          <span
            className="lock-badge research-badge"
            data-testid={`research-badge-${card.badge.nodeId}`}
            aria-label={card.badge.label}
          >
            {card.badge.label}
          </span>
        ) : card.locked ? (
          <span className="lock-badge" data-testid={`lock-badge-${badgeId}`} aria-label={card.badge?.label ?? 'Locked'}>
            <LockMark />
          </span>
        ) : null}
        <TrayMark tool={mark} />
        <span className="tray-name">{name}</span>
        <span className="tray-price">{card.locked ? (card.badge?.label ?? 'Locked') : card.price}</span>
      </button>
      {open ? <HoverCard card={card} onOpen={onOpen} /> : null}
    </div>
  )
}

/**
 * Category is already chosen. This is the named sub-tab row and the thumbnail grid.
 */
export function BuildTray({
  game,
  menu,
  onOpen,
}: {
  game: Game
  menu: BuildMenu
  onOpen: (link: UnlockLink) => void
}) {
  const [groupId, setGroupId] = useState(menu.groups[0]?.id ?? '')
  const group = menu.groups.find((row) => row.id === groupId) ?? menu.groups[0]
  if (!group) return null
  const owned = new Set(game.researchGrants())
  const treeOwned = new Set(game.researchTree.state.unlocked)
  return (
    <div className="build-sheet">
      <div className="build-subtabs" data-testid="build-subtabs" role="tablist">
        {menu.groups.map((row) => (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={row.id === group.id}
            className={row.id === group.id ? 'on' : ''}
            data-testid={`build-group-${row.id}`}
            onClick={() => setGroupId(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>
      <div className="tools build-tray" data-testid="build-tray">
        {group.tools.map((tool) => (
          <ToolStamp key={tool} game={game} tool={tool} owned={owned} treeOwned={treeOwned} onOpen={onOpen} />
        ))}
        {(group.furnish ?? []).map((entry) => (
          <FurnishStamp key={entry.id} game={game} entry={entry} />
        ))}
        {PROGRESSION_BUILDABLES.filter((row) => group.progression.includes(row.id)).map((row) => (
          <ProgressStamp key={row.id} game={game} id={row.id} owned={owned} treeOwned={treeOwned} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

function ToolStamp({
  game,
  tool,
  owned,
  treeOwned,
  onOpen,
}: {
  game: Game
  tool: Tool
  owned: Set<string>
  treeOwned: Set<string>
  onOpen: (link: UnlockLink) => void
}) {
  const lateId = lateIdForTool(tool)
  const input = toolStampInput(tool, game.fieldLevel(), game.lateFieldLevel(), owned, treeOwned)
  if (lateId) {
    const spec = buildingById(lateId)
    input.name = lateStampLabel(lateId)
    input.blurb = spec?.purpose ?? input.blurb
    input.cost = spec?.cost ?? input.cost
    input.upkeepPerDay = spec?.dailyUpkeep ?? input.upkeepPerDay
  }
  const card = stampCard(input)
  const def = BUILDINGS.find((row) => row.tool === tool)
  const name = card.name || def?.name || TOOL_LABEL[tool as keyof typeof TOOL_LABEL] || tool
  return (
    <StampSlot
      testId={lateId ? `late-stamp-${lateId}` : `tray-${tool}`}
      badgeId={lateId ?? tool}
      mark={tool}
      name={name}
      selected={game.tool === tool}
      card={card}
      onOpen={onOpen}
      onUse={() => {
        if (lateId) game.toggleInfo(`late:${lateId}`)
        game.setTool(tool)
      }}
    />
  )
}

function FurnishStamp({ game, entry }: { game: Game; entry: FurnishEntry }) {
  const card: StampCard = {
    name: entry.label,
    blurb: game.fits.length ? 'Opens the hall kit on the first hall.' : 'Place a hall first.',
    price: 'Kit',
    upkeep: 'On the hall bill',
    capacity: '—',
    noise: '—',
    locked: false,
    badge: null,
    sentence: null,
    link: null,
  }
  return (
    <StampSlot
      testId={`tray-${entry.id}`}
      badgeId={entry.id}
      mark={entry.id}
      name={entry.label}
      selected={false}
      card={card}
      onOpen={() => {}}
      onUse={() => {
        const hall = game.fits[0]
        if (!hall) return
        requestKit(entry.kit)
        game.selectHall(hall)
      }}
    />
  )
}

function ProgressStamp({
  game,
  id,
  owned,
  treeOwned,
  onOpen,
}: {
  game: Game
  id: string
  owned: Set<string>
  treeOwned: Set<string>
  onOpen: (link: UnlockLink) => void
}) {
  const row = PROGRESSION_BUILDABLES.find((item) => item.id === id)
  if (!row) return null
  const cost = capstoneCost(row.cost, game.specPaths, row.id)
  const input = toolStampInput(id, game.fieldLevel(), game.lateFieldLevel(), owned, treeOwned)
  input.name = row.name
  input.blurb = row.blurb
  input.cost = cost
  input.upkeepPerDay = row.upkeepPerDay
  const card = stampCard(input)
  return (
    <StampSlot
      testId={`tray-${row.id}`}
      badgeId={row.id}
      mark={row.id}
      name={row.name}
      selected={row.id === 'hydrant' ? game.hydrantArm : game.progressionBuilt.includes(row.id)}
      card={card}
      onOpen={onOpen}
      onUse={() => game.commission(row.id)}
    />
  )
}
