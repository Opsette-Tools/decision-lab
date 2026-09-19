import { createRoot } from "react-dom/client";
import { message } from "antd";
import { App } from "./App";
import { connectBridge } from "./components/opsette-bridge";
import { hydrateScorecardsFromBridge } from "./db/scorecardsRepo";
import { hydrateRunsFromBridge } from "./db/runsRepo";
import { resetParentKnown, setBridgeInstance } from "./lib/bridgeInstance";
import type { BridgedValue } from "./db/types";
import "./styles/tokens.css";
import "./index.css";

// GitHub Pages SPA fallback (rafgraph pattern, paired with public/404.html):
// the 404 page encodes the real path into the query string and bounces here;
// decode it back into a real path BEFORE the router mounts, so a deep link or
// a refresh on /scorecards/:id or /run/:id lands on the right route instead of
// silently dropping back to "/".
(function decodeSpaRedirect(l: Location) {
  if (l.search[1] === "/") {
    const decoded = l.search
      .slice(1)
      .split("&")
      .map((s) => s.replace(/~and~/g, "&"))
      .join("?");
    window.history.replaceState(null, "", l.pathname.slice(0, -1) + decoded + l.hash);
  }
})(window.location);

// PWA service worker registration with iframe / preview guard. In a preview
// iframe, service workers cause stale-content issues, so we unregister any
// existing SWs there. In production they activate normally.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

if (isPreviewHost || isInIframe) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // Dynamic import so the vite-plugin-pwa virtual module never loads in preview.
  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({ immediate: true });
    })
    .catch(() => {
      /* noop */
    });
}

// Bridge handshake gate. In standalone (window.parent === window) this resolves
// to null in <1ms; inside an iframe it awaits the parent's `init` for up to 1s —
// render is never blocked past that. When bridge mode boots, hydrate IDB from
// init.items BEFORE rendering so the repos return the right data on first
// render. Local-only rows are left untouched either way.
connectBridge<BridgedValue>().then(async (bridge) => {
  setBridgeInstance(bridge);
  if (bridge) {
    // Debounced toast: multiple timeouts in a 1s window collapse to a single
    // message, so a bulk-save failure doesn't spam.
    let lastToastAt = 0;
    bridge.onTimeout(() => {
      const nowMs = Date.now();
      if (nowMs - lastToastAt < 1000) return;
      lastToastAt = nowMs;
      message.error("Couldn't save — try again");
    });
    try {
      // Both hydrates read the same shared init.items array and split it by
      // `kind`; resetParentKnown is called ONCE with the combined ids, since it
      // clears the set before refilling and would otherwise have each hydrate
      // clobber the other's ids.
      const [scorecardIds, runIds] = await Promise.all([
        hydrateScorecardsFromBridge(bridge.init.items),
        hydrateRunsFromBridge(bridge.init.items),
      ]);
      resetParentKnown([...scorecardIds, ...runIds]);
    } catch (err) {
      console.error("[decision-lab] bridge hydrate failed:", err);
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
});
