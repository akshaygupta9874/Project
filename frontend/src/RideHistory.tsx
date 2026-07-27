import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Search,
  Filter,
  Download,
  HelpCircle,
  Receipt,
  ArrowUpRight,
  Sparkles,
  X
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

// Luxurious Golden-Brown & Obsidian Theme Styles
const RIDE_STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-amber-500/10 text-amber-700 border-amber-300/50 shadow-sm",
  ONGOING: "bg-amber-100 text-amber-900 border-amber-400 animate-pulse",
  IN_PROGRESS: "bg-amber-100 text-amber-900 border-amber-400 animate-pulse",
  CANCELLED: "bg-stone-200/60 text-stone-600 border-stone-300",
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-800 border-emerald-300/50",
  CAPTURED: "bg-emerald-500/10 text-emerald-800 border-emerald-300/50",
  COMPLETED: "bg-emerald-500/10 text-emerald-800 border-emerald-300/50",
  PENDING: "bg-amber-500/10 text-amber-700 border-amber-300/50",
  FAILED: "bg-rose-500/10 text-rose-800 border-rose-300/50",
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

  // New interactive feature states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedRideForModal, setSelectedRideForModal] = useState<RideHistoryRide | null>(null);

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

  // Filter and Search logic
  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      const matchesSearch =
        ride.pickup.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.destination.address.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (statusFilter === "ALL") return matchesSearch;
      if (statusFilter === "PENDING_PAYMENT") {
        return matchesSearch && ride.status === "COMPLETED" && ride.paymentStatus === "PENDING";
      }
      return matchesSearch && ride.status === statusFilter;
    });
  }, [rides, searchQuery, statusFilter]);

  // Quick statistics calculation
  const stats = useMemo(() => {
    const totalRides = rides.length;
    const completedRides = rides.filter(r => r.status === "COMPLETED").length;
    const totalSpent = rides.reduce((acc, curr) => acc + (curr.fare.final ?? curr.fare.estimated ?? 0), 0);
    return { totalRides, completedRides, totalSpent };
  }, [rides]);

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
        name: "Aura Luxury Rides",
        description: "Complete your premium ride payment",
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
        theme: { color: "#b45309" }, // Amber-700
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
    return <LoadingScreen label="Loading your elite travel history..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/20 p-4 md:p-8 text-stone-100">
      <div className="mx-auto max-w-6xl space-y-8">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-stone-900/80 p-6 md:p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Concierge Log</p>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-stone-100">Ride History & Ledger</h1>
              <p className="text-sm text-stone-400">
                Review your luxury journeys, settle invoices, and manage past itineraries.
              </p>
            </div>

            <Button
              variant="outline"
              className="border-amber-500/30 bg-stone-900/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 transition-all rounded-2xl"
              onClick={() => navigate("/dashboard")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-stone-800/80">
            <div className="flex items-center gap-4 bg-stone-950/40 p-4 rounded-2xl border border-stone-800">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Total Trips</p>
                <p className="font-serif text-xl font-bold text-stone-100">{stats.totalRides}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-stone-950/40 p-4 rounded-2xl border border-stone-800">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Completed</p>
                <p className="font-serif text-xl font-bold text-stone-100">{stats.completedRides}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-stone-950/40 p-4 rounded-2xl border border-stone-800">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider">Total Investment</p>
                <p className="font-serif text-xl font-bold text-stone-100">₹{stats.totalSpent / 100}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Alerts */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/30 p-4 text-sm text-rose-300 shadow-lg">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </motion.div>
        )}

        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-sm text-emerald-300 shadow-lg">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </motion.div>
        )}

        {/* Interactive Search and Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-stone-900/60 p-4 rounded-2xl border border-stone-800 backdrop-blur-md">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by pickup or drop location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-stone-950 border border-stone-800 pl-10 pr-4 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <Filter className="h-4 w-4 text-amber-500 shrink-0 ml-1" />
            {["ALL", "COMPLETED", "ONGOING", "PENDING_PAYMENT", "CANCELLED"].map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setStatusFilter(filterKey)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === filterKey
                    ? "bg-amber-600 text-stone-950 font-semibold shadow-lg shadow-amber-900/40"
                    : "bg-stone-950/60 text-stone-400 border border-stone-800 hover:text-stone-200"
                }`}
              >
                {filterKey.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Ride List */}
        {filteredRides.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-stone-800 bg-stone-900/40 p-16 text-center shadow-inner">
            <div className="rounded-2xl bg-amber-500/10 p-4 text-amber-500 border border-amber-500/20">
              <Inbox className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-xl text-stone-200">No matching itineraries found</p>
              <p className="text-sm text-stone-400">Try tweaking your search filters or book a new journey.</p>
            </div>
            <Button
              onClick={() => navigate("/dashboard")}
              className="mt-2 bg-amber-600 text-stone-950 hover:bg-amber-500 font-semibold rounded-xl"
            >
              Book New Ride <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-5">
            {filteredRides.map((ride, index) => {
              const isProcessing = processingRideId === ride._id;
              const canPay = ride.status === "COMPLETED" && ride.paymentStatus === "PENDING";
              const displayFare = ride.fare.final ? `₹${ride.fare.final / 100}` : `₹${ride.fare.estimated}`;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={ride._id}
                  className="group overflow-hidden rounded-3xl border border-stone-800 bg-stone-900/80 shadow-lg transition-all hover:border-amber-500/40 hover:shadow-amber-950/20"
                >
                  <div className="grid gap-6 p-6 md:grid-cols-[1.6fr_1fr_1fr] items-center">
                    
                    {/* Route Info */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center pt-1">
                        <span className="h-3 w-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                        <span className="my-1.5 w-px flex-1 border-l border-dashed border-stone-700" />
                        <span className="h-3 w-3 rounded-full border-2 border-amber-500 bg-stone-900" />
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-3">
                        <div className="flex items-start gap-2.5 text-sm text-stone-200">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <span className="font-medium line-clamp-1">{ride.pickup.address}</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-sm text-stone-300">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
                          <span className="line-clamp-1">{ride.destination.address}</span>
                        </div>
                        <div className="text-xs text-stone-500 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-amber-500/70" />
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

                    {/* Fare / Meta Details */}
                    <div className="grid gap-3 rounded-2xl border border-stone-800/80 bg-stone-950/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wider">
                          <IndianRupee className="h-3.5 w-3.5 text-amber-500" />
                          Total Fare
                        </span>
                        <span className="font-serif text-lg font-bold text-amber-400">{displayFare}</span>
                      </div>
                      <div className="border-t border-stone-800/80" />
                      <div className="flex items-center justify-between text-xs text-stone-400">
                        <span>Estimated Duration</span>
                        <span className="text-stone-200">{ride.duration.estimated ?? 0} mins</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-stone-400">
                        <span>Chauffeur</span>
                        <span className="flex items-center gap-2 text-stone-200 font-medium">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                            {driverInitial(ride)}
                          </span>
                          {driverDisplayName(ride)}
                        </span>
                      </div>
                    </div>

                    {/* Status Badges & Action Buttons */}
                    <div className="flex flex-col justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getBadgeStyle(
                            RIDE_STATUS_STYLES,
                            ride.status,
                          )}`}
                        >
                          {ride.status}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getBadgeStyle(
                            PAYMENT_STATUS_STYLES,
                            ride.paymentStatus,
                          )}`}
                        >
                          {ride.paymentStatus ?? "N/A"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          disabled={!canPay || isProcessing}
                          className={`flex-1 rounded-xl text-xs font-semibold py-2.5 transition-all ${
                            canPay
                              ? "bg-amber-600 text-stone-950 hover:bg-amber-500 shadow-lg shadow-amber-900/40"
                              : "bg-stone-800 text-stone-300 hover:bg-stone-700"
                          }`}
                          onClick={() => handlePay(ride)}
                        >
                          {isProcessing ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Processing...
                            </span>
                          ) : canPay ? (
                            "Pay Now"
                          ) : (
                            <span onClick={(e) => { e.stopPropagation(); setSelectedRideForModal(ride); }} className="flex items-center gap-1.5 w-full justify-center">
                              <Receipt className="h-3.5 w-3.5" /> View Receipt
                            </span>
                          )}
                        </Button>

                        <button
                          title="Support / Report Issue"
                          onClick={() => alert(`Support ticket requested for ride #${ride._id.slice(-6).toUpperCase()}`)}
                          className="p-2.5 rounded-xl border border-stone-800 bg-stone-950 text-stone-400 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Modal for Ride Details / Receipt Preview */}
        <AnimatePresence>
          {selectedRideForModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-3xl border border-amber-500/30 bg-stone-900 p-6 shadow-2xl text-stone-100"
              >
                <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h3 className="font-serif text-xl font-bold">Journey Summary & Receipt</h3>
                  </div>
                  <button
                    onClick={() => setSelectedRideForModal(null)}
                    className="p-2 rounded-full bg-stone-800 text-stone-400 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4 py-4 text-sm">
                  <div className="bg-stone-950 p-4 rounded-2xl border border-stone-800 space-y-2">
                    <div className="flex justify-between text-stone-400">
                      <span>Ride ID</span>
                      <span className="font-mono text-stone-200">#{selectedRideForModal._id.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-stone-400">
                      <span>Booking Status</span>
                      <span className="text-amber-400 font-semibold">{selectedRideForModal.status}</span>
                    </div>
                    <div className="flex justify-between text-stone-400">
                      <span>Payment Status</span>
                      <span className="text-emerald-400 font-semibold">{selectedRideForModal.paymentStatus ?? "Completed"}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Route breakdown</p>
                    <div className="space-y-2 rounded-2xl border border-stone-800 p-4 bg-stone-950/40">
                      <p className="text-stone-300"><strong>From:</strong> {selectedRideForModal.pickup.address}</p>
                      <p className="text-stone-300"><strong>To:</strong> {selectedRideForModal.destination.address}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Fare breakdown</p>
                    <div className="rounded-2xl border border-stone-800 p-4 bg-stone-950/40 space-y-2">
                      <div className="flex justify-between text-stone-300">
                        <span>Base / Estimated Fare</span>
                        <span>₹{selectedRideForModal.fare.estimated}</span>
                      </div>
                      {selectedRideForModal.fare.final && (
                        <div className="flex justify-between font-bold text-amber-400 pt-2 border-t border-stone-800">
                          <span>Final Total Charged</span>
                          <span>₹{selectedRideForModal.fare.final / 100}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-stone-800">
                  <Button
                    onClick={() => {
                      alert("Simulating receipt download as PDF...");
                      setSelectedRideForModal(null);
                    }}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold rounded-xl"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download PDF Receipt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedRideForModal(null)}
                    className="border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700 rounded-xl"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
