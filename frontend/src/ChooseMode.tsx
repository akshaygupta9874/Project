import MapView from './components/MapView';
import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { appApi } from './apiInterceptor';
import { Button } from './components/ui/button';
import { Bike, Car, Clock, IndianRupee, Check, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuthContext } from "./context/authContext";

interface RideModeOption {
    id: "bike" | "auto" | "car";
    name: string;
    description: string;
    icon: React.ReactNode;
    multiplier: number;
    etaMinutes: number;
}

const RIDE_MODES: RideModeOption[] = [
    {
        id: "bike",
        name: "Moto / Bike",
        description: "Fastest through traffic",
        icon: <Bike className="h-5 w-5" />,
        multiplier: 0.7,
        etaMinutes: 3,
    },
    {
        id: "auto",
        name: "Auto Rickshaw",
        description: "Affordable local ride",
        icon: <Sparkles className="h-5 w-5" />,
        multiplier: 0.9,
        etaMinutes: 5,
    },
    {
        id: "car",
        name: "Comfort Car",
        description: "Spacious & air-conditioned",
        icon: <Car className="h-5 w-5" />,
        multiplier: 1.2,
        etaMinutes: 7,
    },
];

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const BODY_FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

function formatPaiseToRupee(amount: number | null | undefined): string {
    if (amount == null) return "0.00";
    const rupees = amount > 1000 ? amount / 100 : amount; 
    return rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ChooseMode() {
    const navigate = useNavigate();
    const { user } = useAuthContext();

    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
    const [rideData, setRideData] = useState<any>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingRide, setIsCreatingRide] = useState(false);
    const [selectedMode, setSelectedMode] = useState<"bike" | "auto" | "car">("car");

    useEffect(() => {
        const savedData = sessionStorage.getItem("pendingRide");
        if (!savedData) {
            setError("No route details found. Please start over.");
            setIsLoading(false);
            return;
        }

        const parsed = JSON.parse(savedData);
        setRideData(parsed);

        let cancelled = false;
        (async () => {
            try {
                const pLat = parsed.pickupCoords.latitude;
                const pLon = parsed.pickupCoords.longitude;
                const dLat = parsed.destinationCoords.latitude;
                const dLon = parsed.destinationCoords.longitude;
                const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";

                const url = `https://api.geoapify.com/v1/routing?waypoints=${pLat},${pLon}|${dLat},${dLon}&mode=drive&apiKey=${apiKey}`;
                const routeRes = await fetch(url);
                const routeDataRes = await routeRes.json();

                if (!cancelled && routeDataRes?.features?.[0]?.geometry?.coordinates) {
                    const coords = routeDataRes.features[0].geometry.coordinates;
                    const flatCoords: [number, number][] = [];
                    coords.forEach((line: [number, number][]) => {
                        line.forEach(([lon, lat]) => {
                            flatCoords.push([lat, lon]);
                        });
                    });
                    setRoutePolyline(flatCoords);
                }
            } catch {
                if (!cancelled) setError("Unable to load route polyline.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleConfirmAndStart = async () => {
        if (!rideData) return;
        setIsCreatingRide(true);
        try {
            const activeModeObj = RIDE_MODES.find(m => m.id === selectedMode);
            const baseFareValue = rideData.routeDistance ? Math.round((rideData.routeDistance / 100) * 5) : 160;
            const calculatedFare = Math.round(baseFareValue * (activeModeObj?.multiplier || 1));

            // Create ride document in MongoDB now with vehicleType and estimated fare
            const response = await appApi.post<{ message: string; ride: { _id: string } }>("/ride", {
                rider: user?._id,
                vehicleType: selectedMode,
                pickup: { address: rideData.pickup, coordinates: rideData.pickupCoords },
                destination: { address: rideData.destination, coordinates: rideData.destinationCoords },
                fare: { estimated: calculatedFare },
                distance: { estimated: rideData.routeDistance ? Number((rideData.routeDistance / 1000).toFixed(1)) : 5 },
                duration: { estimated: rideData.routeDuration ? Math.round(rideData.routeDuration / 60) : 14 },
            });

            // Clean up temporary session storage backup
            sessionStorage.removeItem("pendingRide");

            // Redirect to active live tracking & matching screen
            navigate(`/ride/${response.data.ride._id}`, { replace: true });
        } catch {
            setError("Unable to create ride request. Please try again.");
            setIsCreatingRide(false);
        }
    };

    if (isLoading) {
        return (
            <div 
                className="grid min-h-screen place-items-center bg-[#EFEBE9] text-[#3E2723]"
                style={{ fontFamily: BODY_FONT }}
            >
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-[#5D4037]" />
                    <p className="text-sm font-medium">Preparing your journey options...</p>
                </div>
            </div>
        );
    }

    if (!rideData || error) {
        return (
            <div 
                className="grid min-h-screen place-items-center bg-[#EFEBE9] px-6 text-center text-[#3E2723]"
                style={{ fontFamily: BODY_FONT }}
            >
                <div>
                    <p className="text-lg font-semibold">{error || "Invalid session data"}</p>
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

    const baseFareValue = rideData.routeDistance ? Math.round((rideData.routeDistance / 100) * 5) : 160;

    return (
        <div 
            className="relative h-screen w-screen overflow-hidden bg-[#EFEBE9] text-[#3E2723]"
            style={{ fontFamily: BODY_FONT }}
        >
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
            `}</style>

            {/* UPPER MAP VIEW (Takes upper 50% of screen height) */}
            <div className="absolute inset-x-0 top-0 z-0 h-[50vh] w-full">
                <MapView
                    center={{
                        lat: rideData.pickupCoords.latitude,
                        lng: rideData.pickupCoords.longitude,
                    }}
                    zoom={14}
                    markers={[
                        {
                            position: {
                                lat: rideData.pickupCoords.latitude,
                                lng: rideData.pickupCoords.longitude,
                            },
                            label: "P",
                            title: "Pickup",
                        },
                        {
                            position: {
                                lat: rideData.destinationCoords.latitude,
                                lng: rideData.destinationCoords.longitude,
                            },
                            label: "D",
                            title: "Destination",
                        },
                    ]}
                    path={
                        routePolyline.length > 0
                            ? routePolyline.map(([lat, lng]) => ({ lat, lng }))
                            : [
                                  {
                                      lat: rideData.pickupCoords.latitude,
                                      lng: rideData.pickupCoords.longitude,
                                  },
                                  {
                                      lat: rideData.destinationCoords.latitude,
                                      lng: rideData.destinationCoords.longitude,
                                  },
                              ]
                    }
                />
            </div>

            {/* FLOATING BACK BUTTON */}
            <div className="absolute top-4 left-4 z-30">
                <button
                    onClick={() => navigate("/dashboard")}
                    className="grid h-11 w-11 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0]/95 text-[#5D4037] shadow-lg backdrop-blur-xl transition hover:bg-[#FAF6F0]"
                    aria-label="Back"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
            </div>

            {/* BOTTOM TICKET PANEL WITH VEHICLE MODE OPTIONS */}
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 26 }}
                className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[32px] border-t border-[#D7CCC8] bg-[#FAF6F0]/95 px-6 pt-5 pb-8 shadow-2xl backdrop-blur-xl max-h-[55vh] overflow-y-auto"
            >
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#D7CCC8]" />

                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#795548]">
                            Select Ride Category
                        </p>
                        <h2 
                            className="text-xl font-bold text-[#3E2723]"
                            style={{ fontFamily: DISPLAY_FONT }}
                        >
                            Choose your ride mode
                        </h2>
                    </div>
                </div>

                {/* THREE OPTIONS (BIKE, AUTO, CAR) */}
                <div className="space-y-2.5">
                    {RIDE_MODES.map((mode) => {
                        const isSelected = selectedMode === mode.id;
                        const calculatedFare = Math.round(baseFareValue * mode.multiplier);

                        return (
                            <motion.div
                                key={mode.id}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedMode(mode.id)}
                                className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all ${
                                    isSelected
                                        ? "border-[#5D4037] bg-[#EFEBE9] shadow-md ring-1 ring-[#5D4037]"
                                        : "border-[#D7CCC8] bg-[#FAF6F0] hover:bg-[#EFEBE9]/50"
                                }`}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className={`grid h-12 w-12 place-items-center rounded-xl shadow-sm transition-colors ${
                                        isSelected 
                                            ? "bg-[#5D4037] text-[#FAF6F0]" 
                                            : "bg-[#EFEBE9] text-[#5D4037]"
                                    }`}>
                                        {mode.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-[#3E2723]">{mode.name}</p>
                                            {isSelected && (
                                                <span className="grid h-4 w-4 place-items-center rounded-full bg-[#5D4037] text-white">
                                                    <Check className="h-2.5 w-2.5" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-xs text-[#795548]">
                                            <span>{mode.description}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 font-medium text-[#3E2723]">
                                                <Clock className="h-3 w-3 text-[#795548]" />
                                                {mode.etaMinutes} mins away
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-base font-bold text-[#3E2723] flex items-center justify-end">
                                        <IndianRupee className="h-3.5 w-3.5 mr-0.5" />
                                        {formatPaiseToRupee(calculatedFare)}
                                    </p>
                                    <p className="text-[10px] uppercase font-semibold text-[#795548]">Estimated</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* CONFIRM & START RIDE BUTTON */}
                <div className="mt-5">
                    <Button
                        onClick={handleConfirmAndStart}
                        disabled={isCreatingRide}
                        className="w-full rounded-full bg-[#5D4037] py-6 text-sm font-semibold text-[#FAF6F0] shadow-lg hover:bg-[#4E342E] transition disabled:opacity-60"
                    >
                        {isCreatingRide ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Matching with drivers...
                            </span>
                        ) : (
                            "Confirm & Start Ride"
                        )}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}