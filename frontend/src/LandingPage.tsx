import { useState, useMemo, useEffect } from "react";
import { motion, type Variants, AnimatePresence } from "framer-motion";

import {
  MapPin,
  Clock3,
  ChevronDown,
  Circle,
  Square,
  Navigation,
  Sparkles,
  Car,
  Star,
  Loader2,
  Locate,
  ArrowRight,
  ShieldCheck,
  Bike,
  IndianRupee,
} from "lucide-react";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useNavigate } from "react-router-dom";
import { searchPlaces } from "./services/geoapify.service";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

interface RideModeOption {
  id: "bike" | "auto" | "car";
  name: string;
  description: string;
  icon: React.ReactNode;
  multiplier: number;
  etaMinutes: number;
}

const RIDE_MODES: RideModeOption[] = [
  {
    id: "bike",
    name: "Moto / Bike",
    description: "Fastest through traffic",
    icon: <Bike className="h-5 w-5" />,
    multiplier: 0.7,
    etaMinutes: 3,
  },
  {
    id: "auto",
    name: "Auto Rickshaw",
    description: "Affordable local ride",
    icon: <Sparkles className="h-5 w-5" />,
    multiplier: 0.9,
    etaMinutes: 5,
  },
  {
    id: "car",
    name: "Comfort Car",
    description: "Spacious & air-conditioned",
    icon: <Car className="h-5 w-5" />,
    multiplier: 1.2,
    etaMinutes: 7,
  },
];

function formatRupee(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Animated city map background ----------
function CityMapBackground() {
  const verticals = useMemo(
    () => [60, 140, 230, 320, 410, 500, 600, 700, 820, 940, 1060, 1180, 1300],
    [],
  );
  const horizontals = useMemo(() => [60, 140, 230, 330, 430, 540, 640, 740, 840], []);

  const pins = useMemo(
    () => [
      { x: 220, y: 200, delay: 0.2 },
      { x: 760, y: 140, delay: 1.1 },
      { x: 1080, y: 520, delay: 0.6 },
      { x: 340, y: 640, delay: 1.6 },
      { x: 980, y: 300, delay: 2.0 },
      { x: 540, y: 420, delay: 0.9 },
    ],
    [],
  );

  const routes = useMemo(
    () => [
      { d: "M -40 230 L 410 230 L 410 430 L 940 430 L 940 230 L 1380 230", dur: 14, delay: 0, color: "#0a0a0a" },
      { d: "M 1380 540 L 820 540 L 820 740 L 320 740 L 320 540 L -40 540", dur: 18, delay: 2, color: "#1a1a1a" },
      { d: "M 140 -40 L 140 330 L 600 330 L 600 640 L 1060 640 L 1060 900", dur: 16, delay: 4, color: "#0a0a0a" },
      { d: "M -40 130 L 500 130 L 500 540 L 1380 540", dur: 20, delay: 1.5, color: "#0a0a0a" },
    ],
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#fff_0%,#f3efe7_45%,#e9e2d2_100%)]" />

      <motion.div
        className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-[#0ea5e9]/15 blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-[520px] w-[520px] rounded-full bg-[#34d399]/20 blur-[120px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 30, 0], scale: [1, 0.9, 1.2, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b]/10 blur-[140px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.svg
        viewBox="0 0 1340 880"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-90"
        animate={{ x: [0, -24, 0, 18, 0], y: [0, 10, 0, -8, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      >
        {verticals.slice(0, -1).map((vx, i) =>
          horizontals.slice(0, -1).map((hy, j) => (
            <rect
              key={`b-${i}-${j}`}
              x={vx + 6}
              y={hy + 6}
              width={verticals[i + 1] - vx - 12}
              height={horizontals[j + 1] - hy - 12}
              fill={(i + j) % 3 === 0 ? "#e5dccb" : (i + j) % 3 === 1 ? "#ede5d4" : "#e0d6c2"}
              rx={3}
              opacity={0.55}
            />
          )),
        )}

        <path
          d="M -50 720 C 200 660, 420 780, 700 700 S 1200 560, 1400 620 L 1400 880 L -50 880 Z"
          fill="#bfdbfe"
          opacity="0.5"
        />

        {verticals.map((vx) => (
          <line key={`v-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#ffffff" strokeWidth={10} />
        ))}
        {horizontals.map((hy) => (
          <line key={`h-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#ffffff" strokeWidth={10} />
        ))}
        {verticals.map((vx) => (
          <line key={`vs-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#cbb98a" strokeWidth={1} strokeDasharray="6 10" />
        ))}
        {horizontals.map((hy) => (
          <line key={`hs-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#cbb98a" strokeWidth={1} strokeDasharray="6 10" />
        ))}

        {routes.map((r, idx) => (
          <g key={`route-${idx}`}>
            <path d={r.d} stroke={r.color} strokeOpacity={0.15} strokeWidth={5} fill="none" strokeLinecap="round" />
            <motion.path
              d={r.d}
              stroke={r.color}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="80 1600"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [-1680, 0] }}
              transition={{ duration: r.dur, delay: r.delay, repeat: Infinity, ease: "linear" }}
            />
            <circle r={7} fill="#0a0a0a" stroke="#fff" strokeWidth={3}>
              <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" begin={`${r.delay}s`} rotate="auto" path={r.d} />
            </circle>
          </g>
        ))}

        {pins.map((p, i) => (
          <g key={`pin-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <motion.circle
              r={6}
              fill="#0ea5e9"
              opacity={0.4}
              animate={{ r: [6, 26, 6], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
            />
            <circle r={5} fill="#0a0a0a" />
            <circle r={2} fill="#fff" />
          </g>
        ))}
      </motion.svg>

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  );
}

// ---------- Rotating tagline ----------
const taglines = ["anywhere", "anytime", "in style", "with Uber"];
function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % taglines.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block min-w-[280px] align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={taglines[i]}
          initial={{ y: 40, opacity: 0, filter: "blur(8px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -40, opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block bg-gradient-to-r from-black via-neutral-700 to-black bg-clip-text text-transparent"
        >
          {taglines[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ---------- Floating live stats chip ----------
function LiveChip() {
  const [eta, setEta] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setEta((e) => (e <= 1 ? 6 : e - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-black/80 shadow-sm backdrop-blur-md"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Navigation size={12} />
      <span>Drivers nearby · {eta} min away</span>
    </motion.div>
  );
}

export default function LandingPage() {
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  // Dynamic Current Location State
  const [currentLocationName, setCurrentLocationName] = useState("Kolkata, IN");
  const [isDetectingCity, setIsDetectingCity] = useState(false);

  // Input & Pricing States
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "destination" | null>(null);

  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);

  // Pricing display state
  const [showPrices, setShowPrices] = useState(false);
  const [isCalculatingPrices, setIsCalculatingPrices] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [calculatedDistanceMeters, setCalculatedDistanceMeters] = useState<number>(5000); // default 5km fallback

  // Detect user's current city on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      setIsDetectingCity(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
            const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`);
            const data = await res.json();
            if (data?.features?.[0]?.properties) {
              const prop = data.features[0].properties;
              const city = prop.city || prop.town || prop.county || "Kolkata";
              const country = prop.country_code ? prop.country_code.toUpperCase() : "IN";
              setCurrentLocationName(`${city}, ${country}`);
            }
          } catch {
            // keep fallback
          } finally {
            setIsDetectingCity(false);
          }
        },
        () => {
          setIsDetectingCity(false);
        },
        { timeout: 8000 }
      );
    }
  }, []);

  // Place Autocomplete Effect for Pickup
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeField === "pickup" && pickup.trim().length > 2) {
        setIsSearchingPickup(true);
        try {
          const features = await searchPlaces(pickup);
          setPickupSuggestions(features || []);
        } catch {
          setPickupSuggestions([]);
        } finally {
          setIsSearchingPickup(false);
        }
      } else {
        setIsSearchingPickup(false);
        setPickupSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickup, activeField]);

  // Place Autocomplete Effect for Destination
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeField === "destination" && destination.trim().length > 2) {
        setIsSearchingDestination(true);
        try {
          const features = await searchPlaces(destination);
          setDestinationSuggestions(features || []);
        } catch {
          setDestinationSuggestions([]);
        } finally {
          setIsSearchingDestination(false);
        }
      } else {
        setIsSearchingDestination(false);
        setDestinationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination, activeField]);

  const handleSelectPlace = (feature: any, type: "pickup" | "destination") => {
    const address = feature.properties?.formatted || feature.properties?.name || "Selected Location";
    const [longitude, latitude] = feature.geometry?.coordinates || [0, 0];
    if (type === "pickup") {
      setPickup(address);
      setPickupCoords({ latitude, longitude });
      setPickupSuggestions([]);
    } else {
      setDestination(address);
      setDestinationCoords({ latitude, longitude });
      setDestinationSuggestions([]);
    }
    setActiveField(null);
  };

  const handleUseCurrentLocationForPickup = () => {
    setPricingError("");
    if (!navigator.geolocation) {
      setPricingError("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocatingPickup(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords({ latitude, longitude });
        setPickup(`Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        setIsLocatingPickup(false);
      },
      (error) => {
        setPricingError(`Unable to retrieve location: ${error.message}`);
        setIsLocatingPickup(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSeePricesClick = async () => {
    if (!pickup.trim() || !destination.trim()) {
      setPricingError("Please fill in both pickup and dropoff locations.");
      return;
    }
    setPricingError("");
    setShowPrices(true);
    setIsCalculatingPrices(true);

    try {
      if (pickupCoords && destinationCoords) {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
        const url = `https://api.geoapify.com/v1/routing?waypoints=${pickupCoords.latitude},${pickupCoords.longitude}|${destinationCoords.latitude},${destinationCoords.longitude}&mode=drive&apiKey=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.features?.[0]?.properties?.distance) {
          setCalculatedDistanceMeters(data.features[0].properties.distance);
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // keep fallback distance
    } finally {
      setIsCalculatingPrices(false);
    }
  };

  const baseFareValue = Math.round((calculatedDistanceMeters / 100) * 5);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0ece2] font-sans text-black">
      <CityMapBackground />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col items-center justify-between gap-16 px-8 py-10 lg:flex-row">
        {/* Left */}
        <motion.div className="flex-1" variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="mb-5 flex flex-wrap items-center gap-3">
            <LiveChip />
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
              <Sparkles size={12} className="text-amber-500" />
              New · Schedule rides up to 30 days ahead
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2 text-base text-gray-800">
            <MapPin size={18} className="text-black" />
            <span className="font-medium">
              {isDetectingCity ? "Detecting location..." : currentLocationName}
            </span>
            <button className="text-gray-500 underline underline-offset-4 transition-colors hover:text-black">
              Change city
            </button>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="max-w-xl text-6xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
          >
            Go <RotatingWord />
            <br />
            with one tap.
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-5 max-w-md text-base text-black/60">
            Request a ride, hop in, and relax. Real-time tracking, upfront pricing,
            and trusted drivers — wherever you're headed.
          </motion.p>

          <motion.div variants={itemVariants}>
            <button className="mt-7 flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow-sm ring-1 ring-black/5 transition-all hover:bg-black hover:text-white hover:shadow-lg active:scale-95">
              <Clock3 size={20} />
              <span className="text-base font-medium">Pickup now</span>
              <ChevronDown size={18} />
            </button>
          </motion.div>

          {/* Inputs */}
          <motion.div variants={itemVariants} className="mt-7 max-w-lg space-y-5">
            {/* Pickup Input */}
            <div className="group relative">
              <motion.div
                className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400 opacity-0 blur transition duration-500"
                animate={{ opacity: isFocused ? 0.7 : 0 }}
              />
              <div
                className="relative"
                onFocus={() => setIsFocused(true)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFocused(false);
                }}
              >
                <Circle className="absolute left-5 top-1/2 z-10 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-black" size={16} />
                <Input
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setActiveField("pickup");
                    setPickupCoords(null);
                  }}
                  onFocus={() => setActiveField("pickup")}
                  placeholder="Pickup location"
                  className="h-16 w-full rounded-2xl border-2 border-transparent bg-white/90 pl-14 pr-14 text-lg shadow-sm backdrop-blur transition-all focus-within:border-black focus-within:bg-white focus-within:shadow-xl focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForPickup}
                  title="Use current location for pickup"
                  className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-black p-2.5 text-white transition-all hover:scale-110"
                >
                  {isLocatingPickup ? <Loader2 className="animate-spin" size={18} /> : <Locate size={18} />}
                </button>

                {/* Pickup Dropdown */}
                <AnimatePresence>
                  {activeField === "pickup" && pickup.trim().length > 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-xl backdrop-blur"
                    >
                      {isSearchingPickup ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                        </div>
                      ) : pickupSuggestions.length > 0 ? (
                        pickupSuggestions.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSelectPlace(item, "pickup")}
                            className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-black transition hover:bg-gray-100"
                          >
                            <MapPin size={14} className="shrink-0 text-gray-400" />
                            <span className="truncate">{item.properties?.formatted || item.properties?.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="py-3 text-center text-sm text-gray-400">No locations found</div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Dropoff Input */}
            <div className="relative">
              <div className="absolute left-[27px] -top-6 h-10 w-0.5 overflow-hidden">
                <div className="h-full w-full bg-gray-300" />
                <motion.div
                  className="absolute top-0 left-0 h-full w-full origin-top bg-black"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: isFocused ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              </div>
              <Square
                className={`absolute left-5 top-1/2 z-10 -translate-y-1/2 transition-colors ${isFocused ? "text-black" : "text-gray-500"}`}
                size={16}
              />
              <Input
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setActiveField("destination");
                  setDestinationCoords(null);
                }}
                onFocus={() => setActiveField("destination")}
                placeholder="Dropoff location"
                className="h-16 w-full rounded-2xl border-2 border-transparent bg-white/90 pl-14 text-lg shadow-sm backdrop-blur transition-all focus-within:border-black focus-within:bg-white focus-within:shadow-xl focus:outline-none"
              />

              {/* Destination Dropdown */}
              <AnimatePresence>
                {activeField === "destination" && destination.trim().length > 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-xl backdrop-blur"
                  >
                    {isSearchingDestination ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                      </div>
                    ) : destinationSuggestions.length > 0 ? (
                      destinationSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectPlace(item, "destination")}
                          className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-black transition hover:bg-gray-100"
                        >
                          <MapPin size={14} className="shrink-0 text-gray-400" />
                          <span className="truncate">{item.properties?.formatted || item.properties?.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="py-3 text-center text-sm text-gray-400">No locations found</div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Inline Pricing Error */}
          <AnimatePresence>
            {pricingError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mt-3 text-sm font-medium text-red-600"
              >
                {pricingError}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="mt-10 flex flex-wrap items-center gap-6">
            <Button
              className="group relative h-14 overflow-hidden rounded-2xl bg-black px-8 text-base text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
              onClick={handleSeePricesClick}
            >
              <span className="relative z-10">See prices</span>
              <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 transition-transform duration-700 group-hover:translate-x-[420%]" />
            </Button>
            <button
              type="button"
              className="group relative text-base font-medium text-gray-600 transition-colors hover:text-black"
              onClick={() => navigate("/login")}
            >
              Log in to see your recent activity
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-black transition-all duration-300 group-hover:w-full" />
            </button>
          </motion.div>

          {/* Pricing Preview Showcase Panel matching ChooseMode styles */}
          <AnimatePresence>
            {showPrices && (
              <motion.div
                initial={{ opacity: 0, y: 16, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: 16, height: 0 }}
                className="mt-8 max-w-lg overflow-hidden rounded-3xl border border-black/10 bg-white/95 p-6 shadow-2xl backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-black">Choose your ride mode</h3>
                    <p className="text-xs text-gray-500 truncate max-w-[280px]">
                      {pickup} → {destination}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPrices(false)}
                    className="text-xs font-semibold text-gray-400 hover:text-black"
                  >
                    Close
                  </button>
                </div>

                {isCalculatingPrices ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-black" />
                    <p className="text-sm">Calculating best fares & ETAs...</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {RIDE_MODES.map((mode) => {
                      const calculatedFare = Math.round(baseFareValue * mode.multiplier);
                      return (
                        <div
                          key={mode.id}
                          onClick={() => navigate("/login")}
                          className="group flex cursor-pointer items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/60 p-4 transition-all hover:border-black hover:bg-white hover:shadow-md"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="grid h-12 w-12 place-items-center rounded-xl bg-black text-white shadow-sm">
                              {mode.icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-black">{mode.name}</span>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  {mode.etaMinutes} mins away
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{mode.description}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-base font-extrabold text-black flex items-center justify-end">
                              <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                              {formatRupee(calculatedFare)}
                            </p>
                            <div className="text-xs text-emerald-600 flex items-center gap-1 justify-end font-semibold">
                              <span>Book</span> <ArrowRight size={12} />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2 text-center">
                      <p className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                        <ShieldCheck size={12} /> Sign in to confirm booking & lock in your fare
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trust row */}
          <motion.div variants={itemVariants} className="mt-10 flex items-center gap-6 text-sm text-black/60">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="font-semibold text-black">4.9</span>
              <span>· 130M+ riders</span>
            </div>
            <div className="hidden h-4 w-px bg-black/15 md:block" />
            <div className="hidden md:block">Available in 10,000+ cities</div>
          </motion.div>
        </motion.div>

        {/* Right */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
          className="relative hidden flex-1 justify-center lg:flex"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-sky-300/40 via-transparent to-amber-300/40 blur-2xl" />
            <img
              src="https://cn-geo1.uber.com/image-proc/crop/resizecrop/udam/format=auto/width=1344/height=1344/srcb64=aHR0cHM6Ly90Yi1zdGF0aWMudWJlci5jb20vcHJvZC91ZGFtLWFzc2V0cy9jZTczNjUzMy1iMWE0LTQ3ZjktOTk0OS0zNWEzZGUyNTkyYzk="
              alt="Uber Journey"
              className="relative w-[460px] rounded-[2rem] object-cover shadow-2xl ring-1 ring-black/5"
            />

            {/* Top-left floating ETA card */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="absolute -left-8 top-10 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <Car size={18} />
              </div>
              <div className="text-sm">
                <div className="font-semibold">UberX · 2 min</div>
                <div className="text-black/55">Arriving nearby</div>
              </div>
            </motion.div>

            {/* Right floating rating */}
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="absolute -right-6 top-1/2 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur"
            >
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">5.0 trip</span>
            </motion.div>

            {/* Bottom card */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-6 left-1/2 flex w-[88%] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#B67863] px-6 py-5 text-white shadow-xl backdrop-blur"
            >
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Ready to travel?</h2>
                <p className="text-sm opacity-90">Plan your ride in advance.</p>
              </div>
              <Button className="rounded-full bg-white px-6 font-semibold text-black transition-transform hover:scale-105 hover:bg-gray-100">
                Schedule
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}