// Brand tokens mirrored from ../../context/ui-tokens.md (single source — no hex in scenes).
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

export const display = loadPlayfair("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
}).fontFamily;

export const sans = loadInter("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
}).fontFamily;

export const color = {
  ivory: "#FAF7F2",
  surface: "#FFFFFF",
  maroon: "#7A1F2B",
  maroonHover: "#641923",
  gold: "#C9A227",
  goldSoft: "#F3E8C9",
  ink: "#2B2118",
  inkSecondary: "#6F6258",
} as const;
