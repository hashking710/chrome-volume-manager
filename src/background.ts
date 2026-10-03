import type {
  OffscreenMessage,
  OperationResult,
  PopupMessage,
  VolumeState
} from './interfaces/Message'

const popupUrl = chrome.runtime.getURL('popup.html')
let creatingOffscreenDocument: Promise<void> | undefined

interface VolumeUpdateWaiter {
  resolve: () => void,
  reject: (error: unknown) => void
}

interface VolumeUpdateBatch {
  value: number,
  waiters: VolumeUpdateWaiter[]
}

interface VolumeUpdateQueue {
  running: boolean,
  pending?: VolumeUpdateBatch
}

const tabVolumeUpdates = new Map<number, VolumeUpdateQueue>()

chrome.runtime.onMessage.addListener((message: PopupMessage, sender, sendResponse) => {
  if (sender.url !== popupUrl) {
    return
  }

  void handlePopupMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      console.error('Unable to update tab volume:', error)
      sendResponse({ error: error instanceof Error ? error.message : String(error) })
    })

  return true
})

chrome.tabs.onRemoved.addListener(tabId => {
  void getOffscreenContexts()
    .then(async contexts => {
      if (contexts.length > 0) {
        await sendToOffscreen({ target: 'offscreen', name: 'dispose-tab', tabId })
      }
    })
    .catch(error => {
      console.error(`Unable to release audio for tab ${tabId}:`, error)
    })
})

async function handlePopupMessage (message: PopupMessage) {
  if (message.name === 'get-tab-volume') {
    const contexts = await getOffscreenContexts()
    if (contexts.length === 0) {
      return 1
    }

    const state = await sendToOffscreen({
      target: 'offscreen',
      name: 'get-tab-volume',
      tabId: message.tabId
    })
    return state.value
  }

  if (!Number.isInteger(message.tabId) || !Number.isFinite(message.value) ||
      message.value < 0 || message.value > 6) {
    throw new Error('The selected tab or volume is invalid.')
  }

  await queueTabVolumeUpdate(message.tabId, message.value)
}

function queueTabVolumeUpdate (tabId: number, value: number): Promise<void> {
  let queue = tabVolumeUpdates.get(tabId)
  if (!queue) {
    queue = { running: false }
    tabVolumeUpdates.set(tabId, queue)
  }

  const update = new Promise<void>((resolve, reject) => {
    if (queue.pending) {
      queue.pending.value = value
      queue.pending.waiters.push({ resolve, reject })
    } else {
      queue.pending = { value, waiters: [{ resolve, reject }] }
    }

    if (!queue.running) {
      queue.running = true
      void processTabVolumeUpdates(tabId, queue)
    }
  })

  return update
}

async function processTabVolumeUpdates (tabId: number, queue: VolumeUpdateQueue) {
  while (queue.pending) {
    const batch = queue.pending
    queue.pending = undefined

    try {
      await applyTabVolume(tabId, batch.value)
      batch.waiters.forEach(waiter => waiter.resolve())
    } catch (error) {
      batch.waiters.forEach(waiter => waiter.reject(error))
    }
  }

  queue.running = false
  if (tabVolumeUpdates.get(tabId) === queue) {
    tabVolumeUpdates.delete(tabId)
  }
}

async function applyTabVolume (tabId: number, value: number) {
  await ensureOffscreenDocument()

  const state = await sendToOffscreen({
    target: 'offscreen',
    name: 'get-tab-volume',
    tabId
  })

  if (state.captured) {
    await sendToOffscreen({
      target: 'offscreen',
      name: 'set-tab-volume',
      tabId,
      value
    })
  } else {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId })
    await sendToOffscreen({
      target: 'offscreen',
      name: 'capture-tab',
      tabId,
      streamId,
      value
    })
  }

  await chrome.action.setBadgeText({
    text: String(Math.round(value * 100)),
    tabId
  })
}

async function getOffscreenContexts () {
  return chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  })
}

async function ensureOffscreenDocument () {
  if ((await getOffscreenContexts()).length > 0) {
    return
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Capture tab audio and adjust its volume with the Web Audio API.'
    }).finally(() => {
      creatingOffscreenDocument = undefined
    })
  }

  await creatingOffscreenDocument
}

function sendToOffscreen (
  message: Extract<OffscreenMessage, { name: 'get-tab-volume' }>
): Promise<VolumeState>
function sendToOffscreen (
  message: Exclude<OffscreenMessage, { name: 'get-tab-volume' }>
): Promise<OperationResult>
async function sendToOffscreen (
  message: OffscreenMessage
): Promise<VolumeState | OperationResult> {
  const response: unknown = await chrome.runtime.sendMessage(message)
  if (isErrorResponse(response)) {
    throw new Error(response.error)
  }

  if (message.name === 'get-tab-volume') {
    if (!isVolumeState(response)) {
      throw new Error('The tab audio state could not be read.')
    }
    return response
  }

  if (!isOperationResult(response)) {
    throw new Error('The tab audio operation returned an unexpected response.')
  }
  return response
}

function isErrorResponse (response: unknown): response is { error: string } {
  return typeof response === 'object' && response !== null &&
    'error' in response && typeof response.error === 'string'
}

function isVolumeState (response: unknown): response is VolumeState {
  return typeof response === 'object' && response !== null &&
    'captured' in response && typeof response.captured === 'boolean' &&
    'value' in response && typeof response.value === 'number' &&
    Number.isFinite(response.value) && response.value >= 0 && response.value <= 6
}

function isOperationResult (response: unknown): response is OperationResult {
  return typeof response === 'object' && response !== null &&
    'ok' in response && response.ok === true
}
