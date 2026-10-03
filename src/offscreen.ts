import type { OffscreenMessage, OperationResult, VolumeState } from './interfaces/Message'

interface CapturedTab {
  audioContext: AudioContext,
  stream: MediaStream,
  streamSource: MediaStreamAudioSourceNode,
  gainNode: GainNode
}

const capturedTabs = new Map<number, CapturedTab>()
const capturesInProgress = new Map<number, Promise<void>>()

chrome.runtime.onMessage.addListener((message: OffscreenMessage, sender, sendResponse) => {
  if (message.target !== 'offscreen' || sender.id !== chrome.runtime.id) {
    return
  }

  void handleMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      console.error('Unable to process tab audio:', error)
      sendResponse({ error: error instanceof Error ? error.message : String(error) })
    })

  return true
})

async function handleMessage (
  message: OffscreenMessage
): Promise<VolumeState | OperationResult> {
  if (message.name === 'get-tab-volume') {
    const tab = capturedTabs.get(message.tabId)
    return { captured: tab !== undefined, value: tab?.gainNode.gain.value ?? 1 }
  }

  if (message.name === 'set-tab-volume') {
    const tab = capturedTabs.get(message.tabId)
    if (!tab) {
      throw new Error('The tab audio stream is not available.')
    }
    tab.gainNode.gain.value = message.value
    return { ok: true }
  }

  if (message.name === 'capture-tab') {
    await captureTab(message.tabId, message.streamId, message.value)
    return { ok: true }
  }

  await disposeTab(message.tabId)
  return { ok: true }
}

async function captureTab (tabId: number, streamId: string, value: number) {
  const existingTab = capturedTabs.get(tabId)
  if (existingTab) {
    existingTab.gainNode.gain.value = value
    return
  }

  const pendingCapture = capturesInProgress.get(tabId)
  if (pendingCapture) {
    await pendingCapture
    const tab = capturedTabs.get(tabId)
    if (!tab) {
      throw new Error('The tab audio stream could not be created.')
    }
    tab.gainNode.gain.value = value
    return
  }

  const capture = createCapturedTab(tabId, streamId, value)
  capturesInProgress.set(tabId, capture)
  try {
    await capture
  } finally {
    capturesInProgress.delete(tabId)
  }
}

async function createCapturedTab (tabId: number, streamId: string, value: number) {
  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: false
  } as MediaStreamConstraints

  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  let audioContext: AudioContext | undefined
  try {
    audioContext = new AudioContext()
    const streamSource = audioContext.createMediaStreamSource(stream)
    const gainNode = audioContext.createGain()
    gainNode.gain.value = value

    streamSource.connect(gainNode)
    gainNode.connect(audioContext.destination)
    await audioContext.resume()
    capturedTabs.set(tabId, { audioContext, stream, streamSource, gainNode })
  } catch (error) {
    stream.getTracks().forEach(track => track.stop())
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(closeError => {
        console.error('Unable to close a failed audio context:', closeError)
      })
    }
    throw error
  }
}

async function disposeTab (tabId: number) {
  const pendingCapture = capturesInProgress.get(tabId)
  if (pendingCapture) {
    await pendingCapture.catch(() => undefined)
  }

  const tab = capturedTabs.get(tabId)
  if (!tab) {
    return
  }

  capturedTabs.delete(tabId)
  tab.streamSource.disconnect()
  tab.gainNode.disconnect()
  tab.stream.getTracks().forEach(track => track.stop())
  await tab.audioContext.close()
}
