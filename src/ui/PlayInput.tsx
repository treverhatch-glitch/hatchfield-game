import { useEffect } from 'react'
import { faceHour } from '../core/faceClock.ts'
import { cameraSession } from '../camera/session.ts'
import type { Game } from '../game/sim.ts'
import type { Speed } from '../game/types.ts'
import { moreMenuSnapshot, setMoreMenu } from '../info/moreMenu.ts'
import { closeMapDetail, closeMapView, mapViewSnapshot } from '../info/session.ts'
import { nextEscape, numbersToClose } from '../input/escape.ts'
import { closeFlightCard, isFlightCardOpen, syncFlightCardClick } from './inspector/flightCard.ts'
import { schedulePillEscape, setSchedulePill } from './timetable/scheduleSheet.ts'
import { closeHubProfile, isHubProfileOpen } from './hub/session.ts'
import { cancelHallTool, hallToolActive, rotateHallTool } from '../input/hallTools.ts'
import { inputMap } from '../input/map.ts'
import { cueCanSkip } from '../render/viewCue'
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
        const linesOpen = game.infoOpen != null
        const menuOpen = moreMenuSnapshot()
        const step = nextEscape({
          menuOpen: pauseState.open,
          cameraCaptured: cameraSession.frozen || cameraSession.following,
          toolActive: hallToolActive() || game.tool !== 'pan',
          infoDetailOpen: view.detail || linesOpen || menuOpen,
          infoViewOpen: view.active != null,
          flightCardOpen: isFlightCardOpen(),
          assignOpen: game.assignPick != null || game.assignBulk,
          hubProfileOpen: isHubProfileOpen(),
          schedulePillOpen: schedulePillEscape(),
        })
        if (step === 'close-menu') pauseState.close()
        else if (step === 'release-camera') cameraSession.noteEscape()
        else if (step === 'cancel-tool') {
          if (hallToolActive()) cancelHallTool()
          else game.setTool('pan')
        } else if (step === 'close-info-detail') {
          const which = numbersToClose({
            infoLinesOpen: game.infoOpen != null,
            infoMenuOpen: moreMenuSnapshot(),
            infoDetailOpen: view.detail,
          })
          if (which === 'lines' && game.infoOpen) {
            game.toggleInfo(game.infoOpen)
            setMoreMenu(false)
          } else if (which === 'menu') {
            setMoreMenu(false)
          } else if (which === 'detail') {
            closeMapDetail()
            if (view.active === 'traffic') game.closeLandside()
            if (view.active === 'fuel') game.closeFuelFarm()
          }
        } else if (step === 'close-info') {
          if (view.active === 'traffic') game.closeLandside()
          if (view.active === 'fuel') game.closeFuelFarm()
          closeMapView()
        }         else if (step === 'close-flight-card') closeFlightCard()
        else if (step === 'close-assign') game.closeAssign()
        else if (step === 'close-hub-profile') closeHubProfile()
        else if (step === 'close-schedule') setSchedulePill(false)
        else pauseState.openMenu()
        return
      }
      if (id === 'tool.rotate') {
        if (game.view === 'hall') rotateHallTool()
        else game.rotatePiece()
        return
      }
      if (game.viewCue && cueCanSkip()) {
        game.setView(game.viewCue)
        return
      }
      if (id === 'view.hall') {
        game.askView(game.view === 'hall' ? 'apron' : 'hall')
        return
      }
      if (id === 'view.photo') {
        cameraSession.togglePhoto(faceHour(game.clock))
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
        const hover = game.hover
        const before = game.selectedFlight
        game.clickTile(hover)
        syncFlightCardClick(game, hover, before)
      }
    })
  }, [game])

  return null
}
