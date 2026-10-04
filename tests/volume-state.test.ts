import { describe, expect, it } from 'vitest'
import { createVolumeState, muteToggleValue, setVolumeState } from '../src/volume-state'

describe('volume mute state', () => {
  it('restores the last audible value after reopening the popup', () => {
    let tabState = createVolumeState(1.4, true)
    tabState = setVolumeState(tabState, 0)

    const restoredValue = muteToggleValue(tabState.value, tabState.lastAudibleValue)
    expect(restoredValue).toBe(1.4)

    tabState = setVolumeState(tabState, restoredValue)
    expect(muteToggleValue(tabState.value, tabState.lastAudibleValue)).toBe(0)
    expect(tabState.lastAudibleValue).toBe(1.4)
  })

  it('starts muted at the default audible level and remembers new non-zero values', () => {
    let tabState = createVolumeState(0, true)
    expect(muteToggleValue(tabState.value, tabState.lastAudibleValue)).toBe(1)

    tabState = setVolumeState(tabState, 2.25)
    tabState = setVolumeState(tabState, 0)

    expect(tabState.lastAudibleValue).toBe(2.25)
    expect(muteToggleValue(tabState.value, tabState.lastAudibleValue)).toBe(2.25)
  })
})
