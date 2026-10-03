export type PopupMessage = {
  name: 'get-tab-volume',
  tabId: number
} | {
  name: 'set-tab-volume',
  tabId: number,
  value: number
}

export type OffscreenMessage = {
  target: 'offscreen',
  name: 'get-tab-volume',
  tabId: number
} | {
  target: 'offscreen',
  name: 'set-tab-volume',
  tabId: number,
  value: number
} | {
  target: 'offscreen',
  name: 'capture-tab',
  tabId: number,
  streamId: string,
  value: number
} | {
  target: 'offscreen',
  name: 'dispose-tab',
  tabId: number
}

export type VolumeState = {
  captured: boolean,
  value: number
}

export type OperationResult = {
  ok: true
}
