"use client";

import dynamic from "next/dynamic";
import React from "react";
import { TripLiveTrackingData } from "@/types/domain.types";

interface LiveMapWrapperProps {
  trackingData: TripLiveTrackingData | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
  showDetails?: boolean;
  height?: string;
}

const DynamicTransitMap = dynamic(() => import("./live-transit-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full flex-col items-center justify-center rounded-[26px] border border-[#EADDC6] bg-[#FFFBF3]">
      <div className="h-10 w-10 animate-spin rounded-full border-3 border-sun/30 border-t-sun" />
      <p className="mt-3 font-display text-[15px] text-ink">Loading 3D campus map…</p>
      <p className="text-[11px] text-ink-500">Preparing the live Toto view</p>
    </div>
  ),
});

export default function LiveMapWrapper(props: LiveMapWrapperProps) {
  return <DynamicTransitMap {...props} />;
}
