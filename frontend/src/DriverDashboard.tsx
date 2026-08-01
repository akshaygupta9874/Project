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
  Gauge,
  Flame,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import { connectDriverSocket, sendDriverLocation } from "./lib/socket";
import { fetchDriverProfile } from "./lib/driverApi";
import { useAuthContext } from "./context/authContext";

// --- Types mirrored from backend Mongoose models (Driver.ts / Ride.ts) ---
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
  GO_ONLINE: "driver:go-online",
  GO_OFFLINE: "driver:go-offline",
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

type DriverStatus = "OFFLINE" | "ONLINE" | "AVAILABLE" | "BUSY";

const BUSY_RIDE_STATUSES: RideStatus[] = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "STARTED", "ARRIVED_AT_DESTINATION"];
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
    badge: "bg-[#3a1f0a]/80 text-[#ffd88a] border border-[#7a4416]/40",
    description: "Matching this ride with a driver.",
    step: 0,
    accent: "#b8722c",
  },
  DRIVER_ASSIGNED: {
    label: "Assigned to you",
    badge: "bg-[#3a1f0a]/80 text-[#ffd88a] border border-[#7a4416]/40",
    description: "Head to the pickup point.",
    step: 1,
    accent: "#c58a3a",
  },
  DRIVER_ARRIVING: {
    label: "Arriving",
    badge: "bg-[#3a1f0a]/80 text-[#ffd88a] border border-[#7a4416]/40",
    description: "You're on your way to the rider.",
    step: 2,
    accent: "#d8a24c",
  },
  STARTED: {
    label: "Trip in progress",
    badge: "bg-[#3a1f0a]/90 text-[#ffe9be] border border-[#c58a3a]/60",
    description: "Trip is underway to the destination.",
    step: 3,
    accent: "#ffd88a",
  },
  ARRIVED_AT_DESTINATION: {
    label: "Arrived at destination",
    badge: "bg-[#3a1f0a]/90 text-[#ffe9be] border border-[#c58a3a]/60",
    description: "Payment is required before completion.",
    step: 4,
    accent: "#b8722c",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-950/80 text-emerald-200 border border-emerald-500/30",
    description: "This trip has been completed.",
    step: 5,
    accent: "#34d399",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-rose-950/80 text-rose-200 border border-rose-500/30",
    description: "This ride was cancelled.",
    step: 4,
    accent: "#f87171",
  },
};

const PAYMENT_STATUS_CONFIG: Record<RidePaymentStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: "Payment pending", badge: "text-amber-400", dot: "bg-amber-400" },
  PAID: { label: "Paid", badge: "text-emerald-400", dot: "bg-emerald-400" },
  CAPTURED: { label: "Payment captured", badge: "text-emerald-400", dot: "bg-emerald-400" },
  FAILED: { label: "Payment failed", badge: "text-rose-400", dot: "bg-rose-400" },
  REFUNDED: { label: "Refunded", badge: "text-[#ffd88a]", dot: "bg-[#7a4416]" },
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
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDurationSeconds(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------- Global styling & fonts ----------
function ConsoleStyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&display=swap');

      .console-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
      .console-display { font-family: 'Fraunces', ui-serif, Georgia, serif; letter-spacing: -0.01em; }
      .console-readout {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }
      .brass-text {
        background: linear-gradient(120deg, #7a4416 0%, #b8722c 35%, #ffd88a 50%, #b8722c 65%, #7a4416 100%);
        background-size: 220% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: brassSheen 7s linear infinite;
      }
      @keyframes brassSheen {
        0% { background-position: 0% center; }
        100% { background-position: -220% center; }
      }
      @keyframes emberRise {
        0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
        10% { opacity: 0.9; }
        90% { opacity: 0.4; }
        100% { transform: translateY(-140px) translateX(var(--drift, 12px)) scale(1); opacity: 0; }
      }
      @keyframes dialGlow {
        0%, 100% { filter: drop-shadow(0 0 6px rgba(184,114,44,0.35)); }
        50% { filter: drop-shadow(0 0 18px rgba(184,114,44,0.7)); }
      }
      .digit-flicker { animation: digitIn 0.5s ease-out; }
      @keyframes digitIn {
        0% { opacity: 0.2; filter: blur(2px); }
        100% { opacity: 1; filter: blur(0); }
      }
      ::selection { background: #b8722c; color: #2e1808; }
    `}</style>
  );
}

// ---------- Micro components ----------

function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className="console-readout digit-flicker">{display}</motion.span>;
}

function EmberField({ count = 16 }: { count?: number }) {
  const embers = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 137.5) % 100,
        delay: (i * 0.9) % 12,
        duration: 8 + ((i * 5) % 9),
        size: 2 + (i % 3),
        drift: ((i % 5) - 2) * 8,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {embers.map((e) => (
        <span
          key={e.id}
          className="absolute bottom-0 rounded-full"
          style={
            {
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              backgroundColor: "#ffd88a",
              boxShadow: "0 0 6px 1px rgba(255,216,138,0.8)",
              animation: `emberRise ${e.duration}s ease-in ${e.delay}s infinite`,
              "--drift": `${e.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

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
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
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

        <path
          d="M -50 720 C 200 660, 420 780, 700 700 S 1200 560, 1400 620 L 1400 880 L -50 880 Z"
          fill="#a0611f"
          opacity="0.35"
        />

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
            <circle r={8} fill="#3a1f0a" stroke="#ffd88a" strokeWidth={3}>
              <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" begin={`${r.delay}s`} rotate="auto" path={r.d} />
            </circle>
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
      whileHover={{ y: -4, scale: 1.02, borderColor: "#b8722c" }}
      className="group relative overflow-hidden rounded-2xl border border-[#7a4416]/30 bg-gradient-to-b from-[#fffaf0]/95 via-[#fff4dc]/90 to-[#f7e2b8]/90 p-4 sm:p-5 shadow-lg backdrop-blur-xl text-[#2e1808]"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-[#7a4416] font-semibold">{label}</p>
        <Icon className="h-4 w-4 text-[#b8722c]" />
      </div>
      <h2 className="mt-2 text-xl sm:text-2xl font-bold text-[#2e1808] break-words" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{children}</h2>
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#7a4416]/20">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#b8722c] to-transparent"
        />
      </div>
    </motion.div>
  );
}

function StatusPulse({ color, label }: { color: string; label: string }) {
  return (
    <span className="relative inline-flex items-center gap-2 rounded-full border border-[#7a4416]/30 bg-[#fffaf0]/90 px-3.5 py-1 text-xs font-semibold text-[#3a1f0a] shadow-sm backdrop-blur console-readout">
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
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[#7a4416]/20" />
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-[#7a4416] via-[#b8722c] to-[#ffd88a]"
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
                    ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0 rgba(184,114,44,0.4)", "0 0 0 10px rgba(184,114,44,0)"] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.4, repeat: current ? Infinity : 0 }}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${done
                    ? "bg-gradient-to-br from-[#3a1f0a] to-[#7a4416] border-[#ffd88a] text-[#ffd88a]"
                    : "bg-[#fffaf0] border-[#7a4416]/30 text-[#7a4416]"
                  }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-[#ffd88a]" /> : <span className="text-[10px] font-bold console-readout">{i + 1}</span>}
              </motion.div>
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${current ? "text-[#b8722c]" : "text-[#7a4416]/70"
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
    primary: "bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] text-[#ffe9be] border border-[#c58a3a]/40 shadow-[0_18px_40px_-12px_rgba(58,31,10,0.7)]",
    success: "bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-emerald-100 border border-emerald-500/30 shadow-[0_18px_40px_-12px_rgba(6,78,59,0.5)]",
    danger: "bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-rose-100 border border-rose-500/30 shadow-[0_18px_40px_-12px_rgba(159,18,57,0.5)]",
    muted: "bg-[#fffaf0] text-[#7a4416] border border-[#7a4416]/25 shadow-sm",
  };
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });
  const [ripples, setRipples] = useState<{ id: number; left: number; top: number }[]>([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.18);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3);
  };
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [...prev, { id, left: e.clientX - rect.left, top: e.clientY - rect.top }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 650);
    }
    onClick?.();
  };

  return (
    <motion.button
      style={{ x: sx, y: sy }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-xl px-6 py-3 text-sm sm:text-base font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {!disabled && (
        <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#ffd88a]/60 to-transparent transition-transform duration-1000 group-hover:translate-x-[460%]" />
      )}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="absolute rounded-full bg-white/40 pointer-events-none"
          style={{ left: r.left, top: r.top, translateX: "-50%", translateY: "-50%" }}
          initial={{ width: 0, height: 0, opacity: 0.6 }}
          animate={{ width: 220, height: 220, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </motion.button>
  );
}

function IgnitionDial({
  status,
  onToggle,
}: {
  status: DriverStatus;
  onToggle: () => void;
}) {
  const angleMap: Record<DriverStatus, number> = { OFFLINE: -95, ONLINE: -45, AVAILABLE: 0, BUSY: 60 };
  const glowMap: Record<DriverStatus, string> = {
    OFFLINE: "#7a4416",
    ONLINE: "#f59e0b",
    AVAILABLE: "#34d399",
    BUSY: "#b8722c",
  };
  const angle = angleMap[status];
  const glow = glowMap[status];
  const disabled = status === "BUSY";

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label="Toggle online status"
      className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-full disabled:cursor-not-allowed focus:outline-none"
      style={{ animation: "dialGlow 3s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="bezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd88a" />
            <stop offset="45%" stopColor="#b8722c" />
            <stop offset="100%" stopColor="#3a1f0a" />
          </linearGradient>
          <radialGradient id="faceGrad" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="100%" stopColor="#f5e6c8" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill="url(#bezelGrad)" />
        <circle cx="60" cy="60" r="49" fill="url(#faceGrad)" stroke="#7a4416" strokeWidth="1.5" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * 360;
          const rad = (a * Math.PI) / 180;
          const x1 = 60 + 41 * Math.sin(rad);
          const y1 = 60 - 41 * Math.cos(rad);
          const x2 = 60 + 46 * Math.sin(rad);
          const y2 = 60 - 46 * Math.cos(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7a4416" strokeWidth="1.5" opacity={0.6} />;
        })}
        <motion.g
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          style={{ originX: "60px", originY: "60px" }}
        >
          <line x1="60" y1="60" x2="60" y2="24" stroke={glow} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="60" cy="60" r="6" fill="#ffd88a" stroke="#3a1f0a" strokeWidth="1.5" />
        </motion.g>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pt-9">
        <Power className="h-4 w-4" style={{ color: glow }} />
      </div>
      {status === "AVAILABLE" && (
        <motion.span
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: glow }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
    </button>
  );
}

function TiltTile({
  emoji,
  label,
  index,
}: {
  emoji: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 10);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.button
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 600 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="relative overflow-hidden h-24 sm:h-28 rounded-3xl border border-[#7a4416]/25 bg-gradient-to-b from-[#fffaf0]/95 via-[#fff4dc]/90 to-[#f7e2b8]/90 text-[#2e1808] shadow-lg w-full flex items-center justify-between px-6 group backdrop-blur-xl"
    >
      <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#c58a3a]/60 rounded-tl-3xl" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#c58a3a]/60 rounded-br-3xl" />
      <span className="flex items-center gap-3 text-base sm:text-lg font-bold">
        <span className="text-2xl">{emoji}</span>
        {label}
      </span>
      <ChevronRight className="h-5 w-5 text-[#b8722c] group-hover:translate-x-1 transition-transform" />
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-[#ffd88a]/60 to-transparent skew-x-[-20deg]"
        animate={{ x: ["0%", "300%"] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: index * 0.4 }}
      />
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
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("ONLINE");
  const [routePolyline, setRoutePolyline] = useState<Array<{ lat: number; lng: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showEarningsFlash, setShowEarningsFlash] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const driverStatusRef = useRef<DriverStatus>("ONLINE");
  const currentRideRef = useRef<Ride | null>(null);
  const hasEmittedOnlineRef = useRef(false);



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
          const currentRideData = rideResponse.data.ride;
          setCurrentRide(currentRideData);
          if (BUSY_RIDE_STATUSES.includes(currentRideData.status)) {
            setDriverStatus("BUSY");
            driverStatusRef.current = "BUSY";
          }
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
        if (!hasEmittedOnlineRef.current) {
          hasEmittedOnlineRef.current = true;
          driverSocket.send(JSON.stringify({ event: DriverEvents.GO_ONLINE, data: {} }));
        }
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
              if (updated) {
                applyCompletedRideStats(updated);
                const earnedPaise =
                  updated.fare?.breakdown?.driverEarningPaise ??
                  updated.fare?.fareBreakdown?.driverEarningPaise ??
                  0;
                if (earnedPaise > 0) {
                  setShowEarningsFlash(earnedPaise);
                  setTimeout(() => setShowEarningsFlash(null), 3200);
                }
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

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      clearInterval(heartbeatInterval);
      if (hasEmittedOnlineRef.current && driverSocket.readyState === WebSocket.OPEN) {
        driverSocket.send(JSON.stringify({ event: DriverEvents.GO_OFFLINE, data: {} }));
      }
      hasEmittedOnlineRef.current = false;
      driverSocket.close();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    if (currentRide && BUSY_RIDE_STATUSES.includes(currentRide.status)) {
      if (driverStatusRef.current !== "BUSY") {
        driverStatusRef.current = "BUSY";
        setDriverStatus("BUSY");
      }
      return;
    }

    if (driverStatus === "OFFLINE" || driverStatus === "ONLINE") {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    const syncLocation = (latitude: number, longitude: number) => {
      setDriverLocation({ latitude, longitude });
      sendDriverLocation(socketRef.current, latitude, longitude);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        syncLocation(position.coords.latitude, position.coords.longitude);
      },
      (positionError) => setError(`Navigator : ${positionError.message} `),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        syncLocation(latitude, longitude);
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
    };
  }, [profile, driverStatus]);

  useEffect(() => {
    if (!currentRide) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    if (driverStatusRef.current === "OFFLINE") return;

    if (BUSY_RIDE_STATUSES.includes(currentRide.status) && driverStatusRef.current !== "BUSY") {
      socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_BUSY, data: {} }));
      setDriverStatus("BUSY");
    } else if (TERMINAL_RIDE_STATUSES.includes(currentRide.status) && driverStatusRef.current === "BUSY") {
      socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_AVAILABLE, data: {} }));
      setDriverStatus("AVAILABLE");
    }
  }, [currentRide?.status]);

  const applyCompletedRideStats = (ride: Ride | null | undefined) => {
    if (!ride) return;

    const completedTripsDelta = 1;
    const earningPaise =
      ride.fare?.breakdown?.driverEarningPaise ??
      ride.fare?.fareBreakdown?.driverEarningPaise ??
      0;
    const distanceMeters = ride.distance?.actual ?? ride.distance?.estimated ?? 0;

    setProfile((prevProfile) => {
      if (!prevProfile) return prevProfile;

      return {
        ...prevProfile,
        statistics: {
          ...prevProfile.statistics,
          completedTrips: prevProfile.statistics.completedTrips + completedTripsDelta,
          totalEarnings: prevProfile.statistics.totalEarnings + earningPaise,
          totalDistance: prevProfile.statistics.totalDistance + distanceMeters,
        },
      };
    });
  };

  const handleToggleAvailability = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("Socket connection not ready.");
      return;
    }
    if (driverStatus === "BUSY") {
      setError("You can't go offline while a ride is active.");
      return;
    }

    if (driverStatus === "ONLINE") {
      socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_AVAILABLE, data: { available: true } }));
      setDriverStatus("AVAILABLE");
      return;
    }

    socketRef.current.send(JSON.stringify({ event: DriverEvents.SET_AVAILABLE, data: { available: false } }));
    setDriverStatus("ONLINE");
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
      applyCompletedRideStats(currentRide);
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
      <div className="console-root relative min-h-screen w-full bg-[#f5e6c8] p-6 flex items-center justify-center font-sans text-[#2e1808] overflow-hidden">
        <CityMapBackground />
        <ConsoleStyleSheet />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative z-10 w-full max-w-4xl rounded-[2.5rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/95 via-[#fff4dc]/90 to-[#f7e2b8]/90 p-8 shadow-2xl backdrop-blur-2xl"
        >
          {/* Brass top rail */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#3a1f0a] to-[#7a4416] text-[#ffd88a] flex items-center justify-center shadow-md">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="console-display text-3xl font-bold text-[#2e1808]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Driver dashboard</h1>
          </div>
          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-900">
              {error}
            </div>
          ) : (
            <p className="mt-4 text-[#6b3a12] font-medium">
              Driver profile not found or awaiting verification. Please complete the driver registration flow.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/driver-registration")}
              className="rounded-xl bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] text-[#ffe9be] hover:opacity-90 border border-[#c58a3a]/40 shadow-md"
            >
              Register as driver
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border-[#7a4416]/30 bg-[#fffaf0]/80 text-[#3a1f0a] hover:bg-[#fff4dc]"
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
      : { lat: 22.5726, lng: 88.3639 };

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
    OFFLINE: "You are not on the dashboard right now.",
    ONLINE: "You are on the dashboard but not accepting rides yet.",
    AVAILABLE: "You are online and receiving requests.",
    BUSY: "You're on an active trip. You'll go back to available automatically once it ends.",
  };

  const statusDot = driverStatus === "AVAILABLE" ? "#34d399" : driverStatus === "BUSY" ? "#b8722c" : driverStatus === "ONLINE" ? "#f59e0b" : "#7a4416";
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
    <div className="console-root relative min-h-screen w-full overflow-x-hidden bg-[#f5e6c8] text-[#2e1808]">
      <ConsoleStyleSheet />
      <CityMapBackground />

      {/* Completion flash */}
      <AnimatePresence>
        {showEarningsFlash !== null && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] rounded-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white px-6 py-3 shadow-2xl flex items-center gap-3 border border-emerald-400/50"
          >
            <Sparkles className="h-5 w-5 text-emerald-200" />
            <span className="font-bold console-readout">Trip completed! +{formatPaise(showEarningsFlash)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8 max-w-7xl mx-auto"
      >
        {/* Header */}
        <motion.header variants={itemRise} className="sticky top-4 z-50 w-full">
          <div className="w-full rounded-[2rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/85 backdrop-blur-xl shadow-xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: 8, scale: 1.05 }}
                className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-[#3a1f0a] via-[#6b3a12] to-[#2e1808] flex items-center justify-center shadow-md text-[#ffd88a]"
              >
                <VehicleIcon className="h-6 w-6" />
                <motion.span
                  className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#fffaf0]"
                  style={{ backgroundColor: statusDot }}
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <h2 className="console-display text-lg sm:text-2xl font-black text-[#2e1808] leading-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                  Driver Console
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#6b3a12]">Drive safe • Earn smart</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <StatusPulse color={statusDot} label={driverStatus} />
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="hidden sm:inline-flex rounded-xl border-[#7a4416]/30 bg-[#fffaf0] text-[#3a1f0a] hover:bg-[#fff4dc]"
              >
                Rider Mode
              </Button>
              <Button
                variant="destructive"
                onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
                className="rounded-xl bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 text-rose-100 hover:opacity-90 border border-rose-500/30 shadow-md"
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
          className="relative w-full overflow-hidden rounded-[2.5rem] p-6 sm:p-10 text-[#2e1808] shadow-2xl border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/85"
        >
          {/* Brass top rail */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />

          {/* moving scanline sweep */}
          <motion.div
            aria-hidden
            className="absolute inset-x-0 h-24 opacity-[0.04] pointer-events-none"
            style={{ background: "linear-gradient(180deg, transparent, #b8722c, transparent)" }}
            animate={{ y: ["-10%", "120%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative flex flex-col gap-6">
            <div className="space-y-3">
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#b8722c] font-bold inline-flex items-center gap-2"
              >
                <Radio className="h-3.5 w-3.5" /> Driver Portal
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="console-display text-3xl sm:text-5xl font-black tracking-tight text-[#2e1808]"
                style={{ fontFamily: "'Fraunces', Georgia, serif" }}
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
              <p className="max-w-xl text-[#6b3a12] font-medium text-sm sm:text-base">
                Ready to earn today? Go online and we'll instantly connect you with nearby riders.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fffaf0] border border-[#7a4416]/20 px-3.5 py-1 text-xs font-semibold text-[#3a1f0a] shadow-sm">
                  <VehicleIcon className="h-3.5 w-3.5 text-[#b8722c]" /> {VEHICLE_TYPE_LABEL[profile.vehicle.type]} •{" "}
                  {profile.vehicle.brand} {profile.vehicle.model}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fffaf0] border border-[#7a4416]/20 px-3.5 py-1 text-xs font-semibold text-[#3a1f0a] shadow-sm">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" /> {profile.verificationStatus}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fffaf0] border border-[#7a4416]/20 px-3.5 py-1 text-xs font-semibold text-[#3a1f0a] shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5 text-[#b8722c]" /> {acceptanceRate}% completion
                </span>
              </div>
            </div>

            {/* 4 StatCards positioned below Welcome back */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full pt-2">
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

        {/* Go Online — brass ignition dial card */}
        <motion.section
          variants={itemRise}
          className="w-full rounded-[2.5rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/85 shadow-xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-2xl"
        >
          {/* Brass top rail */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <IgnitionDial status={driverStatus} onToggle={handleToggleAvailability} />
              <div>
                <h2 className="console-display text-xl font-bold text-[#2e1808] inline-flex items-center gap-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                  <Gauge className="h-4 w-4 text-[#b8722c]" /> Driver Status
                </h2>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={driverStatus}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-sm text-[#6b3a12] font-medium mt-0.5 max-w-xs"
                  >
                    {driverStatusCopy[driverStatus]}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-[#7a4416]/70 font-bold">Tap the dial to toggle</p>
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
                <>Go Unavailable</>
              ) : driverStatus === "BUSY" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> On a Trip
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 text-[#ffd88a]" /> Available To Accept Rides
                </>
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
              className="w-full rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-900 shadow-sm flex items-center gap-3 backdrop-blur-md"
            >
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-700" />
              <span className="flex-1 font-medium">{error}</span>
              <button
                onClick={() => setError("")}
                className="rounded-full p-1 hover:bg-rose-500/10 transition"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4 text-rose-800" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Ride + Map */}
        <motion.section variants={itemRise} className="grid gap-8 w-full">
          <div className="w-full overflow-hidden rounded-[2.5rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/85 shadow-xl backdrop-blur-2xl relative">
            {/* Brass top rail */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />

            <div className="border-b border-[#7a4416]/20 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="console-display text-2xl font-bold text-[#2e1808]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Current Ride</h2>
                <p className="text-sm text-[#6b3a12] font-medium mt-1">Everything you need for the active trip.</p>
              </div>
              <AnimatePresence mode="wait">
                {statusConfig && (
                  <motion.span
                    key={statusConfig.label}
                    initial={{ opacity: 0, scale: 0.9, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -8 }}
                    className={`w-fit rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${statusConfig.badge}`}
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
                      className="absolute inset-0 rounded-full bg-[#b8722c]/20"
                      animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <motion.span
                      className="absolute inset-0 rounded-full bg-[#b8722c]/15"
                      animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                    />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#3a1f0a] to-[#7a4416] text-[#ffd88a] shadow-inner border border-[#c58a3a]/40">
                      <Navigation className="h-8 w-8 text-[#ffd88a]" />
                    </div>
                  </div>
                  <h3 className="mt-5 console-display text-xl sm:text-2xl font-bold text-[#2e1808]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
                    {driverStatus === "AVAILABLE" ? "Scanning for nearby riders…" : "Waiting to go online"}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-[#6b3a12] font-medium max-w-md mx-auto">
                    {driverStatus === "AVAILABLE"
                      ? "You are online. Requests will appear here instantly with sound."
                      : "Tap the ignition dial above to start receiving ride requests."}
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
                    {/* Route card */}
                    <div className="relative rounded-2xl border border-[#7a4416]/20 bg-[#fffaf0]/90 p-5 overflow-hidden shadow-sm">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <span className="relative h-3 w-3 rounded-full bg-emerald-500">
                            <motion.span
                              className="absolute inset-0 rounded-full bg-emerald-500"
                              animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
                              transition={{ duration: 1.6, repeat: Infinity }}
                            />
                          </span>
                          <div className="relative my-1 h-16 w-[2px] overflow-hidden bg-[#7a4416]/30">
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-b from-transparent via-[#b8722c] to-transparent"
                              animate={{ y: ["-100%", "100%"] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                          <MapPin className="h-3.5 w-3.5 text-rose-600" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#b8722c] font-bold">
                              Pickup
                            </p>
                            <p className="text-sm sm:text-base font-semibold text-[#2e1808]">
                              {currentRide.pickup.address}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-[#b8722c] font-bold">
                              Destination
                            </p>
                            <p className="text-sm sm:text-base font-semibold text-[#2e1808]">
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
                        className="rounded-2xl border border-[#7a4416]/20 bg-[#fffaf0]/90 p-5 flex flex-col justify-between shadow-sm backdrop-blur"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-wider text-[#7a4416] font-semibold">
                            {tile.isPayment ? "Payment" : tile.label}
                          </p>
                          <tile.icon className="h-4 w-4 text-[#b8722c]" />
                        </div>
                        <h3
                          className={`mt-2 console-readout text-lg sm:text-xl font-bold break-words ${tile.isPayment ? paymentConfig?.badge : "text-[#2e1808]"
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
                      className="lg:col-span-2 rounded-2xl border border-dashed border-[#7a4416]/40 bg-[#fffaf0]/80 p-5 shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-widest text-[#b8722c] font-bold mb-3">
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
                            <span className="text-[10px] uppercase tracking-wider text-[#7a4416]/80 font-semibold">{k}</span>
                            <span
                              className={`console-readout font-bold ${k === "You earn" ? "text-[#b8722c]" : "text-[#2e1808]"
                                }`}
                            >
                              {formatPaise(Number(v))}
                            </span>
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
                className="mx-6 mb-6 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-900 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md"
              >
                <span>
                  Cancelled{currentRide.cancelledBy ? ` by ${currentRide.cancelledBy.toLowerCase()}` : ""}
                  {currentRide.cancellationReason ? `: ${currentRide.cancellationReason}` : "."}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentRide(null)}
                  className="rounded-xl border-rose-500/30 bg-[#fffaf0] text-rose-900 hover:bg-rose-50 px-4 py-2 text-xs font-bold"
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
                className="relative mx-6 mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-3 overflow-hidden backdrop-blur-md"
              >
                <EmberField count={8} />
                <p className="relative text-xs uppercase tracking-widest text-emerald-800 font-bold">
                  Trip Completed
                </p>
                <h3 className="relative console-readout text-3xl font-black text-emerald-900">
                  {fareBreakdownData
                    ? formatPaise(fareBreakdownData.driverEarningPaise)
                    : fare != null
                      ? formatPaise(fare)
                      : "₹0.00"}
                </h3>
                <p className="relative text-sm font-medium text-emerald-900/80">Driver earnings added successfully.</p>
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRide(null)}
                    className="rounded-xl border-emerald-500/30 bg-[#fffaf0] text-emerald-950 hover:bg-emerald-50 px-6 py-2 text-xs font-bold mt-2 shadow-sm"
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
            className="w-full overflow-hidden rounded-[2.5rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/85 shadow-xl backdrop-blur-2xl relative"
          >
            {/* Brass top rail */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#c58a3a] to-transparent" />

            <div className="border-b border-[#7a4416]/20 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="console-display text-xl font-bold text-[#2e1808]" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Live Route Map</h2>
                <p className="text-sm text-[#6b3a12] font-medium">Your live location and active route.</p>
              </div>
              <StatusPulse
                color={statusConfig ? statusConfig.accent : statusDot}
                label={statusConfig ? statusConfig.label : "No active ride"}
              />
            </div>
            <div className="relative h-[450px] sm:h-[550px] w-full">
              <MapView center={mapCenter} zoom={12} markers={mapMarkers} path={routePolyline} />
              {driverLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-4 left-4 rounded-full bg-[#fffaf0]/95 backdrop-blur px-3.5 py-1.5 text-xs font-semibold text-[#2e1808] shadow-md border border-[#7a4416]/25 flex items-center gap-1.5 console-readout"
                >
                  <span className="relative flex h-2 w-2">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-emerald-500"
                      animate={{ scale: [1, 2], opacity: [0.7, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
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
            <TiltTile key={a.label} emoji={a.emoji} label={a.label} icon={a.icon} index={i} />
          ))}
        </motion.section>

        {/* Vehicle & Documents */}
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
                className="rounded-[2rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/90 p-5 sm:p-6 shadow-sm w-full backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 text-[#7a4416]">
                  <v.icon className="h-4 w-4 text-[#b8722c]" />
                  <p className="text-xs uppercase tracking-wider font-bold">{v.label}</p>
                </div>
                <p className="mt-2 console-readout text-base sm:text-lg font-bold text-[#2e1808] break-words">{v.value}</p>
              </motion.div>
            ))}
          </div>

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
                  className="relative rounded-[2rem] border border-[#fff4dc]/70 bg-gradient-to-b from-[#fffaf0]/90 via-[#fff4dc]/85 to-[#f7e2b8]/90 p-6 shadow-sm w-full overflow-hidden backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#7a4416]">
                      {doc.title}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${doc.verified
                          ? "bg-emerald-500/15 text-emerald-900 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-900 border-amber-500/30"
                        }`}
                    >
                      <Shield className="h-3 w-3" />
                      {doc.verified ? "Verified" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-[#2e1808] break-words">{doc.number}</p>
                  <p
                    className={`mt-1 text-xs console-readout font-medium ${expiringSoon ? "text-rose-700 font-semibold" : "text-[#6b3a12]"
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