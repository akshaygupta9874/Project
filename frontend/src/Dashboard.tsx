import { useEffect, useRef, useState } from "react";
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
  Route as RouteIcon,
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
 * Rider Dashboard — Premium travel-ticket edition.
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

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const BODY_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

// ---- Motion presets ----
const easeOutExpo = [0.16, 1, 0.3, 1] as const;

const containerStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const riseIn = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: easeOutExpo },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
};

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
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

    // Save data to sessionStorage for robust page refresh recovery
    sessionStorage.setItem("pendingRide", JSON.stringify(payload));

    // Navigate to ChooseMode screen seamlessly
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
    <div
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        fontFamily: BODY_FONT,
        background:
          "radial-gradient(1200px 700px at 12% -10%, #F5E6D3 0%, transparent 55%), radial-gradient(1000px 600px at 100% 0%, #EADFC8 0%, transparent 60%), linear-gradient(180deg, #FBF7F1 0%, #F3E9D8 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');

        @keyframes float-slow {
          0%, 100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0,-14px,0); }
        }
        @keyframes drift {
          0% { transform: translateX(-10%); }
          100% { transform: translateX(110%); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes route-dash {
          to { stroke-dashoffset: -40; }
        }

        .rd-float { animation: float-slow 9s ease-in-out infinite; }
        .rd-ticket-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 6s linear infinite;
        }
        .rd-brass-gradient {
          background: linear-gradient(135deg, #B08968 0%, #8B5E3C 50%, #6F4A2F 100%);
        }
        .rd-parchment {
          background:
            radial-gradient(1200px 200px at 50% -20%, rgba(255,255,255,0.7), transparent 70%),
            linear-gradient(180deg, #FBF7F1 0%, #F5EBDC 100%);
        }
        .rd-noise::before {
          content: "";
          position: absolute; inset: 0; pointer-events: none; opacity: 0.05;
          background-image: radial-gradient(rgba(93,64,55,0.4) 1px, transparent 1px);
          background-size: 3px 3px;
        }
        .rd-focus-ring:focus-within {
          box-shadow: 0 0 0 3px rgba(176,137,104,0.25), 0 10px 30px -14px rgba(93,64,55,0.4);
          border-color: #B08968 !important;
        }
        .rd-btn-primary {
          background: linear-gradient(135deg, #5D4037 0%, #3E2723 100%);
          box-shadow: 0 12px 28px -12px rgba(62,39,35,0.55), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .rd-btn-primary:hover { filter: brightness(1.08); }
        .rd-btn-primary:active { transform: translateY(1px); }

        .rd-pulse-ring {
          animation: pulse-ring 2.2s cubic-bezier(0.4,0,0.2,1) infinite;
        }
        .rd-route-line {
          stroke-dasharray: 6 8;
          animation: route-dash 1.2s linear infinite;
        }
        .rd-scroll-fade::-webkit-scrollbar { width: 6px; }
        .rd-scroll-fade::-webkit-scrollbar-thumb { background: #D7CCC8; border-radius: 999px; }
      `}</style>

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="rd-float absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#E8D5B7] opacity-60 blur-3xl" />
        <div
          className="rd-float absolute right-[-60px] top-40 h-96 w-96 rounded-full bg-[#D7BFA1] opacity-50 blur-3xl"
          style={{ animationDelay: "1.4s" }}
        />
        <div
          className="rd-float absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#F1DEC1] opacity-60 blur-3xl"
          style={{ animationDelay: "2.6s" }}
        />
        {/* subtle grid */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
              <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#5D4037" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* drifting car icon */}
        <motion.div
          className="absolute top-24 left-0 text-[#8B5E3C]/30"
          initial={{ x: "-10%" }}
          animate={{ x: "110vw" }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          <Car className="h-8 w-8" />
        </motion.div>
      </div>

      {/* Content container */}
      <motion.div
        variants={containerStagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-16 pt-8 sm:px-8 lg:px-12"
      >
        {/* Header */}
        <motion.header variants={riseIn} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: -8, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="rd-brass-gradient grid h-11 w-11 place-items-center rounded-2xl shadow-[0_10px_24px_-10px_rgba(139,94,60,0.7)]"
            >
              <Car className="h-5 w-5 text-[#FBF7F1]" />
            </motion.div>
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8B5E3C]"
                style={{ fontFamily: BODY_FONT }}
              >
                Uber
              </p>
              <p className="text-sm font-medium text-[#5D4037]">
                Hey, <span className="text-[#3E2723]">{displayName.split(" ")[0]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => navigate("/history")}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/80 text-[#5D4037] backdrop-blur transition hover:bg-[#EFEBE9]"
              aria-label="History"
            >
              <History className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/80 text-[#5D4037] backdrop-blur transition hover:bg-[#EFEBE9]"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.header>

        {/* Hero greeting */}
        <motion.section variants={riseIn} className="pt-2">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#8B5E3C] backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Where are we heading today?
          </div>
          <h1
            className="mt-2 text-4xl leading-[1.05] text-[#3E2723] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: DISPLAY_FONT, fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            Book a ride in{" "}
            <span className="relative inline-block">
              <span
                className="italic"
                style={{
                  background: "linear-gradient(135deg, #B08968 0%, #6F4A2F 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                seconds.
              </span>
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.6, duration: 0.9, ease: easeOutExpo }}
                className="absolute -bottom-1 left-0 h-[3px] w-full origin-left rounded-full"
                style={{ background: "linear-gradient(90deg, #B08968, transparent)" }}
              />
            </span>
          </h1>
        </motion.section>

        {/* Booking ticket */}
        <motion.section
          variants={riseIn}
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="rd-parchment rd-noise relative overflow-hidden rounded-[28px] border border-[#E4D5BE] p-6 sm:p-8"
          style={{
            boxShadow:
              "0 40px 80px -40px rgba(93,64,55,0.35), 0 2px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          {/* shimmer sweep */}
          <div className="rd-ticket-shimmer pointer-events-none absolute inset-x-0 top-0 h-full" />

          {/* Ticket header */}
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#3E2723] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#F5E6D3]">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#B08968]">
                <Car className="h-2.5 w-2.5 text-[#3E2723]" />
              </span>
              New trip
            </div>

            <AnimatePresence mode="wait">
              {(routeDistance !== null || isCalculatingRoute) && (
                <motion.div
                  key={isCalculatingRoute ? "calc" : "done"}
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center gap-2 rounded-full border border-[#E4D5BE] bg-[#FAF6F0]/80 px-3 py-1.5 text-xs font-medium text-[#5D4037] backdrop-blur"
                >
                  {isCalculatingRoute ? (
                    <div className="flex items-center gap-2 text-[#8B5E3C]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Calculating route…
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <RouteIcon className="h-3.5 w-3.5 text-[#8B5E3C]" />
                        <span className="tabular-nums">
                          {routeDistance ? `${(routeDistance / 1000).toFixed(1)} km` : ""}
                        </span>
                      </div>
                      <span className="h-3 w-px bg-[#D7CCC8]" />
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#8B5E3C]" />
                        <span className="tabular-nums">
                          {routeDuration ? `${Math.round(routeDuration / 60)} mins` : ""}
                        </span>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Ticket perforation */}
          <div className="relative my-6 flex items-center gap-3">
            <span className="h-6 w-6 -translate-x-1/2 rounded-full bg-[#F3E9D8] shadow-[inset_0_2px_4px_rgba(93,64,55,0.15)]" />
            <div
              className="h-px flex-1"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #B08968 0 8px, transparent 8px 16px)",
              }}
            />
            <span className="h-6 w-6 translate-x-1/2 rounded-full bg-[#F3E9D8] shadow-[inset_0_2px_4px_rgba(93,64,55,0.15)]" />
          </div>

          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8B5E3C]"
            style={{ fontFamily: BODY_FONT }}
          >
            Route
          </div>

          {/* Fields */}
          <div className="relative">
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
                stroke="#B08968"
                strokeWidth="2"
                className="rd-route-line"
              />
            </svg>

            {/* Pickup */}
            <div className="relative">
              <FieldRow
                icon={<Dot color="saddle" />}
                trailing={
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleUseCurrentLocation}
                    className="grid h-8 w-8 place-items-center rounded-full text-[#8B5E3C] hover:bg-[#EFEBE9]"
                    aria-label="Use current location"
                  >
                    {isLocating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Locate className="h-4 w-4" />
                    )}
                  </motion.button>
                }
                label="Pickup"
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
                    className="rd-scroll-fade absolute left-11 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#E4D5BE] bg-[#FBF7F1] shadow-[0_20px_50px_-20px_rgba(93,64,55,0.35)]"
                  >
                    {isSearchingPickup ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#8B5E3C]">
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
                          className="flex cursor-pointer items-center gap-2 border-b border-[#D7CCC8]/30 px-4 py-2.5 text-xs text-[#3E2723] transition hover:bg-[#EFEBE9] last:border-none"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#B08968]" />
                          <span className="truncate">
                            {item.properties?.formatted || item.properties?.name}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-[#8B5E3C]">
                        No locations found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="my-3 ml-11 h-px bg-[#E4D5BE]" />

            {/* Destination */}
            <div className="relative">
              <FieldRow
                icon={<Dot color="brass" />}
                trailing={
                  <div className="grid h-8 w-8 place-items-center rounded-full text-[#8B5E3C]">
                    <Navigation className="h-4 w-4" />
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
                    className="rd-scroll-fade absolute left-11 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[#E4D5BE] bg-[#FBF7F1] shadow-[0_20px_50px_-20px_rgba(93,64,55,0.35)]"
                  >
                    {isSearchingDestination ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#8B5E3C]">
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
                          className="flex cursor-pointer items-center gap-2 border-b border-[#D7CCC8]/30 px-4 py-2.5 text-xs text-[#3E2723] transition hover:bg-[#EFEBE9] last:border-none"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#B08968]" />
                          <span className="truncate">
                            {item.properties?.formatted || item.properties?.name}
                          </span>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-[#8B5E3C]">
                        No locations found
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUseCurrentLocation}
              className="inline-flex items-center gap-2 self-start rounded-full border border-[#D7CCC8] bg-[#FAF6F0] px-4 py-2 text-xs font-medium text-[#5D4037] transition hover:bg-[#EFEBE9]"
            >
              {isLocating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Locate className="h-3.5 w-3.5" />
              )}
              Use current location
            </motion.button>

            <motion.button
              onClick={handleProceedToChoose}
              disabled={!canProceed}
              whileHover={canProceed ? { y: -2 } : {}}
              whileTap={canProceed ? { scale: 0.97 } : {}}
              className="rd-btn-primary group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold text-[#FBF7F1] transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              Choose vehicle
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowRight className="h-4 w-4" />
              </motion.span>
            </motion.button>
          </div>

          {/* Inline error */}
          <AnimatePresence>
            {rideError && (
              <motion.p
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="mt-4 rounded-xl border border-[#E9C9B8] bg-[#FBEDE4] px-3 py-2 text-xs text-[#8B3A1F]"
              >
                {rideError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Driver CTA */}
        <motion.section variants={riseIn}>
          <DriverCTA
            user={user!}
            driver={driverProfile}
            loading={isLoadingDriver}
          />
        </motion.section>

        {/* Passive server message */}
        <AnimatePresence>
          {serverMessage && (
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: 8 }}
              className="mx-auto flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/80 px-4 py-2 text-xs text-[#5D4037] backdrop-blur"
            >
              <span className="relative grid h-2.5 w-2.5 place-items-center">
                <span className="rd-pulse-ring absolute inset-0 rounded-full bg-[#B08968]" />
                <span className="h-2 w-2 rounded-full bg-[#8B5E3C]" />
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

function Dot({ color }: { color: "saddle" | "brass" }) {
  if (color === "brass") {
    return (
      <span className="relative grid h-6 w-6 place-items-center">
        <span className="absolute inset-0 rounded-md bg-[#B08968]/25" />
        <span className="h-3 w-3 rounded-[3px] rd-brass-gradient shadow-[0_2px_6px_rgba(139,94,60,0.4)]" />
      </span>
    );
  }
  return (
    <span className="relative grid h-6 w-6 place-items-center">
      <span className="rd-pulse-ring absolute inset-0 rounded-full bg-[#5D4037]/40" />
      <span className="h-3 w-3 rounded-full bg-[#3E2723] ring-2 ring-[#FBF7F1] shadow-[0_2px_6px_rgba(62,39,35,0.5)]" />
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
    <label className="rd-focus-ring flex items-center gap-3 rounded-2xl border border-transparent bg-[#FBF7F1]/60 px-3 py-2 transition">
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-1 flex-col">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8B5E3C]"
          style={{ fontFamily: BODY_FONT }}
        >
          {label}
        </span>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          className="h-10 border-0 bg-transparent px-0 text-base text-[#3E2723] placeholder:text-[#A1887F] focus-visible:ring-0 shadow-none"
        />
      </span>
      <span className="shrink-0">{trailing}</span>
    </label>
  );
}