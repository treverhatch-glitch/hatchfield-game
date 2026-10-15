/** Pause sheet. Opening it does not change the clock speed; the play loop skips ticks. */

export type PausePage = 'main' | 'settings' | 'load' | 'save'
export type SettingsTab = 'game' | 'controls'

export interface PauseSnap {
  open: boolean
  page: PausePage
  settingsTab: SettingsTab
  note: string
}

const CLOSED: PauseSnap = { open: false, page: 'main', settingsTab: 'game', note: '' }

class PauseState {
  private snap: PauseSnap = CLOSED
  private listeners = new Set<() => void>()

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): PauseSnap => this.snap

  get open(): boolean {
    return this.snap.open
  }

  openMenu() {
    if (this.snap.open) return
    this.replace({ open: true, page: 'main', settingsTab: 'game', note: '' })
  }

  close() {
    if (!this.snap.open) return
    this.replace({ ...this.snap, open: false, note: '' })
  }

  toggle() {
    if (this.snap.open) this.close()
    else this.openMenu()
  }

  showSettings(tab: SettingsTab = 'game') {
    this.replace({ open: true, page: 'settings', settingsTab: tab, note: '' })
  }

  showLoad() {
    this.replace({ open: true, page: 'load', settingsTab: this.snap.settingsTab, note: '' })
  }

  showSave() {
    this.replace({ open: true, page: 'save', settingsTab: this.snap.settingsTab, note: '' })
  }

  setTab(tab: SettingsTab) {
    if (this.snap.settingsTab === tab) return
    this.replace({ ...this.snap, settingsTab: tab })
  }

  back() {
    this.replace({ ...this.snap, page: 'main', note: '' })
  }

  setNote(note: string) {
    this.replace({ ...this.snap, note })
  }

  private replace(next: PauseSnap) {
    this.snap = next
    for (const fn of this.listeners) fn()
  }
}

export const pauseState = new PauseState()
