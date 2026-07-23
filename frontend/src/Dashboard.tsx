import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  Car,
  User,
  LogOut,
  History,
  Sparkles,
  ArrowRight,
  Locate,
  Loader2,
} from "lucide-react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import LoadingScreen from "./components/LoadingScreen";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";
import { useAuthContext } from "./context/authContext";
import type { DriverProfile } from "./lib/driverApi";
import DriverCTA from "./components/DriverCTA";

/**
 * Rider Dashboard
 * - Elegant full-width light-brown "travel ticket" theme: parchment surfaces, saddle-leather
 *   and brass accents, seamless responsive layout across all displays.
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

  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const pickupAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded: isPlacesLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
    libraries: ["places"],
  });

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

  // ---- Bootstrap: if a ride already exists, jump straight to its page ----
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
        // no active ride – stay on dashboard
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // ---- Passive socket connect so notifications still arrive on this screen ----
  useEffect(() => {
    const riderSocket = connectRiderSocket({
      onReady: () => setServerMessage("Connected to live updates."),
      onError: (message: string) => setServerMessage(message),
      onRideAccepted: () => setServerMessage("Driver has accepted your ride."),
      onDriverLocation: () => { },
      onDriverArrived: () => setServerMessage("Driver has arrived at pickup."),
      onRideStarted: () => setServerMessage("Your ride has started."),
      onRideCompleted: () => setServerMessage("Your ride is complete."),
      onRideCancelled: (payload: any) =>
        setServerMessage(`Ride cancelled by ${payload.cancelledBy.toLowerCase()}.`),
      onNoDriversAvailable: () =>
        setServerMessage("No drivers were available for your request."),
    });
    socketRef.current = riderSocket;
    return () => riderSocket?.close();
  }, []);

  // ---- Autocomplete plumbing ----
  const updatePlaceData = (
    autocomplete: google.maps.places.Autocomplete | null,
    setAddress: React.Dispatch<React.SetStateAction<string>>,
    setCoords: React.Dispatch<
      React.SetStateAction<{ latitude: number; longitude: number } | null>
    >,
  ) => {
    const place = autocomplete?.getPlace();
    if (!place) return;
    const address = place.formatted_address || place.name || "";
    const location = place.geometry?.location;
    if (location) setCoords({ latitude: 23.02, longitude: 86.78 });
    setAddress(address);
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

  const handleCreateRide = async () => {
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
    setIsRequestingRide(true);
    try {
      const response = await appApi.post<{ message: string; ride: Ride }>("/ride", {
        rider: user._id,
        pickup: { address: pickup, coordinates: pickupCoords },
        destination: { address: destination, coordinates: destinationCoords },
        fare: { estimated: 160 },
        distance: { estimated: 5 },
        duration: { estimated: 14 },
      });
      navigate(`/ride/${response.data.ride._id}`);
    } catch {
      setRideError("Unable to create a ride request. Please try again.");
    } finally {
      setIsRequestingRide(false);
    }
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
    return (
      <LoadingScreen
        label="Signing you out"
        sublabel="Clearing your session and redirecting you safely"
      />
    );
  }

  if (isBootstrapping) {
    return <LoadingScreen label="Getting things ready" sublabel="Checking for active rides" />;
  }

  const canBook = pickup && destination && pickupCoords && destinationCoords && !isRequestingRide;
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : "Rider";

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden bg-[#EFEBE9] text-[#3E2723]"
      style={{ fontFamily: BODY_FONT }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Ambient background matching elegant theme */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-[#D7CCC8]/30 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#D7CCC8]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#E4D8D3]/30 blur-3xl" />
      </div>

      {/* Full width container layout */}
      <div className="relative w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8">
        
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full rounded-3xl border border-[#D7CCC8]/60 bg-[#FAF6F0]/90 backdrop-blur-xl shadow-lg px-6 py-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#5D4037] to-[#3E2723] shadow-lg shadow-[#3E2723]/30 ring-2 ring-[#EFEBE9] ring-offset-2 ring-offset-[#D7CCC8]"
            >
              <Car className="h-5 w-5 text-[#FAF6F0]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#795548]">Uber</p>
              <h1
                className="text-lg font-semibold text-[#3E2723]"
                style={{ fontFamily: DISPLAY_FONT }}
              >
                Hey, {displayName.split(" ")[0]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/history")}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0] text-[#5D4037] transition hover:bg-[#EFEBE9]"
              aria-label="History"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0] text-[#5D4037] transition hover:bg-[#EFEBE9]"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </motion.header>

        {/* Hero greeting */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="w-full"
        >
          <p className="text-sm text-[#795548]">Where are we heading today?</p>
          <h2
            className="mt-2 text-4xl leading-tight tracking-tight sm:text-5xl text-[#3E2723]"
            style={{ fontFamily: DISPLAY_FONT, fontWeight: 600 }}
          >
            Book a ride in
            <span className="bg-gradient-to-r from-[#5D4037] via-[#795548] to-[#4E342E] bg-clip-text text-transparent italic mx-2">
              seconds.
            </span>
          </h2>
        </motion.section>

        {/* Booking card — styled as a boarding-pass / travel ticket */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full rounded-[32px] border border-[#D7CCC8] bg-[#FAF6F0] p-6 sm:p-8 shadow-xl shadow-[#3E2723]/10"
        >
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#795548]">
            <Sparkles className="h-3.5 w-3.5 text-[#5D4037]" />
            New trip
          </div>

          {/* Ticket perforation */}
          <div className="relative -mx-6 sm:-mx-8 mb-6">
            <div className="absolute left-0 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EFEBE9]" />
            <div className="absolute right-0 top-1/2 h-6 w-6 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EFEBE9]" />
            <div className="border-t border-dashed border-[#D7CCC8]" />
          </div>

          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#795548]">
            Route
          </p>

          {/* Pickup + destination stack */}
          <div className="relative rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/60 p-3 space-y-1">
            <div className="pointer-events-none absolute left-[30px] top-[42px] bottom-[42px] border-l-2 border-dashed border-[#BCAAA4]" />

            <FieldRow
              icon={<Dot color="saddle" />}
              trailing={<MapPin className="h-4 w-4 text-[#795548]" />}
              label="Pickup"
              value={pickup}
              placeholder="Where from?"
              isLoaded={isPlacesLoaded}
              onChange={(v) => {
                setPickup(v);
                setPickupCoords({ latitude: 23.02, longitude: 86.7 });
              }}
              onLoad={(a) => (pickupAutocompleteRef.current = a)}
              onPlaceChanged={() =>
                updatePlaceData(pickupAutocompleteRef.current, setPickup, setPickupCoords)
              }
            />
            <div className="my-1 h-px bg-[#D7CCC8]" />
            <FieldRow
              icon={<Dot color="brass" />}
              trailing={<Navigation className="h-4 w-4 text-[#795548]" />}
              label="Destination"
              value={destination}
              placeholder="Where to?"
              isLoaded={isPlacesLoaded}
              onChange={(v) => {
                setDestination(v);
                setDestinationCoords({ latitude: 23.05, longitude: 86.76 });
              }}
              onLoad={(a) => (destinationAutocompleteRef.current = a)}
              onPlaceChanged={() =>
                updatePlaceData(
                  destinationAutocompleteRef.current,
                  setDestination,
                  setDestinationCoords,
                )
              }
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="group inline-flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#EFEBE9] px-4 py-2.5 text-sm font-semibold text-[#3E2723] transition hover:bg-[#D7CCC8] disabled:opacity-60 shadow-sm"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#5D4037]" />
              ) : (
                <Locate className="h-4 w-4 text-[#5D4037] transition group-hover:scale-110" />
              )}
              Use current location
            </button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreateRide}
              disabled={!canBook}
              className="inline-flex items-center gap-2 rounded-full bg-[#5D4037] px-6 py-3 text-sm font-bold text-[#FAF6F0] shadow-lg shadow-[#3E2723]/20 transition hover:bg-[#4E342E] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRequestingRide ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding driver…
                </>
              ) : (
                <>
                  Find driver
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
          </div>

          {/* Inline messages */}
          <AnimatePresence>
            {rideError && (
              <motion.div
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="mt-4 overflow-hidden rounded-xl border border-[#A1887F] bg-[#EFEBE9] px-4 py-3 text-sm text-[#5D4037]"
              >
                {rideError}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Driver CTA */}
        <div className="w-full">
          <DriverCTA
            user={user!}
            driver={driverProfile}
            loading={isLoadingDriver}
          />
        </div>

        {/* Passive server message */}
        <AnimatePresence>
          {serverMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-md items-center gap-2 rounded-full border border-[#3E2723]/20 bg-[#3E2723]/95 px-5 py-3 text-xs font-medium text-[#FAF6F0] shadow-2xl backdrop-blur-xl"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D7CCC8] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D7CCC8]" />
              </span>
              {serverMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function Dot({ color }: { color: "saddle" | "brass" }) {
  if (color === "brass") {
    return (
      <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#795548] shadow-[0_0_10px_rgba(121,85,72,0.4)]" />
    );
  }
  return (
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#5D4037] shadow-[0_0_10px_rgba(93,64,55,0.4)]" />
  );
}

function FieldRow({
  icon,
  trailing,
  label,
  value,
  placeholder,
  isLoaded,
  onChange,
  onLoad,
  onPlaceChanged,
}: {
  icon: React.ReactNode;
  trailing: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  isLoaded: boolean;
  onChange: (v: string) => void;
  onLoad: (a: google.maps.places.Autocomplete) => void;
  onPlaceChanged: () => void;
}) {
  const input = (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 border-0 bg-transparent px-0 text-base text-[#3E2723] placeholder:text-[#A1887F] focus-visible:ring-0 shadow-none"
    />
  );

  return (
    <div className="flex items-center gap-3 px-3 py-2 w-full">
      <div className="grid h-6 w-6 place-items-center flex-none">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#795548]">
          {label}
        </p>
        {isLoaded ? (
          <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
            {input}
          </Autocomplete>
        ) : (
          input
        )}
      </div>
      <div className="flex-none">{trailing}</div>
    </div>
  );
}