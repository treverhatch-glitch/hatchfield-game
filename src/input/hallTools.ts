/** Hall placement owns its own tool state. The apron asks it before opening the menu. */

interface HallTools {
  active: () => boolean
  cancel: () => boolean
  rotate: () => boolean
}

const idle: HallTools = {
  active: () => false,
  cancel: () => false,
  rotate: () => false,
}

let tools: HallTools = idle

export function registerHallTools(next: HallTools): () => void {
  tools = next
  return () => {
    if (tools === next) tools = idle
  }
}

export function hallToolActive(): boolean {
  return tools.active()
}

export function cancelHallTool(): boolean {
  return tools.cancel()
}

export function rotateHallTool(): boolean {
  return tools.rotate()
}
