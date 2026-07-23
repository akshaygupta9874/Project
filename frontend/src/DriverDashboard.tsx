import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation, Loader2, X } from "lucide-react";
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
  | "COMPLETED"
  | "CANCELLED";

type RidePaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

interface RidePoint {
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
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

const RIDE_STATUS_CONFIG: Record<RideStatus, { label: string; badge: string; description: string }> = {
  SEARCHING: {
    label: "Searching",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "Matching this ride with a driver.",
  },
  DRIVER_ASSIGNED: {
    label: "Assigned to you",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "Head to the pickup point.",
  },
  DRIVER_ARRIVING: {
    label: "Arriving",
    badge: "bg-[#D7CCC8]/50 text-[#4E342E] border border-[#BCAAA4]",
    description: "You're on your way to the rider.",
  },
  STARTED: {
    label: "Trip in progress",
    badge: "bg-[#D7CCC8]/60 text-[#3E2723] border border-[#A1887F]",
    description: "Trip is underway to the destination.",
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-[#EFEBE9] text-[#5D4037] border border-[#D7CCC8]",
    description: "This trip has been completed.",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-[#EFEBE9] text-[#6D4C41] border border-[#D7CCC8]",
    description: "This ride was cancelled.",
  },
};

const PAYMENT_STATUS_CONFIG: Record<RidePaymentStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: "Payment pending", badge: "text-[#6D4C41]", dot: "bg-[#8D6E63]" },
  PAID: { label: "Paid", badge: "text-[#3E2723]", dot: "bg-[#5D4037]" },
  FAILED: { label: "Payment failed", badge: "text-[#795548]", dot: "bg-[#A1887F]" },
  REFUNDED: { label: "Refunded", badge: "text-[#6D4C41]", dot: "bg-[#BCAAA4]" },
};

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDistanceMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDurationSeconds(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

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

  const watchIdRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const driverStatusRef = useRef<DriverStatus>("OFFLINE");
  const currentRideRef = useRef<Ride | null>(null);

  useEffect(() => { driverStatusRef.current = driverStatus; }, [driverStatus]);
  useEffect(() => { currentRideRef.current = currentRide; }, [currentRide]);

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

  // Fetch Geoapify routing polyline connecting Driver -> Pickup -> Destination sequentially
  useEffect(() => {
    async function fetchGeoapifyRoute() {
      if (!currentRide) {
        setRoutePolyline([]);
        return;
      }

      const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
      if (!apiKey) return;

      const waypoints: string[] = [];

      // 1. Start leg: Driver's live location if available, otherwise start from pickup
      if (driverLocation) {
        waypoints.push(`${driverLocation.latitude},${driverLocation.longitude}`);
      }

      // 2. Middle leg: Pickup location (always required to route through pickup)
      waypoints.push(`${currentRide.pickup.coordinates.latitude},${currentRide.pickup.coordinates.longitude}`);

      // 3. Final leg: Destination location
      waypoints.push(`${currentRide.destination.coordinates.latitude},${currentRide.destination.coordinates.longitude}`);

      // Geoapify requires at least 2 unique waypoints
      if (waypoints.length < 2) return;

      try {
        const url = `https://api.geoapify.com/v1/routing?waypoints=${waypoints.join("|")}&mode=drive&apiKey=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data?.features?.[0]?.geometry?.coordinates) {
          const coords = data.features[0].geometry.coordinates;
          const flatPoints: Array<{ lat: number; lng: number }> = [];
          coords.forEach((line: [number, number][]) => {
            line.forEach(([lon, lat]) => {
              flatPoints.push({ lat, lng: lon });
            });
          });
          setRoutePolyline(flatPoints);
        }
      } catch (err) {
        console.error("Failed to fetch Geoapify route polyline", err);
      }
    }

    fetchGeoapifyRoute();
  }, [currentRide?._id, driverLocation?.latitude, driverLocation?.longitude, currentRide?.pickup, currentRide?.destination]);

  // Setup WebSocket connection, incoming message listeners, heartbeat, and location watching
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
      onError: (message) => {
        setError(message);
      },
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

          case ServerEvents.RIDE_STARTED:
            setCurrentRide((prev) => (prev ? { ...prev, status: "STARTED" } : prev));
            break;

          case ServerEvents.RIDE_COMPLETED: {
            setCurrentRide((prev) => {
              const updated = prev ? { ...prev, status: "COMPLETED" as RideStatus, ...data?.ride } : null;
              const earnedPaise = updated?.fare?.breakdown?.driverEarningPaise ?? updated?.fare?.fareBreakdown?.driverEarningPaise ?? 0;
              
              if (earnedPaise > 0) {
                setProfile((prevProf) => prevProf ? {
                  ...prevProf,
                  statistics: {
                    ...prevProf.statistics,
                    completedTrips: prevProf.statistics.completedTrips + 1,
                    totalEarnings: prevProf.statistics.totalEarnings + earnedPaise,
                  }
                } : prevProf);
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
      (positionError) => {
        setError(`Navigator : ${positionError.message} `);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      },
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

  // Auto-transition driver status based on active ride lifecycle
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
      JSON.stringify({
        event: DriverEvents.SET_AVAILABLE,
        data: { available: goingOnline },
      }),
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
    } else if (event === DriverEvents.START_RIDE) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "STARTED" } : prev));
    } else if (event === DriverEvents.COMPLETE_RIDE) {
      setCurrentRide((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading driver dashboard" />;
  }

  if (!profile || profile.verificationStatus!="APPROVED") {
    return (
      <div className="min-h-screen w-full bg-[#EFEBE9] p-6 flex items-center justify-center">
        <div className="w-full max-w-4xl rounded-3xl bg-[#FAF6F0] border border-[#D7CCC8] p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-[#3E2723]">Driver dashboard</h1>
          {error ? (
            <div className="mt-4 rounded-2xl border border-[#D7CCC8] bg-[#F5EBE6] p-4 text-sm text-[#5D4037]">
              {error}
            </div>
          ) : (
            <p className="mt-4 text-[#5D4037]">Driver profile not found. Please complete the driver registration flow.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate("/driver-registration")} className="bg-[#D7CCC8] text-[#3E2723] hover:bg-[#BCAAA4]">Register as driver</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-[#D7CCC8] text-[#5D4037] hover:bg-[#EFEBE9]">Go to rider dashboard</Button>
          </div>
        </div>
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
            position: { lat: currentRide.destination.coordinates.latitude, lng: currentRide.destination.coordinates.longitude },
            label: "D",
            title: "Destination",
          },
        ]
      : []),
  ];

  const statusConfig = currentRide ? RIDE_STATUS_CONFIG[currentRide.status] : null;
  const paymentConfig = currentRide ? PAYMENT_STATUS_CONFIG[currentRide.paymentStatus] : null;
  const distance = currentRide ? currentRide.distance.actual ?? currentRide.distance.estimated : null;
  const duration = currentRide ? currentRide.duration.actual ?? currentRide.duration.estimated : null;
  const fare = currentRide ? currentRide.fare.breakdown?.driverEarningPaise ?? currentRide.fare.final ?? currentRide.fare.estimated : null;
  
  const fareBreakdownData = currentRide?.fare?.breakdown ?? currentRide?.fare?.fareBreakdown ?? null;

  const driverStatusCopy: Record<DriverStatus, string> = {
    OFFLINE: "Riders can only see you while you're online.",
    AVAILABLE: "You are online and receiving requests.",
    BUSY: "You're on an active trip. You'll go back to available automatically once it ends.",
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#EFEBE9] text-[#3E2723] transition-colors duration-300">
      {/* Background Decorative Blobs */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#D7CCC8]/30 blur-3xl pointer-events-none" />
      <div className="absolute top-60 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#D7CCC8]/25 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[#E4D8D3]/30 blur-3xl pointer-events-none" />

      {/* Full Width Main Container */}
      <div className="relative w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8">

        {/* Sticky Header */}
        <header className="sticky top-4 z-50 w-full">
          <div className="w-full rounded-3xl border border-[#D7CCC8]/60 bg-[#FAF6F0]/90 backdrop-blur-xl shadow-lg px-6 py-4 flex items-center justify-between transition-all duration-300 hover:shadow-xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#3E2723]">Driver Dashboard</h2>
              <p className="text-sm text-[#795548]">Drive safely ☕</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-[#D7CCC8] text-[#5D4037] hover:bg-[#EFEBE9]">
                Rider Mode
              </Button>
              <Button variant="destructive" onClick={() => void logout().then(() => navigate("/login", { replace: true }))} className="bg-[#5D4037] hover:bg-[#4E342E] text-white">
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Statistics Section */}
        <section className="w-full overflow-hidden rounded-[32px] bg-gradient-to-r from-[#3E2723] via-[#5D4037] to-[#795548] p-6 sm:p-10 text-[#FAF6F0] shadow-2xl transition-all duration-300">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#D7CCC8] font-semibold">Driver Portal</p>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Welcome Back 👋</h1>
              <p className="max-w-xl text-[#E4D8D3] text-sm sm:text-base">
                Ready to earn today? Go online and we'll instantly connect you with nearby riders.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-4 sm:p-5 border border-white/10 hover:bg-white/15 transition-all">
                <p className="text-xs uppercase tracking-widest text-[#D7CCC8] font-medium">Trips</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold">{profile.statistics.completedTrips}</h2>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-4 sm:p-5 border border-white/10 hover:bg-white/15 transition-all">
                <p className="text-xs uppercase tracking-widest text-[#D7CCC8] font-medium">Rating</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold">{profile.rating.average.toFixed(1)}</h2>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-4 sm:p-5 border border-white/10 hover:bg-white/15 transition-all">
                <p className="text-xs uppercase tracking-widest text-[#D7CCC8] font-medium">Earnings</p>
                <h2 className="mt-2 text-xl sm:text-3xl font-bold truncate">{formatPaise(profile.statistics.totalEarnings)}</h2>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-4 sm:p-5 border border-white/10 hover:bg-white/15 transition-all">
                <p className="text-xs uppercase tracking-widest text-[#D7CCC8] font-medium">Status</p>
                <h2 className="mt-2 text-lg sm:text-xl font-bold text-[#D7CCC8] truncate">{profile.verificationStatus}</h2>
              </div>
            </div>
          </div>
        </section>

        {/* Go Online Control Card */}
        <section className="w-full rounded-3xl bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl p-6 transition-all duration-300 hover:shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#3E2723]">Driver Status</h2>
              <p className="text-sm text-[#795548] mt-0.5">{driverStatusCopy[driverStatus]}</p>
            </div>
            <Button
              size="lg"
              onClick={handleToggleAvailability}
              disabled={driverStatus === "BUSY"}
              className={`rounded-full px-8 py-6 text-base font-bold shadow-md transition-all active:scale-95 disabled:opacity-70 ${
                driverStatus === "AVAILABLE"
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : driverStatus === "BUSY"
                  ? "bg-[#8D6E63] text-white"
                  : "bg-[#5D4037] hover:bg-[#4E342E] text-[#FAF6F0]"
              }`}
            >
              {driverStatus === "AVAILABLE" ? "🟢 Go Offline" : driverStatus === "BUSY" ? "🚗 On a Trip" : "☕ Go Online"}
            </Button>
          </div>
        </section>

        {/* Error Display Bar */}
        {error && (
          <div className="w-full rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            {error}
          </div>
        )}

        {/* Current Ride Section & Map Wrapper */}
        <section className="grid gap-8 w-full">
          <div className="w-full overflow-hidden rounded-[32px] bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl transition-all">
            <div className="border-b border-[#D7CCC8] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[#3E2723]">Current Ride</h2>
                <p className="text-sm text-[#795548] mt-1">Everything you need for the active trip.</p>
              </div>
              {statusConfig && (
                <span className={`w-fit rounded-full px-4 py-1.5 text-sm font-semibold ${statusConfig.badge}`}>
                  {statusConfig.label}
                </span>
              )}
            </div>

            {!currentRide ? (
              <div className="py-16 px-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#D7CCC8]/40 text-[#5D4037] shadow-inner">
                  <Navigation className="h-8 w-8 animate-pulse" />
                </div>
                <h3 className="mt-5 text-xl sm:text-2xl font-bold text-[#3E2723]">Waiting for Ride Requests</h3>
                <p className="mt-2 text-sm sm:text-base text-[#795548] max-w-md mx-auto">
                  {driverStatus === "AVAILABLE" ? "You are online. Nearby requests will appear here instantly." : "Go online to start receiving ride requests."}
                </p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6 p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#EFEBE9]/80 border border-[#D7CCC8] p-5">
                    <p className="text-xs uppercase tracking-widest text-[#5D4037] font-bold">Pickup</p>
                    <p className="mt-2 text-base sm:text-lg font-semibold text-[#3E2723]">{currentRide.pickup.address}</p>
                  </div>
                  <div className="rounded-2xl bg-[#EFEBE9]/80 border border-[#D7CCC8] p-5">
                    <p className="text-xs uppercase tracking-widest text-[#5D4037] font-bold">Destination</p>
                    <p className="mt-2 text-base sm:text-lg font-semibold text-[#3E2723]">{currentRide.destination.address}</p>
                  </div>

                  {/* Ride Workflow Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    {currentRide.status === "SEARCHING" && (
                      <>
                        <Button
                          onClick={() => handleAcceptRide(currentRide._id)}
                          className="bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-full px-6 py-3 font-bold flex items-center gap-2"
                        >
                          Accept Ride
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleRejectRide(currentRide._id)}
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 rounded-full px-6 py-3 font-bold flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {currentRide.status === "DRIVER_ASSIGNED" && (
                      <Button
                        onClick={() => sendRideAction(DriverEvents.ARRIVED_AT_PICKUP, currentRide._id)}
                        className="bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-full px-6 py-3 font-bold"
                      >
                        Arrived at Pickup
                      </Button>
                    )}
                    {currentRide.status === "DRIVER_ARRIVING" && (
                      <Button
                        onClick={() => sendRideAction(DriverEvents.START_RIDE, currentRide._id)}
                        className="bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-full px-6 py-3 font-bold"
                      >
                        Start Ride
                      </Button>
                    )}
                    {currentRide.status === "STARTED" && (
                      <Button
                        onClick={() => sendRideAction(DriverEvents.COMPLETE_RIDE, currentRide._id)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-6 py-3 font-bold"
                      >
                        Complete Ride
                      </Button>
                    )}
                    {["DRIVER_ASSIGNED", "DRIVER_ARRIVING"].includes(currentRide.status) && (
                      <Button
                        variant="outline"
                        onClick={() => handleCancelRide(currentRide._id)}
                        className="border-rose-300 text-rose-700 hover:bg-rose-50 rounded-full px-6 py-3 font-bold flex items-center gap-2"
                      >
                        Cancel Ride
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-[#EFEBE9] border border-[#D7CCC8] p-5 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wider text-[#795548] font-medium">Distance</p>
                    <h3 className="mt-2 text-xl sm:text-2xl font-bold text-[#3E2723]">
                      {distance != null ? formatDistanceMeters(distance) : "--"}
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-[#EFEBE9] border border-[#D7CCC8] p-5 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wider text-[#795548] font-medium">ETA</p>
                    <h3 className="mt-2 text-xl sm:text-2xl font-bold text-[#3E2723]">
                      {duration != null ? formatDurationSeconds(duration) : "--"}
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-[#EFEBE9] border border-[#D7CCC8] p-5 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wider text-[#795548] font-medium">Fare</p>
                    <h3 className="mt-2 text-xl sm:text-2xl font-bold text-[#3E2723]">
                      {fare != null ? formatPaise(fare) : "--"}
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-[#EFEBE9] border border-[#D7CCC8] p-5 flex flex-col justify-between">
                    <p className="text-xs uppercase tracking-wider text-[#795548] font-medium">Payment</p>
                    <h3 className={`mt-2 text-lg sm:text-xl font-bold ${paymentConfig?.badge}`}>
                      {paymentConfig?.label}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {currentRide?.status === "CANCELLED" && (
              <div className="mx-6 mb-6 rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-4 text-sm text-[#5D4037] flex flex-wrap items-center justify-between gap-3">
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
              </div>
            )}

            {currentRide?.status === "COMPLETED" && (
              <div className="mx-6 mb-6 rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-6 text-center space-y-3">
                <p className="text-xs uppercase tracking-widest text-[#795548] font-bold">Trip Completed</p>
                <h3 className="text-3xl font-black text-[#3E2723]">
                  {fareBreakdownData ? formatPaise(fareBreakdownData.driverEarningPaise) : (fare != null ? formatPaise(fare) : "₹0.00")}
                </h3>
                <p className="text-sm text-[#5D4037]">Driver earnings added successfully.</p>
                <div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRide(null)}
                    className="border-[#D7CCC8] text-[#5D4037] hover:bg-[#FAF6F0] rounded-full px-6 py-2 text-xs font-bold mt-2"
                  >
                    Back to searching
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Live Map Box */}
          <div className="w-full overflow-hidden rounded-[32px] bg-[#FAF6F0] border border-[#D7CCC8] shadow-xl">
            <div className="border-b border-[#D7CCC8] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-[#3E2723]">Live Route Map</h2>
                <p className="text-sm text-[#795548]">Your live location and active route.</p>
              </div>
              <span className={`w-fit inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusConfig ? statusConfig.badge : "bg-[#EFEBE9] text-[#5D4037]"}`}>
                <span className="h-2 w-2 rounded-full bg-current animate-ping" />
                {statusConfig ? statusConfig.label : "No active ride"}
              </span>
            </div>
            <div className="h-[450px] sm:h-[550px] w-full">
              <MapView
                center={mapCenter}
                zoom={12}
                markers={mapMarkers}
                path={routePolyline}
              />
            </div>
          </div>
        </section>

        {/* Action Buttons Grid */}
        <section className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4 w-full">
          <Button variant="outline" className="h-24 sm:h-28 rounded-3xl text-base sm:text-lg border-[#D7CCC8] bg-[#FAF6F0] text-[#3E2723] hover:bg-[#EFEBE9] transition-all shadow-sm w-full">
            🚕 Ride History
          </Button>
          <Button variant="outline" className="h-24 sm:h-28 rounded-3xl text-base sm:text-lg border-[#D7CCC8] bg-[#FAF6F0] text-[#3E2723] hover:bg-[#EFEBE9] transition-all shadow-sm w-full">
            💰 Earnings
          </Button>
          <Button variant="outline" className="h-24 sm:h-28 rounded-3xl text-base sm:text-lg border-[#D7CCC8] bg-[#FAF6F0] text-[#3E2723] hover:bg-[#EFEBE9] transition-all shadow-sm w-full">
            🚗 Vehicle
          </Button>
          <Button variant="outline" className="h-24 sm:h-28 rounded-3xl text-base sm:text-lg border-[#D7CCC8] bg-[#FAF6F0] text-[#3E2723] hover:bg-[#EFEBE9] transition-all shadow-sm w-full">
            ⚙️ Settings
          </Button>
        </section>

        {/* Vehicle & Documents Info Sections */}
        <div className="w-full space-y-6">
          <div className="grid gap-6 sm:grid-cols-3 w-full">
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-5 sm:p-6 shadow-sm w-full">
              <p className="text-xs uppercase tracking-wider text-[#795548] font-semibold">Type</p>
              <p className="mt-2 text-base sm:text-lg font-bold text-[#3E2723]">{VEHICLE_TYPE_LABEL[profile.vehicle.type]}</p>
            </div>
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-5 sm:p-6 shadow-sm w-full">
              <p className="text-xs uppercase tracking-wider text-[#795548] font-semibold">Model</p>
              <p className="mt-2 text-base sm:text-lg font-bold text-[#3E2723]">{profile.vehicle.brand} {profile.vehicle.model}</p>
            </div>
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-5 sm:p-6 shadow-sm w-full">
              <p className="text-xs uppercase tracking-wider text-[#795548] font-semibold">Registration</p>
              <p className="mt-2 text-base sm:text-lg font-bold text-[#3E2723]">{profile.vehicle.registrationNumber}</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3 w-full">
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-sm w-full">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#795548]">License</h3>
              <p className="mt-3 text-sm font-medium text-[#3E2723]">{profile.documents.drivingLicense.number}</p>
              <p className="mt-1 text-xs text-[#795548]">Expires {new Date(profile.documents.drivingLicense.expiryDate).toLocaleDateString()}</p>
            </div>
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-sm w-full">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#795548]">Insurance</h3>
              <p className="mt-3 text-sm font-medium text-[#3E2723]">{profile.documents.insurance.number}</p>
              <p className="mt-1 text-xs text-[#795548]">Expires {new Date(profile.documents.insurance.expiryDate).toLocaleDateString()}</p>
            </div>
            <div className="rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-sm w-full">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#795548]">Pollution</h3>
              <p className="mt-3 text-sm font-medium text-[#3E2723]">Certificate Active</p>
              <p className="mt-1 text-xs text-[#795548]">Expires {new Date(profile.documents.pollutionCertificate.expiryDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}