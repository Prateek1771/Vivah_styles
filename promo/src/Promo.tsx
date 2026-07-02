import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { color, display, sans } from "./theme";
import { GoldRule, Headline, KenBurns, Stage, useScale } from "./components";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const SCENE = 165; // frames per scene
const XFADE = 18; // transition length
// 6*165 - 5*18 = 900 frames = 30s @30fps  (see Root.tsx)

// ── Scene 1: Hook ──────────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const s = useScale();
  const t = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <Stage bg={color.maroon}>
      {/* gold glow accent behind the wordmark */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${color.gold}55, transparent 55%)`,
          opacity: interpolate(frame, [0, 40], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28 * s,
        }}
      >
        <div
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 130 * s,
            color: color.ivory,
            opacity: t,
            scale: String(interpolate(t, [0, 1], [0.86, 1])),
            letterSpacing: -1,
          }}
        >
          VivahStyle
        </div>
        <GoldRule delay={18} width={300} />
        <div
          style={{
            fontFamily: sans,
            fontSize: 44 * s,
            color: color.goldSoft,
            opacity: interpolate(frame, [24, 48], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Wedding fashion, perfected in-store.
        </div>
      </div>
    </Stage>
  );
};

// ── Scene 2: Promise (photo + headline) ─────────────────────────────────────
const Promise2: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <KenBurns src="couples/couple-03.jpeg" />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Headline
        text="Style every bride. Instantly."
        sub="One platform for the whole boutique."
        delay={6}
        dark
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

// ── Scene 3: Inventory ──────────────────────────────────────────────────────
const Inventory: React.FC = () => (
  <Stage>
    <Headline
      text="Snap. Auto-fill. Done."
      sub="Smart inventory powered by vision AI."
      delay={4}
    />
  </Stage>
);

// ── Scene 4: Color match (skin-tone swatches) ───────────────────────────────
const TONES = ["fair", "wheatish", "medium", "tan", "deep"];
const ColorMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const s = useScale();
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 56 * s,
        }}
      >
        <Headline text="Perfect colors for every skin tone." delay={4} />
        <div style={{ display: "flex", gap: 28 * s }}>
          {TONES.map((tone, i) => {
            const d = 16 + i * 6;
            const p = interpolate(frame, [d, d + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            const size = 150 * s;
            return (
              <Img
                key={tone}
                src={staticFile(`skintones/${tone}.jpeg`)}
                style={{
                  width: size,
                  height: size,
                  borderRadius: 999,
                  objectFit: "cover",
                  border: `${4 * s}px solid ${color.gold}`,
                  opacity: p,
                  scale: String(interpolate(p, [0, 1], [0.6, 1])),
                  translate: `0px ${interpolate(p, [0, 1], [30 * s, 0])}px`,
                }}
              />
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

// ── Scene 5: Try-on / recommendations (photo grid) ──────────────────────────
const GRID = [4, 5, 6, 7, 8, 9].map(
  (n) => `couples/couple-${String(n).padStart(2, "0")}.jpeg`,
);
const TryOn: React.FC = () => {
  const frame = useCurrentFrame();
  const s = useScale();
  return (
    <Stage bg={color.ink}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48 * s,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20 * s,
          }}
        >
          {GRID.map((src, i) => {
            const d = 6 + i * 5;
            const p = interpolate(frame, [d, d + 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            });
            const w = 260 * s;
            return (
              <Img
                key={src}
                src={staticFile(src)}
                style={{
                  width: w,
                  height: w * 1.25,
                  objectFit: "cover",
                  borderRadius: 12 * s,
                  opacity: p,
                  scale: String(interpolate(p, [0, 1], [0.8, 1])),
                }}
              />
            );
          })}
        </div>
        <Headline text="AI try-on & instant match scores." delay={40} dark />
      </div>
    </Stage>
  );
};

// ── Scene 6: CTA / outro ────────────────────────────────────────────────────
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const s = useScale();
  const t = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28 * s,
        }}
      >
        <div
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 120 * s,
            color: color.maroon,
            opacity: t,
            scale: String(interpolate(t, [0, 1], [0.9, 1])),
          }}
        >
          VivahStyle
        </div>
        <GoldRule delay={20} width={420} />
        <div
          style={{
            fontFamily: sans,
            fontSize: 46 * s,
            color: color.inkSecondary,
            opacity: interpolate(frame, [28, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Built for the boutique.
        </div>
      </div>
    </Stage>
  );
};

const SCENES = [Hook, Promise2, Inventory, ColorMatch, TryOn, Outro];

export const Promo: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: color.ivory }}>
      <Audio
        src={staticFile("launch-music.mp3")}
        trimAfter={durationInFrames}
        // fade in 1s, fade out last 1.5s so the trim ends cleanly
        volume={(f) =>
          interpolate(
            f,
            [0, fps, durationInFrames - 1.5 * fps, durationInFrames],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <TransitionSeries>
        {SCENES.map((Scene, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: XFADE })}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={SCENE}>
              <Scene />
            </TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
