"use client";

import React, { useState } from "react";
import { MapPin, Check, Save, Crosshair, AlertTriangle, ShieldCheck } from "lucide-react";
import { Stop, STOPS } from "@/config/transit";
import { StopCoordinate } from "@/types/domain.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { notifyLiveUpdate } from "@/lib/hooks/use-live-refresh";

interface StopCalibrationCardProps {
  stops: Record<Stop, StopCoordinate>;
  onSaved?: () => void;
  className?: string;
}

export default function StopCalibrationCard({
  stops,
  onSaved,
  className = "",
}: StopCalibrationCardProps) {
  const { showToast } = useToast();
  const [selectedStop, setSelectedStop] = useState<Stop>("College");
  const [name, setName] = useState(stops.College?.name || "Campus Academic Gate");
  const [latitude, setLatitude] = useState(String(stops.College?.latitude || 28.535517));
  const [longitude, setLongitude] = useState(String(stops.College?.longitude || 77.391028));
  const [isSaving, setIsSaving] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  const handleStopChange = (stop: Stop) => {
    setSelectedStop(stop);
    const s = stops[stop];
    if (s) {
      setName(s.name);
      setLatitude(String(s.latitude));
      setLongitude(String(s.longitude));
    }
  };

  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      showToast({
        title: "GPS Unavailable",
        message: "Device geolocation is not supported.",
        tone: "coral",
      });
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetecting(false);
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        showToast({
          title: "Current GPS Captured",
          message: `Acquired coordinates for ${selectedStop} (±${Math.round(pos.coords.accuracy)}m).`,
          tone: "teal",
        });
      },
      (err) => {
        setIsDetecting(false);
        showToast({
          title: "GPS Error",
          message: err.message || "Could not read device position.",
          tone: "coral",
        });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      showToast({ title: "Validation Error", message: "Latitude must be between -90 and 90", tone: "coral" });
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      showToast({ title: "Validation Error", message: "Longitude must be between -180 and 180", tone: "coral" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/stops/coordinates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stop: selectedStop,
          name: name.trim(),
          latitude: latNum,
          longitude: lngNum,
          isVerified: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        notifyLiveUpdate();
        showToast({
          title: "Coordinates Calibrated",
          message: `Verified coordinates saved for ${selectedStop} in MongoDB.`,
          tone: "teal",
        });
        if (onSaved) onSaved();
      } else {
        showToast({ title: "Error", message: data.error || "Failed to save coordinates", tone: "coral" });
      }
    } catch {
      showToast({ title: "Network Error", message: "Could not save stop coordinates.", tone: "coral" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[#EADDC6] bg-white p-4 sm:p-5 shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#F0E4D0] pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-sun shrink-0">
            <MapPin size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="font-display text-[15px] sm:text-[16px] text-ink font-bold truncate">
              Stop Coordinates Calibration
            </h4>
            <div className="text-[11px] text-ink-500 truncate">
              Verified ground-truth coordinates for College, Station & Office
            </div>
          </div>
        </div>
        <div className="self-start sm:self-auto shrink-0">
          <Badge tone="teal" className="text-[10px] sm:text-[11px]">
            <ShieldCheck size={12} /> Authorized Rider Only
          </Badge>
        </div>
      </div>

      {/* Stop Selector Tabs */}
      <div className="mt-4 flex gap-1.5 sm:gap-2">
        {STOPS.map((stop) => (
          <button
            key={stop}
            type="button"
            onClick={() => handleStopChange(stop)}
            className={`flex-1 rounded-xl border py-2 px-1 text-[11px] sm:text-[12px] font-semibold transition truncate ${
              selectedStop === stop
                ? "border-ink bg-ink text-white shadow-sm"
                : "border-[#E4D5BB] bg-white text-ink-600 hover:border-sun"
            }`}
          >
            {stop}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="mt-4 space-y-3.5">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
            Stop Name / Landmark
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field mt-1 text-[13.5px]"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="field mt-1 text-[13.5px] font-mono"
              required
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="field mt-1 text-[13.5px] font-mono"
              required
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentGps}
            disabled={isDetecting}
            className="w-full sm:w-auto text-[11.5px] justify-center"
          >
            <Crosshair size={14} className={isDetecting ? "animate-spin" : ""} />
            {isDetecting ? "Detecting GPS…" : "Calibrate with Device GPS"}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="w-full sm:w-auto sm:ml-auto text-[11.5px] justify-center"
          >
            <Save size={14} />
            {isSaving ? "Saving to Atlas…" : `Save ${selectedStop} Coordinates`}
          </Button>
        </div>
      </form>
    </div>
  );
}
