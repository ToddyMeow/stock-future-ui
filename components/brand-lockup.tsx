"use client"

import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

type BrandLockupProps = {
  compact?: boolean
  className?: string
}

export function BrandLockup({ compact = false, className }: BrandLockupProps) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-3 rounded-2xl transition-colors",
        compact ? "px-0 py-0" : "px-0 py-0",
        className,
      )}
      aria-label="Velvet Anchor"
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/6 shadow-[0_10px_24px_-16px_rgba(122,31,56,0.8)]",
          compact ? "size-10" : "size-12",
        )}
      >
        <Image
          src="/velvet-anchor-mark.svg"
          alt="Velvet Anchor"
          fill
          sizes={compact ? "40px" : "48px"}
          className="object-cover"
          priority
        />
      </div>

      <div className="min-w-0">
        <div
          className={cn(
            "font-semibold tracking-[0.08em] text-slate-900",
            compact ? "text-sm" : "text-base",
          )}
        >
          Velvet Anchor
        </div>
        <div
          className={cn(
            "text-muted-foreground",
            compact ? "text-[10px]" : "text-[11px]",
          )}
        >
          期货半自动交易控制台
        </div>
      </div>
    </Link>
  )
}

export function MobileBrandBar() {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/92 px-4 py-3 backdrop-blur md:hidden">
      <BrandLockup compact />
    </div>
  )
}
