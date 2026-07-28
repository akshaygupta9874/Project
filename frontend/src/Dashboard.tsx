import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  MapPin,
  Navigation,
  Car,
  LogOut,
  History,
  Sparkles,
  ArrowRight,
  Locate,
  Loader2,
  Clock,
  Route as RouteIcon
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { Input } from "./components/ui/input";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";
import { useAuthContext } from "./context/authContext";
import type { DriverProfile } from "./lib/driverApi";
import DriverCTA from "./components/DriverCTA";
import { searchPlaces } from "./services/geoapify.service";

/**
 * Rider Dashboard — Unified Golden-Luxury Master Ticket Edition
 */

type RideStatus =
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

interface RidePoint {
  address: string;
  coordinates: { latitude: number; longitude: number };
}

interface Ride {
  _id: string;
  pickup: RidePoint;
  destination: RidePoint;
  fare: { estimated: number; final?: number | null };
  distance: { estimated: number | null };
  duration: { estimated: number | null };
  status: RideStatus;
}

// ---- Motion presets ----
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

// ---------- Golden-brown animated city map background ----------
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
      { d: "M -40 230 L 410 230 L 410 430 L 940 430 L 940 230 L 1380 230", dur: 14, delay: 0, color: "#3a1f0a" },
      { d: "M 1380 540 L 820 540 L 820 740 L 320 740 L 320 540 L -40 540", dur: 18, delay: 2, color: "#4a2a12" },
      { d: "M 140 -40 L 140 330 L 600 330 L 600 640 L 1060 640 L 1060 900", dur: 16, delay: 4, color: "#2e1808" },
    ],
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_15%,#fff7e6_0%,#f5e6c8_35%,#e6c893_65%,#c99a5a_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(80,45,15,0.35) 1px, transparent 1px), radial-gradient(rgba(80,45,15,0.2) 1px, transparent 1px)",
          backgroundSize: "3px 3px, 7px 7px",
          backgroundPosition: "0 0, 1px 2px",
        }}
      />
      <motion.div
        className="absolute -left-40 top-0 h-[560px] w-[560px] rounded-full bg-[#f4b860]/40 blur-[130px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-40 bottom-0 h-[560px] w-[560px] rounded-full bg-[#b8722c]/40 blur-[130px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 30, 0], scale: [1, 0.9, 1.2, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        viewBox="0 0 1340 880"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        animate={{ x: [0, -24, 0, 18, 0], y: [0, 10, 0, -8, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="brassRoute" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a4416" />
            <stop offset="50%" stopColor="#c58a3a" />
            <stop offset="100%" stopColor="#7a4416" />
          </linearGradient>
          <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd88a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd88a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {verticals.slice(0, -1).map((vx, i) =>
          horizontals.slice(0, -1).map((hy, j) => (
            <rect
              key={`b-${i}-${j}`}
              x={vx + 6}
              y={hy + 6}
              width={verticals[i + 1] - vx - 12}
              height={horizontals[j + 1] - hy - 12}
              fill={(i + j) % 4 === 0 ? "#e8c98b" : (i + j) % 4 === 1 ? "#dbb271" : (i + j) % 4 === 2 ? "#efd8a3" : "#cf9d55"}
              rx={3}
              opacity={0.55}
            />
          )),
        )}

        {verticals.map((vx) => (
          <line key={`v-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#fff4dc" strokeWidth={10} />
        ))}
        {horizontals.map((hy) => (
          <line key={`h-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#fff4dc" strokeWidth={10} />
        ))}

        {routes.map((r, idx) => (
          <g key={`route-${idx}`}>
            <path d={r.d} stroke={r.color} strokeOpacity={0.22} strokeWidth={5} fill="none" strokeLinecap="round" />
            <motion.path
              d={r.d}
              stroke="url(#brassRoute)"
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="80 1600"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [-1680, 0] }}
              transition={{ duration: r.dur, delay: r.delay, repeat: Infinity, ease: "linear" }}
            />
          </g>
        ))}

        {pins.map((p, i) => (
          <g key={`pin-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <circle r={28} fill="url(#pinGlow)" />
            <motion.circle
              r={6}
              fill="#c58a3a"
              opacity={0.6}
              animate={{ r: [6, 28, 6], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.4, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
            />
            <circle r={5} fill="#3a1f0a" />
            <circle r={2} fill="#fff4dc" />
          </g>
        ))}
      </motion.svg>
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f5e6c8]/95 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#c99a5a]/60 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(60,30,8,0.35)_100%)]" />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(true);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [rideError, setRideError] = useState("");
  const [serverMessage, setServerMessage] = useState("");

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] =
    useState<{ latitude: number; longitude: number } | null>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "destination" | null>(null);

  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);

  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const [isLocating, setIsLocating] = useState(false);

  const socketRef = useRef<any>(null);
  const formRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function loadDriver() {
      try {
        const res = await appApi.get("/driver/profile");
        setDriverProfile(res.data.data);
      } catch {
        setDriverProfile(null);
      } finally {
        setIsLoadingDriver(false);
      }
    }
    loadDriver();
  }, []);

  // Close suggestions dropdown when clicking outside the master card form
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setActiveField(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await appApi.get<{ message: string; ride: Ride }>("/ride/current");
        if (cancelled) return;
        const ride = response.data.ride;
        if (ride && ride.status !== "COMPLETED" && ride.status !== "CANCELLED") {
          navigate(`/ride/${ride._id}`, { replace: true });
          return;
        }
      } catch {
        // no active ride
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const riderSocket = connectRiderSocket({
      onReady: () => setServerMessage("Connected to live updates."),
      onError: (message: string) => setServerMessage(message),
      onRideAccepted: () => setServerMessage("Driver has accepted your ride."),
      onDriverLocation: () => {},
      onDriverArrived: () => setServerMessage("Driver has arrived at pickup."),
      onRideStarted: () => setServerMessage("Your ride has started."),
      onRideArrivedAtDestination: () => setServerMessage("Driver has arrived at destination."),
      onRideCompleted: () => setServerMessage("Your ride is complete."),
      onRideCancelled: (payload: any) =>
        setServerMessage(`Ride cancelled by ${payload.cancelledBy.toLowerCase()}.`),
      onNoDriversAvailable: () =>
        setServerMessage("No drivers were available for your request."),
    });
    socketRef.current = riderSocket;
    return () => riderSocket?.close();
  }, []);

  useEffect(() => {
    if (activeField === "pickup" && pickup.trim().length > 2) {
      setIsSearchingPickup(true);
    } else {
      setIsSearchingPickup(false);
      setPickupSuggestions([]);
    }

    const timer = setTimeout(async () => {
      if (activeField === "pickup" && pickup.trim().length > 2) {
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
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickup, activeField]);

  useEffect(() => {
    if (activeField === "destination" && destination.trim().length > 2) {
      setIsSearchingDestination(true);
    } else {
      setIsSearchingDestination(false);
      setDestinationSuggestions([]);
    }

    const timer = setTimeout(async () => {
      if (activeField === "destination" && destination.trim().length > 2) {
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
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination, activeField]);

  useEffect(() => {
    if (!pickupCoords || !destinationCoords) {
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }
    async function fetchRouteDetails() {
      setIsCalculatingRoute(true);
      try {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
        const url = `https://api.geoapify.com/v1/routing?waypoints=${pickupCoords?.latitude},${pickupCoords?.longitude}|${destinationCoords?.latitude},${destinationCoords?.longitude}&mode=drive&apiKey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
          const feature = data.features[0];
          setRouteDistance(feature.properties.distance);
          setRouteDuration(feature.properties.time);
        }
      } catch (err) {
        console.error("Failed to fetch route details", err);
      } finally {
        setIsCalculatingRoute(false);
      }
    }
    fetchRouteDetails();
  }, [pickupCoords, destinationCoords]);

  const handleSelectPlace = (feature: any, type: "pickup" | "destination") => {
    const address = feature.properties?.formatted || feature.properties?.name || "Selected Location";
    const [longitude, latitude] = feature.geometry?.coordinates || [0, 0];
    if (type === "pickup") {
      setPickup(address);
      setPickupCoords({ latitude, longitude });
      setPickupSuggestions([]);
      setIsSearchingPickup(false);
    } else {
      setDestination(address);
      setDestinationCoords({ latitude, longitude });
      setDestinationSuggestions([]);
      setIsSearchingDestination(false);
    }
    setActiveField(null);
  };

  const handleUseCurrentLocation = () => {
    setRideError("");
    if (!navigator.geolocation) {
      setRideError("Geolocation is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords({ latitude, longitude });
        setPickup(`Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        setIsLocating(false);
      },
      (error) => {
        setRideError(`Unable to access location: ${error.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleProceedToChoose = () => {
    if (!pickup.trim() || !destination.trim()) {
      setRideError("Please provide both pickup and destination details.");
      return;
    }
    if (!pickupCoords || !destinationCoords) {
      setRideError("Please select both pickup and destination from the suggestions.");
      return;
    }
    if (!user?._id) {
      setRideError("Unable to determine your profile. Please sign in again.");
      return;
    }
    setRideError("");

    const payload = {
      pickup,
      destination,
      pickupCoords,
      destinationCoords,
      routeDistance,
      routeDuration,
    };

    sessionStorage.setItem("pendingRide", JSON.stringify(payload));
    navigate("/choose");
  };

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
      setIsLoggingOut(false);
    }
  }

  if (isLoggingOut) {
    return <LoadingScreen sublabel="Signing you out..." />;
  }

  if (isBootstrapping) {
    return <LoadingScreen sublabel="Preparing your dashboard..." />;
  }

  const canProceed =
    Boolean(pickup) &&
    Boolean(destination) &&
    Boolean(pickupCoords) &&
    Boolean(destinationCoords) &&
    routeDistance !== null &&
    routeDuration !== null &&
    !isCalculatingRoute;

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "Rider";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f5e6c8] font-sans text-[#2e1808]">
      <CityMapBackground />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes route-dash {
          to { stroke-dashoffset: -40; }
        }
        .rd-route-line {
          stroke-dasharray: 6 8;
          animation: route-dash 1.2s linear infinite;
        }
        .rd-scroll-fade::-webkit-scrollbar { width: 6px; }
        .rd-scroll-fade::-webkit-scrollbar-thumb { background: #c58a3a; border-radius: 999px; }
      `}</style>

      {/* Main Content Container */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-16 pt-8 sm:px-8 lg:px-12"
      >
        {/* Header */}
        <motion.header variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#3a1f0a] to-[#7a4416] text-[#ffd88a] shadow-[0_10px_24px_-10px_rgba(58,31,10,0.6)]"
            >
              <Car className="h-6 w-6" />
            </motion.div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7a4416]">
                Aura Luxury Rides
              </p>
              <p className="text-sm font-medium text-[#2e1808]">
                Hey, <span className="font-bold text-[#3a1f0a]">{displayName.split(" ")[0]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => navigate("/history")}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#7a4416]/20 bg-[#fffaf0]/90 text-[#3a1f0a] shadow-sm backdrop-blur transition hover:bg-[#fff4dc]"
              aria-label="History"
            >
              <History className="h-4 w-4 text-[#b8722c]" />
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#7a4416]/20 bg-[#fffaf0]/90 text-[#3a1f0a] shadow-sm backdrop-blur transition hover:bg-[#fff4dc]"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4 text-[#b8722c]" />
            </motion.button>
          </div>
        </motion.header>

        {/* UNIFIED MASTER TICKET CARD */}
        <motion.section
          ref={formRef}
          variants={itemVariants}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative overflow-hidden rounded-[2.5rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/95 via-[#fff4dc]/90 to-[#f7e2b8]/90 p-6 sm:p-10 shadow-[0_40px_100px_-24px_rgba(80,40,10,0.55),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-2xl"
        >
          {/* Perforation ticket-edge dots */}
          <div className="pointer-events-none absolute left-0 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={`pl-${i}`} className="h-2 w-2 rounded-full bg-[#f5e6c8]" />
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-1/2 flex translate-x-1/2 -translate-y-1/2 flex-col gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={`pr-${i}`} className="h-2 w-2 rounded-full bg-[#f5e6c8]" />
            ))}
          </div>

          {/* Brass top rail */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />

          {/* Hero greeting & Title inside the card */}
          <div className="mb-6 text-center sm:text-left">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3a1f0a] to-[#7a4416] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#ffd88a] shadow-[0_8px_20px_-8px_rgba(58,31,10,0.6)]">
              <Sparkles size={13} />
              Where are we heading today?
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1
                className="text-3xl leading-tight text-[#2e1808] sm:text-4xl lg:text-5xl font-bold tracking-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
              >
                Book a ride in{" "}
                <span className="italic bg-gradient-to-br from-[#2e1808] via-[#6b3a12] to-[#b8722c] bg-clip-text text-transparent">
                  seconds.
                </span>
              </h1>

              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleUseCurrentLocation}
                className="self-start sm:self-auto inline-flex items-center gap-2 rounded-full border border-[#7a4416]/25 bg-[#fffaf0]/90 px-4 py-2 text-xs font-semibold text-[#3a1f0a] shadow-sm transition hover:bg-[#fff4dc] hover:border-[#b8722c]"
              >
                {isLocating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Locate className="h-3.5 w-3.5 text-[#b8722c]" />
                )}
                Use current location
              </motion.button>
            </div>
          </div>

          {/* Ticket perforation divider */}
          <div className="relative my-6 flex items-center gap-3">
            <span className="h-6 w-6 -translate-x-1/2 rounded-full bg-[#f5e6c8] shadow-[inset_0_2px_4px_rgba(122,68,22,0.2)]" />
            <div
              className="h-px flex-1"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #7a4416 0 8px, transparent 8px 16px)",
                opacity: 0.4,
              }}
            />
            <span className="h-6 w-6 translate-x-1/2 rounded-full bg-[#f5e6c8] shadow-[inset_0_2px_4px_rgba(122,68,22,0.2)]" />
          </div>

          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7a4416]">
            Route Specifications
          </div>

          {/* Route Fields */}
          <div className="relative space-y-4">
            {/* connecting line */}
            <svg
              className="pointer-events-none absolute left-[22px] top-[36px] h-[calc(100%-72px)] w-[2px]"
              viewBox="0 0 2 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="#b8722c"
                strokeWidth="2"
                className="rd-route-line"
              />
            </svg>

            {/* Pickup */}
            <div className="relative">
              <FieldRow
                icon={<Dot color="dark" />}
                trailing={
                  <div className="grid h-8 w-8 place-items-center text-[#7a4416]">
                    <MapPin className="h-4 w-4 text-[#b8722c]" />
                  </div>
                }
                label="Pickup Location"
                value={pickup}
                placeholder="Where from?"
                onChange={(v) => {
                  setPickup(v);
                  setActiveField("pickup");
                  setPickupCoords(null);
                }}
                onFocus={() => setActiveField("pickup")}
              />
              <AnimatePresence>
                {activeField === "pickup" && pickup.trim().length > 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="rd-scroll-fade absolute left-11 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#7a4416]/25 bg-[#fffaf0] p-1 shadow-[0_20px_50px_-20px_rgba(80,40,10,0.4)] backdrop-blur-md"
                  >
                    {isSearchingPickup ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#7a4416]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching places...
                      </div>
                    ) : pickupSuggestions.length > 0 ? (
                      pickupSuggestions.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => handleSelectPlace(item, "pickup")}
                          className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-[#2e1808] transition hover:bg-[#fff4dc]"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b8722c]" />
                          <span className="truncate">
                            {item.properties?.formatted || item.properties?.name}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-[#7a4416]/70">
                        No locations found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Destination */}
            <div className="relative">
              <FieldRow
                icon={<Dot color="brass" />}
                trailing={
                  <div className="grid h-8 w-8 place-items-center text-[#7a4416]">
                    <Navigation className="h-4 w-4 text-[#b8722c]" />
                  </div>
                }
                label="Destination"
                value={destination}
                placeholder="Where to?"
                onChange={(v) => {
                  setDestination(v);
                  setActiveField("destination");
                  setDestinationCoords(null);
                }}
                onFocus={() => setActiveField("destination")}
              />
              <AnimatePresence>
                {activeField === "destination" && destination.trim().length > 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="rd-scroll-fade absolute left-11 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#7a4416]/25 bg-[#fffaf0] p-1 shadow-[0_20px_50px_-20px_rgba(80,40,10,0.4)] backdrop-blur-md"
                  >
                    {isSearchingDestination ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#7a4416]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching places...
                      </div>
                    ) : destinationSuggestions.length > 0 ? (
                      destinationSuggestions.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => handleSelectPlace(item, "destination")}
                          className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-[#2e1808] transition hover:bg-[#fff4dc]"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b8722c]" />
                          <span className="truncate">
                            {item.properties?.formatted || item.properties?.name}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-[#7a4416]/70">
                        No locations found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Dispatch & Route Metrics Bar inside Master Card */}
          <div className="mt-8 pt-6 border-t border-[#7a4416]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <AnimatePresence mode="wait">
              {(routeDistance !== null || isCalculatingRoute) ? (
                <motion.div
                  key={isCalculatingRoute ? "calc" : "done"}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-3 rounded-full border border-[#7a4416]/20 bg-[#fffaf0]/90 px-4 py-2 text-xs font-medium text-[#3a1f0a] shadow-sm"
                >
                  {isCalculatingRoute ? (
                    <div className="flex items-center gap-2 text-[#7a4416]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Calculating route…
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <RouteIcon className="h-3.5 w-3.5 text-[#b8722c]" />
                        <span className="tabular-nums font-semibold">
                          {routeDistance ? `${(routeDistance / 1000).toFixed(1)} km` : ""}
                        </span>
                      </div>
                      <span className="h-3 w-px bg-[#7a4416]/30" />
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#b8722c]" />
                        <span className="tabular-nums font-semibold">
                          {routeDuration ? `${Math.round(routeDuration / 60)} mins` : ""}
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              ) : (
                <div className="text-xs font-medium text-[#7a4416]/80">
                  Select pickup & destination to estimate fare & time.
                </div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleProceedToChoose}
              disabled={!canProceed}
              whileHover={canProceed ? { y: -2 } : {}}
              whileTap={canProceed ? { scale: 0.97 } : {}}
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] px-8 py-4 text-base font-semibold text-[#ffe9be] shadow-[0_18px_40px_-12px_rgba(58,31,10,0.7),inset_0_1px_0_rgba(255,216,138,0.35)] transition-all hover:shadow-[0_24px_50px_-14px_rgba(58,31,10,0.85)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#c58a3a]/40" />
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#ffd88a]/60 to-transparent transition-transform duration-1000 group-hover:translate-x-[460%]" />
              <span className="relative z-10 inline-flex items-center gap-2">
                Choose vehicle
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ArrowRight className="h-4 w-4 text-[#ffd88a]" />
                </motion.span>
              </span>
            </motion.button>
          </div>

          {/* Inline error */}
          <AnimatePresence>
            {rideError && (
              <motion.p
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-xs font-medium text-rose-900 shadow-sm"
              >
                {rideError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Brass bottom rail */}
          <div className="pointer-events-none absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />
        </motion.section>

        {/* Driver CTA Section */}
        <DriverCTA
          user={user!}
          driver={driverProfile}
          loading={isLoadingDriver}
        />

        {/* Passive server message */}
        <AnimatePresence>
          {serverMessage && (
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: 8 }}
              className="mx-auto flex items-center gap-2 rounded-full border border-[#7a4416]/25 bg-[#fffaf0]/90 px-4 py-2 text-xs font-medium text-[#3a1f0a] shadow-sm backdrop-blur"
            >
              <span className="relative grid h-2.5 w-2.5 place-items-center">
                <span className="absolute inset-0 rounded-full bg-[#b8722c] animate-ping" />
                <span className="h-2 w-2 rounded-full bg-[#7a4416]" />
              </span>
              {serverMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Dot({ color }: { color: "dark" | "brass" }) {
  if (color === "brass") {
    return (
      <span className="relative grid h-6 w-6 place-items-center">
        <span className="absolute inset-0 rounded-md bg-[#b8722c]/20" />
        <span className="h-3 w-3 rounded-[3px] bg-gradient-to-br from-[#7a4416] to-[#b8722c] shadow-sm" />
      </span>
    );
  }
  return (
    <span className="relative grid h-6 w-6 place-items-center">
      <span className="absolute inset-0 rounded-full bg-[#3a1f0a]/20 animate-ping" />
      <span className="h-3 w-3 rounded-full bg-[#3a1f0a] ring-2 ring-[#fffaf0] shadow-sm" />
    </span>
  );
}

function FieldRow({
  icon,
  trailing,
  label,
  value,
  placeholder,
  onChange,
  onFocus,
}: {
  icon: React.ReactNode;
  trailing: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[#7a4416]/20 bg-[#fffaf0]/95 px-4 py-3 transition-all duration-300 focus-within:border-transparent focus-within:ring-2 focus-within:ring-[#b8722c] focus-within:shadow-[0_0_0_4px_rgba(184,114,44,0.15)] shadow-sm">
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-1 flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7a4416]">
          {label}
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="h-10 border-0 bg-transparent px-0 text-base text-[#2e1808] placeholder:text-[#7a4416]/45 focus-visible:ring-0 shadow-none outline-none"
        />
      </span>
      <span className="shrink-0">{trailing}</span>
    </label>
  );
}