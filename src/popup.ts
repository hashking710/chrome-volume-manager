import type { PopupMessage } from './interfaces/Message'

const volumeSlider = requireElement(document.querySelector<HTMLInputElement>('#volume-slider'))
const volumeValue = requireElement(document.querySelector<HTMLElement>('#volume-value'))
const volumeDescription = requireElement(document.querySelector<HTMLElement>('#volume-description'))
const status = requireElement(document.querySelector<HTMLElement>('#status'))
const muteButton = requireElement(document.querySelector<HTMLButtonElement>('#mute-button'))
const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-volume]'))

const applyDelay = 50
let activeTabId: number
let pendingTimer: number | undefined
let updateRevision = 0
let lastAudibleVolume = 100

volumeSlider.disabled = true
void initialize()

volumeSlider.addEventListener('input', () => {
  updateDisplay(Number(volumeSlider.value))
  scheduleVolumeUpdate(Number(volumeSlider.value), false)
})

volumeSlider.addEventListener('change', () => {
  scheduleVolumeUpdate(Number(volumeSlider.value), true)
})

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    const value = Number(button.dataset.volume)
    volumeSlider.value = String(value)
    updateDisplay(value)
    scheduleVolumeUpdate(value, true)
  })
})

muteButton.addEventListener('click', () => {
  const isMuted = muteButton.getAttribute('aria-pressed') === 'true'
  const value = isMuted ? lastAudibleVolume : 0
  if (!isMuted && Number(volumeSlider.value) > 0) {
    lastAudibleVolume = Number(volumeSlider.value)
  }
  volumeSlider.value = String(value)
  updateDisplay(value)
  scheduleVolumeUpdate(value, true)
})

async function initialize () {
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (activeTab?.id === undefined) {
      throw new Error('No active tab is available.')
    }

    activeTabId = activeTab.id
    const initialValue = await sendMessage({ name: 'get-tab-volume', tabId: activeTabId })
    if (typeof initialValue !== 'number' || !Number.isFinite(initialValue) ||
        initialValue < 0 || initialValue > 6) {
      throw new Error('The current tab volume could not be read.')
    }

    const value = Math.round(initialValue * 100 / 5) * 5
    volumeSlider.value = String(value)
    updateDisplay(value)
    setControlsEnabled(true)
  } catch (error) {
    showError(error)
  }
}

function scheduleVolumeUpdate (value: number, immediate: boolean) {
  if (pendingTimer !== undefined) {
    window.clearTimeout(pendingTimer)
    pendingTimer = undefined
  }

  updateRevision += 1
  const revision = updateRevision
  status.dataset.error = 'false'
  status.textContent = ''

  if (immediate) {
    void applyVolume(value, revision)
  } else {
    pendingTimer = window.setTimeout(() => {
      pendingTimer = undefined
      void applyVolume(value, revision)
    }, applyDelay)
  }
}

async function applyVolume (value: number, revision: number) {
  try {
    await sendMessage({ name: 'set-tab-volume', tabId: activeTabId, value: value / 100 })
  } catch (error) {
    if (revision === updateRevision) {
      showError(error)
    }
  }
}

function updateDisplay (value: number) {
  volumeValue.textContent = String(value)
  volumeSlider.style.setProperty('--progress', `${value / 6}%`)
  muteButton.setAttribute('aria-pressed', String(value === 0))
  requireElement(muteButton.querySelector('span')).textContent = value === 0 ? 'Unmute' : 'Mute'

  if (value > 0) {
    lastAudibleVolume = value
  }

  presetButtons.forEach(button => {
    const selected = Number(button.dataset.volume) === value
    button.setAttribute('aria-pressed', String(selected))
  })

  volumeDescription.textContent = value === 0
    ? 'Muted for this tab'
    : value > 100
      ? 'Above normal'
      : 'Fine-tune from silent to 6×'
}

function setControlsEnabled (enabled: boolean) {
  volumeSlider.disabled = !enabled
  muteButton.disabled = !enabled
  presetButtons.forEach(button => {
    button.disabled = !enabled
  })
}

async function sendMessage (message: PopupMessage): Promise<unknown> {
  const response: unknown = await chrome.runtime.sendMessage(message)
  if (typeof response === 'object' && response !== null && 'error' in response) {
    throw new Error(String(response.error))
  }
  return response
}

function requireElement<T> (element: T | null): T {
  if (element === null) {
    throw new Error('The volume popup is missing required controls.')
  }
  return element
}

function showError (error: unknown) {
  status.textContent = error instanceof Error ? error.message : String(error)
  status.dataset.error = 'true'
  setControlsEnabled(false)
}
