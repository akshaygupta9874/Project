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
  TrendingUp,
  Zap,
  Radio,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";
import { createPaymentOrder, loadRazorpayCheckout, verifyPaymentSignature } from "./lib/payment";
import { useAuthContext } from "./context/authContext";

/**
 * RideDetails — Premium instrument console theme with brass metallics,
 * rising embers, advanced motion choreography, and next-level modern UI.
 * Unified with DriverDashboard aesthetic but optimized for rider journey.
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

const STATUS_STEPS: { key: RideStatus; label: string }[] = [
  { key: "SEARCHING", label: "Searching" },
  { key: "DRIVER_ASSIGNED", label: "Assigned" },
  { key: "DRIVER_ARRIVING", label: "Arriving" },
  { key: "STARTED", label: "On trip" },
  { key: "ARRIVED_AT_DESTINATION", label: "Arrived" },
  { key: "COMPLETED", label: "Complete" },
];

const STATUS_COPY: Record<RideStatus, { title: string; subtitle: string }> = {
  SEARCHING: { title: "Finding your driver…", subtitle: "Matching you with the nearest ride" },
  DRIVER_ASSIGNED: { title: "Driver assigned", subtitle: "Your driver is preparing to head over" },
  DRIVER_ARRIVING: { title: "Driver is arriving", subtitle: "Head to your pickup spot" },
  STARTED: { title: "You're on your way", subtitle: "Sit back and enjoy the ride" },
  ARRIVED_AT_DESTINATION: { title: "Arrived at destination", subtitle: "Payment is now required before trip completion" },
  COMPLETED: { title: "Trip complete", subtitle: "Thanks for riding with us" },
  CANCELLED: { title: "Ride cancelled", subtitle: "This trip is no longer active" },
};

const RIDE_STATUS_CONFIG: Record<
  RideStatus,
  { label: string; badge: string; accent: string }
> = {
  SEARCHING: {
    label: "Searching",
    badge: "bg-[#3B2818]/70 text-[#F2CD7C] border border-[#7A5230]",
    accent: "#D9A521",
  },
  DRIVER_ASSIGNED: {
    label: "Assigned to you",
    badge: "bg-[#3B2818]/70 text-[#F2CD7C] border border-[#7A5230]",
    accent: "#E0B347",
  },
  DRIVER_ARRIVING: {
    label: "Arriving",
    badge: "bg-[#3B2818]/70 text-[#F2CD7C] border border-[#7A5230]",
    accent: "#E8843A",
  },
  STARTED: {
    label: "Trip in progress",
    badge: "bg-[#3B2818]/80 text-[#FBEBC9] border border-[#A67C4E]",
    accent: "#F2CD7C",
  },
  ARRIVED_AT_DESTINATION: {
    label: "Arrived at destination",
    badge: "bg-[#3B2818]/80 text-[#F6ECDA] border border-[#A67C4E]",
    accent: "#D9A521",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-[#3B2818]/60 text-[#C7D69E] border border-[#7A5230]",
    accent: "#8FA34E",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-[#3B2818]/60 text-[#E2A08E] border border-[#7A5230]",
    accent: "#B54834",
  },
};

function formatPaiseToRupee(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
  const rupees = amount > 1000 ? amount / 100 : amount;
  return rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Animated Number Component ----------
function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className="font-mono digit-flicker">{display}</motion.span>;
}

// ---------- Rising Embers Animation ----------
function EmberField({ count = 12 }: { count?: number }) {
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
              backgroundColor: "#F2CD7C",
              boxShadow: "0 0 6px 1px rgba(242,205,124,0.8)",
              animation: `emberRise ${e.duration}s ease-in ${e.delay}s infinite`,
              "--drift": `${e.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ---------- Ambient Atmosphere Orbs ----------
function DashboardAtmosphere() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#7A5230]/30 blur-3xl"
        animate={{ y: [0, 20, 0], x: [0, 10, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-60 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#D9A521]/15 blur-3xl"
        animate={{ y: [0, -25, 0], x: [0, -15, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[#E8843A]/10 blur-3xl"
        animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <EmberField count={12} />
    </>
  );
}

// ---------- Status Pulse Badge ----------
function StatusPulse({ color, label }: { color: string; label: string }) {
  return (
    <span className="relative inline-flex items-center gap-2 rounded-full border border-[#7A5230] bg-[#241a10]/80 px-3 py-1.5 text-xs font-semibold text-[#F6ECDA] backdrop-blur console-readout">
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

// ---------- Ride Stepper ----------
function RideStepper({ status }: { status: RideStatus }) {
  const activeIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  const progress = Math.max(0, activeIdx) / (STATUS_STEPS.length - 1);
  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[#3B2818]" />
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-gradient-to-r from-[#7A5230] via-[#D9A521] to-[#F2CD7C]"
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
        {STATUS_STEPS.map((s, i) => {
          const done = i <= activeIdx && status !== "CANCELLED";
          const current = i === activeIdx && status !== "CANCELLED";
          return (
            <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5">
              <motion.div
                animate={
                  current
                    ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0 #D9A52166", "0 0 0 10px #D9A52100"] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.4, repeat: current ? Infinity : 0 }}
                className={`h-6 w-6 rounded-full border-2 flex items-center justify-center font-semibold ${
                  done
                    ? "bg-[#D9A521] border-[#F2CD7C] text-[#1B130C]"
                    : "bg-[#241a10] border-[#5A4128] text-[#C9AE86]"
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px]">{i + 1}</span>}
              </motion.div>
              <span
                className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${
                  current ? "text-[#F2CD7C]" : "text-[#8D7350]"
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

// ---------- Premium Shine Button ----------
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
    primary: "bg-gradient-to-br from-[#D9A521] via-[#B8860B] to-[#7A5230] text-[#1B130C]",
    success: "bg-gradient-to-br from-[#A9C171] via-[#8FA34E] to-[#5F7538] text-[#12190A]",
    danger: "bg-gradient-to-br from-[#D0654E] via-[#B54834] to-[#7A2E20] text-[#FBEBC9]",
    muted: "bg-gradient-to-br from-[#7A5230] to-[#5A3D24] text-[#F0E2CC]",
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
      className={`relative overflow-hidden rounded-full px-6 py-3 text-sm sm:text-base font-bold shadow-[0_6px_20px_rgba(0,0,0,0.35)] border border-[#F2CD7C]/40 transition-shadow disabled:opacity-60 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
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
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-white/40"
          style={{ left: r.left, top: r.top, width: 12, height: 12, x: -6, y: -6 }}
          animate={{ scale: [0, 4], opacity: [1, 0] }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      ))}
    </motion.button>
  );
}

// ---------- Premium Stat Card ----------
function StatCard({
  label,
  value,
  icon: Icon,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 220, damping: 22 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-2xl border border-[#7A5230]/60 bg-[#241a10]/70 p-4 sm:p-5 backdrop-blur-xl"
    >
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--x,50%) var(--y,50%), rgba(242,205,124,0.15), transparent 40%)",
        }}
        transition={{ duration: 0.4 }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-[#C9AE86] font-medium">{label}</p>
        <Icon className="h-4 w-4 text-[#D9A521]/80" />
      </div>
      <h2 className="mt-2 text-2xl sm:text-3xl font-bold truncate text-[#F6ECDA]">{value}</h2>
      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#3B2818]">
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#F2CD7C]/80 to-transparent"
        />
      </div>
    </motion.div>
  );
}

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
        theme: { color: "#78350f" },
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
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 text-[#1B130C]"
        style={{
          background:
            "linear-gradient(135deg, #2C2319 0%, #1B130C 50%, #2C2319 100%)",
        }}
      >
        <DashboardAtmosphere />
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#7A5230]/60 bg-[#241a10]/90 p-8 text-center shadow-2xl backdrop-blur-xl"
        >
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#3B2818] border border-[#7A5230] text-[#F2CD7C]">
            <Car className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold text-[#F6ECDA]">
            {error || "No active ride found"}
          </p>
          <p className="mt-1 text-sm text-[#C9AE86]">
            Head back to your dashboard to book a new ride.
          </p>
          <Button
            className="mt-6 w-full rounded-full bg-gradient-to-r from-[#D9A521] to-[#B8860B] py-2.5 text-sm font-semibold text-[#1B130C] hover:shadow-lg"
            onClick={() => navigate("/dashboard")}
          >
            Back to dashboard
          </Button>
        </motion.section>
      </main>
    );
  }

  const statusConfig = RIDE_STATUS_CONFIG[ride.status];
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === ride.status);
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
  const formattedFare = formatPaiseToRupee(activeFareValue);
  const activeDistance = ride.distance.actual ?? ride.distance.estimated ?? 0;
  const activeDuration = ride.duration.actual ?? ride.duration.estimated ?? 0;

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden text-[#F6ECDA]"
      style={{
        background: "linear-gradient(135deg, #2C2319 0%, #1B130C 50%, #2C2319 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        
        .console-root { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
        .console-display { font-family: 'Fraunces', ui-serif, Georgia, serif; letter-spacing: -0.01em; }
        .console-readout {
          font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        
        @keyframes shine-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes route-dash {
          to { stroke-dashoffset: -32; }
        }
        @keyframes soft-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes emberRise {
          0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
          10% { opacity: 0.9; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-140px) translateX(var(--drift, 12px)) scale(1); opacity: 0; }
        }
        @keyframes dialGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(217,165,33,0.35)); }
          50% { filter: drop-shadow(0 0 18px rgba(217,165,33,0.7)); }
        }
        .digit-flicker { animation: digitIn 0.5s ease-out; }
        @keyframes digitIn {
          0% { opacity: 0.2; filter: blur(2px); }
          100% { opacity: 1; filter: blur(0); }
        }
      `}</style>

      {/* MAP BACKGROUND */}
      <div className="absolute inset-0">
        <MapView
          center={
            driverLocation
              ? {
                lat: driverLocation.latitude,
                lng: driverLocation.longitude,
              }
              : {
                lat: ride.pickup.coordinates.latitude,
                lng: ride.pickup.coordinates.longitude,
              }
          }
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
                  label: "🚗",
                  title: "Driver",
                },
              ]
              : []),
          ]}
          path={mapPath}
        />
        {/* dark premium overlay with ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(28,19,12,0.32)_0%,transparent_20%,transparent_50%,rgba(28,19,12,0.42)_100%)]" />
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay bg-[radial-gradient(ellipse_at_top,rgba(242,205,124,0.12),transparent_60%)]" />
        <DashboardAtmosphere />
      </div>

      {/* FLOATING TOP BAR */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6"
      >
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto group grid h-11 w-11 place-items-center rounded-full border border-[#7A5230] bg-[#241a10]/80 text-[#F2CD7C] shadow-lg backdrop-blur-xl transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#7A5230] bg-[#241a10]/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F2CD7C] shadow-lg backdrop-blur-xl console-readout"
        >
          <span className="relative inline-flex h-2 w-2">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-[#D9A521]"
              animate={{ scale: [1, 2, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D9A521]" />
          </span>
          Ride #{ride._id.slice(-6)}
        </motion.div>

        <motion.div
          whileHover={{ rotate: 15 }}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#7A5230] bg-[#241a10]/80 text-[#F2CD7C] shadow-lg backdrop-blur-xl"
        >
          <Navigation2 className="h-5 w-5" />
        </motion.div>
      </motion.header>

      {/* DRIVER SEARCHING PULSE OVERLAY */}
      <AnimatePresence>
        {ride.status === "SEARCHING" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
          >
            <div className="relative flex flex-col items-center">
              <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#D9A521]/25" />
              <span className="absolute h-28 w-28 animate-pulse rounded-full bg-[#F2CD7C]/30" />
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-[#7A5230] bg-[#241a10]/95 text-[#F2CD7C] shadow-2xl backdrop-blur-xl">
                <Car className="h-8 w-8 animate-bounce" />
              </div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 rounded-full border border-[#7A5230] bg-[#241a10]/80 px-4 py-2 text-xs font-semibold text-[#F2CD7C] shadow-lg backdrop-blur-xl console-display"
              >
                Locating nearby drivers…
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING PREMIUM TICKET SHEET */}
      <motion.section
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 28, delay: 0.05 }}
        className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl px-3 pb-3 sm:px-4 sm:pb-4"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-[#7A5230]/60 bg-gradient-to-b from-[#3B2818]/95 to-[#241a10]/95 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          {/* ticket perforation strip */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-3 flex justify-between opacity-40">
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className="h-3 w-3 -translate-y-1/2 rounded-full bg-[#7A5230]" />
            ))}
          </div>
          
          {/* brass shine sweep */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
            <div
              className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#F2CD7C]/15 to-transparent"
              style={{ animation: "shine-sweep 6s ease-in-out infinite" }}
            />
          </div>

          {/* drag handle */}
          <div className="pt-4">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#7A5230]" />
          </div>

          <div className="relative space-y-5 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
            {/* Status Header */}
            <motion.div
              key={ride.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C9AE86]">
                  {ride.status.replace(/_/g, " ")}
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold text-[#F6ECDA] sm:text-[26px] console-display">
                  {STATUS_COPY[ride.status].title}
                </h1>
                <p className="mt-1 text-sm text-[#C9AE86]">{STATUS_COPY[ride.status].subtitle}</p>
              </div>
              {isTerminal ? (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#8FA34E]/30 border border-[#8FA34E] text-[#C7D69E]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <motion.div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#D9A521]/20 border border-[#D9A521]/40 text-[#F2CD7C]">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
                    <Zap className="h-5 w-5" />
                  </motion.div>
                </motion.div>
              )}
            </motion.div>

            {/* Enhanced Stepper with Console Theme */}
            {!isTerminal || ride.status === "COMPLETED" ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <RideStepper status={ride.status} />
              </motion.div>
            ) : null}

            {/* Driver Card - Premium Enhanced */}
            <AnimatePresence>
              {ride.driver && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.15 }}
                  className="relative overflow-hidden rounded-2xl border border-[#7A5230]/80 bg-gradient-to-br from-[#3B2818]/70 via-[#241a10]/70 to-[#1B130C]/70 p-4 shadow-inner backdrop-blur"
                >
                  <motion.div
                    className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D9A521]/15 blur-2xl"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <div className="relative flex items-center gap-3">
                    <div className="relative">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#D9A521] via-[#B8860B] to-[#7A5230] text-lg font-bold text-[#1B130C] shadow-lg console-display">
                        {driverFirstName?.[0]?.toUpperCase() || "D"}
                      </div>
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                        className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#241a10] bg-[#8FA34E] text-white shadow"
                      >
                        <Shield className="h-3 w-3" />
                      </motion.span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-[#F6ECDA] console-display">
                        {driverFirstName} {driverLastName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#C9AE86]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D9A521]/20 border border-[#D9A521]/40 px-1.5 py-0.5 font-semibold text-[#F2CD7C]">
                          <Star className="h-3 w-3 fill-[#F2CD7C] text-[#F2CD7C]" />
                          4.9
                        </span>
                        <span>•</span>
                        <span className="truncate font-medium">{vehicleNo}</span>
                      </div>
                    </div>
                    {driverPhone && (
                      <motion.a
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        href={`tel:${driverPhone}`}
                        className="group grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#D9A521] to-[#B8860B] text-[#1B130C] shadow-lg"
                        aria-label="Call driver"
                      >
                        <Phone className="h-4 w-4 transition group-hover:rotate-12" />
                      </motion.a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trip Stops - Enhanced */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-2xl border border-[#7A5230]/60 bg-[#241a10]/50 p-4 backdrop-blur"
            >
              <div className="relative flex flex-col gap-3">
                <Stop color="brass" label="Pickup" value={ride.pickup.address} />
                <div className="absolute left-[13px] top-[26px] bottom-[26px] w-[2px] overflow-hidden">
                  <svg className="h-full w-full">
                    <line
                      x1="1"
                      y1="0"
                      x2="1"
                      y2="100%"
                      stroke="#D9A521"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      style={{ animation: "route-dash 1.2s linear infinite" }}
                    />
                  </svg>
                </div>
                <Stop color="gold" square label="Drop-off" value={ride.destination.address} />
              </div>
            </motion.div>

            {/* Stats Grid - Premium Cards */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-3 gap-3"
            >
              <StatCard icon={IndianRupee} label="Fare" value={`₹${formattedFare}`} delay={0.3} />
              <StatCard icon={Clock} label="Duration" value={`${activeDuration}m`} delay={0.35} />
              <StatCard icon={RouteIcon} label="Distance" value={`${activeDistance}km`} delay={0.4} />
            </motion.div>

            {/* Fare Breakdown */}
            <AnimatePresence>
              {ride.status === "COMPLETED" && ride.fare.breakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-2xl border border-[#7A5230]/60 bg-[#241a10]/50 p-4 backdrop-blur"
                >
                  <p className="mb-3 text-sm font-bold text-[#F2CD7C] console-display">
                    Fare Breakdown
                  </p>
                  <div className="space-y-2 text-xs text-[#C9AE86] console-readout">
                    {ride.fare.breakdown.baseFarePaise != null && (
                      <FareRow label="Base Fare" value={`₹${formatPaiseToRupee(ride.fare.breakdown.baseFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.distanceFarePaise != null && (
                      <FareRow label="Distance" value={`₹${formatPaiseToRupee(ride.fare.breakdown.distanceFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.timeFarePaise != null && (
                      <FareRow label="Time" value={`₹${formatPaiseToRupee(ride.fare.breakdown.timeFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.surgePaise != null && ride.fare.breakdown.surgePaise > 0 && (
                      <FareRow label="Surge" value={`₹${formatPaiseToRupee(ride.fare.breakdown.surgePaise)}`} />
                    )}
                    <div className="border-t border-[#7A5230]/40 pt-2 mt-2 flex justify-between font-bold text-[#F2CD7C]">
                      <span>Total</span>
                      <span>₹{formatPaiseToRupee(ride.fare.breakdown.totalPaise)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment Alert */}
            {ride.status === "ARRIVED_AT_DESTINATION" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#E8843A]/50 bg-[#E8843A]/10 p-3 text-xs text-[#FBEBC9]"
              >
                <p className="font-bold">Payment Required</p>
                <p className="mt-0.5 text-[#F0E2CC]">
                  {paymentPending
                    ? "Complete payment to finalize your trip."
                    : "Payment has been captured successfully."}
                </p>
              </motion.div>
            )}

            {/* Driver Location Debug */}
            {driverLocation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-[11px] text-[#8D7350] console-readout"
              >
                <MapPin className="h-3 w-3" />
                Driver position synced
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 pt-1">
              {ride.status === "ARRIVED_AT_DESTINATION" && (
                <ShineButton
                  onClick={handlePayNow}
                  disabled={isPaying}
                  variant="primary"
                  className="w-full"
                >
                  {isPaying && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isPaying ? "Preparing payment…" : "Pay now"}
                </ShineButton>
              )}
              {isTerminal ? (
                <ShineButton
                  onClick={() => navigate("/dashboard")}
                  variant="success"
                  className="w-full"
                >
                  Back to dashboard
                </ShineButton>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full rounded-full border border-[#B54834]/50 bg-[#B54834]/10 py-3 text-xs font-bold text-[#E2A08E] shadow-sm transition hover:bg-[#B54834]/20"
                >
                  Cancel ride
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#7A5230] bg-[#241a10]/90 px-4 py-2.5 text-xs font-semibold text-[#F2CD7C] shadow-xl backdrop-blur-xl console-readout"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="relative inline-flex h-2 w-2 rounded-full bg-[#D9A521]"
            />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCancelConfirm(false)}
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#7A5230]/60 bg-[#241a10]/95 p-6 shadow-2xl backdrop-blur"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-[#F6ECDA] console-display">
                    Cancel this ride?
                  </p>
                  <p className="mt-1 text-xs text-[#C9AE86]">
                    Cancellations may affect your account standing.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setShowCancelConfirm(false)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-[#3B2818] text-[#F2CD7C] transition"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
              <div className="flex items-center gap-2.5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-full border border-[#7A5230] bg-[#3B2818]/70 py-2.5 text-xs font-bold text-[#F2CD7C] transition hover:bg-[#3B2818]/90"
                >
                  Keep ride
                </motion.button>
                <ShineButton
                  onClick={handleCancel}
                  disabled={isCancelling}
                  variant="danger"
                  className="flex-1"
                >
                  {isCancelling ? "Cancelling…" : "Yes, cancel"}
                </ShineButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------- helper components ---------- */

function Stop({
  color,
  square,
  label,
  value,
}: {
  color: "brass" | "gold";
  square?: boolean;
  label: string;
  value: string;
}) {
  const dotBase =
    color === "brass"
      ? "bg-[#D9A521] shadow-[0_0_10px_rgba(217,165,33,0.6)]"
      : "bg-[#F2CD7C] shadow-[0_0_10px_rgba(242,205,124,0.5)]";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative z-10 flex items-start gap-3"
    >
      <div className="relative mt-1 grid h-6 w-6 place-items-center shrink-0">
        {color === "brass" && (
          <span className="absolute h-6 w-6 animate-ping rounded-full bg-[#D9A521]/25" />
        )}
        <motion.span
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: Math.random() }}
          className={`relative h-3 w-3 ${dotBase} ${square ? "rotate-45 rounded-[2px]" : "rounded-full"}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9AE86]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-[#F6ECDA] console-display" title={value}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

function FareRow({ label, value }: { label: string; value: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center">
      <span className="text-[#C9AE86]">{label}</span>
      <span className="font-semibold text-[#F2CD7C]">{value}</span>
    </motion.div>
  );
}
