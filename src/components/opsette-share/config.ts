// Opsette Share — per-app configuration for Decision Lab.
// See ../../../_shared/opsette-share/INTEGRATION.md.

import type { OpsetteShareConfig } from "./config.template";

export type { OpsetteShareConfig };

export const opsetteShareConfig: OpsetteShareConfig = {
  appName: "Decision Lab",
  tagline: "Build a weighted scorecard once, then run it on every real decision.",
  url: "https://tools.opsette.io/decision-lab/",
  logoSrc: "opsette-logo.png",
};
