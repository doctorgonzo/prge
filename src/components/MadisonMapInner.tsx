"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Types ─────────────────────────────────────────────────────────────

export interface CrisisPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  severity: 1 | 2 | 3;
  active: boolean;
}

export interface CallerPin {
  id: string;
  lat: number;
  lng: number;
  name: string;
  neighborhood: string;
}

export interface NeighborhoodDarkness {
  id: string;
  bounds: [number, number][];
  darkness: number;
}

export interface MadisonMapInnerProps {
  crisisPins: CrisisPin[];
  callerPins: CallerPin[];
  neighborhoodDarkness: NeighborhoodDarkness[];
}

// ── Pin size lookup ───────────────────────────────────────────────────

const CRISIS_SIZE: Record<1 | 2 | 3, number> = { 1: 8, 2: 12, 3: 16 };

// ── Marker layers (imperative, since divIcon needs L directly) ───────

function CrisisMarkers({ pins }: { pins: CrisisPin[] }) {
  const map = useMap();

  useMemo(() => {
    // Clear previous crisis markers (tagged with a data attribute).
    map.eachLayer((layer) => {
      if ((layer as unknown as { _prge_crisis?: boolean })._prge_crisis) {
        map.removeLayer(layer);
      }
    });

    pins.forEach((pin) => {
      const size = CRISIS_SIZE[pin.severity];
      const icon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<span class="prge-map-crisis-dot${pin.active ? " prge-map-crisis-pulse" : ""}" style="width:${size}px;height:${size}px;opacity:${pin.active ? 1 : 0.4}"></span>`,
      });

      const marker = L.marker([pin.lat, pin.lng], { icon });
      (marker as unknown as { _prge_crisis: boolean })._prge_crisis = true;
      marker.bindTooltip(pin.label, {
        className: "prge-map-tooltip",
        direction: "top",
        offset: [0, -(size / 2 + 4)],
      });
      marker.addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pins]);

  return null;
}

function CallerMarkers({ pins }: { pins: CallerPin[] }) {
  const map = useMap();

  useMemo(() => {
    map.eachLayer((layer) => {
      if ((layer as unknown as { _prge_caller?: boolean })._prge_caller) {
        map.removeLayer(layer);
      }
    });

    pins.forEach((pin) => {
      const icon = L.divIcon({
        className: "",
        iconSize: [6, 6],
        iconAnchor: [3, 3],
        html: `<span class="prge-map-caller-dot"></span>`,
      });

      const marker = L.marker([pin.lat, pin.lng], { icon });
      (marker as unknown as { _prge_caller: boolean })._prge_caller = true;
      marker.bindTooltip(`${pin.name} — ${pin.neighborhood}`, {
        className: "prge-map-tooltip",
        direction: "top",
        offset: [0, -7],
      });
      marker.addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pins]);

  return null;
}

// ── Main inner component ─────────────────────────────────────────────

export default function MadisonMapInner({
  crisisPins,
  callerPins,
  neighborhoodDarkness,
}: MadisonMapInnerProps) {
  return (
    <div className="prge-map-root">
      {/* Injected styles — colocated so this component is self-contained */}
      <style>{`
        /* ── Container + CRT overlays ──────────────────────────── */
        .prge-map-root {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 2px;
        }

        /* Green-amber surveillance tint on the map itself */
        .prge-map-root .leaflet-container {
          width: 100%;
          height: 100%;
          background: #050a08;
          filter: hue-rotate(40deg) saturate(0.7) brightness(0.85);
        }

        /* Scanline overlay — reuses the PRGE repeating-gradient pattern */
        .prge-map-scanlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 800;
          background-image: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0) 0px,
            rgba(0, 0, 0, 0) 2px,
            rgba(0, 0, 0, 0.25) 2px,
            rgba(0, 0, 0, 0.25) 3px
          );
        }

        /* CRT vignette — dark edges, clear center */
        .prge-map-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 801;
          background: radial-gradient(
            ellipse at center,
            transparent 40%,
            rgba(0, 0, 0, 0.45) 80%,
            rgba(0, 0, 0, 0.8) 100%
          );
        }

        /* ── Attribution: crushed to near-invisible ───────────── */
        .leaflet-control-attribution {
          font-size: 8px !important;
          opacity: 0.3 !important;
          background: transparent !important;
          color: #4a5 !important;
        }
        .leaflet-control-attribution a {
          color: #4a5 !important;
        }

        /* Kill the default Leaflet zoom control chrome */
        .leaflet-control-zoom a {
          background: rgba(5, 10, 8, 0.85) !important;
          color: rgba(74, 222, 128, 0.6) !important;
          border-color: rgba(74, 222, 128, 0.15) !important;
        }
        .leaflet-control-zoom a:hover {
          color: rgba(74, 222, 128, 0.9) !important;
        }

        /* ── Crisis pin dot + pulse animation ─────────────────── */
        .prge-map-crisis-dot {
          display: block;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.9);
          box-shadow:
            0 0 6px rgba(239, 68, 68, 0.7),
            0 0 12px rgba(239, 68, 68, 0.3);
        }

        @keyframes prge-map-crisis-pulse-anim {
          0%, 100% {
            box-shadow:
              0 0 6px rgba(239, 68, 68, 0.7),
              0 0 12px rgba(239, 68, 68, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow:
              0 0 12px rgba(239, 68, 68, 0.95),
              0 0 24px rgba(239, 68, 68, 0.5),
              0 0 36px rgba(239, 68, 68, 0.2);
            transform: scale(1.3);
          }
        }
        .prge-map-crisis-pulse {
          animation: prge-map-crisis-pulse-anim 1.2s ease-in-out infinite;
        }

        /* ── Caller pin dot ───────────────────────────────────── */
        .prge-map-caller-dot {
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(251, 191, 36, 0.85);
          box-shadow:
            0 0 4px rgba(251, 191, 36, 0.6),
            0 0 8px rgba(251, 191, 36, 0.25);
        }

        /* ── Tooltip styling ──────────────────────────────────── */
        .prge-map-tooltip {
          background: rgba(5, 10, 8, 0.92) !important;
          border: 1px solid rgba(74, 222, 128, 0.3) !important;
          color: rgba(74, 222, 128, 0.85) !important;
          font-family: ui-monospace, "SF Mono", monospace !important;
          font-size: 10px !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
          padding: 3px 8px !important;
          border-radius: 1px !important;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.6) !important;
        }
        .prge-map-tooltip::before {
          border-top-color: rgba(74, 222, 128, 0.3) !important;
        }
      `}</style>

      <MapContainer
        center={[43.0747, -89.3841]}
        zoom={13}
        minZoom={12}
        maxZoom={15}
        zoomControl={true}
        attributionControl={true}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Neighborhood darkness polygons */}
        {neighborhoodDarkness.map((hood) => (
          <Polygon
            key={hood.id}
            positions={hood.bounds as L.LatLngExpression[]}
            pathOptions={{
              fillColor: "#000000",
              fillOpacity: hood.darkness,
              stroke: false,
            }}
          />
        ))}

        {/* Imperative marker layers */}
        <CrisisMarkers pins={crisisPins} />
        <CallerMarkers pins={callerPins} />
      </MapContainer>

      {/* CRT atmosphere overlays (CSS, not Leaflet layers) */}
      <div className="prge-map-scanlines" />
      <div className="prge-map-vignette" />
    </div>
  );
}
