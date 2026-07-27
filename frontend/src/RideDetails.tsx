import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Shield,
  Star,
  Car,
  MapPin,
  Clock,
  Route as RouteIcon,
  IndianRupee,
  X,
  Loader2,
  CheckCircle2,
  Navigation2,
  Sparkles,
  Radio,
  AlertTriangle,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";
import { createPaymentOrder, loadRazorpayCheckout, verifyPaymentSignature } from "./lib/payment";
import { useAuthContext } from "./context/authContext";

/**
 * RideDetails — "boarding pass" theme, next-level pass.
 * Same data contract, sockets, and payment flow as before; the map is now a
 * proper hero panel up top (a ticket "window"), torn along a die-cut seam
 * into the trip details stub below. Terminal states get an inked stamp.
 */

type RideStatus =
  | "SEARCHING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ARRIVING"
  | "STARTED"
  | "ARRIVED_AT_DESTINATION"
  | "COMPLETED"
  | "CANCELLED";

interface RidePoint {
  address: string;
  coordinates: { latitude: number; longitude: number };
}
interface FareBreakdown {
  baseFarePaise?: number;
  distanceFarePaise?: number;
  timeFarePaise?: number;
  surgePaise?: number;
  platformCommissionPaise?: number;
  driverEarningPaise?: number;
  totalPaise?: number;
}
interface DriverInfo {
  _id: string;
  firstName?: string;
  lastName?: string;
  vehicleNumber?: string | null;
  phone?: string;
  user?: { firstName?: string; lastName?: string; phone?: string };
  vehicle?: { registrationNumber?: string; model?: string; color?: string };
}
interface Ride {
  _id: string;
  pickup: RidePoint;
  destination: RidePoint;
  fare: { estimated: number; final?: number | null; breakdown?: FareBreakdown | null };
  distance: { estimated: number | null; actual?: number | null };
  duration: { estimated: number | null; actual?: number | null };
  status: RideStatus;
  paymentStatus?: "PENDING" | "PAID" | "CAPTURED" | "FAILED" | "REFUNDED";
  driver?: DriverInfo | null;
}

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const BODY_FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";

const STATUS_STEPS: { key: RideStatus; label: string }[] = [
  { key: "SEARCHING", label: "Searching" },
  { key: "DRIVER_ASSIGNED", label: "Assigned" },
  { key: "DRIVER_ARRIVING", label: "Arriving" },
  { key: "STARTED", label: "On trip" },
  { key: "ARRIVED_AT_DESTINATION", label: "Arrived" },
  { key: "COMPLETED", label: "Complete" },
];

const STATUS_META: Record<RideStatus, { title: string; subtitle: string; accent: string }> = {
  SEARCHING: { title: "Finding your driver…", subtitle: "Matching you with the nearest ride", accent: "#8D6E63" },
  DRIVER_ASSIGNED: { title: "Driver assigned", subtitle: "Your driver is preparing to head over", accent: "#B8860B" },
  DRIVER_ARRIVING: { title: "Driver is arriving", subtitle: "Head to your pickup spot", accent: "#C9973B" },
  STARTED: { title: "You're on your way", subtitle: "Sit back and enjoy the ride", accent: "#5C7A63" },
  ARRIVED_AT_DESTINATION: {
    title: "Arrived at destination",
    subtitle: "Payment is now required before trip completion",
    accent: "#B8860B",
  },
  COMPLETED: { title: "Trip complete", subtitle: "Thanks for riding with us", accent: "#4E7C59" },
  CANCELLED: { title: "Ride cancelled", subtitle: "This trip is no longer active", accent: "#B54834" },
};

function formatPaiseToRupee(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
  const rupees = amount > 1000 ? amount / 100 : amount;
  return rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------------- */
/* Style sheet + ambient atmosphere                                       */
/* ---------------------------------------------------------------------- */

function TicketStyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

      @keyframes shine-sweep {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(120%); }
      }
      @keyframes route-dash {
        to { stroke-dashoffset: -32; }
      }
      @keyframes ticket-drift {
        0% { transform: translateY(0); opacity: 0; }
        15% { opacity: 0.5; }
        85% { opacity: 0.22; }
        100% { transform: translateY(-90px); opacity: 0; }
      }
      @keyframes digit-in {
        0% { opacity: 0.25; filter: blur(2px); }
        100% { opacity: 1; filter: blur(0); }
      }
      .digit-flicker { animation: digit-in 0.45s ease-out; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
        }
      }
    `}</style>
  );
}

function DustMotes({ count = 7 }: { count?: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 53.7) % 100,
        delay: (i * 1.3) % 10,
        duration: 10 + ((i * 4) % 8),
        size: 2 + (i % 2),
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m) => (
        <span
          key={m.id}
          className="absolute bottom-0 rounded-full bg-[#B8860B]/25"
          style={{
            left: `${m.left}%`,
            width: m.size,
            height: m.size,
            animation: `ticket-drift ${m.duration}s ease-in-out ${m.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function TicketAtmosphere() {
  return (
    <>
      <motion.div
        className="pointer-events-none fixed -top-24 -left-24 z-0 h-72 w-72 rounded-full bg-[#D7B37A]/25 blur-3xl"
        animate={{ y: [0, 16, 0], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none fixed top-1/3 -right-28 z-0 h-80 w-80 rounded-full bg-[#8D6E63]/15 blur-3xl"
        animate={{ y: [0, -18, 0], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Small reusable atoms                                                   */
/* ---------------------------------------------------------------------- */

function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return (
    <motion.span className="digit-flicker tabular-nums" style={{ fontFamily: MONO_FONT }}>
      {display}
    </motion.span>
  );
}

function TicketButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "success" | "danger" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-to-r from-[#8D6E63] via-[#6D4C41] to-[#3E2723] text-[#FAF6F0] border border-[#3E2723]/40",
    success: "bg-gradient-to-r from-[#6E8F63] via-[#4E7C59] to-[#2F5B3D] text-[#F4F8F1] border border-[#2F5B3D]/40",
    danger: "bg-rose-600 text-white border border-rose-700/40",
    ghost: "bg-[#EFEBE9] text-[#3E2723] border border-[#D7CCC8] hover:bg-[#E4DBD3]",
  };
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 240, damping: 20 });
  const sy = useSpring(y, { stiffness: 240, damping: 20 });
  const [ripples, setRipples] = useState<{ id: number; left: number; top: number }[]>([]);

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || variant === "ghost") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.12);
    y.set((e.clientY - r.top - r.height / 2) * 0.22);
  };
  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [...prev, { id, left: e.clientX - r.left, top: e.clientY - r.top }]);
      setTimeout(() => setRipples((prev) => prev.filter((rp) => rp.id !== id)), 600);
    }
    onClick?.();
  };

  return (
    <motion.button
      type={type}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-shadow disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6E63] focus-visible:ring-offset-2 ${styles[variant]} ${className}`}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
      {!disabled && variant !== "ghost" && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-50%", "420%"] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-white/35"
          style={{ left: r.left, top: r.top, translateX: "-50%", translateY: "-50%" }}
          initial={{ width: 0, height: 0, opacity: 0.5 }}
          animate={{ width: 200, height: 200, opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      ))}
    </motion.button>
  );
}

/* ---------------------------------------------------------------------- */
/* Map hero + boarding-pass seam                                          */
/* ---------------------------------------------------------------------- */

function RadarSweep() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: "conic-gradient(from 0deg, rgba(141,110,99,0.28), transparent 28%, transparent 100%)",
        maskImage: "radial-gradient(circle at center, black 55%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(circle at center, black 55%, transparent 75%)",
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
    />
  );
}

function PerforationSeam() {
  return (
    <div className="relative z-20 -mt-4 mb-[-1px] flex justify-center px-8">
      <div className="relative h-4 w-full max-w-[92%]">
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 border-t border-dashed border-[#C9B7A6]" />
        <span className="absolute -left-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#FAF6F0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]" />
        <span className="absolute -right-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#FAF6F0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Ink stamp for terminal states                                          */
/* ---------------------------------------------------------------------- */

function TicketStamp({ label, sublabel, tone }: { label: string; sublabel: string; tone: "complete" | "void" }) {
  const color = tone === "complete" ? "#2F5B3D" : "#8B2E20";
  const pathId = tone === "complete" ? "stampArcComplete" : "stampArcVoid";
  return (
    <motion.div
      initial={{ scale: 1.6, rotate: tone === "complete" ? -18 : 14, opacity: 0 }}
      animate={{ scale: 1, rotate: tone === "complete" ? -10 : 8, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.15 }}
      className="relative mx-auto grid h-28 w-28 place-items-center"
      style={{ color }}
    >
      <svg
        viewBox="0 0 140 140"
        className="absolute inset-0 h-full w-full"
        style={{ filter: "drop-shadow(0 2px 1px rgba(0,0,0,0.08))" }}
      >
        <defs>
          <path id={pathId} d="M 15 70 A 55 55 0 1 1 125 70" fill="none" />
        </defs>
        <circle cx="70" cy="70" r="62" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="3 4" opacity="0.85" />
        <circle cx="70" cy="70" r="50" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
        <text fontSize="10.5" fontWeight="700" letterSpacing="2" fill={color} opacity="0.9">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {label} • {label} •
          </textPath>
        </text>
      </svg>
      <div className="relative grid h-12 w-12 place-items-center rounded-full border-2" style={{ borderColor: color }}>
        {tone === "complete" ? <CheckCircle2 className="h-6 w-6" /> : <X className="h-6 w-6" />}
      </div>
      <span className="sr-only">{sublabel}</span>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Journey stepper                                                        */
/* ---------------------------------------------------------------------- */

function JourneyStepper({ status }: { status: RideStatus }) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  const activeIdx = idx === -1 ? 0 : idx;
  const progress = STATUS_STEPS.length > 1 ? activeIdx / (STATUS_STEPS.length - 1) : 0;
  return (
    <div className="relative rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] px-3 py-4">
      <div className="absolute left-7 right-7 top-[34px] h-[2px] bg-[#E4DBD3]" />
      <motion.div
        className="absolute left-7 top-[34px] h-[2px] bg-gradient-to-r from-[#8D6E63] via-[#B8860B] to-[#4E7C59]"
        initial={{ width: 0 }}
        animate={{ width: `calc(${progress} * (100% - 3.5rem))` }}
        transition={{ type: "spring", stiffness: 100, damping: 22 }}
      />
      <div className="relative flex items-start justify-between">
        {STATUS_STEPS.map((s, i) => {
          const done = i <= activeIdx && status !== "CANCELLED";
          const current = i === activeIdx && status !== "CANCELLED";
          return (
            <div key={s.key} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
              <motion.div
                animate={current ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 1.6, repeat: current ? Infinity : 0 }}
                className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[10px] font-bold ${
                  done ? "border-[#3E2723] bg-[#3E2723] text-[#FAF6F0]" : "border-[#D7CCC8] bg-[#FAF6F0] text-[#A1887F]"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </motion.div>
              <span
                className={`text-center text-[9px] font-semibold uppercase tracking-wider ${
                  current ? "text-[#3E2723]" : "text-[#A1887F]"
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

/* ---------------------------------------------------------------------- */
/* Driver card (tilt on hover)                                            */
/* ---------------------------------------------------------------------- */

function DriverCard({
  firstName,
  lastName,
  vehicleNo,
  phone,
}: {
  firstName: string;
  lastName: string;
  vehicleNo: string;
  phone?: string;
}) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 6);
    rx.set(-py * 6);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 700 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="relative overflow-hidden rounded-2xl border border-[#EFE0CC] bg-gradient-to-br from-[#FBF3E4] via-[#F6E7CE] to-[#EFDCBB] p-4 shadow-inner"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D7B37A]/30 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="relative">
          <div
            className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#8D6E63] to-[#3E2723] text-lg font-semibold text-[#FAF6F0] shadow-lg"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            {firstName?.[0]?.toUpperCase() || "D"}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#FAF6F0] bg-emerald-500 text-white shadow">
            <Shield className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[#3E2723]" style={{ fontFamily: DISPLAY_FONT }}>
            {firstName} {lastName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6D4C41]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF6F0]/70 px-1.5 py-0.5 font-semibold text-[#3E2723]">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              4.9
            </span>
            <span>•</span>
            <span className="truncate font-medium">{vehicleNo}</span>
          </div>
        </div>
        {phone && (
          <motion.a
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            href={`tel:${phone}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3E2723] text-[#FAF6F0] shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6E63]"
            aria-label="Call driver"
          >
            <Phone className="h-4 w-4" />
          </motion.a>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Stat tile                                                              */
/* ---------------------------------------------------------------------- */

function StatTile({
  icon,
  label,
  value,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] p-3 text-center shadow-sm transition"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-16 bg-gradient-to-b from-white/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037]">{icon}</div>
      <p className="mt-1.5 text-sm font-semibold text-[#3E2723]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8D6E63]">{label}</p>
      <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-[#EFEBE9]">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay }}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#B8860B]/70 to-transparent"
        />
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main component                                                         */
/* ---------------------------------------------------------------------- */

export default function RideDetails() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();

  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const { user } = useAuthContext();

  const fetchRideDetails = async (id?: string) => {
    try {
      const endpoint = id ? `/ride/${id}` : "/ride/current";
      const response = await appApi.get<{ message: string; ride: Ride }>(endpoint);
      const currentRide = response.data.ride;
      if (currentRide) {
        setRide(currentRide);
        return currentRide;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const currentRide = await fetchRideDetails(rideId);
        if (cancelled || !currentRide) {
          if (!cancelled && !currentRide) setError("Unable to load ride details.");
          return;
        }
        if (currentRide?.pickup && currentRide?.destination) {
          const pLat = currentRide.pickup.coordinates.latitude;
          const pLon = currentRide.pickup.coordinates.longitude;
          const dLat = currentRide.destination.coordinates.latitude;
          const dLon = currentRide.destination.coordinates.longitude;
          const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
          const url = `https://api.geoapify.com/v1/routing?waypoints=${pLat},${pLon}|${dLat},${dLon}&mode=drive&apiKey=${apiKey}`;
          const routeRes = await fetch(url);
          const routeData = await routeRes.json();
          if (!cancelled && routeData?.features?.[0]?.geometry?.coordinates) {
            const coords = routeData.features[0].geometry.coordinates;
            const flatCoords: [number, number][] = [];
            coords.forEach((line: [number, number][]) => {
              line.forEach(([lon, lat]) => flatCoords.push([lat, lon]));
            });
            setRoutePolyline(flatCoords);
          }
        }
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

  useEffect(() => {
    const s = connectRiderSocket({
      onReady: () => setToast("Connected to live updates"),
      onError: (m: string) => setToast(m),
      onRideAccepted: async () => {
        setToast("Driver has accepted your ride");
        await fetchRideDetails(rideId);
      },
      onDriverLocation: (payload: any) => {
        if (payload?.latitude != null && payload?.longitude != null) {
          setDriverLocation({ latitude: payload.latitude, longitude: payload.longitude });
        }
      },
      onDriverArrived: () => {
        setRide((p) => (p ? { ...p, status: "DRIVER_ARRIVING" } : p));
        setToast("Driver has arrived at pickup");
      },
      onRideStarted: () => {
        setRide((p) => (p ? { ...p, status: "STARTED" } : p));
        setToast("Ride started");
      },
      onRideArrivedAtDestination: () => {
        setRide((p) => (p ? { ...p, status: "ARRIVED_AT_DESTINATION" } : p));
        setToast("Driver has arrived at your destination");
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

    if (s) {
      const originalOnMessage = s.onmessage;
      s.onmessage = async (event) => {
        if (originalOnMessage) originalOnMessage.call(s, event);
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.event === "server:driver-location" && parsed?.data) {
            const { latitude, longitude } = parsed.data;
            if (latitude != null && longitude != null) {
              setDriverLocation({ latitude, longitude });
            }
          }
          if (parsed?.event === "server:ride-accepted" || parsed?.event === "server:driver-assigned") {
            await fetchRideDetails(rideId);
          }
        } catch {
          /* ignore */
        }
      };
    }

    socketRef.current = s;
    return () => s?.close();
  }, [rideId]);

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

  async function handlePayNow() {
    if (!ride || !user?._id) {
      setError("Unable to start payment from this ride right now.");
      return;
    }
    if (ride.status !== "ARRIVED_AT_DESTINATION") {
      setError("Payment is only available after your driver arrives at the destination.");
      return;
    }
    if (ride.paymentStatus && ride.paymentStatus !== "PENDING") {
      setError("This ride payment has already been processed.");
      return;
    }

    let currentRide = ride;
    try {
      const response = await appApi.get<{ message: string; ride: Ride }>(
        `/ride/${currentRide._id}/fare-preview`
      );
      currentRide = response.data.ride;
      setRide(currentRide);
    } catch {
      setError("Unable to calculate the final fare. Please try again.");
      return;
    }

    if (!currentRide.fare.breakdown) {
      setError("Ride fare breakdown is not available for payment.");
      return;
    }

    setIsPaying(true);
    setError("");
    setToast("");

    try {
      const paymentOrder = await createPaymentOrder({
        rideId: currentRide._id,
        driverId: currentRide.driver?._id ?? "",
        fareBreakdown: {
          baseFarePaise: currentRide.fare.breakdown?.baseFarePaise ?? 0,
          distanceFarePaise: currentRide.fare.breakdown?.distanceFarePaise ?? 0,
          timeFarePaise: currentRide.fare.breakdown?.timeFarePaise ?? 0,
          surgePaise: currentRide.fare.breakdown?.surgePaise ?? 0,
          platformCommissionPaise: currentRide.fare.breakdown?.platformCommissionPaise ?? 0,
          driverEarningPaise: currentRide.fare.breakdown?.driverEarningPaise ?? 0,
          totalPaise: currentRide.fare.breakdown?.totalPaise ?? 0,
        },
        idempotencyKey: `${currentRide._id}-${user._id}`,
      });

      const Razorpay = await loadRazorpayCheckout();
      const options = {
        key: paymentOrder.razorpayKeyId,
        amount: paymentOrder.amountPaise,
        currency: paymentOrder.currency,
        order_id: paymentOrder.gatewayOrderId,
        name: "Ride payment",
        description: "Complete your ride payment",
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyResult = await verifyPaymentSignature(response);
            setRide((current) =>
              current ? { ...current, paymentStatus: verifyResult.status as Ride["paymentStatus"] } : current
            );
            setToast("Payment verified successfully.");
          } catch {
            setError("Payment succeeded, but verification failed. Please contact support.");
          }
        },
        prefill: {
          name: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
          email: user?.email,
        },
        theme: { color: "#3E2723" },
        modal: {
          ondismiss: () =>
            setToast("Payment window closed. You can retry this ride payment anytime."),
        },
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
    } catch {
      setError("Unable to launch payment checkout. Please try again later.");
    } finally {
      setIsPaying(false);
    }
  }

  const mapPath = useMemo(
    () =>
      routePolyline.length > 0
        ? routePolyline.map(([lat, lng]) => ({ lat, lng }))
        : ride
          ? [
            { lat: ride.pickup.coordinates.latitude, lng: ride.pickup.coordinates.longitude },
            { lat: ride.destination.coordinates.latitude, lng: ride.destination.coordinates.longitude },
          ]
          : [],
    [routePolyline, ride]
  );

  if (isLoading) {
    return <LoadingScreen label="Loading ride" sublabel="Fetching your trip details" />;
  }

  if (!ride || error) {
    return (
      <main
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 text-[#3E2723]"
        style={{
          fontFamily: BODY_FONT,
          background: "radial-gradient(circle at top left, #fdfcf8 0%, #f6efe3 35%, #ebdcc9 100%)",
        }}
      >
        <TicketStyleSheet />
        <TicketAtmosphere />
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0]/95 p-8 text-center shadow-2xl backdrop-blur"
        >
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037]">
            <Car className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold" style={{ fontFamily: DISPLAY_FONT }}>
            {error || "No active ride found"}
          </p>
          <p className="mt-1 text-sm text-[#6D4C41]">Head back to your dashboard to book a new ride.</p>
          <TicketButton variant="primary" className="mt-6 w-full" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </TicketButton>
        </motion.section>
      </main>
    );
  }

  const statusMeta = STATUS_META[ride.status];
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === ride.status);
  const progressFraction = STATUS_STEPS.length > 1 ? Math.max(0, stepIndex) / (STATUS_STEPS.length - 1) : 0;
  const isTerminal = ride.status === "COMPLETED" || ride.status === "CANCELLED";
  const paymentPending = ride.paymentStatus === "PENDING" || ride.paymentStatus === undefined;

  const driverFirstName = ride.driver?.firstName || ride.driver?.user?.firstName || "Assigned Driver";
  const driverLastName = ride.driver?.lastName || ride.driver?.user?.lastName || "";
  const vehicleNo =
    ride.driver?.vehicleNumber ||
    ride.driver?.vehicle?.registrationNumber ||
    ride.driver?.vehicle?.model ||
    "Vehicle Details Pending";
  const driverPhone = ride.driver?.phone || ride.driver?.user?.phone;

  const activeFareValue = ride.fare.final ?? ride.fare.estimated ?? 0;
  const activeDistance = ride.distance.actual ?? ride.distance.estimated ?? 0;
  const activeDuration = ride.duration.actual ?? ride.duration.estimated ?? 0;

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden text-[#3E2723]" style={{ fontFamily: BODY_FONT }}>
      <TicketStyleSheet />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(circle at top left, #fdfcf8 0%, #f6efe3 35%, #ebdcc9 100%)" }}
      />
      <TicketAtmosphere />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4"
          >
            <div className="flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-xs font-semibold text-[#3E2723] shadow-xl backdrop-blur-xl">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-3 py-4 sm:px-5 sm:py-6">
        {/* Header */}
        <motion.header
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="sticky top-3 z-30 mb-4 flex items-center justify-between gap-3"
        >
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/dashboard")}
            className="grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6E63]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D4037] shadow-lg backdrop-blur-xl"
            style={{ fontFamily: MONO_FONT }}
          >
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            Ride #{ride._id.slice(-6)}
          </motion.div>

          <div className="grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl">
            <Navigation2 className="h-5 w-5" />
          </div>
        </motion.header>

        {/* Map hero */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 24 }}
        >
          <div className="relative h-[300px] overflow-hidden rounded-t-[32px] border border-b-0 border-[#D7CCC8] shadow-2xl sm:h-[380px]">
            <MapView
              center={
                driverLocation
                  ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
                  : { lat: ride.pickup.coordinates.latitude, lng: ride.pickup.coordinates.longitude }
              }
              markers={[
                {
                  position: { lat: ride.pickup.coordinates.latitude, lng: ride.pickup.coordinates.longitude },
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
                      position: { lat: driverLocation.latitude, lng: driverLocation.longitude },
                      label: "🚗",
                      title: "Driver",
                    },
                  ]
                  : []),
              ]}
              path={mapPath}
            />

            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(62,39,35,0.12)_0%,transparent_22%,transparent_60%,rgba(62,39,35,0.32)_100%)]" />

            {ride.status === "SEARCHING" && <RadarSweep />}

            {/* corner rivets */}
            <span className="pointer-events-none absolute left-4 top-4 h-2.5 w-2.5 rounded-full bg-[#FAF6F0]/80 shadow-inner" />
            <span className="pointer-events-none absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-[#FAF6F0]/80 shadow-inner" />

            {/* live badge */}
            <div className="absolute left-4 top-9 flex items-center gap-1.5 rounded-full bg-[#FAF6F0]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5D4037] shadow-md backdrop-blur">
              <Radio className="h-3 w-3" />
              Live
            </div>

            {/* driver gps chip */}
            <AnimatePresence>
              {driverLocation && (
                <motion.div
                  key={`${driverLocation.latitude.toFixed(3)}-${driverLocation.longitude.toFixed(3)}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-[#3E2723]/90 px-3 py-1.5 text-[10px] font-semibold text-[#FAF6F0] shadow-lg backdrop-blur"
                  style={{ fontFamily: MONO_FONT }}
                >
                  <MapPin className="h-3 w-3" />
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
                </motion.div>
              )}
            </AnimatePresence>

            {/* status ribbon, bottom-right */}
            <AnimatePresence mode="wait">
              <motion.div
                key={ride.status}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute bottom-4 right-4 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-md backdrop-blur"
                style={{ backgroundColor: "rgba(250,246,240,0.92)", color: statusMeta.accent }}
              >
                {ride.status.replace(/_/g, " ")}
              </motion.div>
            </AnimatePresence>
          </div>
          <PerforationSeam />
        </motion.section>

        {/* Ticket body */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, type: "spring", stiffness: 200, damping: 24 }}
          className="relative -mt-4 space-y-6 overflow-hidden rounded-b-[32px] border border-t-0 border-[#D7CCC8] bg-[#FAF6F0]/98 p-5 pb-7 shadow-2xl backdrop-blur-sm sm:p-7"
        >
          <DustMotes count={6} />

          {/* Headline */}
          <AnimatePresence mode="wait">
            <motion.div
              key={ride.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: statusMeta.accent }}>
                  {ride.status.replace(/_/g, " ")}
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold text-[#3E2723] sm:text-[26px]" style={{ fontFamily: DISPLAY_FONT }}>
                  {statusMeta.title}
                </h1>
                <p className="mt-1 text-sm text-[#6D4C41]">{statusMeta.subtitle}</p>
              </div>
              {isTerminal ? (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037] shadow-inner">
                  {ride.status === "SEARCHING" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
                      <Sparkles className="h-5 w-5" />
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper */}
          {!isTerminal || ride.status === "COMPLETED" ? <JourneyStepper status={ride.status} /> : null}

          {/* Terminal stamp */}
          <AnimatePresence>
            {ride.status === "COMPLETED" && (
              <div className="flex justify-center py-1">
                <TicketStamp label="TRIP COMPLETE" sublabel="Trip completed successfully" tone="complete" />
              </div>
            )}
            {ride.status === "CANCELLED" && (
              <div className="flex justify-center py-1">
                <TicketStamp label="RIDE VOID" sublabel="This ride was cancelled" tone="void" />
              </div>
            )}
          </AnimatePresence>

          {/* Driver card */}
          <AnimatePresence>
            {ride.driver && (
              <DriverCard firstName={driverFirstName} lastName={driverLastName} vehicleNo={vehicleNo} phone={driverPhone} />
            )}
          </AnimatePresence>

          {/* Trip stops */}
          <div className="relative overflow-hidden rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] p-4">
            <div className="relative flex flex-col gap-3">
              <Stop color="saddle" label="Pickup" value={ride.pickup.address} />
              <div className="absolute left-[13px] top-[26px] bottom-[26px] w-6 -translate-x-1/2">
                <svg className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 overflow-visible">
                  <line
                    x1="1"
                    y1="0"
                    x2="1"
                    y2="100%"
                    stroke="#8D6E63"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    style={{ animation: "route-dash 1.2s linear infinite" }}
                  />
                </svg>
                {!isTerminal && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 grid h-5 w-5 place-items-center rounded-full bg-[#FAF6F0] text-[#3E2723] shadow ring-1 ring-[#D7CCC8]"
                    initial={{ top: "0%" }}
                    animate={{ top: `${Math.min(88, progressFraction * 100)}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 20 }}
                  >
                    <Car className="h-3 w-3" />
                  </motion.div>
                )}
              </div>
              <Stop color="brass" square label="Drop-off" value={ride.destination.address} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              icon={<IndianRupee className="h-4 w-4" />}
              label="Fare"
              value={
                <>
                  ₹<AnimatedNumber value={activeFareValue} format={(v) => formatPaiseToRupee(v)} />
                </>
              }
            />
            <StatTile
              icon={<Clock className="h-4 w-4" />}
              label="ETA"
              delay={0.05}
              value={
                <>
                  <AnimatedNumber value={activeDuration} format={(v) => `${Math.round(v)}`} />m
                </>
              }
            />
            <StatTile
              icon={<RouteIcon className="h-4 w-4" />}
              label="Distance"
              delay={0.1}
              value={
                <>
                  <AnimatedNumber value={activeDistance} format={(v) => v.toFixed(1)} />
                  km
                </>
              }
            />
          </div>

          {/* Fare breakdown */}
          <AnimatePresence>
            {ride.status === "COMPLETED" && ride.fare.breakdown && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-dashed border-[#D7CCC8] bg-[#FBF7F1] p-4"
              >
                <p className="mb-2 text-sm font-semibold text-[#3E2723]" style={{ fontFamily: DISPLAY_FONT }}>
                  Fare Breakdown
                </p>
                <div className="space-y-1.5 text-xs text-[#6D4C41]">
                  {[
                    ["Base Fare", ride.fare.breakdown.baseFarePaise],
                    ["Distance Fare", ride.fare.breakdown.distanceFarePaise],
                    ["Time Fare", ride.fare.breakdown.timeFarePaise],
                    ...(ride.fare.breakdown.surgePaise ? [["Surge Charge", ride.fare.breakdown.surgePaise]] : []),
                  ].map(([label, amount], i) =>
                    amount != null ? (
                      <motion.div
                        key={label as string}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Row label={label as string} value={`₹${formatPaiseToRupee(amount as number)}`} />
                      </motion.div>
                    ) : null
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Payment note */}
          {ride.status === "ARRIVED_AT_DESTINATION" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Payment is required before the trip can be finalized.</p>
                <p className="mt-0.5 text-amber-800/80">
                  {paymentPending ? "Your payment remains pending until it is completed." : "Payment has been captured."}
                </p>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {ride.status === "ARRIVED_AT_DESTINATION" && (
              <TicketButton variant="primary" className="w-full" onClick={handlePayNow} disabled={isPaying}>
                {isPaying && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPaying ? "Preparing payment…" : "Pay now"}
              </TicketButton>
            )}
            {isTerminal ? (
              <TicketButton
                variant={ride.status === "COMPLETED" ? "success" : "primary"}
                className="w-full"
                onClick={() => navigate("/dashboard")}
              >
                Back to dashboard
              </TicketButton>
            ) : (
              <TicketButton variant="ghost" className="w-full !shadow-sm" onClick={() => setShowCancelConfirm(true)}>
                Cancel ride
              </TicketButton>
            )}
          </div>
        </motion.section>
      </div>

      {/* Cancel modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelConfirm(false)}
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#3E2723]" style={{ fontFamily: DISPLAY_FONT }}>
                      Cancel this ride?
                    </p>
                    <p className="mt-1 text-xs text-[#6D4C41]">Frequent cancellations may affect your account.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037] transition hover:bg-[#D7CCC8]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6E63]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <TicketButton variant="ghost" className="flex-1 !px-4 !py-2.5 text-xs" onClick={() => setShowCancelConfirm(false)}>
                  Keep ride
                </TicketButton>
                <TicketButton
                  variant="danger"
                  className="flex-1 !px-4 !py-2.5 text-xs"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Cancelling…" : "Yes, cancel"}
                </TicketButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

function Stop({
  color,
  square,
  label,
  value,
}: {
  color: "saddle" | "brass";
  square?: boolean;
  label: string;
  value: string;
}) {
  const dotBase =
    color === "saddle"
      ? "bg-[#5D4037] shadow-[0_0_10px_rgba(93,64,55,0.45)]"
      : "bg-[#8D6E63] shadow-[0_0_10px_rgba(121,85,72,0.45)]";

  return (
    <div className="relative z-10 flex items-start gap-3">
      <div className="relative mt-1 grid h-6 w-6 place-items-center">
        {color === "saddle" && <span className="absolute h-6 w-6 animate-ping rounded-full bg-[#5D4037]/25" />}
        <span className={`relative h-3 w-3 ${dotBase} ${square ? "rotate-45 rounded-[2px]" : "rounded-full"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8D6E63]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-[#3E2723]" style={{ fontFamily: "'Fraunces', Georgia, serif" }} title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold text-[#3E2723]">{value}</span>
    </div>
  );
}
