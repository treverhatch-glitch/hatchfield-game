import { useEffect } from 'react'
import { simClockToHour } from '../render/world/daylight.ts'
import { cameraSession } from '../camera/session.ts'
import type { Game } from '../game/sim.ts'
import type { Speed } from '../game/types.ts'
import { closeMapDetail, closeMapView, mapViewSnapshot } from '../info/session.ts'
import { nextEscape } from '../input/escape.ts'
import { cancelHallTool, hallToolActive, rotateHallTool } from '../input/hallTools.ts'
import { inputMap } from '../input/map.ts'
import { pauseState } from './pauseState.ts'

/** One listener for every press action. Hold actions are sampled by the cameras. */
export function PlayInput({ game }: { game: Game }) {
  useEffect(() => {
    inputMap.attach()
    return () => inputMap.detach()
  }, [])

  useEffect(() => {
    return inputMap.onPress((id) => {
      if (pauseState.open && id !== 'ui.back' && id !== 'ui.menu') return
      if (id === 'ui.menu') {
        pauseState.toggle()
        return
      }
      if (id === 'ui.back') {
        const view = mapViewSnapshot()
        const step = nextEscape({
          menuOpen: pauseState.open,
          cameraCaptured: cameraSession.frozen || cameraSession.following,
          toolActive: hallToolActive() || game.tool !== 'pan',
          infoDetailOpen: view.detail,
          infoViewOpen: view.active != null,
        })
        if (step === 'close-menu') pauseState.close()
        else if (step === 'release-camera') cameraSession.noteEscape()
        else if (step === 'cancel-tool') {
          if (hallToolActive()) cancelHallTool()
          else game.setTool('pan')
        } else if (step === 'close-info-detail') {
          closeMapDetail()
          if (view.active === 'traffic') game.closeLandside()
          if (view.active === 'fuel') game.closeFuelFarm()
        } else if (step === 'close-info') {
          if (view.active === 'traffic') game.closeLandside()
          if (view.active === 'fuel') game.closeFuelFarm()
          closeMapView()
        } else pauseState.openMenu()
        return
      }
      if (id === 'tool.rotate') {
        if (game.view === 'hall') rotateHallTool()
        else game.rotatePiece()
        return
      }
      if (id === 'view.hall') {
        game.setView(game.view === 'hall' ? 'apron' : 'hall')
        return
      }
      if (id === 'view.photo') {
        cameraSession.togglePhoto(simClockToHour(game.clock))
        return
      }
      if (id === 'view.flows') {
        game.toggleFlows()
        return
      }
      if (id === 'speed.pause') {
        game.setSpeed(game.speed === 0 ? 1 : 0)
        return
      }
      if (id === 'speed.1' || id === 'speed.3' || id === 'speed.5') {
        const speed = Number(id.slice('speed.'.length)) as Speed
        game.setSpeed(speed)
        return
      }
      if (id === 'ui.select' && game.hover && game.view === 'apron') {
        game.clickTile(game.hover)
      }
    })
  }, [game])

  return null
}
