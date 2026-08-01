import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { MapPin, Loader2, Locate } from "lucide-react";
import { Button } from "./components/ui/button";

interface PickupMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords: { latitude: number; longitude: number } | null;
  onConfirm: (address: string, coords: { latitude: number; longitude: number }) => void;
  reverseGeocodeFn: (lat: number, lng: number) => Promise<string>;
}

export function PickupMap({
  isOpen,
  onClose,
  initialCoords,
  onConfirm,
  reverseGeocodeFn,
}: PickupMapModalProps) {
  const [mapModalLat, setMapModalLat] = useState<number>(22.5726);
  const [mapModalLng, setMapModalLng] = useState<number>(88.3639);
  const [mapModalAddress, setMapModalAddress] = useState<string>("");
  const [isReverseGeocodingMap, setIsReverseGeocodingMap] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Leaflet Map Initialization & Move Event Listener
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      if (mapContainerRef.current && !mapInstanceRef.current) {
        const initialLat = initialCoords?.latitude || 22.5726;
        const initialLng = initialCoords?.longitude || 88.3639;

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([initialLat, initialLng], 16);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        mapInstanceRef.current = map;

        // Trigger initial reverse geocode for starting center
        handleMapMoveEnd(initialLat, initialLng);

        map.on("moveend", () => {
          const center = map.getCenter();
          handleMapMoveEnd(center.lat, center.lng);
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleMapMoveEnd = async (lat: number, lng: number) => {
    setMapModalLat(lat);
    setMapModalLng(lng);
    setIsReverseGeocodingMap(true);
    try {
      const address = await reverseGeocodeFn(lat, lng);
      setMapModalAddress(address);
    } catch {
      setMapModalAddress(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    } finally {
      setIsReverseGeocodingMap(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#f5e6c8]"
        >
          {/* Top Modal Header */}
          <div className="flex items-center justify-between border-b border-[#7a4416]/20 bg-[#fffaf0]/95 px-6 py-4 shadow-sm backdrop-blur-md">
            <div>
              <h2 className="text-lg font-bold text-[#2e1808]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                Set pickup location
              </h2>
              <p className="text-xs font-medium text-[#6b3a12]">
                Move the map to position the pin at your exact pickup spot
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-[#7a4416]/10 px-4 py-2 text-xs font-semibold text-[#3a1f0a] transition hover:bg-[#7a4416]/20"
            >
              Cancel
            </button>
          </div>

          {/* Map Container View */}
          <div className="relative flex-1 w-full overflow-hidden">
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full z-0" />

            {/* Fixed Center Pin Overlay */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] text-[#ffd88a] shadow-2xl border-2 border-[#ffd88a]"
              >
                <MapPin size={24} className="text-[#ffd88a]" />
              </motion.div>
              <div className="h-3 w-1.5 bg-[#3a1f0a] shadow-md rounded-full -mt-1" />
            </div>

            {/* GPS Re-center Quick Button */}
            <button
              onClick={() => {
                if (mapInstanceRef.current && initialCoords) {
                  mapInstanceRef.current.setView([initialCoords.latitude, initialCoords.longitude], 16);
                }
              }}
              className="absolute right-6 top-6 z-[400] flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fffaf0] text-[#3a1f0a] shadow-xl border border-[#7a4416]/25 transition hover:scale-105"
              title="Re-center to GPS"
            >
              <Locate size={20} className="text-[#b8722c]" />
            </button>
          </div>

          {/* Bottom Address & Confirmation Panel */}
          <div className="border-t border-[#7a4416]/20 bg-[#fffaf0] p-6 shadow-2xl backdrop-blur-md">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-[#7a4416]/20 bg-[#fffaf0]/95 p-4 shadow-sm">
                <MapPin className="mt-0.5 shrink-0 text-[#b8722c]" size={20} />
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#7a4416]">Selected Address</div>
                  <div className="text-base font-bold text-[#2e1808]">
                    {isReverseGeocodingMap ? (
                      <span className="flex items-center gap-2 text-[#7a4416]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#b8722c]" /> Fetching address...
                      </span>
                    ) : (
                      mapModalAddress || "Move map to select location"
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => onConfirm(mapModalAddress, { latitude: mapModalLat, longitude: mapModalLng })}
                className="w-full h-14 rounded-2xl bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] text-base font-semibold text-[#ffe9be] shadow-lg transition hover:scale-[1.01] active:scale-95"
              >
                Confirm Pickup Location
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}