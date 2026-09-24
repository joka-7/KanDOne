/**
 * Developer-set feature flags for modeldispatcher-* — never a
 * switch the end user sees or controls. See ModelDispatcher's own
 * docs/USAGE.md § "No-backend browser apps" for the full pattern.
 *
 * `dispatch` isn't wired to anything here: this app already fully
 * delegates every AI call to browser-agent (no legacy call path left to
 * fall back to), so only `ui` matters for this app's rollout — whether
 * AI settings render the shared <ModelPicker> or the app's own
 * hand-built fields.
 */

import { resolveDispatcherFeatures } from 'modeldispatcher-browser-agent';

export const dispatcherFeatures = resolveDispatcherFeatures({
  ui: import.meta.env.VITE_MODEL_DISPATCHER_UI !== 'false',
});
