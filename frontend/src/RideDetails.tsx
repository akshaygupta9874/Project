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
  Route as RouteIcon,
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
import { createPaymentOrder, loadRazorpayCheckout, verifyPaymentSignature } from "./lib/payment";
import { useAuthContext } from "./context/authContext";

/**
 * Ride Details page - Full Map View with Floating Ticket Overlay
 * - Light-brown "travel ticket" theme: parchment surfaces, saddle-leather
 *   and brass accents, seamless responsive layout across all displays.
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
  user?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  vehicle?: {
    registrationNumber?: string;
    model?: string;
    color?: string;
  };
}

interface Ride {
  _id: string;
  pickup: RidePoint;
  destination: RidePoint;
  fare: {
    estimated: number;
    final?: number | null;
    breakdown?: FareBreakdown | null;
  };
  distance: { estimated: number | null; actual?: number | null };
  duration: { estimated: number | null; actual?: number | null };
  status: RideStatus;
  paymentStatus?: "PENDING" | "PAID" | "CAPTURED" | "FAILED" | "REFUNDED";
  driver?: DriverInfo | null;
}

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const BODY_FONT =
  "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

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
  const [driverLocation, setDriverLocation] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string>("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const { user } = useAuthContext();

  // Helper function to fetch full ride details including driver info
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
      // ignore individual fetch errors if fallback handles it
    }
    return null;
  };

  // Load ride & fetch Geoapify routing polyline with dynamic waypoints
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
              line.forEach(([lon, lat]) => {
                flatCoords.push([lat, lon]);
              });
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

  // Live updates via WebSocket matching incoming frame structure
  useEffect(() => {
    const s = connectRiderSocket({
      onReady: () => setToast("Connected to live updates"),
      onError: (m: string) => setToast(m),
      onRideAccepted: async () => {
        setToast("Driver has accepted your ride");
        // Immediately fetch full ride state to populate driver info right away
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
          // Also listen for general backend status update broadcasts containing driver allocation
          if (parsed?.event === "server:ride-accepted" || parsed?.event === "server:driver-assigned") {
            await fetchRideDetails(rideId);
          }
        } catch {
          // silent fallback parsing ignore
        }
      };
    }

    socketRef.current = s;
    return () => s?.close();
  }, [rideId]);

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
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyResult = await verifyPaymentSignature(response);
            setRide((current) => current ? { ...current, paymentStatus: verifyResult.status as Ride["paymentStatus"] } : current);
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
          ondismiss: () => setToast("Payment window closed. You can retry this ride payment anytime."),
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

  if (isLoading) {
    return <LoadingScreen label="Loading your ride" sublabel="Fetching the latest details" />;
  }

  if (!ride || error) {
    return (
      <div 
        className="grid min-h-screen place-items-center bg-[#EFEBE9] px-6 text-center text-[#3E2723]"
        style={{ fontFamily: BODY_FONT }}
      >
        <div>
          <p className="text-lg font-semibold">{error || "No active ride found"}</p>
          <Button 
            className="mt-6 rounded-full bg-[#5D4037] text-[#FAF6F0] hover:bg-[#4E342E]" 
            onClick={() => navigate("/dashboard")}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusCopy = STATUS_COPY[ride.status];
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === ride.status);
  const isTerminal = ride.status === "COMPLETED" || ride.status === "CANCELLED";
  const paymentPending = ride.paymentStatus === "PENDING" || ride.paymentStatus === undefined;

  const driverFirstName = ride.driver?.firstName || ride.driver?.user?.firstName || "Assigned Driver";
  const driverLastName = ride.driver?.lastName || ride.driver?.user?.lastName || "";
  const vehicleNo = ride.driver?.vehicleNumber || ride.driver?.vehicle?.registrationNumber || ride.driver?.vehicle?.model || "Vehicle Details Pending";
  const driverPhone = ride.driver?.phone || ride.driver?.user?.phone;

  const activeFareValue = ride.fare.final ?? ride.fare.estimated ?? 0;
  const formattedFare = formatPaiseToRupee(activeFareValue);
  const activeDistance = ride.distance.actual ?? ride.distance.estimated ?? 0;
  const activeDuration = ride.duration.actual ?? ride.duration.estimated ?? 0;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#EFEBE9] text-[#3E2723]"
      style={{ fontFamily: BODY_FONT }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* FULL SCREEN MAP BACKGROUND */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <MapView
          center={
            driverLocation
              ? { lat: driverLocation.latitude, lng: driverLocation.longitude }
              : {
                  lat: ride.pickup.coordinates.latitude,
                  lng: ride.pickup.coordinates.longitude,
                }
          }
          zoom={14}
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
            routePolyline.length > 0
              ? routePolyline.map(([lat, lng]) => ({ lat, lng }))
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
      </div>

      {/* FLOATING TOP BAR */}
      <div className="absolute inset-x-0 top-4 z-30 flex items-center justify-between px-6 pointer-events-none">
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl transition hover:bg-[#FAF6F0]"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#795548] shadow-lg backdrop-blur-xl">
          Ride #{ride._id.slice(-6)}
        </div>
        <span className="h-11 w-11" />
      </div>

      {/* DRIVER SEARCHING PULSE OVERLAY */}
      <AnimatePresence>
        {ride.status === "SEARCHING" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none grid place-items-center z-10"
          >
            <div className="relative">
              <span className="absolute inset-0 -m-8 animate-ping rounded-full bg-[#5D4037]/25" />
              <span
                className="absolute inset-0 -m-8 animate-ping rounded-full bg-[#5D4037]/25"
                style={{ animationDelay: "0.6s" }}
              />
              <div className="relative grid h-20 w-20 place-items-center rounded-full border-4 border-[#EFEBE9] bg-gradient-to-br from-[#5D4037] to-[#3E2723] shadow-2xl text-[#FAF6F0]">
                <Car className="h-8 w-8 text-[#FAF6F0]" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BOTTOM TICKET SHEET */}
      <motion.section
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="absolute inset-x-4 bottom-6 z-30 mx-auto max-w-xl rounded-[32px] border border-[#D7CCC8] bg-[#FAF6F0]/95 p-6 shadow-2xl backdrop-blur-xl max-h-[82vh] flex flex-col"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 flex-shrink-0 rounded-full bg-[#D7CCC8]" />

        <div className="overflow-y-auto pr-1 space-y-4">
          {/* Status headline */}
          <AnimatePresence mode="wait">
            <motion.div
              key={ride.status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex items-start justify-between gap-4"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#795548]">
                  {ride.status.replace(/_/g, " ")}
                </p>
                <h1 
                  className="mt-0.5 text-xl sm:text-2xl font-bold text-[#3E2723]"
                  style={{ fontFamily: DISPLAY_FONT }}
                >
                  {statusCopy.title}
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-[#795548]">{statusCopy.subtitle}</p>
              </div>
              {isTerminal ? (
                <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-[#5D4037]/10 text-[#5D4037]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <Loader2 className="mt-1 h-5 w-5 flex-shrink-0 animate-spin text-[#795548]" />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper */}
          {!isTerminal || ride.status === "COMPLETED" ? (
            <div className="flex items-center gap-1.5">
              {STATUS_STEPS.map((s, i) => {
                const active = i <= (stepIndex === -1 ? 0 : stepIndex);
                return (
                  <div key={s.key} className="flex-1">
                    <motion.div
                      initial={{ scaleX: 0.4, opacity: 0.4 }}
                      animate={{ scaleX: 1, opacity: active ? 1 : 0.25 }}
                      transition={{ duration: 0.4, delay: i * 0.04 }}
                      className={`h-1.5 origin-left rounded-full ${
                        active
                          ? "bg-gradient-to-r from-[#5D4037] to-[#795548]"
                          : "bg-[#D7CCC8]"
                      }`}
                    />
                    <p
                      className={`mt-1 text-[9px] font-bold uppercase tracking-wider ${
                        active ? "text-[#3E2723]" : "text-[#A1887F]"
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
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 240, damping: 24 }}
                className="overflow-hidden rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/70 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative flex-shrink-0">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#5D4037] to-[#3E2723] text-base font-bold text-[#FAF6F0] shadow-md">
                      {driverFirstName?.[0]?.toUpperCase() || "D"}
                    </div>
                    <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-[#FAF6F0] bg-[#5D4037]">
                      <Shield className="h-2 w-2 text-[#FAF6F0]" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#3E2723] truncate">
                      {driverFirstName} {driverLastName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#795548]">
                      <span className="inline-flex items-center gap-1 font-medium text-[#3E2723]">
                        <Star className="h-3 w-3 fill-[#795548] text-[#795548]" />
                        4.9
                      </span>
                      <span>•</span>
                      <span className="truncate font-medium text-[#3E2723]">{vehicleNo}</span>
                    </div>
                  </div>
                  <a
                    href={driverPhone ? `tel:${driverPhone}` : "tel:0000000000"}
                    className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#5D4037] text-[#FAF6F0] shadow-md transition hover:scale-105"
                    aria-label="Call driver"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trip stops */}
          <div className="rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/70 p-3.5 shadow-sm">
            <div className="relative">
              <div className="pointer-events-none absolute left-[9px] top-3.5 bottom-3.5 w-px bg-gradient-to-b from-[#5D4037]/60 via-[#D7CCC8] to-[#795548]/60" />
              <Stop
                color="saddle"
                label="Pickup"
                value={ride.pickup.address || "Pickup point"}
              />
              <div className="h-2.5" />
              <Stop
                color="brass"
                square
                label="Destination"
                value={ride.destination.address || "Destination"}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <Stat icon={<IndianRupee className="h-3.5 w-3.5 text-[#795548]" />} label="Fare" value={`₹${formattedFare}`} />
            <Stat icon={<Clock className="h-3.5 w-3.5 text-[#795548]" />} label="ETA" value={`${activeDuration}m`} />
            <Stat icon={<RouteIcon className="h-3.5 w-3.5 text-[#795548]" />} label="Distance" value={`${activeDistance}km`} />
          </div>

          {/* Breakdown details if completed and available */}
          {ride.status === "COMPLETED" && ride.fare.breakdown && (
            <div className="rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-3 text-xs text-[#5D4037]">
              <p className="font-bold uppercase tracking-wider text-[#795548] mb-1.5">Fare Breakdown</p>
              <div className="space-y-1">
                {ride.fare.breakdown.baseFarePaise != null && (
                  <div className="flex justify-between"><span>Base Fare</span><span>₹{formatPaiseToRupee(ride.fare.breakdown.baseFarePaise)}</span></div>
                )}
                {ride.fare.breakdown.distanceFarePaise != null && (
                  <div className="flex justify-between"><span>Distance Fare</span><span>₹{formatPaiseToRupee(ride.fare.breakdown.distanceFarePaise)}</span></div>
                )}
                {ride.fare.breakdown.timeFarePaise != null && (
                  <div className="flex justify-between"><span>Time Fare</span><span>₹{formatPaiseToRupee(ride.fare.breakdown.timeFarePaise)}</span></div>
                )}
                {ride.fare.breakdown.surgePaise != null && ride.fare.breakdown.surgePaise > 0 && (
                  <div className="flex justify-between"><span>Surge Charge</span><span>₹{formatPaiseToRupee(ride.fare.breakdown.surgePaise)}</span></div>
                )}
              </div>
            </div>
          )}

          {ride.status === "ARRIVED_AT_DESTINATION" && (
            <div className="rounded-2xl border border-[#D7CCC8] bg-[#F5EBE6] p-3 text-sm text-[#5D4037]">
              <p className="font-semibold">Payment is required before the trip can be finalized.</p>
              <p className="mt-1 text-xs text-[#795548]">
                {paymentPending ? "Your payment remains pending until it is completed." : "Payment has been captured."}
              </p>
            </div>
          )}

          {/* Live driver coords (subtle) */}
          {driverLocation && (
            <p className="flex items-center gap-1.5 text-[10px] text-[#795548]">
              <MapPin className="h-3 w-3" />
              Driver at {driverLocation.latitude.toFixed(4)}, {driverLocation.longitude.toFixed(4)}
            </p>
          )}

          {/* Payment / Cancel / Done */}
          <div className="pt-1 space-y-2">
            {ride.status === "ARRIVED_AT_DESTINATION" && (
              <Button
                className="w-full rounded-full bg-[#5D4037] text-[#FAF6F0] hover:bg-[#4E342E]"
                onClick={handlePayNow}
                disabled={isPaying}
              >
                {isPaying ? "Preparing payment…" : "Pay now"}
              </Button>
            )}
            {isTerminal ? (
              <Button className="w-full rounded-full bg-[#5D4037] text-[#FAF6F0] hover:bg-[#4E342E]" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            ) : (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full rounded-full border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 shadow-sm"
              >
                Cancel ride
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed inset-x-0 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 px-4 py-2 text-xs text-[#3E2723] shadow-xl backdrop-blur-xl"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5D4037] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5D4037]" />
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
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 
                    className="text-lg font-semibold text-[#3E2723]"
                    style={{ fontFamily: DISPLAY_FONT }}
                  >
                    Cancel this ride?
                  </h3>
                  <p className="mt-1 text-xs text-[#795548]">
                    Frequent cancellations may affect your account.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-[#EFEBE9] text-[#5D4037]"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-full border border-[#D7CCC8] bg-[#EFEBE9] py-2.5 text-xs font-semibold text-[#3E2723] hover:bg-[#D7CCC8]/60 transition"
                >
                  Keep ride
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex-1 rounded-full bg-rose-600 py-2.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60 shadow-md"
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
  color: "saddle" | "brass";
  square?: boolean;
  label: string;
  value: string;
}) {
  const dotStyle =
    color === "saddle"
      ? "bg-[#5D4037] shadow-[0_0_8px_rgba(93,64,55,0.4)]"
      : "rotate-45 bg-[#795548] shadow-[0_0_8px_rgba(121,85,72,0.4)]";

  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-1 inline-block h-2.5 w-2.5 ${dotStyle} ${
          square ? "rounded-sm" : "rounded-full"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[#795548]">
          {label}
        </p>
        <p className="truncate text-xs text-[#3E2723] font-medium">{value}</p>
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
    <div className="rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/70 p-2.5 shadow-sm text-center">
      <div className="flex items-center justify-center gap-1 text-[#795548]">{icon}</div>
      <p className="mt-1 text-base font-bold text-[#3E2723]">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#795548]">
        {label}
      </p>
    </div>
  );
}