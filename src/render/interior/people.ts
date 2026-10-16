/**
 * Hall crowd driver. PeopleRenderer is the only body, through HallNavCrowd.
 * The hall root stays at scale 1, so a person is a metre.
 */
import type * as THREE from 'three'
import type { HallNav } from '../../game/hallNav.ts'
import { HallNavCrowd } from '../hallNavCrowd.ts'

export class HallPeople {
  readonly crowd = new HallNavCrowd()
  readonly group: THREE.Group

  constructor() {
    this.group = this.crowd.group
    this.group.name = 'hall-people'
    this.group.userData.piece = 'person'
  }

  sync(nav: HallNav, clock: number, camera: THREE.Camera): number {
    return this.crowd.sync(nav, clock, camera)
  }

  lastPoses() {
    return this.crowd.lastPoses()
  }

  dispose() {
    this.crowd.dispose()
  }
}
