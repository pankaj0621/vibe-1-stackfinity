"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  FullscreenControl,
  LngLatBounds,
  Map as MapLibreMapConstructor,
  Marker as MapLibreMarkerConstructor,
  NavigationControl,
  Popup,
  getVersion,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type Marker as MapLibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MapPin,
  Clock,
  Navigation,
  AlertTriangle,
  RefreshCw,
  Radio,
  Compass,
  ShieldAlert,
  LocateFixed,
  Box,
} from "lucide-react";
import {
  Stop,
  STOPS,
  DEFAULT_STOP_COORDINATES,
} from "@/config/transit";
import { StopCoordinate, TripLiveTrackingData } from "@/types/domain.types";
import { formatRoadDistance, formatEta } from "@/lib/utils/routing";
import { Badge } from "@/components/ui/badge";

const CARTO_VOYAGER_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "lawazia-live-route";
const ACCURACY_SOURCE_ID = "lawazia-gps-accuracy";

interface LiveTransitMapProps {
  trackingData: TripLiveTrackingData | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
  showDetails?: boolean;
  height?: string;
}

export default function LiveTransitMap({
  trackingData,
  isLoading = false,
  error = null,
  onRefresh,
  className = "",
  showDetails = true,
  height = "460px",
}: LiveTransitMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, MapLibreMarker>>({});
  const positionAnimationRef = useRef<number | null>(null);
  const lastVehicleTargetRef = useRef<[number, number] | null>(null);
  const cameraSignatureRef = useRef<string | null>(null);
  const followVehicleRef = useRef(true);
  const is3DViewRef = useRef(true);
  const [isFollowingVehicle, setIsFollowingVehicle] = useState(true);
  const [is3DView, setIs3DView] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Next 14 does not resolve MapLibre's bundled worker URL reliably, so serve its worker from public/.
    setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

    const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
    const addCartoKey = (rawUrl: string) => {
      if (!cartoKey) return rawUrl;
      try {
        const url = new URL(rawUrl);
        if (url.hostname === "cartocdn.com" || url.hostname.endsWith(".cartocdn.com")) {
          if (!url.searchParams.has("key")) url.searchParams.set("key", cartoKey);
          return url.toString();
        }
      } catch {
        // Leave non-URL requests untouched; MapLibre will report an invalid style request.
      }
      return rawUrl;
    };

    const map = new MapLibreMapConstructor({
      container,
      style: cartoKey ? addCartoKey(CARTO_VOYAGER_STYLE) : OPENFREEMAP_STYLE,
      center: [77.3965, 28.5355],
      zoom: 15,
      pitch: 56,
      bearing: -14,
      maxPitch: 72,
      attributionControl: false,
      scrollZoom: true,
      transformRequest: (url) => ({ url: addCartoKey(url) }),
    });
    mapInstanceRef.current = map;
    map.addControl(
      new NavigationControl({ showZoom: true, showCompass: true, visualizePitch: true }),
      "bottom-right"
    );
    map.addControl(
      new AttributionControl({ compact: false }),
      "bottom-left"
    );
    map.addControl(new FullscreenControl(), "top-right");

    const stopFollowingOnDrag = () => {
      followVehicleRef.current = false;
      setIsFollowingVehicle(false);
    };
    const onMapLoad = () => {
      const styleLayers = map.getStyle().layers || [];
      const firstSymbolLayer = styleLayers.find((layer) => layer.type === "symbol")?.id;

      // Replace the flat building footprints with raised building volumes from CARTO's vector source.
      ["building", "building-top"].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      });
      if (map.getSource("carto") && !map.getLayer("lawazia-3d-buildings")) {
        map.addLayer(
          {
            id: "lawazia-3d-buildings",
            type: "fill-extrusion",
            source: "carto",
            "source-layer": "building",
            minzoom: 14.5,
            paint: {
              "fill-extrusion-color": "#d8cbbb",
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                14.5,
                0,
                15.5,
                ["max", 4, ["to-number", ["get", "render_height"], 11]],
                17,
                ["max", 6, ["to-number", ["get", "render_height"], 13]],
              ],
              "fill-extrusion-base": ["to-number", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.88,
              "fill-extrusion-vertical-gradient": true,
            },
          },
          firstSymbolLayer
        );
      }
      // OpenFreeMap's Liberty style already includes a 3D building extrusion layer.

      const emptyCollection = { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection;
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: emptyCollection });
      map.addSource(ACCURACY_SOURCE_ID, { type: "geojson", data: emptyCollection });

      const routeLayers = [
        {
          id: "lawazia-route-shadow",
          type: "line" as const,
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": "#15342f", "line-width": 13, "line-opacity": 0.2, "line-blur": 1.2 },
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
        },
        {
          id: "lawazia-route-casing",
          type: "line" as const,
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.95 },
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
        },
        {
          id: "lawazia-route-line",
          type: "line" as const,
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": "#13a77a", "line-width": 5.5, "line-opacity": 0.98 },
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
        },
        {
          id: "lawazia-route-flow",
          type: "line" as const,
          source: ROUTE_SOURCE_ID,
          paint: { "line-color": "#d8fff0", "line-width": 2, "line-opacity": 0.92, "line-dasharray": [1, 3] },
          layout: { "line-cap": "round" as const, "line-join": "round" as const },
        },
      ];
      routeLayers.forEach((layer) => map.addLayer(layer, firstSymbolLayer));
      map.addLayer(
        {
          id: "lawazia-gps-accuracy-fill",
          type: "fill",
          source: ACCURACY_SOURCE_ID,
          paint: { "fill-color": "#12a77b", "fill-opacity": 0.1 },
        },
        firstSymbolLayer
      );
      map.addLayer(
        {
          id: "lawazia-gps-accuracy-outline",
          type: "line",
          source: ACCURACY_SOURCE_ID,
          paint: { "line-color": "#12a77b", "line-opacity": 0.45, "line-width": 1.25 },
        },
        firstSymbolLayer
      );

      map.on("dragstart", stopFollowingOnDrag);
      setMapReady(true);
      requestAnimationFrame(() => map.resize());
    };
    map.on("load", onMapLoad);
    map.on("error", (event) => {
      if (event.error) console.error("Live map request failed:", event.error.message);
    });

    const handleResize = () => map.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.off("load", onMapLoad);
      map.off("dragstart", stopFollowingOnDrag);
      if (positionAnimationRef.current !== null) {
        window.cancelAnimationFrame(positionAnimationRef.current);
        positionAnimationRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = {};
      lastVehicleTargetRef.current = null;
      cameraSignatureRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map) return;

    const stopsRecord: Record<Stop, StopCoordinate> = trackingData?.stops || {
      College: { stop: "College", ...DEFAULT_STOP_COORDINATES.College },
      Station: { stop: "Station", ...DEFAULT_STOP_COORDINATES.Station },
      Office: { stop: "Office", ...DEFAULT_STOP_COORDINATES.Office },
    };
    const isIdle = !trackingData || trackingData.trackingStatus === "idle";
    const fromStop = isIdle ? undefined : trackingData?.from;
    const toStop = isIdle ? undefined : trackingData?.to;
    const latestLocation = trackingData?.latestLocation;
    const routeGeometry = trackingData?.routeGeometry;
    const isStale = latestLocation?.isStale || trackingData?.trackingStatus === "stale";
    const boundsPoints: [number, number][] = [];
    let vehiclePositionChanged = false;

    (Object.entries(stopsRecord) as [Stop, StopCoordinate][]).forEach(([stopName, coord]) => {
      if (!coord || typeof coord.latitude !== "number" || typeof coord.longitude !== "number") return;
      const isOrigin = stopName === fromStop;
      const isDestination = stopName === toStop;
      boundsPoints.push([coord.longitude, coord.latitude]);
      const markerKey = `stop-${stopName}`;
      let marker = markersRef.current[markerKey];
      const element = marker?.getElement() || document.createElement("div");
      element.classList.add("campus-stop-marker");
      element.innerHTML = `
        <div class="flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-md transition-transform duration-300 hover:scale-110 ${
          isOrigin
            ? "border-[#FFC93C] bg-[#141210] text-[#FFC93C] ring-2 ring-[#FFC93C]/40"
            : isDestination
              ? "border-teal-300 bg-[#0B8F86] text-white ring-2 ring-teal-400/40"
              : "border-[#DDCBB2] bg-white text-[#141210] hover:border-[#FFC93C]"
        }">
          <span class="h-2.5 w-2.5 rounded-full ${isOrigin ? "animate-ping bg-[#FFC93C]" : isDestination ? "bg-teal-300" : "bg-amber-600"}"></span>
          <span>${stopName}</span>
          ${isOrigin ? '<span class="font-mono text-[9px] uppercase tracking-wider text-[#FFC93C]/90">PICKUP</span>' : ""}
          ${isDestination ? '<span class="font-mono text-[9px] uppercase tracking-wider text-teal-200">DROP</span>' : ""}
        </div>`;
      element.style.zIndex = "5";
      if (marker) {
        marker.setLngLat([coord.longitude, coord.latitude]);
      } else {
        marker = new MapLibreMarkerConstructor({ element, anchor: "center", pitchAlignment: "viewport" })
          .setLngLat([coord.longitude, coord.latitude])
          .addTo(map);
        markersRef.current[markerKey] = marker;
      }
      marker.setPopup(new Popup({ offset: 22, closeButton: true }).setDOMContent(
        createInfoPopup(coord.name || stopName, [
          `Verified transit stop: ${stopName}`,
          `${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`,
        ])
      ));
    });

    const vehicleKey = "rider-vehicle";
    let vehicleMarker = markersRef.current[vehicleKey];
    if (latestLocation && typeof latestLocation.latitude === "number" && typeof latestLocation.longitude === "number") {
      const vehicleTarget: [number, number] = [latestLocation.latitude, latestLocation.longitude];
      boundsPoints.push([latestLocation.longitude, latestLocation.latitude]);
      const headingDeg = latestLocation.heading || 0;
      const speedKmh = latestLocation.speed ? Math.round(latestLocation.speed) : 0;
      const vehicleLabel = speedKmh > 0 ? `TOTO · ${speedKmh} km/h` : "TOTO";
      const element = vehicleMarker?.getElement() || document.createElement("div");
      element.classList.add("toto-marker");
      element.classList.toggle("toto-marker-stale", Boolean(isStale));
      element.classList.toggle("toto-marker-live", !isStale);
      element.setAttribute("aria-label", "Toto live location");
      element.innerHTML = `
        <span class="toto-marker-pulse"></span>
        <div class="toto-vehicle" aria-hidden="true">
          <svg viewBox="0 0 80 88" width="70" height="78" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="40" cy="78" rx="24" ry="6" fill="#18342f" fill-opacity=".22" />
            <circle cx="40" cy="17" r="6" fill="#182321" stroke="#fff" stroke-width="2" />
            <circle cx="21" cy="59" r="6" fill="#182321" stroke="#fff" stroke-width="2" />
            <circle cx="59" cy="59" r="6" fill="#182321" stroke="#fff" stroke-width="2" />
            <path d="M21 59 23 35q1-18 17-20 16 2 17 20l2 24q-2 10-19 12-17-2-19-12Z" fill="#0e4039" stroke="#fff" stroke-width="2.5" />
            <path d="M26 34q2-13 14-13t14 13Z" fill="#ffc928" stroke="#fff" stroke-width="1.5" />
            <path d="m27 37 26 0 3 14H24Z" fill="#b8e7e0" stroke="#12332d" stroke-width="2" />
            <path d="m24 53 32 0 1 8q-17 8-34 0Z" fill="#f6b91e" stroke="#fff" stroke-width="1.5" />
            <path d="M29 63h22" stroke="#18342f" stroke-width="2" stroke-linecap="round" />
            <circle cx="30" cy="57" r="2" fill="#fff2b8" /><circle cx="50" cy="57" r="2" fill="#fff2b8" />
          </svg>
        </div>
        <span class="toto-marker-label">${vehicleLabel}</span>
        ${isStale ? '<span class="toto-marker-signal">GPS delayed</span>' : ""}`;
      element.style.zIndex = "20";

      if (!vehicleMarker) {
        vehicleMarker = new MapLibreMarkerConstructor({
          element,
          anchor: "center",
          rotationAlignment: "map",
          pitchAlignment: "viewport",
        }).setLngLat([latestLocation.longitude, latestLocation.latitude]).addTo(map);
        markersRef.current[vehicleKey] = vehicleMarker;
      }
      vehicleMarker.setRotation(headingDeg);
      vehicleMarker.setPopup(new Popup({ offset: 42, closeButton: true }).setDOMContent(
        createInfoPopup(`Toto #1 (${trackingData?.riderName || "Authorized rider"})`, [
          `Speed: ${speedKmh} km/h · Heading: ${Math.round(headingDeg)}°`,
          `Accuracy: ±${Math.round(latestLocation.accuracy || 10)}m`,
          `Updated: ${new Date(latestLocation.timestamp).toLocaleTimeString()}`,
        ])
      ));

      const previousTarget = lastVehicleTargetRef.current;
      const positionChanged = !previousTarget ||
        Math.abs(previousTarget[0] - vehicleTarget[0]) > 0.000001 ||
        Math.abs(previousTarget[1] - vehicleTarget[1]) > 0.000001;
      if (positionChanged) {
        vehiclePositionChanged = true;
        if (positionAnimationRef.current !== null) {
          window.cancelAnimationFrame(positionAnimationRef.current);
          positionAnimationRef.current = null;
        }
        if (previousTarget && vehicleMarker) {
          const marker = vehicleMarker;
          const start = marker.getLngLat();
          const startedAt = performance.now();
          const durationMs = 1100;
          const animate = (now: number) => {
            const progress = Math.min((now - startedAt) / durationMs, 1);
            const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            marker.setLngLat([
              start.lng + (vehicleTarget[1] - start.lng) * eased,
              start.lat + (vehicleTarget[0] - start.lat) * eased,
            ]);
            if (progress < 1) positionAnimationRef.current = window.requestAnimationFrame(animate);
            else positionAnimationRef.current = null;
          };
          positionAnimationRef.current = window.requestAnimationFrame(animate);
        } else {
          vehicleMarker?.setLngLat([vehicleTarget[1], vehicleTarget[0]]);
        }
        lastVehicleTargetRef.current = vehicleTarget;
      }

      const accuracyMeters = latestLocation.accuracy || 0;
      const accuracySource = map.getSource(ACCURACY_SOURCE_ID) as GeoJSONSource | undefined;
      accuracySource?.setData(accuracyMeters > 0 ? accuracyCircleFeature(latestLocation.latitude, latestLocation.longitude, accuracyMeters) : emptyFeatureCollection());
    } else {
      if (vehicleMarker) {
        vehicleMarker.remove();
        delete markersRef.current[vehicleKey];
      }
      if (positionAnimationRef.current !== null) {
        window.cancelAnimationFrame(positionAnimationRef.current);
        positionAnimationRef.current = null;
      }
      lastVehicleTargetRef.current = null;
      (map.getSource(ACCURACY_SOURCE_ID) as GeoJSONSource | undefined)?.setData(emptyFeatureCollection());
    }

    const routeSource = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    const routeCoordinates: [number, number][] = routeGeometry && routeGeometry.length > 1
      ? routeGeometry.map(([latitude, longitude]) => [longitude, latitude] as [number, number])
      : [];
    routeSource?.setData(routeCoordinates.length > 1
      ? {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoordinates } }],
        }
      : emptyFeatureCollection());

    const cameraSignature = [
      trackingData?.tripId || "IDLE",
      fromStop || "",
      toStop || "",
      ...STOPS.flatMap((stop) => [stopsRecord[stop].latitude, stopsRecord[stop].longitude]),
    ].join("|");
    if (cameraSignatureRef.current !== cameraSignature) {
      cameraSignatureRef.current = cameraSignature;
      const tripBounds = !isIdle && routeCoordinates.length > 1
        ? routeCoordinates
        : !isIdle && fromStop && toStop
          ? [
              [stopsRecord[fromStop].longitude, stopsRecord[fromStop].latitude] as [number, number],
              [stopsRecord[toStop].longitude, stopsRecord[toStop].latitude] as [number, number],
              ...(latestLocation ? [[latestLocation.longitude, latestLocation.latitude] as [number, number]] : []),
            ]
          : boundsPoints;
      if (tripBounds.length >= 2) {
        const mapWidth = map.getContainer().clientWidth;
        const horizontalPadding = mapWidth < 480 ? 72 : mapWidth < 768 ? 64 : 56;
        const bounds = new LngLatBounds(tripBounds[0], tripBounds[0]);
        tripBounds.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, {
          padding: { top: 38, right: horizontalPadding, bottom: 56, left: horizontalPadding },
          maxZoom: 16,
          duration: 900,
          pitch: is3DViewRef.current ? 56 : 0,
          bearing: is3DViewRef.current ? -14 : 0,
        });
      } else if (tripBounds.length === 1) {
        map.easeTo({ center: tripBounds[0], zoom: 16, duration: 800 });
      }
    } else if (vehiclePositionChanged && latestLocation && followVehicleRef.current) {
      map.easeTo({
        center: [latestLocation.longitude, latestLocation.latitude],
        duration: 800,
        essential: true,
      });
    }
  }, [mapReady, trackingData]);

  if (isLoading && !trackingData) {
    return (
      <div className={`relative flex flex-col items-center justify-center rounded-[24px] border border-[#EADDC6] bg-[#FFFBF3] p-8 ${className}`} style={{ minHeight: height }}>
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-[3px] border-[#FFC93C]/30 border-t-[#FFC93C] animate-spin" />
          <Radio size={20} className="absolute inset-0 m-auto animate-pulse text-amber-600" />
        </div>
        <p className="mt-4 font-display text-[17px] text-[#141210]">Connecting to Live GPS Stream…</p>
        <p className="mt-1 text-[12px] text-zinc-500">Retrieving vehicle telemetry and verified campus stops</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative flex flex-col items-center justify-center rounded-[24px] border border-coral-200 bg-coral-50/60 p-8 text-center ${className}`} style={{ minHeight: height }}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-coral text-white shadow-soft"><ShieldAlert size={24} /></div>
        <h4 className="mt-4 font-display text-[18px] text-[#141210]">Live Tracking Unavailable</h4>
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-zinc-600">{error}</p>
        {onRefresh && <button onClick={onRefresh} className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-[12px] font-semibold text-[#141210] transition hover:bg-[#141210] hover:text-white"><RefreshCw size={13} /> Try Reconnecting</button>}
      </div>
    );
  }

  const isStale = trackingData?.trackingStatus === "stale" || trackingData?.latestLocation?.isStale;
  const isGPSUnavailable = trackingData?.trackingStatus === "gps_unavailable";
  const isCompleted = trackingData?.trackingStatus === "completed";
  const isActive = trackingData?.trackingStatus === "active";

  return (
    <div className={`relative overflow-hidden rounded-[26px] border border-[#EADDC6] bg-white shadow-soft ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#F0E4D0] bg-[#FFFDF8] px-3.5 py-3 sm:gap-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${isActive ? "bg-[#FFC93C] text-[#141210] shadow-sm" : isCompleted ? "bg-teal-100 text-teal-700" : isStale ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}><Compass size={17} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="truncate font-display text-[13.5px] font-bold text-[#141210] sm:text-[15px]">{trackingData && trackingData.tripId !== "IDLE" ? `${trackingData.from} → ${trackingData.to}` : "Campus Transit Loop"}</span>
              <Badge tone={isActive ? "green" : isCompleted ? "teal" : isStale ? "coral" : "gray"} className="!py-0.5 text-[9.5px] sm:text-[10px]">
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${isActive ? "animate-pulse bg-emerald-500" : isCompleted ? "bg-teal-500" : isStale ? "bg-amber-500" : "bg-gray-400"}`} />
                {isActive ? "Live GPS Active" : isCompleted ? "Trip Completed" : isStale ? `Stale (${trackingData?.latestLocation?.ageSeconds || ">60"}s ago)` : "Transit Loop Ready"}
              </Badge>
            </div>
            <div className="truncate text-[10.5px] text-zinc-500 sm:text-[11px]">Rider: <strong className="text-[#141210]">{trackingData?.riderName || "No rider assigned"}</strong> · 3D road view</div>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-3">
          {trackingData?.roadDistanceMeters !== undefined && trackingData.roadDistanceMeters > 0 && <div className="flex items-center gap-1.5 rounded-xl border border-[#EBE0CD] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#141210] sm:text-[11.5px]"><Navigation size={12} className="shrink-0 text-amber-600" /><span>{formatRoadDistance(trackingData.roadDistanceMeters)}</span>{trackingData.estimatedDurationSeconds !== undefined && <span className="font-normal text-zinc-500">· {formatEta(trackingData.estimatedDurationSeconds)}</span>}</div>}
          {onRefresh && <button onClick={onRefresh} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E7D9C1] bg-white text-zinc-600 transition hover:bg-[#F6EFE2] hover:text-[#141210]" title="Refresh tracking data"><RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /></button>}
        </div>
      </div>

      <div className="relative w-full overflow-hidden" style={{ height, minHeight: height }}>
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%", minHeight: height }} className="live-map-canvas" />
        <div className="pointer-events-none absolute left-3 top-3 z-[500]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#24433d] shadow-lg backdrop-blur-md"><span className={`h-2 w-2 rounded-full ${isActive ? "animate-pulse bg-emerald-500" : "bg-[#93a49e]"}`} />{isActive ? "Live 3D road view" : "Campus 3D map"}</span>
        </div>
        {trackingData?.latestLocation && <button type="button" onClick={() => {
          const map = mapInstanceRef.current;
          const location = trackingData.latestLocation;
          if (!map || !location) return;
          followVehicleRef.current = true;
          setIsFollowingVehicle(true);
          map.flyTo({ center: [location.longitude, location.latitude], zoom: Math.max(map.getZoom(), 16), pitch: Math.max(map.getPitch(), 52), duration: 850 });
        }} className="absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[10.5px] font-bold text-[#183d35] shadow-lg backdrop-blur-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" aria-label={isFollowingVehicle ? "Following Toto. Click to center the map on it" : "Center map on Toto and resume following"} title={isFollowingVehicle ? "Following Toto" : "Center on Toto"}><LocateFixed size={14} /> {isFollowingVehicle ? "Following Toto" : "Center Toto"}</button>}
        <button
          type="button"
          onClick={() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            const nextIs3D = !is3DViewRef.current;
            is3DViewRef.current = nextIs3D;
            setIs3DView(nextIs3D);
            map.easeTo({ pitch: nextIs3D ? 56 : 0, bearing: nextIs3D ? -14 : 0, duration: 650 });
          }}
          className="absolute right-3 top-[52px] z-[500] inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 py-2 text-[10.5px] font-bold text-[#183d35] shadow-lg backdrop-blur-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={`Switch to ${is3DView ? "2D" : "3D"} map view`}
          title={`Switch to ${is3DView ? "2D" : "3D"} map view`}
        >
          <Box size={14} /> {is3DView ? "2D view" : "3D view"}
        </button>
        {isStale && <div className="pointer-events-none absolute bottom-3 left-2 right-2 z-20 mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50/95 p-3 text-[11.5px] font-medium text-amber-900 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-4 sm:text-[12px]"><div className="flex items-start gap-2.5"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><div><strong className="font-bold">Location Signal Stale:</strong> Rider device hasn&apos;t broadcast GPS coordinates for over 60 seconds (device may be idle or screen locked).</div></div></div>}
        {isGPSUnavailable && trackingData && trackingData.tripId !== "IDLE" && <div className="pointer-events-none absolute bottom-3 left-2 right-2 z-20 mx-auto max-w-md rounded-2xl border border-[#E0D4C0] bg-white/95 p-3 text-[11.5px] font-medium text-zinc-700 shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4 sm:right-4 sm:text-[12px]"><div className="flex items-start gap-2.5"><Clock size={16} className="mt-0.5 shrink-0 animate-pulse text-amber-600" /><div><strong className="font-bold">Awaiting Rider GPS Stream:</strong> The rider has not yet started transmitting live GPS telemetry for this trip.</div></div></div>}
      </div>

      {showDetails && <div className="border-t border-[#F0E4D0] bg-[#FFFDF8] px-3.5 py-2.5 sm:px-5 sm:py-3"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[10.5px] text-zinc-600 sm:text-[11px]"><div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"><span className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-[10px]">Verified Stops:</span>{STOPS.map((stop) => {
        const coord = (trackingData?.stops && trackingData.stops[stop]) || DEFAULT_STOP_COORDINATES[stop];
        return <span key={stop} className="inline-flex items-center gap-1 rounded-md bg-[#F6EFE2] px-2 py-0.5 font-medium"><MapPin size={10} className="text-teal-600" /><strong>{stop}</strong>: {coord.latitude.toFixed(3)}, {coord.longitude.toFixed(3)}</span>;
      })}</div>{trackingData?.latestLocation && <div className="text-[10.5px] text-zinc-500 sm:text-[11px]">Last broadcast: <strong className="text-[#141210]">{new Date(trackingData.latestLocation.timestamp).toLocaleTimeString()}</strong></div>}</div></div>}
    </div>
  );
}

function emptyFeatureCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function accuracyCircleFeature(latitude: number, longitude: number, radiusMeters: number): GeoJSON.FeatureCollection {
  const earthRadius = 6_378_137;
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const angularDistance = radiusMeters / earthRadius;
  const points: [number, number][] = [];
  for (let bearing = 0; bearing <= 360; bearing += 12) {
    const direction = (bearing * Math.PI) / 180;
    const destinationLat = Math.asin(
      Math.sin(lat) * Math.cos(angularDistance) + Math.cos(lat) * Math.sin(angularDistance) * Math.cos(direction)
    );
    const destinationLon = lon + Math.atan2(
      Math.sin(direction) * Math.sin(angularDistance) * Math.cos(lat),
      Math.cos(angularDistance) - Math.sin(lat) * Math.sin(destinationLat)
    );
    points.push([(destinationLon * 180) / Math.PI, (destinationLat * 180) / Math.PI]);
  }
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [points] } }] };
}

function createInfoPopup(title: string, details: string[]): HTMLElement {
  const root = document.createElement("div");
  root.className = "live-map-popup";
  const heading = document.createElement("strong");
  heading.textContent = title;
  root.appendChild(heading);
  details.forEach((detail) => {
    const line = document.createElement("div");
    line.textContent = detail;
    root.appendChild(line);
  });
  return root;
}
