import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Navigation,
  Loader2,
  X,
  Car,
  Bike,
  Zap,
  Star,
  TrendingUp,
  Wallet,
  Shield,
  FileText,
  Sparkles,
  Radio,
  ChevronRight,
  Clock,
  Route as RouteIcon,
  MapPin,
  CheckCircle2,
  Power,
  History,
  Settings,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import { connectDriverSocket, sendDriverLocation } from "./lib/socket";
import { fetchDriverProfile } from "./lib/driverApi";
import { useAuthContext } from "./context/authContext";

// --- Types mirrored from the backend Mongoose models (Driver.ts / Ride.ts) ---
type VehicleType = "CAR" | "BIKE" | "AUTO";

type RideStatus =
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "STARTED"
  | "ARRIVED_AT_DESTINATION"
  | "COMPLETED"
  | "CANCELLED";

type RidePaymentStatus = "PENDING" | "PAID" | "CAPTURED" | "FAILED" | "REFUNDED";

interface RidePoint {
  address: string;
  coordinates: { latitude: number; longitude: number };
}

interface FareBreakdown {
  baseFarePaise: number;
  distanceFarePaise: number;
  timeFarePaise: number;
  surgePaise: number;
  platformCommissionPaise: number;
  driverEarningPaise: number;
  totalPaise: number;
}

export interface Ride {
  _id: string;
  driver: string;
  pickup: RidePoint;
  destination: RidePoint;
  fare: {
    estimated: number;
    final: number | null;
    breakdown: FareBreakdown | null;
    fareBreakdown?: FareBreakdown | null;
  };
  distance: { estimated: number; actual: number | null };
  duration: { estimated: number; actual: number | null };
  status: RideStatus;
  paymentStatus: RidePaymentStatus;
  cancelledBy: "RIDER" | "DRIVER" | "SYSTEM" | null;
  cancellationReason: string | null;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

interface DriverProfileData {
  _id: string;
  profilePhoto: { url: string; publicId: string };
  vehicleImages: { front: string; back: string; left: string; right: string; interior: string };
  vehicle: {
    type: VehicleType;
    brand: string;
    model: string;
    color: string;
    registrationNumber: string;
    registrationYear: number;
  };
  documents: {
    drivingLicense: { number: string; expiryDate: string; frontImage: string; backImage: string; verified: boolean };
    registrationCertificate: { number: string; image: string; verified: boolean };
    insurance: { number: string; expiryDate: string; image: string; verified: boolean };
    pollutionCertificate: { expiryDate: string; image: string };
  };
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  isVerified: boolean;
  rating: { average: number; totalRatings: number };
  statistics: {
    totalTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    totalDistance: number;
    totalEarnings: number;
  };
  lastOnlineAt?: string;
}

const DriverEvents = {
  UPDATE_LOCATION: "driver:update-location",
  SET_AVAILABLE: "driver:set-available",
  SET_BUSY: "driver:set-busy",
  SET_OFFLINE: "driver:set-offline",
  HEARTBEAT: "driver:heartbeat",
  ACCEPT_RIDE: "driver:accept-ride",
  REJECT_RIDE: "driver:reject-ride",
  ARRIVED_AT_PICKUP: "driver:arrived-at-pickup",
  ARRIVED_AT_DESTINATION: "driver:arrived-at-destination",
  START_RIDE: "driver:start-ride",
  COMPLETE_RIDE: "driver:complete-ride",
  CANCEL_RIDE_BY_DRIVER: "driver:cancel-ride",
} as const;

const ServerEvents = {
  NEW_RIDE: "server:new-ride",
  RIDE_ACCEPTED: "server:ride-accepted",
  RIDE_NO_DRIVERS_AVAILABLE: "server:ride-no-drivers-available",
  DRIVER_LOCATION: "server:driver-location",
  DRIVER_ARRIVED: "server:driver-arrived",
  ARRIVED_AT_DESTINATION: "server:ride-arrived-at-destination",
  PAYMENT_CAPTURED: "server:payment-captured",
  RIDE_STARTED: "server:ride-started",
  RIDE_COMPLETED: "server:ride-completed",
  RIDE_CANCELLED: "server:ride-cancelled",
  ERROR: "server:error",
} as const;

type DriverStatus = "OFFLINE" | "AVAILABLE" | "BUSY";

const BUSY_RIDE_STATUSES: RideStatus[] = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "STARTED"];
const TERMINAL_RIDE_STATUSES: RideStatus[] = ["COMPLETED", "CANCELLED"];
const HEARTBEAT_INTERVAL_MS = 10000;

const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  CAR: "Car",
  BIKE: "Bike",
  AUTO: "Auto",
};

const VEHICLE_TYPE_ICON: Record<VehicleType, React.ComponentType<{ className?: string }>> = {
  CAR: Car,
  BIKE: Bike,
  AUTO: Car,
};

const RIDE_STATUS_CONFIG: Record<
  RideStatus,
  { label: string; badge: string; description: string; step: number; accent: string }
> = {
  SEARCHING: {
    label: "Searching",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "Matching this ride with a driver.",
    step: 0,
    accent: "#8D6E63",
  },
  DRIVER_ASSIGNED: {
    label: "Assigned to you",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "Head to the pickup point.",
    step: 1,
    accent: "#6D4C41",
  },
  DRIVER_ARRIVING: {
    label: "Arriving",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "You're on your way to the rider.",
    step: 2,
    accent: "#5D4037",
  },
  STARTED: {
    label: "Trip in progress",
    badge: "bg-[#D7CCC8]/60 text-[#3E2723] border border-[#A1887F]",
    description: "Trip is underway to the destination.",
    step: 3,
    accent: "#3E2723",
  },
  ARRIVED_AT_DESTINATION: {
    label: "Arrived at destination",
    badge: "bg-[#E8D8C3] text-[#5D4037] border border-[#D7CCC8]",
    description: "Payment is required before completion.",
    step: 4,
    accent: "#6D4C41",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-[#EFEBE9] text-[#5D4037] border border-[#D7CCC8]",
    description: "This trip has been completed.",
    step: 5,
    accent: "#2E7D32",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-[#EFEBE9] text-[#6D4C41] border border-[#D7CCC8]",
    description: "This ride was cancelled.",
    step: 4,
    accent: "#B71C1C",
  },
};

const PAYMENT_STATUS_CONFIG: Record<RidePaymentStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: "Payment pending", badge: "text-[#6D4C41]", dot: "bg-[#8D6E63]" },
  PAID: { label: "Paid", badge: "text-[#3E2723]", dot: "bg-[#5D4037]" },
  CAPTURED: { label: "Payment captured", badge: "text-[#3E2723]", dot: "bg-[#5D4037]" },
  FAILED: { label: "Payment failed", badge: "text-[#795548]", dot: "bg-[#A1887F]" },
  REFUNDED: { label: "Refunded", badge: "text-[#6D4C41]", dot: "bg-[#BCAAA4]" },
};

const RIDE_STEPS: { key: RideStatus; label: string }[] = [
  { key: "SEARCHING", label: "Searching" },
  { key: "DRIVER_ASSIGNED", label: "Assigned" },
  { key: "DRIVER_ARRIVING", label: "Arriving" },
  { key: "STARTED", label: "In trip" },
  { key: "COMPLETED", label: "Completed" },
];

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDistanceMeters(meters: number): string {
  if (meters >= 1000) return `${(meters).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDurationSeconds(seconds: number): string {
  const minutes = Math.round(seconds);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------- Micro components ----------

function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span>{display}</motion.span>;
}

function StatCard({
  label,
  children,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 22 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 sm:p-5 backdrop-blur-xl"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--x,50%) var(--y,50%), rgba(255,255,255,0.12), transparent 40%)",
        }}
        transition={{ duration: 0.4 }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-[#D7CCC8] font-medium">{label}</p>
        <Icon className="h-4 w-4 text-[#E4D8D3]/70" />
      </div>
      <h2 className="mt-2 text-2xl sm:text-3xl font-bold truncate">{children}</h2>
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
        />
      </div>
    </motion.div>
  );
}

function StatusPulse({ color, label }: { color: string; label: string }) {
  return (
    <span className="relative inline-flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/80 px-3 py-1 text-xs font-semibold text-[#3E2723] backdrop-blur">
      <span className="relative flex h-2.5 w-2.5">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 2.4], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      </span>
      {label}
    </span>
  );
}

function RideStepper({ status }: { status: RideStatus }) {
  const activeIdx = RIDE_STEPS.findIndex((s) => s.key === status);
  const progress = Math.max(0, activeIdx) / (RIDE_STEPS.length - 1);
  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[#D7CCC8]" />
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-[#5D4037] via-[#795548] to-[#3E2723]"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
        {RIDE_STEPS.map((s, i) => {
          const done = i <= activeIdx && status !== "CANCELLED";
          const current = i === activeIdx && status !== "CANCELLED";
          return (
            <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5">
              <motion.div
                animate={
                  current
                    ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0 #5D403766", "0 0 0 10px #5D403700"] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.4, repeat: current ? Infinity : 0 }}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${done
                    ? "bg-[#3E2723] border-[#3E2723] text-white"
                    : "bg-[#FAF6F0] border-[#D7CCC8] text-[#795548]"
                  }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </motion.div>
              <span
                className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${current ? "text-[#3E2723]" : "text-[#8D6E63]"
                  }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AmbientBlobs() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#D7CCC8]/40 blur-3xl"
        animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-60 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#BCAAA4]/25 blur-3xl"
        animate={{ y: [0, -25, 0], x: [0, -15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[#E4D8D3]/40 blur-3xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function ShineButton({
  children,
  onClick,
  disabled,
  className = "",
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "success" | "danger" | "muted";
}) {
  const styles: Record<string, string> = {
    primary: "bg-[#5D4037] hover:bg-[#4E342E] text-white",
    success: "bg-emerald-700 hover:bg-emerald-800 text-white",
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
    muted: "bg-[#8D6E63] text-white",
  };
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.03 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-full px-6 py-3 text-sm sm:text-base font-bold shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {!disabled && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-50%", "450%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}

// ---------- Main Component ----------

export default function DriverDashboard() {
  const { logout } = useAuthContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DriverProfileData | null>(null);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("OFFLINE");
  const [routePolyline, setRoutePolyline] = useState<Array<{ lat: number; lng: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEarningsFlash, setShowEarningsFlash] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const driverStatusRef = useRef<DriverStatus>("OFFLINE");
  const currentRideRef = useRef<Ride | null>(null);

  useEffect(() => {
    driverStatusRef.current = driverStatus;
  }, [driverStatus]);
  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    async function loadProfileAndRide() {
      try {
        const [profileResponse, rideResponse] = await Promise.all([
          fetchDriverProfile(),
          appApi.get<{ message: string; ride: Ride }>("/ride/driver/current").catch(() => null),
        ]);
        setProfile(profileResponse);
        if (rideResponse && rideResponse.data?.ride) {
          setCurrentRide(rideResponse.data.ride);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message ?? "Unable to load driver profile.");
      } finally {
        setLoading(false);
      }
    }
    loadProfileAndRide();
  }, []);

  useEffect(() => {
    async function fetchGeoapifyRoute() {
      if (!currentRide) {
        setRoutePolyline([]);
        return;
      }
      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
      if (!apiKey) return;

      const waypoints: string[] = [];
      if (driverLocation) waypoints.push(`${driverLocation.latitude},${driverLocation.longitude}`);
      waypoints.push(`${currentRide.pickup.coordinates.latitude},${currentRide.pickup.coordinates.longitude}`);
      waypoints.push(`${currentRide.destination.coordinates.latitude},${currentRide.destination.coordinates.longitude}`);
      if (waypoints.length < 2) return;

      try {
        const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints.join("|")}&mode=drive&apiKey=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.features?.[0]?.geometry?.coordinates) {
          const coords = data.features[0].geometry.coordinates;
          const flatPoints: Array<{ lat: number; lng: number }> = [];
          coords.forEach((line: [number, number][]) => {
            line.forEach(([lon, lat]) => flatPoints.push({ lat, lng: lon }));
          });
          setRoutePolyline(flatPoints);
        }
      } catch (err) {
        console.error("Failed to fetch Geoapify route polyline", err);
      }
    }
    fetchGeoapifyRoute();
  }, [currentRide?._id, driverLocation?.latitude, driverLocation?.longitude, currentRide?.pickup, currentRide?.destination]);

  useEffect(() => {
    if (!profile) return;

    const driverSocket = connectDriverSocket({
      onReady: () => {
        setError("");
        if (currentRideRef.current && BUSY_RIDE_STATUSES.includes(currentRideRef.current.status)) {
          driverSocket.send(JSON.stringify({ event: DriverEvents.SET_BUSY, data: {} }));
          setDriverStatus("BUSY");
        }
      },
      onError: (message) => setError(message),
    });

    socketRef.current = driverSocket;

    driverSocket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const { event: serverEvent, data } = parsed;

        switch (serverEvent) {
          case ServerEvents.NEW_RIDE:
            if (data?.ride) {
              setError("");
              setCurrentRide(data.ride);
            }
            break;
          case ServerEvents.RIDE_ACCEPTED:
            if (data?.ride) setCurrentRide(data.ride);
            break;
          case ServerEvents.DRIVER_ARRIVED:
            setCurrentRide((prev) => (prev ? { ...prev, status: "DRIVER_ARRIVING" } : prev));
            break;
          case ServerEvents.ARRIVED_AT_DESTINATION:
            setCurrentRide((prev) => (prev ? { ...prev, status: "ARRIVED_AT_DESTINATION" } : prev));
            break;
          case ServerEvents.PAYMENT_CAPTURED:
            setCurrentRide((prev) =>
              prev
                ? {
                  ...prev,
                  ...data.ride,
                }
                : prev
            );
            break;
          case ServerEvents.RIDE_STARTED:
            setCurrentRide((prev) => (prev ? { ...prev, status: "STARTED" } : prev));
            break;
          case ServerEvents.RIDE_COMPLETED: {
            setCurrentRide((prev) => {
              const updated = prev ? { ...prev, status: "COMPLETED" as RideStatus, ...data?.ride } : null;
              const earnedPaise =
                updated?.fare?.breakdown?.driverEarningPaise ??
                updated?.fare?.fareBreakdown?.driverEarningPaise ??
                0;
              if (earnedPaise > 0) {
                setShowEarningsFlash(earnedPaise);
                setTimeout(() => setShowEarningsFlash(null), 3200);
                setProfile((prevProf) =>
                  prevProf
                    ? {
                      ...prevProf,
                      statistics: {
                        ...prevProf.statistics,
                        completedTrips: prevProf.statistics.completedTrips + 1,
                        totalEarnings: prevProf.statistics.totalEarnings + earnedPaise,
                      },
                    }
                    : prevProf,
                );
              }
              return updated;
            });
            break;
          }
          case ServerEvents.RIDE_CANCELLED:
            setCurrentRide((prev) =>
              prev
                ? { ...prev, status: "CANCELLED", cancelledBy: data?.cancelledBy, cancellationReason: data?.reason }
                : prev,
            );
            break;
          case ServerEvents.ERROR:
            setError(data?.message || "Server error occurred.");
            break;
          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse incoming socket message:", err);
      }
    };

    const heartbeatInterval = setInterval(() => {
      if (driverStatusRef.current === "OFFLINE") return;
      if (driverSocket.readyState === WebSocket.OPEN) {
        driverSocket.send(JSON.stringify({ event: DriverEvents.HEARTBEAT, data: {} }));
      }
    }, HEARTBEAT_INTERVAL_MS);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return () => {
        clearInterval(heartbeatInterval);
        driverSocket.close();
      };
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ latitude, longitude });
        sendDriverLocation(driverSocket, latitude, longitude);
      },
      (positionError) => setError(`Navigator : ${positionError.message} `),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      clearInterval(heartbeatInterval);
      driverSocket.close();
    };
  }, [profile]);

  useEffect(() => {
    if (!currentRide) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    if (BUSY_RIDE_STATUSES.includes(currentRide.status) && driverStatusRef.current !== "BUSY") {
      socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_BUSY, data: {} }));
      setDriverStatus("BUSY");
    } else if (TERMINAL_RIDE_STATUSES.includes(currentRide.status) && driverStatusRef.current === "BUSY") {
      socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_AVAILABLE, data: {} }));
      setDriverStatus("AVAILABLE");
    }
  }, [currentRide?.status]);

  const handleToggleAvailability = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    if (driverStatus === "BUSY") {
      setError("You can't go offline while a ride is active.");
      return;
    }
    const goingOnline = driverStatus === "OFFLINE";
    socketRef.current.send(
      JSON.stringify({ event: DriverEvents.SET_AVAILABLE, data: { available: goingOnline } }),
    );
    setDriverStatus(goingOnline ? "AVAILABLE" : "OFFLINE");
  };

  const handleAcceptRide = (rideId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    setError("");
    socketRef.current.send(JSON.stringify({ event: DriverEvents.ACCEPT_RIDE, data: { rideId } }));
    setCurrentRide((prev) => (prev ? { ...prev, status: "DRIVER_ASSIGNED" } : prev));
  };

  const handleRejectRide = (rideId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    socketRef.current.send(JSON.stringify({ event: DriverEvents.REJECT_RIDE, data: { rideId } }));
    setCurrentRide(null);
  };

  const handleCancelRide = (rideId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    setError("");
    socketRef.current.send(
      JSON.stringify({
        event: DriverEvents.CANCEL_RIDE_BY_DRIVER,
        data: { rideId, reason: "Cancelled by driver" },
      }),
    );
    setCurrentRide((prev) => (prev ? { ...prev, status: "CANCELLED", cancelledBy: "DRIVER" } : prev));
  };

  const sendRideAction = (event: string, rideId: string, extraData = {}) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    socketRef.current.send(JSON.stringify({ event, data: { rideId, ...extraData } }));
    if (event === DriverEvents.ARRIVED_AT_PICKUP) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "DRIVER_ARRIVING" } : prev));
    } else if (event === DriverEvents.ARRIVED_AT_DESTINATION) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "ARRIVED_AT_DESTINATION" } : prev));
    } else if (event === DriverEvents.START_RIDE) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "STARTED" } : prev));
    } else if (event === DriverEvents.COMPLETE_RIDE) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
    }
  };

  const acceptanceRate = useMemo(() => {
    if (!profile) return 0;
    const total = profile.statistics.totalTrips || 1;
    return Math.round((profile.statistics.completedTrips / total) * 100);
  }, [profile]);

  if (loading) {
    return <LoadingScreen label="Loading driver dashboard" />;
  }

  if (!profile || profile.verificationStatus != "APPROVED") {
    return (
      <div className="min-h-screen w-full bg-[#EFEBE9] p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="w-full max-w-4xl rounded-3xl bg-[#FAF6F0] border border-[#D7CCC8] p-8 shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#5D4037] text-white flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold text-[#3E2723]">Driver dashboard</h1>
          </div>
          {error ? (
            <div className="mt-4 rounded-2xl border border-[#D7CCC8] bg-[#F5EBE6] p-4 text-sm text-[#5D4037]">
              {error}
            </div>
          ) : (
            <p className="mt-4 text-[#5D4037]">
              Driver profile not found or awaiting verification. Please complete the driver registration flow.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/driver-registration")}
              className="bg-[#D7CCC8] text-[#3E2723] hover:bg-[#BCAAA4]"
            >
              Register as driver
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="border-[#D7CCC8] text-[#5D4037] hover:bg-[#EFEBE9]"
            >
              Go to rider dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const mapCenter = driverLocation
    ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
    : currentRide
      ? { lat: currentRide.pickup.coordinates.latitude, lng: currentRide.pickup.coordinates.longitude }
      : { lat: 12.9716, lng: 77.5946 };

  const mapMarkers = [
    ...(driverLocation
      ? [{ position: { lat: driverLocation.latitude, lng: driverLocation.longitude }, label: "DR", title: "You" }]
      : []),
    ...(currentRide
      ? [
        {
          position: { lat: currentRide.pickup.coordinates.latitude, lng: currentRide.pickup.coordinates.longitude },
          label: "P",
          title: "Pickup",
        },
        {
          position: {
            lat: currentRide.destination.coordinates.latitude,
            lng: currentRide.destination.coordinates.longitude,
          },
          label: "D",
          title: "Destination",
        },
      ]
      : []),
  ];

  const statusConfig = currentRide ? RIDE_STATUS_CONFIG[currentRide.status] : null;
  const paymentConfig = currentRide ? PAYMENT_STATUS_CONFIG[currentRide.paymentStatus] : null;
  const canCompleteCurrentRide = currentRide?.status === "ARRIVED_AT_DESTINATION" && currentRide.paymentStatus === "CAPTURED";
  const distance = currentRide ? currentRide.distance.actual ?? currentRide.distance.estimated : null;
  const duration = currentRide ? currentRide.duration.actual ?? currentRide.duration.estimated : null;
  const fare = currentRide
    ? currentRide.fare.breakdown?.driverEarningPaise ?? currentRide.fare.final ?? currentRide.fare.estimated
    : null;
  const fareBreakdownData = currentRide?.fare?.breakdown ?? currentRide?.fare?.fareBreakdown ?? null;

  const driverStatusCopy: Record<DriverStatus, string> = {
    OFFLINE: "Riders can only see you while you're online.",
    AVAILABLE: "You are online and receiving requests.",
    BUSY: "You're on an active trip. You'll go back to available automatically once it ends.",
  };

  const statusDot = driverStatus === "AVAILABLE" ? "#2E7D32" : driverStatus === "BUSY" ? "#EF6C00" : "#8D6E63";
  const VehicleIcon = VEHICLE_TYPE_ICON[profile.vehicle.type];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemRise = {
    hidden: { opacity: 0, y: 22 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 180, damping: 22 } },
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#EFEBE9] text-[#3E2723]">
      <AmbientBlobs />

      {/* Completion flash */}
      <AnimatePresence>
        {showEarningsFlash !== null && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-emerald-700 text-white px-6 py-3 shadow-2xl flex items-center gap-3"
          >
            <Sparkles className="h-5 w-5" />
            <span className="font-bold">Trip completed! +{formatPaise(showEarningsFlash)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8"
      >
        {/* Header */}
        <motion.header variants={itemRise} className="sticky top-4 z-50 w-full">
          <div className="w-full rounded-3xl border border-[#D7CCC8]/60 bg-[#FAF6F0]/85 backdrop-blur-xl shadow-lg px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 8, scale: 1.05 }}
                className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-[#3E2723] to-[#795548] flex items-center justify-center shadow-md"
              >
                <VehicleIcon className="h-5 w-5 text-[#FAF6F0]" />
                <motion.span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#FAF6F0]"
                  style={{ backgroundColor: statusDot }}
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-[#3E2723] leading-tight">Driver Dashboard</h2>
                <p className="text-xs sm:text-sm text-[#795548]">Drive safe • Earn smart ☕</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <StatusPulse color={statusDot} label={driverStatus} />
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="hidden sm:inline-flex border-[#D7CCC8] text-[#5D4037] hover:bg-[#EFEBE9]"
              >
                Rider Mode
              </Button>
              <Button
                variant="destructive"
                onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
                className="bg-[#5D4037] hover:bg-[#4E342E] text-white"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </motion.header>

        {/* Hero */}
        <motion.section
          variants={itemRise}
          className="relative w-full overflow-hidden rounded-[32px] p-6 sm:p-10 text-[#FAF6F0] shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, #3E2723 0%, #4E342E 40%, #5D4037 70%, #795548 100%)",
          }}
        >
          {/* animated shimmer */}
          <motion.div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(600px circle at 15% 0%, rgba(255,255,255,0.18), transparent 45%), radial-gradient(500px circle at 90% 100%, rgba(255,220,180,0.15), transparent 40%)",
            }}
            animate={{ opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          {/* drifting car */}
          <motion.div
            aria-hidden
            className="absolute -bottom-4 -left-8 text-white/10"
            initial={{ x: 0 }}
            animate={{ x: ["0%", "6%", "0%"] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          >
            <Car className="h-40 w-40" />
          </motion.div>

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#D7CCC8] font-semibold inline-flex items-center gap-2"
              >
                <Radio className="h-3.5 w-3.5" /> Driver Portal
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-3xl sm:text-5xl font-black tracking-tight"
              >
                Welcome back{" "}
                <motion.span
                  animate={{ rotate: [0, 14, -8, 14, 0] }}
                  transition={{ duration: 1.4, delay: 0.6 }}
                  style={{ display: "inline-block", transformOrigin: "70% 70%" }}
                >
                  👋
                </motion.span>
              </motion.h1>
              <p className="max-w-xl text-[#E4D8D3] text-sm sm:text-base">
                Ready to earn today? Go online and we'll instantly connect you with nearby riders.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs">
                  <VehicleIcon className="h-3.5 w-3.5" /> {VEHICLE_TYPE_LABEL[profile.vehicle.type]} •{" "}
                  {profile.vehicle.brand} {profile.vehicle.model}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs">
                  <Shield className="h-3.5 w-3.5 text-emerald-300" /> {profile.verificationStatus}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" /> {acceptanceRate}% completion
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full lg:w-auto">
              <StatCard label="Trips" icon={RouteIcon} delay={0.05}>
                <AnimatedNumber value={profile.statistics.completedTrips} />
              </StatCard>
              <StatCard label="Rating" icon={Star} delay={0.1}>
                <AnimatedNumber value={profile.rating.average} format={(v) => v.toFixed(1)} />
              </StatCard>
              <StatCard label="Earnings" icon={Wallet} delay={0.15}>
                <AnimatedNumber value={profile.statistics.totalEarnings} format={(v) => formatPaise(v)} />
              </StatCard>
              <StatCard label="Distance" icon={Zap} delay={0.2}>
                <AnimatedNumber
                  value={profile.statistics.totalDistance}
                  format={(v) => formatDistanceMeters(v)}
                />
              </StatCard>
            </div>
          </div>
        </motion.section>

        {/* Go Online */}
        <motion.section
          variants={itemRise}
          className="w-full rounded-3xl bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl p-6 relative overflow-hidden"
        >
          <motion.div
            aria-hidden
            className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl"
            style={{ backgroundColor: statusDot, opacity: 0.15 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <motion.div
                animate={
                  driverStatus === "AVAILABLE"
                    ? { boxShadow: ["0 0 0 0 #2E7D3266", "0 0 0 18px #2E7D3200"] }
                    : {}
                }
                transition={{ duration: 1.6, repeat: Infinity }}
                className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-md"
                style={{ backgroundColor: statusDot }}
              >
                <Power className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-[#3E2723]">Driver Status</h2>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={driverStatus}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-sm text-[#795548] mt-0.5"
                  >
                    {driverStatusCopy[driverStatus]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            <ShineButton
              onClick={handleToggleAvailability}
              disabled={driverStatus === "BUSY"}
              variant={
                driverStatus === "AVAILABLE" ? "success" : driverStatus === "BUSY" ? "muted" : "primary"
              }
              className="px-8 py-4"
            >
              {driverStatus === "AVAILABLE" ? (
                <>🟢 Go Offline</>
              ) : driverStatus === "BUSY" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> On a Trip
                </>
              ) : (
                <>☕ Go Online</>
              )}
            </ShineButton>
          </div>
        </motion.section>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="w-full rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm flex items-center gap-3"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError("")}
                className="rounded-full p-1 hover:bg-rose-100 transition"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Ride + Map */}
        <motion.section variants={itemRise} className="grid gap-8 w-full">
          <div className="w-full overflow-hidden rounded-[32px] bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl">
            <div className="border-b border-[#D7CCC8] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[#3E2723]">Current Ride</h2>
                <p className="text-sm text-[#795548] mt-1">Everything you need for the active trip.</p>
              </div>
              <AnimatePresence mode="wait">
                {statusConfig && (
                  <motion.span
                    key={statusConfig.label}
                    initial={{ opacity: 0, scale: 0.9, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -8 }}
                    className={`w-fit rounded-full px-4 py-1.5 text-sm font-semibold ${statusConfig.badge}`}
                  >
                    {statusConfig.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {currentRide && (
              <div className="px-6 sm:px-8 pt-6">
                <RideStepper status={currentRide.status} />
              </div>
            )}

            <AnimatePresence mode="wait">
              {!currentRide ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="py-16 px-6 text-center"
                >
                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                    <motion.span
                      className="absolute inset-0 rounded-full bg-[#D7CCC8]/50"
                      animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.span
                      className="absolute inset-0 rounded-full bg-[#D7CCC8]/40"
                      animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                    />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#D7CCC8]/60 text-[#5D4037] shadow-inner">
                      <Navigation className="h-8 w-8" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-xl sm:text-2xl font-bold text-[#3E2723]">
                    {driverStatus === "AVAILABLE" ? "Scanning for nearby riders…" : "Waiting to go online"}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-[#795548] max-w-md mx-auto">
                    {driverStatus === "AVAILABLE"
                      ? "You are online. Requests will appear here instantly with sound."
                      : "Flip the switch above to start receiving ride requests."}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={currentRide._id + currentRide.status}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="grid lg:grid-cols-2 gap-6 p-6 sm:p-8"
                >
                  <div className="space-y-4">
                    {/* Route card with animated dashline */}
                    <div className="relative rounded-2xl bg-[#EFEBE9]/80 border border-[#D7CCC8] p-5 overflow-hidden">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <span className="relative h-3 w-3 rounded-full bg-emerald-600">
                            <motion.span
                              className="absolute inset-0 rounded-full bg-emerald-500"
                              animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
                              transition={{ duration: 1.6, repeat: Infinity }}
                            />
                          </span>
                          <div className="relative my-1 h-16 w-[2px] overflow-hidden bg-[#D7CCC8]">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-b from-transparent via-[#5D4037] to-transparent"
                              animate={{ y: ["-100%", "100%"] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                          <MapPin className="h-3.5 w-3.5 text-rose-600" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#5D4037] font-bold">
                              Pickup
                            </p>
                            <p className="text-sm sm:text-base font-semibold text-[#3E2723]">
                              {currentRide.pickup.address}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#5D4037] font-bold">
                              Destination
                            </p>
                            <p className="text-sm sm:text-base font-semibold text-[#3E2723]">
                              {currentRide.destination.address}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      {currentRide.status === "SEARCHING" && (
                        <>
                          <ShineButton onClick={() => handleAcceptRide(currentRide._id)} variant="success">
                            <CheckCircle2 className="h-4 w-4" /> Accept Ride
                          </ShineButton>
                          <ShineButton onClick={() => handleRejectRide(currentRide._id)} variant="danger">
                            <X className="h-4 w-4" /> Reject
                          </ShineButton>
                        </>
                      )}
                      {currentRide.status === "DRIVER_ASSIGNED" && (
                        <ShineButton
                          onClick={() => sendRideAction(DriverEvents.ARRIVED_AT_PICKUP, currentRide._id)}
                          variant="primary"
                        >
                          <MapPin className="h-4 w-4" /> Arrived at Pickup
                        </ShineButton>
                      )}
                      {currentRide.status === "DRIVER_ARRIVING" && (
                        <ShineButton
                          onClick={() => sendRideAction(DriverEvents.START_RIDE, currentRide._id)}
                          variant="primary"
                        >
                          <ChevronRight className="h-4 w-4" /> Start Ride
                        </ShineButton>
                      )}
                      {currentRide.status === "STARTED" && (
                        <ShineButton
                          onClick={() => sendRideAction(DriverEvents.ARRIVED_AT_DESTINATION, currentRide._id)}
                          variant="primary"
                        >
                          <MapPin className="h-4 w-4" /> Arrived at Destination
                        </ShineButton>
                      )}
                      {currentRide.status === "ARRIVED_AT_DESTINATION" && (
                        <ShineButton
                          onClick={() => sendRideAction(DriverEvents.COMPLETE_RIDE, currentRide._id)}
                          variant="success"
                          disabled={!canCompleteCurrentRide}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Complete Ride
                        </ShineButton>
                      )}
                      {["DRIVER_ASSIGNED", "DRIVER_ARRIVING"].includes(currentRide.status) && (
                        <ShineButton onClick={() => handleCancelRide(currentRide._id)} variant="danger">
                          <X className="h-4 w-4" /> Cancel Ride
                        </ShineButton>
                      )}
                    </div>
                  </div>

                  {/* Metric tiles */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        label: "Distance",
                        value: distance != null ? formatDistanceMeters(distance) : "--",
                        icon: RouteIcon,
                      },
                      {
                        label: "ETA",
                        value: duration != null ? formatDurationSeconds(duration) : "--",
                        icon: Clock,
                      },
                      {
                        label: "Fare",
                        value: fare != null ? formatPaise(fare) : "--",
                        icon: Wallet,
                      },
                      {
                        label: paymentConfig?.label ?? "Payment",
                        value: paymentConfig?.label ?? "--",
                        icon: Sparkles,
                        isPayment: true,
                      },
                    ].map((tile, i) => (
                      <motion.div
                        key={tile.label + i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ y: -3 }}
                        className="rounded-2xl bg-gradient-to-br from-[#EFEBE9] to-[#E4D8D3] border border-[#D7CCC8] p-5 flex flex-col justify-between shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-wider text-[#795548] font-medium">
                            {tile.isPayment ? "Payment" : tile.label}
                          </p>
                          <tile.icon className="h-4 w-4 text-[#8D6E63]" />
                        </div>
                        <h3
                          className={`mt-2 text-lg sm:text-xl font-bold ${tile.isPayment ? paymentConfig?.badge : "text-[#3E2723]"
                            }`}
                        >
                          {tile.value}
                        </h3>
                      </motion.div>
                    ))}
                  </div>

                  {/* Fare breakdown */}
                  {fareBreakdownData && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="lg:col-span-2 rounded-2xl border border-dashed border-[#BCAAA4] bg-[#FAF6F0] p-5"
                    >
                      <p className="text-xs uppercase tracking-widest text-[#795548] font-bold mb-3">
                        Fare Breakdown
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {[
                          ["Base", fareBreakdownData.baseFarePaise],
                          ["Distance", fareBreakdownData.distanceFarePaise],
                          ["Time", fareBreakdownData.timeFarePaise],
                          ["Surge", fareBreakdownData.surgePaise],
                          ["Commission", -fareBreakdownData.platformCommissionPaise],
                          ["You earn", fareBreakdownData.driverEarningPaise],
                          ["Total", fareBreakdownData.totalPaise],
                        ].map(([k, v]) => (
                          <div key={k as string} className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-[#8D6E63]">{k}</span>
                            <span className="font-bold text-[#3E2723]">{formatPaise(Number(v))}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {currentRide?.status === "CANCELLED" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-6 mb-6 rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-4 text-sm text-[#5D4037] flex flex-wrap items-center justify-between gap-3"
              >
                <span>
                  Cancelled{currentRide.cancelledBy ? ` by ${currentRide.cancelledBy.toLowerCase()}` : ""}
                  {currentRide.cancellationReason ? `: ${currentRide.cancellationReason}` : "."}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentRide(null)}
                  className="border-[#D7CCC8] text-[#5D4037] hover:bg-[#EFEBE9] rounded-full px-4 py-2 text-xs font-bold"
                >
                  Back to searching
                </Button>
              </motion.div>
            )}

            {currentRide?.status === "COMPLETED" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="relative mx-6 mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3 overflow-hidden"
              >
                <motion.div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  animate={{ background: ["radial-gradient(circle at 30% 30%, #A5D6A755, transparent 60%)", "radial-gradient(circle at 70% 60%, #A5D6A755, transparent 60%)"] }}
                  transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
                />
                <p className="relative text-xs uppercase tracking-widest text-emerald-800 font-bold">
                  Trip Completed
                </p>
                <h3 className="relative text-3xl font-black text-emerald-900">
                  {fareBreakdownData
                    ? formatPaise(fareBreakdownData.driverEarningPaise)
                    : fare != null
                      ? formatPaise(fare)
                      : "₹0.00"}
                </h3>
                <p className="relative text-sm text-emerald-800">Driver earnings added successfully.</p>
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRide(null)}
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-full px-6 py-2 text-xs font-bold mt-2"
                  >
                    Back to searching
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Live map */}
          <motion.div
            variants={itemRise}
            className="w-full overflow-hidden rounded-[32px] bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl"
          >
            <div className="border-b border-[#D7CCC8] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-[#3E2723]">Live Route Map</h2>
                <p className="text-sm text-[#795548]">Your live location and active route.</p>
              </div>
              <StatusPulse
                color={statusConfig ? statusConfig.accent : statusDot}
                label={statusConfig ? statusConfig.label : "No active ride"}
              />
            </div>
            <div className="relative h-[450px] sm:h-[550px] w-full">
              <MapView center={mapCenter} zoom={12} markers={mapMarkers} path={routePolyline} />
              {/* corner GPS chip */}
              {driverLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 left-4 rounded-full bg-[#FAF6F0]/90 backdrop-blur px-3 py-1.5 text-xs font-semibold text-[#3E2723] shadow-md border border-[#D7CCC8] flex items-center gap-1.5"
                >
                  <span className="relative flex h-2 w-2">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-emerald-500"
                      animate={{ scale: [1, 2], opacity: [0.7, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                  </span>
                  GPS locked • {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.section>

        {/* Quick actions */}
        <motion.section
          variants={itemRise}
          className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4 w-full"
        >
          {[
            { label: "Ride History", icon: History, emoji: "🚕" },
            { label: "Earnings", icon: Wallet, emoji: "💰" },
            { label: "Vehicle", icon: Car, emoji: "🚗" },
            { label: "Settings", icon: Settings, emoji: "⚙️" },
          ].map((a, i) => (
            <motion.button
              key={a.label}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative overflow-hidden h-24 sm:h-28 rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] text-[#3E2723] transition-all shadow-sm w-full flex items-center justify-between px-6 group"
            >
              <span className="flex items-center gap-3 text-base sm:text-lg font-semibold">
                <span className="text-2xl">{a.emoji}</span>
                {a.label}
              </span>
              <ChevronRight className="h-5 w-5 text-[#8D6E63] group-hover:translate-x-1 transition-transform" />
              <motion.span
                aria-hidden
                className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-[#D7CCC8]/50 to-transparent skew-x-[-20deg]"
                animate={{ x: ["0%", "300%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
              />
            </motion.button>
          ))}
        </motion.section>

        {/* Vehicle */}
        <motion.div variants={itemRise} className="w-full space-y-6">
          <div className="grid gap-6 sm:grid-cols-3 w-full">
            {[
              { label: "Type", value: VEHICLE_TYPE_LABEL[profile.vehicle.type], icon: VehicleIcon },
              {
                label: "Model",
                value: `${profile.vehicle.brand} ${profile.vehicle.model}`,
                icon: Sparkles,
              },
              { label: "Registration", value: profile.vehicle.registrationNumber, icon: FileText },
            ].map((v, i) => (
              <motion.div
                key={v.label}
                whileHover={{ y: -3 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-5 sm:p-6 shadow-sm w-full"
              >
                <div className="flex items-center gap-2 text-[#795548]">
                  <v.icon className="h-4 w-4" />
                  <p className="text-xs uppercase tracking-wider font-semibold">{v.label}</p>
                </div>
                <p className="mt-2 text-base sm:text-lg font-bold text-[#3E2723]">{v.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Documents */}
          <div className="grid gap-6 sm:grid-cols-3 w-full">
            {[
              {
                title: "License",
                number: profile.documents.drivingLicense.number,
                expiry: profile.documents.drivingLicense.expiryDate,
                verified: profile.documents.drivingLicense.verified,
              },
              {
                title: "Insurance",
                number: profile.documents.insurance.number,
                expiry: profile.documents.insurance.expiryDate,
                verified: profile.documents.insurance.verified,
              },
              {
                title: "Pollution",
                number: "Certificate Active",
                expiry: profile.documents.pollutionCertificate.expiryDate,
                verified: true,
              },
            ].map((doc, i) => {
              const expiryDate = new Date(doc.expiry);
              const daysLeft = Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const expiringSoon = daysLeft < 30;
              return (
                <motion.div
                  key={doc.title}
                  whileHover={{ y: -3 }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-sm w-full overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#795548]">
                      {doc.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${doc.verified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      <Shield className="h-3 w-3" />
                      {doc.verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#3E2723]">{doc.number}</p>
                  <p
                    className={`mt-1 text-xs ${expiringSoon ? "text-rose-700 font-semibold" : "text-[#795548]"
                      }`}
                  >
                    Expires {expiryDate.toLocaleDateString()}
                    {expiringSoon && daysLeft >= 0 ? ` • ${daysLeft}d left` : ""}
                    {daysLeft < 0 ? " • Expired" : ""}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
