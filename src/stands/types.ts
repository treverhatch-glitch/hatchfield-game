/** Footprint. The heavy pad is the only one that grows. */
export type StandSize = 'light' | 'narrow' | 'heavy'

/** 0 grass or hardstand, 1 everyday concrete, 2 the pad airlines ask for. */
export type StandRung = 0 | 1 | 2

export type FittingId =
  | 'jet_bridge'
  | 'gpu_pca'
  | 'apron_light'
  | 'deice_outlet'
  | 'flag'
  | 'alarm_bell'
  | 'line_office'

export type FittingHost = 'stand' | 'fire' | 'hangar' | 'fuel'

export interface Fitting {
  id: FittingId
  /** Written by migration. The player is not charged again. */
  granted?: 'legacy'
}
