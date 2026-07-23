import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Clock, Star, Navigation, IndianRupee, Route, Timer } from "lucide-react";
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

interface DriverRide {
  _id: string;
  pickup: RidePoint;
  destination: RidePoint;
  fare: {
    estimated: number;
    final: number | null;
    breakdown: FareBreakdown | null;
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
  const [currentRide, setCurrentRide] = useState<DriverRide | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadProfileAndRide() {
      try {
        const [profileResponse, rideResponse] = await Promise.all([
          fetchDriverProfile(),
          appApi.get<{ message: string; ride: DriverRide }>("/ride/driver/current").catch(() => null),
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
    if (!profile) return;

    const driverSocket = connectDriverSocket({
      onReady: () => {
        setError("");
      },
      onError: (message) => {
        setError(message);
      },
    });

    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return () => driverSocket.close();
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setDriverLocation({ latitude, longitude });
        sendDriverLocation(driverSocket, latitude, longitude);
      },
      (positionError) => {
        setError(positionError.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      driverSocket.close();
    };
  }, [profile]);

  if (loading) {
    return <LoadingScreen label="Loading driver dashboard" />;
  }

  if (!profile) {
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

  const mapPath = currentRide
    ? driverLocation
      ? [
          { lat: driverLocation.latitude, lng: driverLocation.longitude },
          { lat: currentRide.pickup.coordinates.latitude, lng: currentRide.pickup.coordinates.longitude },
          { lat: currentRide.destination.coordinates.latitude, lng: currentRide.destination.coordinates.longitude },
        ]
      : [
          { lat: currentRide.pickup.coordinates.latitude, lng: currentRide.pickup.coordinates.longitude },
          { lat: currentRide.destination.coordinates.latitude, lng: currentRide.destination.coordinates.longitude },
        ]
    : [];

  const statusConfig = currentRide ? RIDE_STATUS_CONFIG[currentRide.status] : null;
  const paymentConfig = currentRide ? PAYMENT_STATUS_CONFIG[currentRide.paymentStatus] : null;
  const distance = currentRide ? currentRide.distance.actual ?? currentRide.distance.estimated : null;
  const duration = currentRide ? currentRide.duration.actual ?? currentRide.duration.estimated : null;
  const fare = currentRide ? currentRide.fare.final ?? currentRide.fare.estimated : null;
  const isFareFinal = currentRide?.fare.final != null;

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
              <p className="text-sm text-[#795548] mt-0.5">Riders can only see you while you're online.</p>
            </div>
            <Button size="lg" className="rounded-full bg-[#5D4037] px-8 py-6 text-base font-bold text-[#FAF6F0] hover:bg-[#4E342E] shadow-md transition-all active:scale-95">
              ☕ Go Online
            </Button>
          </div>
        </section>

        {/* Earnings & Stats Grid Cards */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 w-full">
          <div className="rounded-3xl bg-gradient-to-br from-[#5D4037] to-[#3E2723] p-6 text-[#FAF6F0] shadow-lg transition-transform duration-300 hover:-translate-y-1">
            <p className="text-[#D7CCC8] text-sm font-medium">Today's Earnings</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">₹0</h2>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-[#6D4C41] to-[#4E342E] p-6 text-[#FAF6F0] shadow-lg transition-transform duration-300 hover:-translate-y-1">
            <p className="text-[#D7CCC8] text-sm font-medium">Completed Trips</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">{profile.statistics.completedTrips}</h2>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-[#795548] to-[#5D4037] p-6 text-[#FAF6F0] shadow-lg transition-transform duration-300 hover:-translate-y-1">
            <p className="text-[#D7CCC8] text-sm font-medium">Rating</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black">{profile.rating.average.toFixed(1)}</h2>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-[#8D6E63] to-[#6D4C41] p-6 text-[#FAF6F0] shadow-lg transition-transform duration-300 hover:-translate-y-1">
            <p className="text-[#D7CCC8] text-sm font-medium">Total Earnings</p>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black truncate">{formatPaise(profile.statistics.totalEarnings)}</h2>
          </div>
        </section>

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
                  Stay online and nearby riders will automatically appear here.
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
              <div className="mx-6 mb-6 rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-4 text-sm text-[#5D4037]">
                Cancelled{currentRide.cancelledBy ? ` by ${currentRide.cancelledBy.toLowerCase()}` : ""}
                {currentRide.cancellationReason ? `: ${currentRide.cancellationReason}` : "."}
              </div>
            )}

            {currentRide?.status === "COMPLETED" && currentRide.fare.breakdown && (
              <div className="mx-6 mb-6 rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-5">
                <p className="text-sm font-medium text-[#3E2723]">
                  You earned <span className="font-bold">{formatPaise(currentRide.fare.breakdown.driverEarningPaise)}</span> on this trip
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#5D4037] sm:grid-cols-3">
                  <div className="flex justify-between gap-2"><dt>Base fare</dt><dd>{formatPaise(currentRide.fare.breakdown.baseFarePaise)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Distance</dt><dd>{formatPaise(currentRide.fare.breakdown.distanceFarePaise)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Time</dt><dd>{formatPaise(currentRide.fare.breakdown.timeFarePaise)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Surge</dt><dd>{formatPaise(currentRide.fare.breakdown.surgePaise)}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Platform fee</dt><dd>-{formatPaise(currentRide.fare.breakdown.platformCommissionPaise)}</dd></div>
                  <div className="flex justify-between gap-2 font-bold"><dt>Total</dt><dd>{formatPaise(currentRide.fare.breakdown.totalPaise)}</dd></div>
                </dl>
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
                path={mapPath}
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