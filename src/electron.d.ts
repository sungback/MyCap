export {}

declare global {
  interface Window {
    captureApi?: {
      triggerCapture: () => Promise<void>
      triggerRegionCapture: () => Promise<void>
      triggerWindowCapture: () => Promise<void>
      onCaptureDone: (callback: (payload: { filePath: string }) => void) => () => void
    }
    overlayApi?: {
      onInit: (
        callback: (payload: { dataUrl: string; width: number; height: number }) => void,
      ) => () => void
      completeSelection: (rect: { x: number; y: number; width: number; height: number }) => void
      cancel: () => void
    }
    pickerApi?: {
      onInit: (
        callback: (sources: { id: string; name: string; thumbnailDataUrl: string }[]) => void,
      ) => () => void
      select: (id: string) => void
      cancel: () => void
    }
    editorApi?: {
      onInit: (callback: (payload: { dataUrl: string; filePath: string }) => void) => () => void
      save: (dataUrl: string) => Promise<void>
      close: () => void
    }
  }
}
