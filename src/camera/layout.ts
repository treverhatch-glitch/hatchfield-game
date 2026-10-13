import { SIZE } from '../game/types.ts'
import { CELL } from '../render/aircraft/specs.ts'
import type { FieldLayout } from './types.ts'

/** Shared apron scale. The follow camera and the renderer use the same cell. */
export const FIELD_LAYOUT: FieldLayout = { cell: CELL, size: SIZE }
