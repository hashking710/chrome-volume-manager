import type {
  OffscreenMessage,
  OperationResult,
  PopupMessage,
  VolumeState
} from './interfaces/Message'
import { createLatestValueQueue, type LatestValueQueue } from './latest-value-queue'
import { createVolumeState } from './volume-state'

const popupUrl = chrome.runtime.getURL('popup.html')
let creatingOffscreenDocument: Promise<void> | undefined

const tabVolumeUpdates = new Map<number, LatestValueQueue<number>>()

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
      return createVolumeState()
    }

    const state = await sendToOffscreen({
      target: 'offscreen',
      name: 'get-tab-volume',
      tabId: message.tabId
    })
    return state
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
    let newQueue: LatestValueQueue<number>
    newQueue = createLatestValueQueue(
      nextValue => applyTabVolume(tabId, nextValue),
      () => {
        if (tabVolumeUpdates.get(tabId) === newQueue) {
          tabVolumeUpdates.delete(tabId)
        }
      }
    )
    queue = newQueue
    tabVolumeUpdates.set(tabId, queue)
  }

  return queue.enqueue(value)
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
    Number.isFinite(response.value) && response.value >= 0 && response.value <= 6 &&
    'lastAudibleValue' in response && typeof response.lastAudibleValue === 'number' &&
    Number.isFinite(response.lastAudibleValue) &&
    response.lastAudibleValue > 0 && response.lastAudibleValue <= 6
}

function isOperationResult (response: unknown): response is OperationResult {
  return typeof response === 'object' && response !== null &&
    'ok' in response && response.ok === true
}
