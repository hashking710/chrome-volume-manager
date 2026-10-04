import type { VolumeState } from './interfaces/Message'

export function createVolumeState (
  value = 1,
  captured = false,
  lastAudibleValue = value > 0 ? value : 1
): VolumeState {
  return { captured, value, lastAudibleValue }
}

export function setVolumeState (state: VolumeState, value: number): VolumeState {
  return {
    captured: state.captured,
    value,
    lastAudibleValue: value > 0 ? value : state.lastAudibleValue
  }
}

export function muteToggleValue (currentValue: number, lastAudibleValue: number): number {
  return currentValue === 0 ? lastAudibleValue : 0
}
