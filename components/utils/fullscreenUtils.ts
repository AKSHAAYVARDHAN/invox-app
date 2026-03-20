export function getFullscreenElement(): Element | null {
  return document.fullscreenElement
    || (document as any).webkitFullscreenElement
    || (document as any).mozFullScreenElement
    || (document as any).msFullscreenElement;
}

export async function requestFullscreen(element: HTMLElement): Promise<void> {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  }
  throw new Error('Fullscreen API is not supported.');
}

export async function exitFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    return (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    return (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    return (document as any).msExitFullscreen();
  }
  throw new Error('Fullscreen API is not supported.');
}

export function addFullscreenListener(handler: EventListener): void {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);
}

export function removeFullscreenListener(handler: EventListener): void {
  document.removeEventListener('fullscreenchange', handler);
  document.removeEventListener('webkitfullscreenchange', handler);
  document.removeEventListener('mozfullscreenchange', handler);
  document.removeEventListener('MSFullscreenChange', handler);
}
