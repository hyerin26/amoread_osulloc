/*
 * Optional host adapter example for an authenticated osulloc application.
 * Include after editor/v1.12/app.js. No guessed URLs, tokens or schemas.
 *
 * BEFORE the editor scripts:
 *   window.AMOREAD_EDITOR_OPTIONS = { persistence: 'external' };
 *
 * Host MUST expose its own authenticated, authorized methods:
 *   window.AMOREAD_OSULLOC_API = {
 *     listProducts: async () => normalizedProductArray,
 *     listReviews:  async () => normalizedReviewArray,
 *     getDraft:     async () => editorSnapshotOrNull,
 *     saveDraft:    async snapshot => persistSnapshotOnHost(snapshot)
 *   };
 *
 * Production host should enforce record normalization, authorization,
 * edit conflict detection, price calculation and input sanitization.
 */
(function () {
  'use strict';
  const app = window.AMOREAD_EDITOR_API;
  const host = window.AMOREAD_OSULLOC_API;
  if (!app || !host) {
    console.info('[AMOREAD] Host integration not configured; editor remains standalone.');
    return;
  }
  const funcs = ['listProducts', 'listReviews', 'getDraft', 'saveDraft'];
  const missing = funcs.filter(key => typeof host[key] !== 'function');
  if (missing.length) {
    console.warn('[AMOREAD] Missing host adapter methods:', missing.join(', '));
    return;
  }

  let pending = null;
  let busy = false;
  let latest = null;
  let unsubscribe = null;
  const debounceMs = 700;

  async function flush() {
    if (busy || !latest) return;
    const draft = latest;
    latest = null;
    busy = true;
    try {
      await host.saveDraft(draft);
      window.dispatchEvent(new CustomEvent('amoread:save-status', {
        detail: { ok: true, state: 'saved' }
      }));
    } catch (error) {
      // Preserve the last unsaved snapshot in memory, never discard it silently.
      latest = latest || draft;
      window.dispatchEvent(new CustomEvent('amoread:save-status', {
        detail: { ok: false, state: 'error', message: String(error && error.message || error) }
      }));
      console.error('[AMOREAD] Draft was not saved; retry through the host', error);
    } finally {
      busy = false;
      // Wait for a new edit before retrying on errors to avoid an infinite loop.
      if (latest && latest !== draft) schedule();
    }
  }
  function schedule(snapshot) {
    if (snapshot) latest = snapshot;
    clearTimeout(pending);
    pending = setTimeout(flush, debounceMs);
  }
  async function init() {
    try {
      const [products, reviews, draft] = await Promise.all([
        host.listProducts(), host.listReviews(), host.getDraft()
      ]);
      app.setCatalog({ products, reviews });
      if (draft) app.importSnapshot(draft);
      unsubscribe = app.subscribe(schedule);
      window.dispatchEvent(new CustomEvent('amoread:host-ready'));
    } catch (error) {
      console.error('[AMOREAD] Host initialization failed', error);
      window.dispatchEvent(new CustomEvent('amoread:host-error', {
        detail: { message: String(error && error.message || error) }
      }));
    }
  }
  window.AMOREAD_OSULLOC_EDITOR_ADAPTER = {
    start: init,
    dispose() {
      clearTimeout(pending);
      if (unsubscribe) unsubscribe();
    },
    flush
  };
  init();
})();
