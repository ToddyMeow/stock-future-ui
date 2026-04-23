import type { CSSProperties } from "react"

/**
 * BrandMark — Velvet Anchor hairline slash-bar emblem.
 * Geometric horizontal bar + diagonal slash, SpaceX-style minimalism.
 */
export function BrandMark({
  size = 32,
  color = "currentColor",
  style,
}: {
  size?: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 120 70"
      width={size}
      height={(size * 70) / 120}
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <rect x="14" y="30" width="92" height="3" fill={color} />
      <rect
        x="58.5"
        y="12"
        width="3"
        height="46"
        fill={color}
        transform="rotate(22 60 35)"
      />
    </svg>
  )
}

/**
 * AlphaMark — Alpha Lab geometric α (circle + diagonal + tick serif).
 * Rhythm-matched to BrandMark.
 */
export function AlphaMark({
  size = 32,
  color = "currentColor",
  style,
}: {
  size?: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 120 70"
      width={size}
      height={(size * 70) / 120}
      style={{ display: "block", ...style }}
      aria-hidden="true"
    >
      <circle cx="42" cy="35" r="18" fill="none" stroke={color} strokeWidth="3" />
      <path
        d="M 60 17 L 96 53"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="square"
        fill="none"
      />
      <rect x="94" y="50" width="10" height="3" fill={color} />
    </svg>
  )
}

/** Velvet Anchor lockup — mark + wordmark. */
export function Lockup({
  sub = "",
  size = 28,
}: {
  sub?: string
  size?: number
}) {
  return (
    <div className="lockup">
      <span className="mark">
        <BrandMark size={size} />
      </span>
      <div>
        <div className="wm">VELVET ANCHOR</div>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
    </div>
  )
}

/** Alpha Lab lockup — monospace wordmark with wider tracking. */
export function AlphaLockup({
  sub = "",
  size = 24,
}: {
  sub?: string
  size?: number
}) {
  return (
    <div className="lockup alpha">
      <span className="mark">
        <AlphaMark size={size} />
      </span>
      <div>
        <div className="wm">ALPHA LAB</div>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
    </div>
  )
}
