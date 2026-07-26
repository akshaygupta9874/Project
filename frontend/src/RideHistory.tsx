import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Clock,
  MapPin,
  IndianRupee,
  Car,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { Button } from "./components/ui/button";
import { appApi } from "./lib/api";
import {
  createPaymentOrder,
  loadRazorpayCheckout,
  verifyPaymentSignature,
  type FareBreakdownPayload,
  type PaymentStatus,
} from "./lib/payment";
import { useAuthContext } from "./context/authContext";

interface RideHistoryRide {
  _id: string;
  pickup: { address: string };
  destination: { address: string };
  fare: { estimated: number; final?: number | null; breakdown?: FareBreakdownPayload | null };
  distance: { estimated: number | null };
  duration: { estimated: number | null };
  status: string;
  paymentStatus?: PaymentStatus;
  driver?: { _id?: string; firstName?: string; lastName?: string; vehicleNumber?: string | null } | string | null;
  createdAt: string;
}

// Presentational helpers only — do not affect data, fetching, or payment logic.
const RIDE_STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ONGOING: "bg-amber-50 text-amber-800 border-amber-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 border-amber-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CAPTURED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
};

const DEFAULT_BADGE_STYLE = "bg-stone-100 text-stone-700 border-stone-200";

function getBadgeStyle(map: Record<string, string>, key?: string | null) {
  if (!key) return DEFAULT_BADGE_STYLE;
  return map[key] ?? DEFAULT_BADGE_STYLE;
}

function driverInitial(ride: RideHistoryRide) {
  if (typeof ride.driver === "string" || !ride.driver?.firstName) return "D";
  return ride.driver.firstName.charAt(0).toUpperCase();
}

function driverDisplayName(ride: RideHistoryRide) {
  if (typeof ride.driver === "string") return "Driver assigned";
  if (ride.driver?.firstName) return `${ride.driver.firstName} ${ride.driver.lastName ?? ""}`.trim();
  return "Driver assigned";
}

export default function RideHistory() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [rides, setRides] = useState<RideHistoryRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processingRideId, setProcessingRideId] = useState<string | null>(null);

  useEffect(() => {
    async function loadRideHistory() {
      try {
        const response = await appApi.get<{ totalRides: number; rides: RideHistoryRide[] }>("/ride/history");
        setRides(response.data.rides);
      } catch (err) {
        setError("Unable to load ride history. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    void loadRideHistory();
  }, []);

  const handlePay = async (ride: RideHistoryRide) => {
    if (!user?._id) {
      setError("Unable to determine your account. Please sign in again.");
      return;
    }

    if (ride.status !== "COMPLETED") {
      setError("Payment is only available for completed rides.");
      return;
    }

    if (ride.paymentStatus !== "PENDING") {
      setError("This ride payment has already been processed.");
      return;
    }

    let currentRide = ride;

    if (!currentRide.fare.breakdown || currentRide.fare.final == null) {
      try {
        const response = await appApi.get<{ message: string; ride: RideHistoryRide }>(
          `/ride/${currentRide._id}/fare-preview`
        );

        currentRide = response.data.ride;
      } catch {
        setError("Unable to calculate the final fare. Please try again.");
        return;
      }
    }

    if (!currentRide.fare.breakdown) {
      setError("Ride fare breakdown is not available for payment.");
      return;
    }

    const driverId = typeof currentRide.driver === "string" ? currentRide.driver : currentRide.driver?._id;
    if (!driverId) {
      setError("Unable to determine the assigned driver for this ride.");
      return;
    }

    setProcessingRideId(currentRide._id);
    setError("");
    setMessage("");

    try {
      const paymentOrder = await createPaymentOrder({
        rideId: currentRide._id,
        driverId,
        fareBreakdown: currentRide.fare.breakdown,
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
            setRides((current) =>
              current.map((entry) =>
                entry._id === ride._id
                  ? { ...entry, paymentStatus: verifyResult.status }
                  : entry,
              ),
            );
            setMessage("Payment verified successfully. Thank you for riding with us.");
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
          ondismiss: () => {
            setMessage("Payment window closed. You can retry this ride payment anytime.");
          },
        },
      };

      const razorpayInstance = new Razorpay(options);
      razorpayInstance.open();
    } catch {
      setError("Unable to launch payment checkout. Please try again later.");
    } finally {
      setProcessingRideId(null);
    }
  };

  if (loading) {
    return <LoadingScreen label="Loading ride history" />;
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-amber-800">Ride History</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-stone-900">All trips</h1>
            <p className="mt-1 text-sm text-stone-500">
              {rides.length > 0
                ? `${rides.length} trip${rides.length === 1 ? "" : "s"} on record`
                : "Your completed and ongoing trips will appear here"}
            </p>
          </div>

          <Button
            variant="outline"
            className="border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-900"
            onClick={() => navigate("/dashboard")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to dashboard
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {rides.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-sm">
            <div className="rounded-full bg-amber-50 p-3 text-amber-800">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="font-serif text-lg text-stone-800">No rides found yet</p>
            <p className="text-sm text-stone-500">Book a new ride from your dashboard to see it listed here.</p>
          </div>
        ) : (
          <div className="grid gap-5">
            {rides.map((ride) => {
              const isProcessing = processingRideId === ride._id;
              const canPay = ride.status === "COMPLETED" && ride.paymentStatus === "PENDING";
              const displayFare = ride.fare.final ? `₹${ride.fare.final / 100}` : `₹${ride.fare.estimated}`;

              return (
                <div
                  key={ride._id}
                  className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="grid gap-4 p-6 md:grid-cols-[1.6fr_1fr_1fr]">
                    {/* Route */}
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center pt-1">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-700" />
                        <span className="my-1 w-px flex-1 border-l border-dashed border-stone-300" />
                        <span className="h-2.5 w-2.5 rounded-full border-2 border-amber-700 bg-white" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-3">
                        <div className="flex items-start gap-2 text-sm text-stone-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                          <span>{ride.pickup.address}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-stone-700">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                          <span>{ride.destination.address}</span>
                        </div>
                        <div className="text-xs text-stone-400">
                          {new Date(ride.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          &middot; {new Date(ride.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Fare / meta */}
                    <div className="grid gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <IndianRupee className="h-3.5 w-3.5" />
                          Fare
                        </span>
                        <span className="font-serif text-base font-semibold text-stone-900">{displayFare}</span>
                      </div>
                      <div className="border-t border-dashed border-stone-200" />
                      <div className="flex items-center justify-between text-stone-600">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <Clock className="h-3.5 w-3.5" />
                          Duration
                        </span>
                        <span>{ride.duration.estimated ?? 0} mins</span>
                      </div>
                      <div className="flex items-center justify-between text-stone-600">
                        <span className="flex items-center gap-1.5 text-stone-500">
                          <Car className="h-3.5 w-3.5" />
                          Driver
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-800">
                            {driverInitial(ride)}
                          </span>
                          {driverDisplayName(ride)}
                        </span>
                      </div>
                    </div>

                    {/* Status / action */}
                    <div className="flex flex-col justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${getBadgeStyle(
                            RIDE_STATUS_STYLES,
                            ride.status,
                          )}`}
                        >
                          {ride.status}
                        </span>
                        <span
                          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium ${getBadgeStyle(
                            PAYMENT_STATUS_STYLES,
                            ride.paymentStatus,
                          )}`}
                        >
                          {ride.paymentStatus ?? "N/A"}
                        </span>
                      </div>

                      <Button
                        variant="secondary"
                        disabled={!canPay || isProcessing}
                        className={
                          canPay
                            ? "bg-amber-800 text-amber-50 hover:bg-amber-900 disabled:opacity-60"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-100"
                        }
                        onClick={() => handlePay(ride)}
                      >
                        {isProcessing ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </span>
                        ) : canPay ? (
                          "Pay ride"
                        ) : (
                          "View details"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
