import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FIELD_LEVEL_XP, PRESTIGE_STARS, fieldProgress, prestigeThreshold } from '../../game/catalog.ts'
import { FieldBadge, LevelUpCard } from './FieldBadge.tsx'
import { formatUnlockNames, nextUnlockLine, unlocksAtLevel } from './levelUnlocks.ts'

describe('next unlock line', () => {
  it('caps the names at three and appends +N', () => {
    expect(formatUnlockNames(['Apron', 'Taxiway', 'Stand'])).toBe('Apron · Taxiway · Stand')
    expect(formatUnlockNames(['Apron', 'Taxiway', 'Stand', 'Tower', 'Helipad'])).toBe(
      'Apron · Taxiway · Stand +2',
    )
    expect(formatUnlockNames([])).toBe('')
  })

  it('names the next prestige star at level 10 and goes blank at max prestige', () => {
    const atTen = fieldProgress(FIELD_LEVEL_XP[10])
    expect(atTen.level).toBe(10)
    expect(nextUnlockLine(atTen)).toBe('Prestige star P1')
    expect(nextUnlockLine(atTen)).not.toContain(unlocksAtLevel(10)[0]?.name ?? 'missing')
    const maxed = fieldProgress(prestigeThreshold(PRESTIGE_STARS))
    expect(maxed.nextLabel).toBe('max')
    expect(nextUnlockLine(maxed)).toBe('')
  })
})

describe('FieldBadge', () => {
  it('renders level-2 names on a level-1 badge without opening Growth', () => {
    const progress = fieldProgress(89)
    expect(progress.level).toBe(1)
    expect(progress.xp).toBeLessThan(90)
    const html = renderToStaticMarkup(
      <FieldBadge progress={progress} points={() => '0 RP'} title="Field Lv 1" onOpen={() => {}} />,
    )
    const line = nextUnlockLine(progress)
    expect(line).toBe(formatUnlockNames(unlocksAtLevel(2).map((row) => row.name)))
    expect(line.length).toBeGreaterThan(0)
    expect(html).toContain('data-testid="field-level"')
    expect(html).toContain('data-testid="field-next"')
    expect(html).toContain(line)
    expect(html).toContain('type="button"')
    expect(html).not.toContain('data-testid="field-levels"')
  })

  it('renders the next prestige star at level 10 and no line at max prestige', () => {
    const atTen = renderToStaticMarkup(
      <FieldBadge
        progress={fieldProgress(FIELD_LEVEL_XP[10])}
        points={() => '12 RP'}
        title="Field Lv 10"
        onOpen={() => {}}
      />,
    )
    expect(atTen).toContain('Prestige star P1')
    for (const row of unlocksAtLevel(10)) expect(atTen).not.toContain(row.name)

    const maxed = renderToStaticMarkup(
      <FieldBadge
        progress={fieldProgress(prestigeThreshold(PRESTIGE_STARS))}
        points={() => '12 RP'}
        title="Field Lv 10"
        onOpen={() => {}}
      />,
    )
    expect(maxed).not.toContain('data-testid="field-next"')
    expect(maxed).not.toContain('Prestige star')
  })

  it('leaves the level-up card as the full list', () => {
    const html = renderToStaticMarkup(<LevelUpCard level={2} onClose={() => {}} onProgression={() => {}} />)
    for (const row of unlocksAtLevel(2)) expect(html).toContain(row.name)
    expect(html).toContain('Open Progression')
    expect(html).not.toContain('data-testid="field-next"')
  })
})
