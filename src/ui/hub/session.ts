/** Which carrier's hub profile is expanded. The manage panel itself stays open. */
let profileId: string | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeHubProfile(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Empty while no profile is expanded. */
export function hubProfileSnapshot(): string {
  return profileId ?? ''
}

export function hubProfileId(): string | null {
  return profileId
}

export function isHubProfileOpen(): boolean {
  return profileId != null
}

export function openHubProfile(id: string) {
  profileId = profileId === id ? null : id
  emit()
}

export function closeHubProfile() {
  if (profileId == null) return
  profileId = null
  emit()
}

export function resetHubProfile() {
  profileId = null
  emit()
}
