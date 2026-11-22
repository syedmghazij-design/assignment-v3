export function toast(message, type = 'ok') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gims-toast', { detail: { message, type } }));
}
