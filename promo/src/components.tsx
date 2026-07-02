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
import { color, display, sans } from "./theme";

// Scale everything off a 1080px-wide baseline so the same scenes read well
// at 1080 (vertical/square) and 1920 (landscape) widths. ponytail: width-only
// scale is enough here; switch to min(w,h) if a portrait variant ever crowds.
export const useScale = () => useVideoConfig().width / 1080;

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Fade + rise in, then hold. `delay` and `dur` are in frames.
const reveal = (frame: number, delay: number, dur = 18) =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

export const Headline: React.FC<{
  text: string;
  sub?: string;
  delay?: number;
  dark?: boolean; // true = on a photo/maroon bg, use light text
}> = ({ text, sub, delay = 0, dark = false }) => {
  const frame = useCurrentFrame();
  const s = useScale();
  const t = reveal(frame, delay);
  const tSub = reveal(frame, delay + 8);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24 * s,
        textAlign: "center",
        maxWidth: 920 * s,
        padding: `0 ${80 * s}px`,
      }}
    >
      <h1
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 96 * s,
          lineHeight: 1.05,
          margin: 0,
          color: dark ? color.ivory : color.ink,
          opacity: t,
          translate: `0px ${interpolate(t, [0, 1], [40 * s, 0])}px`,
          textShadow: dark ? "0 4px 24px rgba(0,0,0,0.45)" : "none",
        }}
      >
        {text}
      </h1>
      {sub ? (
        <p
          style={{
            fontFamily: sans,
            fontWeight: 400,
            fontSize: 46 * s,
            lineHeight: 1.3,
            margin: 0,
            color: dark ? color.goldSoft : color.inkSecondary,
            opacity: tSub,
            translate: `0px ${interpolate(tSub, [0, 1], [24 * s, 0])}px`,
            textShadow: dark ? "0 2px 16px rgba(0,0,0,0.5)" : "none",
          }}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
};

// Slow Ken Burns pan/zoom on a full-frame image with a darkening scrim.
export const KenBurns: React.FC<{ src: string; scrim?: number }> = ({
  src,
  scrim = 0.45,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.08, 1.2]);
  const shift = interpolate(frame, [0, durationInFrames], [0, -3]);

  return (
    <AbsoluteFill>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: String(scale),
          translate: `0px ${shift}%`,
        }}
      />
      <AbsoluteFill style={{ backgroundColor: `rgba(43,33,24,${scrim})` }} />
    </AbsoluteFill>
  );
};

// Centered column on a solid background — shared scene chrome.
export const Stage: React.FC<{
  children: React.ReactNode;
  bg?: string;
}> = ({ children, bg = color.ivory }) => (
  <AbsoluteFill
    style={{
      backgroundColor: bg,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </AbsoluteFill>
);

// Animated gold underline that draws left-to-right.
export const GoldRule: React.FC<{ delay?: number; width?: number }> = ({
  delay = 0,
  width = 360,
}) => {
  const frame = useCurrentFrame();
  const s = useScale();
  const w = interpolate(frame, [delay, delay + 24], [0, width * s], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <div
      style={{
        width: w,
        height: 6 * s,
        borderRadius: 999,
        backgroundColor: color.gold,
      }}
    />
  );
};
