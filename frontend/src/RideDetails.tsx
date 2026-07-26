import { useEffect, useMemo, useRef, useState } from "react";
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
  Route as RouteIcon,
  IndianRupee,
  X,
  Loader2,
  CheckCircle2,
  Navigation2,
  Sparkles,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import MapView from "./components/MapView";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import { connectRiderSocket } from "./lib/socket";
import { createPaymentOrder, loadRazorpayCheckout, verifyPaymentSignature } from "./lib/payment";
import { useAuthContext } from "./context/authContext";

/**
 * RideDetails — premium travel-ticket theme.
 * Same logic + API/socket contract; polished UI, layout & motion only.
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

function formatPaiseToRupee(amount: number | null | undefined): string {
  if (amount == null) return "0.00";
  const rupees = amount > 1000 ? amount / 100 : amount;
  return rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 text-[#3E2723]"
        style={{
          fontFamily: BODY_FONT,
          background:
            "radial-gradient(circle at top left, #fdfcf8 0%, #f6efe3 35%, #ebdcc9 100%)",
        }}
      >
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0]/95 p-8 text-center shadow-2xl backdrop-blur"
        >
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037]">
            <Car className="h-6 w-6" />
          </div>
          <p className="text-lg font-semibold" style={{ fontFamily: DISPLAY_FONT }}>
            {error || "No active ride found"}
          </p>
          <p className="mt-1 text-sm text-[#6D4C41]">
            Head back to your dashboard to book a new ride.
          </p>
          <Button
            className="mt-6 w-full rounded-full bg-[#3E2723] py-2.5 text-sm font-semibold text-[#FAF6F0] hover:bg-[#5D4037]"
            onClick={() => navigate("/dashboard")}
          >
            Back to dashboard
          </Button>
        </motion.section>
      </main>
    );
  }

  const statusCopy = STATUS_COPY[ride.status];
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
      className="relative min-h-screen w-full overflow-hidden text-[#3E2723]"
      style={{ fontFamily: BODY_FONT }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
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
      `}</style>

      {/* MAP BACKGROUND */}
      <div className="absolute inset-0">
        <MapView
          pickup={{
            lat: ride.pickup.coordinates.latitude,
            lng: ride.pickup.coordinates.longitude,
          }}
          destination={{
            lat: ride.destination.coordinates.latitude,
            lng: ride.destination.coordinates.longitude,
          }}
          driverLocation={
            driverLocation
              ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
              : undefined
          }
          path={mapPath}
        />
        {/* map warm tint & vignettes for premium theme */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(62,39,35,0.18)_0%,transparent_18%,transparent_55%,rgba(62,39,35,0.28)_100%)]" />
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay bg-[radial-gradient(ellipse_at_top,rgba(255,236,201,0.25),transparent_60%)]" />
      </div>

      {/* FLOATING TOP BAR */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6"
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto group grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl transition hover:-translate-x-0.5 hover:bg-[#FAF6F0]"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
        </button>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5D4037] shadow-lg backdrop-blur-xl"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          Ride #{ride._id.slice(-6)}
        </motion.div>

        <div className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl">
          <Navigation2 className="h-5 w-5" />
        </div>
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
              <span className="absolute h-40 w-40 animate-ping rounded-full bg-[#8D6E63]/25" />
              <span className="absolute h-28 w-28 animate-pulse rounded-full bg-[#A1887F]/40" />
              <div className="relative grid h-20 w-20 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#3E2723] shadow-2xl backdrop-blur-xl">
                <Car className="h-8 w-8" />
              </div>
              <p
                className="mt-4 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-1.5 text-xs font-semibold text-[#5D4037] shadow-lg backdrop-blur-xl"
                style={{ fontFamily: DISPLAY_FONT }}
              >
                Locating nearby drivers…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BOTTOM TICKET SHEET */}
      <motion.section
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 28, delay: 0.05 }}
        className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-2xl px-3 pb-3 sm:px-4 sm:pb-4"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-[#D7CCC8] bg-[#FAF6F0]/98 shadow-[0_-20px_60px_-20px_rgba(62,39,35,0.35)] backdrop-blur-2xl">
          {/* ticket perforation strip */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-3 flex justify-between">
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i} className="h-3 w-3 -translate-y-1/2 rounded-full bg-[#f6efe3] shadow-inner" />
            ))}
          </div>
          {/* soft brass shine */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{ animation: "shine-sweep 6s ease-in-out infinite" }}
            />
          </div>

          {/* drag handle */}
          <div className="pt-4">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#D7CCC8]" />
          </div>

          <div className="relative space-y-5 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
            {/* Headline */}
            <motion.div
              key={ride.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8D6E63]">
                  {ride.status.replace(/_/g, " ")}
                </p>
                <h1
                  className="mt-1 truncate text-2xl font-semibold text-[#3E2723] sm:text-[26px]"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  {statusCopy.title}
                </h1>
                <p className="mt-1 text-sm text-[#6D4C41]">{statusCopy.subtitle}</p>
              </div>
              {isTerminal ? (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 shadow-inner">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037] shadow-inner">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-5 w-5" />
                  </motion.div>
                </div>
              )}
            </motion.div>

            {/* Stepper */}
            {!isTerminal || ride.status === "COMPLETED" ? (
              <div className="relative flex items-center justify-between rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] px-3 py-3">
                <div className="absolute left-6 right-6 top-1/2 h-[2px] -translate-y-1/2 bg-[#EFEBE9]" />
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{
                    scaleX:
                      stepIndex <= 0
                        ? 0
                        : stepIndex / (STATUS_STEPS.length - 1),
                  }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  style={{ transformOrigin: "left" }}
                  className="absolute left-6 right-6 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-[#8D6E63] via-[#A1887F] to-[#5D4037]"
                />
                {STATUS_STEPS.map((s, i) => {
                  const active = i <= (stepIndex === -1 ? 0 : stepIndex);
                  return (
                    <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5">
                      <motion.span
                        animate={
                          active && i === stepIndex && !isTerminal
                            ? { scale: [1, 1.15, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 1.6, repeat: Infinity }}
                        className={`grid h-4 w-4 place-items-center rounded-full border-2 ${
                          active
                            ? "border-[#3E2723] bg-[#3E2723]"
                            : "border-[#D7CCC8] bg-[#FAF6F0]"
                        }`}
                      />
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-wider ${
                          active ? "text-[#3E2723]" : "text-[#A1887F]"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Driver card */}
            <AnimatePresence>
              {ride.driver && (
                <motion.div
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
                        {driverFirstName?.[0]?.toUpperCase() || "D"}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#FAF6F0] bg-emerald-500 text-white shadow">
                        <Shield className="h-3 w-3" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-base font-semibold text-[#3E2723]"
                        style={{ fontFamily: DISPLAY_FONT }}
                      >
                        {driverFirstName} {driverLastName}
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
                    {driverPhone && (
                      <a
                        href={`tel:${driverPhone}`}
                        className="group grid h-11 w-11 place-items-center rounded-full bg-[#3E2723] text-[#FAF6F0] shadow-lg transition hover:scale-105 active:scale-95"
                        aria-label="Call driver"
                      >
                        <Phone className="h-4 w-4 transition group-hover:rotate-12" />
                      </a>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trip stops */}
            <div className="relative overflow-hidden rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] p-4">
              <div className="relative flex flex-col gap-3">
                <Stop color="saddle" label="Pickup" value={ride.pickup.address} />
                {/* connector */}
                <div className="absolute left-[13px] top-[26px] bottom-[26px] w-[2px] overflow-hidden">
                  <svg className="h-full w-full">
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
                </div>
                <Stop color="brass" square label="Drop-off" value={ride.destination.address} />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <Stat icon={<IndianRupee className="h-4 w-4" />} label="Fare" value={`₹${formattedFare}`} />
              <Stat icon={<Clock className="h-4 w-4" />} label="ETA" value={`${activeDuration}m`} />
              <Stat icon={<RouteIcon className="h-4 w-4" />} label="Distance" value={`${activeDistance}km`} />
            </div>

            {/* Fare breakdown */}
            <AnimatePresence>
              {ride.status === "COMPLETED" && ride.fare.breakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] p-4"
                >
                  <p
                    className="mb-2 text-sm font-semibold text-[#3E2723]"
                    style={{ fontFamily: DISPLAY_FONT }}
                  >
                    Fare Breakdown
                  </p>
                  <div className="space-y-1.5 text-xs text-[#6D4C41]">
                    {ride.fare.breakdown.baseFarePaise != null && (
                      <Row label="Base Fare" value={`₹${formatPaiseToRupee(ride.fare.breakdown.baseFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.distanceFarePaise != null && (
                      <Row label="Distance Fare" value={`₹${formatPaiseToRupee(ride.fare.breakdown.distanceFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.timeFarePaise != null && (
                      <Row label="Time Fare" value={`₹${formatPaiseToRupee(ride.fare.breakdown.timeFarePaise)}`} />
                    )}
                    {ride.fare.breakdown.surgePaise != null && ride.fare.breakdown.surgePaise > 0 && (
                      <Row label="Surge Charge" value={`₹${formatPaiseToRupee(ride.fare.breakdown.surgePaise)}`} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {ride.status === "ARRIVED_AT_DESTINATION" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-900"
              >
                <p className="font-semibold">Payment is required before the trip can be finalized.</p>
                <p className="mt-0.5 text-amber-800/80">
                  {paymentPending
                    ? "Your payment remains pending until it is completed."
                    : "Payment has been captured."}
                </p>
              </motion.div>
            )}

            {driverLocation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-[11px] text-[#8D6E63]"
              >
                <MapPin className="h-3 w-3" />
                Driver at {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              {ride.status === "ARRIVED_AT_DESTINATION" && (
                <Button
                  onClick={handlePayNow}
                  disabled={isPaying}
                  className="relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#5D4037] via-[#3E2723] to-[#5D4037] py-3 text-sm font-semibold text-[#FAF6F0] shadow-lg transition hover:shadow-2xl disabled:opacity-70"
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    style={{ animation: "shine-sweep 2.4s ease-in-out infinite" }}
                  />
                  <span className="relative inline-flex items-center justify-center gap-2">
                    {isPaying && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isPaying ? "Preparing payment…" : "Pay now"}
                  </span>
                </Button>
              )}
              {isTerminal ? (
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="w-full rounded-full bg-[#3E2723] py-2.5 text-sm font-semibold text-[#FAF6F0] hover:bg-[#5D4037]"
                >
                  Back to dashboard
                </Button>
              ) : (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full rounded-full border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-500/20 active:scale-[0.99]"
                >
                  Cancel ride
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-20 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-xs font-semibold text-[#3E2723] shadow-xl backdrop-blur-xl"
          >
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

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
                <div>
                  <p
                    className="text-lg font-semibold text-[#3E2723]"
                    style={{ fontFamily: DISPLAY_FONT }}
                  >
                    Cancel this ride?
                  </p>
                  <p className="mt-1 text-xs text-[#6D4C41]">
                    Frequent cancellations may affect your account.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037] transition hover:bg-[#D7CCC8]/60"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-full border border-[#D7CCC8] bg-[#EFEBE9] py-2.5 text-xs font-semibold text-[#3E2723] transition hover:bg-[#D7CCC8]/60"
                >
                  Keep ride
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex-1 rounded-full bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-rose-700 disabled:opacity-70"
                >
                  {isCancelling ? "Cancelling…" : "Yes, cancel"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ---------- helpers ---------- */

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
        {color === "saddle" && (
          <span className="absolute h-6 w-6 animate-ping rounded-full bg-[#5D4037]/25" />
        )}
        <span
          className={`relative h-3 w-3 ${dotBase} ${
            square ? "rotate-45 rounded-[2px]" : "rounded-full"
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8D6E63]">
          {label}
        </p>
        <p
          className="mt-0.5 truncate text-sm font-medium text-[#3E2723]"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          title={value}
        >
          {value}
        </p>
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
    <motion.div
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-[#EFEBE9] bg-[#FBF7F1] p-3 text-center shadow-sm transition"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-16 bg-gradient-to-b from-white/50 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037]">
        {icon}
      </div>
      <p
        className="mt-1.5 text-sm font-semibold text-[#3E2723]"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8D6E63]">
        {label}
      </p>
    </motion.div>
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
