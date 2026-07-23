import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Shield,
  Star,
  Car,
  MapPin,
  Clock,
  Route,
  IndianRupee,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";

/**
 * Ride Details page
 * Route: /ride/:rideId
 * Owns the live ride experience after booking — map, driver card, status stepper,
 * fare summary, and cancel action.
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
  driver?: {
    _id: string;
    firstName: string;
    lastName: string;
    vehicleNumber?: string | null;
  } | null;
}

const STATUS_STEPS: { key: RideStatus; label: string }[] = [
  { key: "SEARCHING", label: "Searching" },
  { key: "DRIVER_ASSIGNED", label: "Assigned" },
  { key: "DRIVER_ARRIVING", label: "Arriving" },
  { key: "STARTED", label: "On trip" },
  { key: "COMPLETED", label: "Complete" },
];

const STATUS_COPY: Record<RideStatus, { title: string; subtitle: string }> = {
  SEARCHING: { title: "Finding your driver…", subtitle: "Matching you with the nearest ride" },
  DRIVER_ASSIGNED: { title: "Driver assigned", subtitle: "Your driver is preparing to head over" },
  DRIVER_ARRIVING: { title: "Driver is arriving", subtitle: "Head to your pickup spot" },
  STARTED: { title: "You're on your way", subtitle: "Sit back and enjoy the ride" },
  COMPLETED: { title: "Trip complete", subtitle: "Thanks for riding with us" },
  CANCELLED: { title: "Ride cancelled", subtitle: "This trip is no longer active" },
};

export default function RideDetails() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();

  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string>("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);

  // Load ride
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await appApi.get<{ message: string; ride: Ride }>("/ride/current");
        if (cancelled) return;
        setRide(response.data.ride);
      } catch {
        if (!cancelled) setError("Unable to load ride details.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  // Live updates
  useEffect(() => {
    const s = connectRiderSocket({
      onReady: () => setToast("Connected to live updates"),
      onError: (m: string) => setToast(m),
      onRideAccepted: () => {
        setRide((p) => (p ? { ...p, status: "DRIVER_ASSIGNED" } : p));
        setToast("Driver has accepted your ride");
      },
      onDriverLocation: (payload: any) => {
        setDriverLocation({ latitude: payload.latitude, longitude: payload.longitude });
      },
      onDriverArrived: () => {
        setRide((p) => (p ? { ...p, status: "DRIVER_ARRIVING" } : p));
        setToast("Driver has arrived at pickup");
      },
      onRideStarted: () => {
        setRide((p) => (p ? { ...p, status: "STARTED" } : p));
        setToast("Ride started");
      },
      onRideCompleted: () => {
        setRide((p) => (p ? { ...p, status: "COMPLETED" } : p));
        setToast("Ride complete");
      },
      onRideCancelled: (payload: any) => {
        setRide((p) => (p ? { ...p, status: "CANCELLED" } : p));
        setToast(`Ride cancelled by ${payload.cancelledBy.toLowerCase()}`);
      },
      onNoDriversAvailable: () => setToast("No drivers available yet"),
    });
    socketRef.current = s;
    return () => s?.close();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCancel() {
    if (!ride) return;
    setIsCancelling(true);
    try {
      await appApi.patch(`/ride/${ride._id}/cancel`, {
        cancellationReason: "Rider cancelled from ride details",
      });
      setRide((p) => (p ? { ...p, status: "CANCELLED" } : p));
      setShowCancelConfirm(false);
    } catch {
      setError("Unable to cancel ride. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return <LoadingScreen label="Loading your ride" sublabel="Fetching the latest details" />;
  }

  if (!ride || error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-200">
        <div>
          <p className="text-lg font-semibold">{error || "No active ride found"}</p>
          <Button className="mt-6" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusCopy = STATUS_COPY[ride.status];
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === ride.status);
  const isTerminal = ride.status === "COMPLETED" || ride.status === "CANCELLED";

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {/* MAP — hero */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <MapView
          center={
            driverLocation
              ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
              : {
                  lat: ride.pickup.coordinates.latitude,
                  lng: ride.pickup.coordinates.longitude,
                }
          }
          zoom={13}
          markers={[
            {
              position: {
                lat: ride.pickup.coordinates.latitude,
                lng: ride.pickup.coordinates.longitude,
              },
              label: "P",
              title: "Pickup",
            },
            {
              position: {
                lat: ride.destination.coordinates.latitude,
                lng: ride.destination.coordinates.longitude,
              },
              label: "D",
              title: "Destination",
            },
            ...(driverLocation
              ? [
                  {
                    position: {
                      lat: driverLocation.latitude,
                      lng: driverLocation.longitude,
                    },
                    label: "DR",
                    title: "Driver",
                  },
                ]
              : []),
          ]}
          path={
            driverLocation
              ? [
                  { lat: driverLocation.latitude, lng: driverLocation.longitude },
                  {
                    lat: ride.pickup.coordinates.latitude,
                    lng: ride.pickup.coordinates.longitude,
                  },
                  {
                    lat: ride.destination.coordinates.latitude,
                    lng: ride.destination.coordinates.longitude,
                  },
                ]
              : [
                  {
                    lat: ride.pickup.coordinates.latitude,
                    lng: ride.pickup.coordinates.longitude,
                  },
                  {
                    lat: ride.destination.coordinates.latitude,
                    lng: ride.destination.coordinates.longitude,
                  },
                ]
          }
        />

        {/* Gradient overlay for legibility */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-6">
          <button
            onClick={() => navigate("/")}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-slate-900/70 backdrop-blur-xl transition hover:bg-slate-800/70"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest backdrop-blur-xl">
            Ride #{ride._id.slice(-6)}
          </div>
          <span className="h-10 w-10" />
        </div>

        {/* Driver-searching pulse overlay */}
        <AnimatePresence>
          {ride.status === "SEARCHING" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 grid place-items-center"
            >
              <div className="relative">
                <span className="absolute inset-0 -m-6 animate-ping rounded-full bg-emerald-400/30" />
                <span
                  className="absolute inset-0 -m-6 animate-ping rounded-full bg-emerald-400/30"
                  style={{ animationDelay: "0.6s" }}
                />
                <div className="relative grid h-16 w-16 place-items-center rounded-full border-4 border-slate-950 bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-2xl">
                  <Car className="h-6 w-6 text-slate-950" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SHEET */}
      <motion.section
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="relative -mt-10 mx-auto max-w-2xl rounded-t-[32px] border-t border-white/10 bg-slate-950/95 px-5 pb-24 pt-4 backdrop-blur-xl"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />

        {/* Status headline */}
        <AnimatePresence mode="wait">
          <motion.div
            key={ride.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-start justify-between gap-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                {ride.status.replace(/_/g, " ")}
              </p>
              <h1 className="mt-1 text-2xl font-bold">{statusCopy.title}</h1>
              <p className="mt-1 text-sm text-slate-400">{statusCopy.subtitle}</p>
            </div>
            {isTerminal ? (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            ) : (
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-slate-400" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Stepper */}
        {!isTerminal || ride.status === "COMPLETED" ? (
          <div className="mt-5 flex items-center gap-1.5">
            {STATUS_STEPS.map((s, i) => {
              const active = i <= (stepIndex === -1 ? 0 : stepIndex);
              return (
                <div key={s.key} className="flex-1">
                  <motion.div
                    initial={{ scaleX: 0.4, opacity: 0.4 }}
                    animate={{ scaleX: 1, opacity: active ? 1 : 0.25 }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className={`h-1.5 origin-left rounded-full ${
                      active
                        ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                        : "bg-white/10"
                    }`}
                  />
                  <p
                    className={`mt-1.5 text-[10px] font-medium uppercase tracking-wider ${
                      active ? "text-slate-200" : "text-slate-500"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Driver card */}
        <AnimatePresence>
          {ride.driver && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 240, damping: 24 }}
              className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-4"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-fuchsia-400 text-lg font-bold text-slate-950">
                    {ride.driver.firstName?.[0]}
                    {ride.driver.lastName?.[0]}
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-slate-950 bg-emerald-400">
                    <Shield className="h-2.5 w-2.5 text-slate-950" />
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold">
                    {ride.driver.firstName} {ride.driver.lastName}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-slate-200">4.9</span>
                    <span>·</span>
                    <span>{ride.driver.vehicleNumber ?? "Vehicle"}</span>
                  </div>
                </div>
                <a
                  href="tel:0000000000"
                  className="grid h-11 w-11 place-items-center rounded-full bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:scale-105"
                  aria-label="Call driver"
                >
                  <Phone className="h-4 w-4" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trip stops */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="relative">
            <div className="pointer-events-none absolute left-[9px] top-4 bottom-4 w-px bg-gradient-to-b from-emerald-400/60 via-white/20 to-indigo-400/60" />
            <Stop
              color="emerald"
              label="Pickup"
              value={ride.pickup.address || "Pickup point"}
            />
            <div className="h-3" />
            <Stop
              color="indigo"
              square
              label="Destination"
              value={ride.destination.address || "Destination"}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={<IndianRupee className="h-4 w-4" />} label="Fare" value={`₹${ride.fare.estimated ?? 0}`} />
          <Stat icon={<Clock className="h-4 w-4" />} label="ETA" value={`${ride.duration.estimated ?? 0}m`} />
          <Stat icon={<Route className="h-4 w-4" />} label="Distance" value={`${ride.distance.estimated ?? 0}km`} />
        </div>

        {/* Live driver coords (subtle) */}
        {driverLocation && (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <MapPin className="h-3 w-3" />
            Driver at {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
          </p>
        )}

        {/* Cancel / Done */}
        <div className="mt-6">
          {isTerminal ? (
            <Button className="w-full rounded-full" onClick={() => navigate("/")}>
              Back to dashboard
            </Button>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full rounded-full border border-rose-500/30 bg-rose-500/10 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              Cancel ride
            </button>
          )}
        </div>
      </motion.section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-sm items-center gap-2 rounded-full border border-white/10 bg-slate-900/90 px-4 py-2.5 text-xs text-slate-200 shadow-2xl backdrop-blur-xl"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel confirm modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelConfirm(false)}
            className="fixed inset-0 z-50 grid place-items-end bg-black/60 backdrop-blur-md sm:place-items-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-3xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Cancel this ride?</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Frequent cancellations may affect your account.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/5"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold"
                >
                  Keep ride
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex-1 rounded-full bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60"
                >
                  {isCancelling ? "Cancelling…" : "Yes, cancel"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- helpers ---------- */

function Stop({
  color,
  square,
  label,
  value,
}: {
  color: "emerald" | "indigo";
  square?: boolean;
  label: string;
  value: string;
}) {
  const bg =
    color === "emerald"
      ? "bg-emerald-400 shadow-emerald-400/60"
      : "bg-indigo-400 shadow-indigo-400/60";
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-1.5 inline-block h-2.5 w-2.5 shadow-[0_0_12px] ${bg} ${
          square ? "rounded-sm" : "rounded-full"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className="truncate text-sm text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 text-lg font-bold text-slate-100">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
    </div>
  );
}
