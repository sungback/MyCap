import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('captureApi', {
  triggerCapture: () => ipcRenderer.invoke('capture:trigger'),
  triggerRegionCapture: () => ipcRenderer.invoke('capture:triggerRegion'),
  triggerWindowCapture: () => ipcRenderer.invoke('capture:triggerWindow'),
  onCaptureDone: (callback: (payload: { filePath: string }) => void) => {
    const listener = (_event: unknown, payload: { filePath: string }) => callback(payload)
    ipcRenderer.on('capture:done', listener)
    return () => ipcRenderer.removeListener('capture:done', listener)
  },
})

contextBridge.exposeInMainWorld('overlayApi', {
  onInit: (
    callback: (payload: { dataUrl: string; width: number; height: number }) => void,
  ) => {
    const listener = (
      _event: unknown,
      payload: { dataUrl: string; width: number; height: number },
    ) => callback(payload)
    ipcRenderer.on('overlay:init', listener)
    return () => ipcRenderer.removeListener('overlay:init', listener)
  },
  completeSelection: (rect: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.send('overlay:complete', rect),
  cancel: () => ipcRenderer.send('overlay:cancel'),
})

contextBridge.exposeInMainWorld('pickerApi', {
  onInit: (
    callback: (sources: { id: string; name: string; thumbnailDataUrl: string }[]) => void,
  ) => {
    const listener = (
      _event: unknown,
      sources: { id: string; name: string; thumbnailDataUrl: string }[],
    ) => callback(sources)
    ipcRenderer.on('picker:init', listener)
    return () => ipcRenderer.removeListener('picker:init', listener)
  },
  select: (id: string) => ipcRenderer.send('picker:select', id),
  cancel: () => ipcRenderer.send('picker:cancel'),
})

contextBridge.exposeInMainWorld('editorApi', {
  onInit: (callback: (payload: { dataUrl: string; filePath: string }) => void) => {
    const listener = (_event: unknown, payload: { dataUrl: string; filePath: string }) =>
      callback(payload)
    ipcRenderer.on('editor:init', listener)
    return () => ipcRenderer.removeListener('editor:init', listener)
  },
  save: (dataUrl: string) => ipcRenderer.invoke('editor:save', { dataUrl }),
  close: () => ipcRenderer.send('editor:close'),
})
