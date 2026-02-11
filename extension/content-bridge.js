/**
 * Content Bridge
 *
 * Injected into localhost pages (the dashboard).
 * Bridges communication between the React app and the extension's
 * background service worker using DOM events + chrome.runtime messages.
 */

// Signal to the dashboard that the extension is installed.
// Use BOTH a DOM attribute (synchronous, survives timing issues) and postMessage.
document.documentElement.setAttribute('data-wmp-extension', '1.0.0');
window.postMessage({ type: 'WMP_EXTENSION_READY', version: '1.0.0' }, '*');

// Listen for requests from the dashboard
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  if (!event.data || typeof event.data !== 'object') return;

  // Respond to ping/check with a fresh ready signal
  // This handles the case where the ImportWizard mounts after the initial ready signal
  if (event.data.type === 'WMP_PING') {
    window.postMessage({ type: 'WMP_EXTENSION_READY', version: '1.0.0' }, '*');
    return;
  }

  if (event.data.type !== 'WMP_REQUEST') return;

  const { action, requestId, payload } = event.data;

  // Also respond to pings through the request channel with a ready signal
  if (action === 'wmp-ping') {
    window.postMessage({ type: 'WMP_EXTENSION_READY', version: '1.0.0' }, '*');
  }

  try {
    // Forward to background service worker
    const response = await chrome.runtime.sendMessage({
      action: action,
      ...payload,
    });

    // Send response back to the dashboard
    window.postMessage(
      {
        type: 'WMP_RESPONSE',
        requestId: requestId,
        response: response,
      },
      '*'
    );
  } catch (err) {
    window.postMessage(
      {
        type: 'WMP_RESPONSE',
        requestId: requestId,
        response: { success: false, error: err.message },
      },
      '*'
    );
  }
});
