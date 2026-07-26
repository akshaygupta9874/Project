import { useState, useMemo, useEffect } from "react";
import { motion, type Variants, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock3,
  Circle,
  Square,
  Loader2,
  Locate,
  ArrowRight,
  ShieldCheck,
  IndianRupee,
  Zap,
  Star,
  TrendingUp,
} from "lucide-react";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useNavigate } from "react-router-dom";
import { searchPlaces } from "./services/geoapify.service";



// ========== CONSOLE STYLESHEET ==========
function ConsoleStyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&display=swap');

      .console-display { font-family: 'Fraunces', ui-serif, Georgia, serif; letter-spacing: -0.01em; }
      .console-readout { font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
      
      .brass-text {
        background: linear-gradient(120deg, #A67C4E 0%, #F2CD7C 35%, #FBEBC9 50%, #F2CD7C 65%, #A67C4E 100%);
        background-size: 220% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: brassSheen 6s linear infinite;
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
      ::selection { background: #D9A521; color: #1B130C; }
    `}</style>
  );
}

// ========== PREMIUM CONSOLE BACKGROUND ==========
function PremiumConsoleBackground() {
  const embers = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
    id: i,
    left: (i * 137.5) % 100,
    delay: (i * 0.7) % 10,
    duration: 7 + ((i * 4) % 8),
    size: 1.5 + (i % 3),
    drift: ((i % 5) - 2) * 15,
  })), []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <ConsoleStyleSheet />
      {/* Premium gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a2218] via-[#3B2818] to-[#1B130C]" />

      {/* Breathing brass orbs */}
      <motion.div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#D9A521]/25 blur-3xl"
        animate={{ y: [0, 25, 0], x: [0, 15, 0], scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-[#F2CD7C]/15 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, -20, 0], scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-[#E8843A]/12 blur-3xl"
        animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Rising ember particles */}
      {embers.map(e => (
        <span
          key={`ember-${e.id}`}
          className="absolute bottom-0 rounded-full"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            backgroundColor: "#F2CD7C",
            boxShadow: "0 0 8px 1px rgba(242,205,124,0.85)",
            animation: `emberRise ${e.duration}s ease-in ${e.delay}s infinite`,
            "--drift": `${e.drift}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Scanline effect */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,.1),rgba(0,0,0,.1)_1px,transparent_1px,transparent_2px)] opacity-20" />
    </div>
  );
}

// ========== ROTATING WORD ANIMATION ==========
function RotatingWord() {
  const words = ["anywhere", "everywhere", "far", "forward"];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent(p => (p + 1) % words.length), 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.span
      key={words[current]}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      className="brass-text"
    >
      {words[current]}
    </motion.span>
  );
}

// ========== LIVE CHIP ==========
function LiveChip() {
  return (
    <motion.div
      className="inline-flex items-center gap-2 rounded-full border border-[#D9A521]/40 bg-[#241a10]/70 px-3.5 py-1.5 text-xs font-semibold text-[#F2CD7C] shadow-lg shadow-[#D9A521]/20 backdrop-blur"
      whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(217,165,33,0.4)" }}
    >
      <motion.span
        className="h-2 w-2 rounded-full bg-[#F2CD7C]"
        animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span>Live · Booking ready</span>
    </motion.div>
  );
}

// ========== MAIN LANDING PAGE ==========
export default function LandingPage() {
  const navigate = useNavigate();
  const [currentLocationName, setCurrentLocationName] = useState("Kolkata, IN");
  const [isDetectingCity, setIsDetectingCity] = useState(false);

  // Input & Pricing States
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<any[]>([]);
  const [activeField, setActiveField] = useState<"pickup" | "destination" | null>(null);

  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [isLocatingPickup, setIsLocatingPickup] = useState(false);

  // Pricing display state
  const [isCalculatingPrices, setIsCalculatingPrices] = useState(false);
  const [pricingError, setPricingError] = useState("");

  // Detect user's current city on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      setIsDetectingCity(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
            const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`);
            const data = await res.json();
            if (data?.features?.[0]?.properties) {
              const prop = data.features[0].properties;
              const city = prop.city || prop.town || prop.county || "Kolkata";
              const country = prop.country_code ? prop.country_code.toUpperCase() : "IN";
              setCurrentLocationName(`${city}, ${country}`);
            }
          } catch {
            // keep fallback
          } finally {
            setIsDetectingCity(false);
          }
        },
        () => { setIsDetectingCity(false); },
        { timeout: 8000 }
      );
    }
  }, []);

  // Place Autocomplete Effect for Pickup
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeField === "pickup" && pickup.trim().length > 2) {
        setIsSearchingPickup(true);
        try {
          const features = await searchPlaces(pickup);
          setPickupSuggestions(features || []);
        } catch {
          setPickupSuggestions([]);
        } finally {
          setIsSearchingPickup(false);
        }
      } else {
        setIsSearchingPickup(false);
        setPickupSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pickup, activeField]);

  // Place Autocomplete Effect for Destination
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeField === "destination" && destination.trim().length > 2) {
        setIsSearchingDestination(true);
        try {
          const features = await searchPlaces(destination);
          setDestinationSuggestions(features || []);
        } catch {
          setDestinationSuggestions([]);
        } finally {
          setIsSearchingDestination(false);
        }
      } else {
        setIsSearchingDestination(false);
        setDestinationSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination, activeField]);

  const handleSelectPlace = (feature: any, type: "pickup" | "destination") => {
    const address = feature.properties?.formatted || feature.properties?.name || "Selected Location";
    const [longitude, latitude] = feature.geometry?.coordinates || [0, 0];
    if (type === "pickup") {
      setPickup(address);
      setPickupCoords({ latitude, longitude });
      setPickupSuggestions([]);
    } else {
      setDestination(address);
      setDestinationCoords({ latitude, longitude });
      setDestinationSuggestions([]);
    }
    setActiveField(null);
  };

  const handleUseCurrentLocationForPickup = () => {
    setPricingError("");
    if (!navigator.geolocation) {
      setPricingError("Geolocation is not supported.");
      return;
    }
    setIsLocatingPickup(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPickupCoords({ latitude, longitude });
        setPickup(`Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        setIsLocatingPickup(false);
      },
      (error) => {
        setPricingError(`Unable to retrieve location: ${error.message}`);
        setIsLocatingPickup(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSeePricesClick = async () => {
    if (!pickup.trim() || !destination.trim()) {
      setPricingError("Please fill in both pickup and dropoff locations.");
      return;
    }
    setPricingError("");
    setIsCalculatingPrices(true);

    try {
      if (pickupCoords && destinationCoords) {
        const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || "";
        const url = `https://api.geoapify.com/v1/routing?waypoints=${pickupCoords.latitude},${pickupCoords.longitude}|${destinationCoords.latitude},${destinationCoords.longitude}&mode=drive&apiKey=${apiKey}`;
        const res = await fetch(url);
        // Distance data fetched for potential future use
        await res.json();
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      // keep fallback
    } finally {
      setIsCalculatingPrices(false);
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.1, delayChildren: 0.2, duration: 0.8 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <div className="console-root relative min-h-screen overflow-hidden bg-[#1B130C]">
      <PremiumConsoleBackground />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-between gap-16 px-6 py-12 lg:flex-row lg:py-20">
        {/* LEFT CONTENT */}
        <motion.div
          className="flex-1 space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Status Chips */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
            <LiveChip />
            <motion.div
              className="inline-flex items-center gap-2 rounded-full border border-[#D9A521]/30 bg-[#241a10]/60 px-3.5 py-1.5 text-xs font-medium text-[#F2CD7C] backdrop-blur"
              whileHover={{ scale: 1.05 }}
            >
              <TrendingUp size={12} />
              Premium booking experience
            </motion.div>
          </motion.div>

          {/* Location Badge */}
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-sm text-[#C9AE86]">
            <MapPin size={18} className="text-[#D9A521]" />
            <span className="font-medium">
              {isDetectingCity ? "Detecting location..." : currentLocationName}
            </span>
            <button className="text-[#8D7350] hover:text-[#F2CD7C] transition-colors underline-offset-2 hover:underline">
              Change city
            </button>
          </motion.div>

          {/* Main Headline */}
          <motion.h1 variants={itemVariants} className="console-display text-6xl sm:text-7xl lg:text-8xl font-bold leading-tight tracking-tight">
            <div className="text-[#F6ECDA]">Your Ride</div>
            <div className="brass-text">Go <RotatingWord /></div>
          </motion.h1>

          {/* Subheading */}
          <motion.p variants={itemVariants} className="max-w-md text-lg text-[#C9AE86] leading-relaxed">
            Premium ride-booking experience with real-time tracking, instant pricing, and unmatched safety standards.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-4">
            <Button
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#D9A521] to-[#B8860B] px-8 py-3.5 font-semibold text-white shadow-lg shadow-[#D9A521]/40 hover:shadow-[#F2CD7C]/50 transition-all hover:scale-105 active:scale-95"
              onClick={() => navigate("/dashboard")}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Zap size={18} />
                Book a Ride
              </span>
              <motion.span
                className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25"
                animate={{ x: ["0%", "400%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            </Button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-xl border border-[#D9A521]/40 bg-[#241a10]/60 px-6 py-3.5 font-semibold text-[#F2CD7C] backdrop-blur hover:border-[#F2CD7C]/60 transition-all"
              onClick={() => navigate("/login")}
            >
              Sign In
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        </motion.div>

        {/* RIGHT: BOOKING CARD */}
        <motion.div
          className="flex-1 w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <motion.div className="rounded-2xl border border-[#D9A521]/30 bg-[#241a10]/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-[#D9A521]/10">
            {/* Form Header */}
            <div className="mb-6 space-y-2">
              <h2 className="console-display text-2xl font-bold text-[#F6ECDA]">Book Your Ride</h2>
              <p className="text-sm text-[#8D7350]">Enter your destinations and get instant pricing</p>
            </div>

            {/* Pickup Input */}
            <motion.div className="mb-4 relative group" whileTap={{ scale: 1.01 }}>
              <label className="block text-xs uppercase tracking-widest text-[#C9AE86] font-semibold mb-2">Pickup</label>
              <div className="relative">
                <Circle className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D9A521]/60 group-focus-within:text-[#F2CD7C] transition-colors" />
                <motion.div className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D9A521]/40 via-[#F2CD7C]/20 to-[#D9A521]/40 opacity-0 blur group-focus-within:opacity-100 transition-opacity" />
                <Input
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setActiveField("pickup");
                    setPickupCoords(null);
                  }}
                  onFocus={() => setActiveField("pickup")}
                  placeholder="Pickup location"
                  className="relative rounded-xl border border-[#7A5230]/40 bg-[#1B130C] pl-12 pr-12 py-3.5 text-[#F6ECDA] placeholder-[#8D7350] shadow-lg shadow-[#D9A521]/10 backdrop-blur transition-all focus:border-[#F2CD7C]/60 focus:bg-[#241a10] focus:shadow-lg focus:shadow-[#D9A521]/30"
                />
                <button
                  type="button"
                  onClick={handleUseCurrentLocationForPickup}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-br from-[#D9A521] to-[#B8860B] p-2 text-white hover:scale-110 active:scale-95 transition-all shadow-lg shadow-[#D9A521]/30"
                >
                  {isLocatingPickup ? <Loader2 className="animate-spin" size={18} /> : <Locate size={18} />}
                </button>
              </div>
              {/* Pickup Suggestions */}
              <AnimatePresence>
                {isSearchingPickup && (
                  <motion.div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-[#7A5230]/40 bg-[#1B130C] backdrop-blur p-2 z-50">
                    <Loader2 className="animate-spin text-[#D9A521] mx-auto" size={20} />
                  </motion.div>
                )}
                {pickupSuggestions.length > 0 && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-[#7A5230]/40 bg-[#1B130C] backdrop-blur shadow-xl z-50"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {pickupSuggestions.slice(0, 5).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPlace(suggestion, "pickup")}
                        className="w-full px-4 py-2 text-left text-sm text-[#C9AE86] hover:bg-[#241a10]/60 hover:text-[#F2CD7C] transition-colors border-b border-[#7A5230]/20 last:border-0"
                      >
                        {suggestion.properties?.formatted || suggestion.properties?.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Destination Input */}
            <motion.div className="mb-6 relative group" whileTap={{ scale: 1.01 }}>
              <label className="block text-xs uppercase tracking-widest text-[#C9AE86] font-semibold mb-2">Dropoff</label>
              <div className="relative">
                <Square className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D9A521]/60 group-focus-within:text-[#F2CD7C] transition-colors" />
                <motion.div className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D9A521]/40 via-[#F2CD7C]/20 to-[#D9A521]/40 opacity-0 blur group-focus-within:opacity-100 transition-opacity" />
                <Input
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setActiveField("destination");
                    setDestinationCoords(null);
                  }}
                  onFocus={() => setActiveField("destination")}
                  placeholder="Dropoff location"
                  className="relative rounded-xl border border-[#7A5230]/40 bg-[#1B130C] pl-12 pr-4 py-3.5 text-[#F6ECDA] placeholder-[#8D7350] shadow-lg shadow-[#D9A521]/10 backdrop-blur transition-all focus:border-[#F2CD7C]/60 focus:bg-[#241a10] focus:shadow-lg focus:shadow-[#D9A521]/30"
                />
              </div>
              {/* Destination Suggestions */}
              <AnimatePresence>
                {isSearchingDestination && (
                  <motion.div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-[#7A5230]/40 bg-[#1B130C] backdrop-blur p-2 z-50">
                    <Loader2 className="animate-spin text-[#D9A521] mx-auto" size={20} />
                  </motion.div>
                )}
                {destinationSuggestions.length > 0 && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-[#7A5230]/40 bg-[#1B130C] backdrop-blur shadow-xl z-50"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {destinationSuggestions.slice(0, 5).map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectPlace(suggestion, "destination")}
                        className="w-full px-4 py-2 text-left text-sm text-[#C9AE86] hover:bg-[#241a10]/60 hover:text-[#F2CD7C] transition-colors border-b border-[#7A5230]/20 last:border-0"
                      >
                        {suggestion.properties?.formatted || suggestion.properties?.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Error Message */}
            {pricingError && (
              <motion.div className="mb-4 rounded-lg border border-[#B54834]/40 bg-[#B54834]/10 px-4 py-3 text-sm text-[#E2A08E]">
                {pricingError}
              </motion.div>
            )}

            {/* Book Button */}
            <Button
              className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#D9A521] via-[#E8A845] to-[#B8860B] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#D9A521]/40 hover:shadow-[#F2CD7C]/50 transition-all hover:scale-105 active:scale-95"
              onClick={handleSeePricesClick}
              disabled={isCalculatingPrices}
            >
              <div className="relative z-10 flex items-center justify-center gap-2">
                {isCalculatingPrices ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    See Prices
                  </>
                )}
              </div>
              <motion.span
                className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/30"
                animate={{ x: ["0%", "400%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            </Button>

            {/* Features Grid */}
            <motion.div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: ShieldCheck, label: "Safe & Secure" },
                { icon: Star, label: "Trusted Drivers" },
                { icon: Clock3, label: "Quick Pickup" },
                { icon: IndianRupee, label: "Best Prices" },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  className="rounded-lg border border-[#D9A521]/20 bg-[#1B130C]/60 p-3 text-center backdrop-blur"
                  whileHover={{ scale: 1.05, borderColor: "#F2CD7C" }}
                >
                  <feature.icon className="h-5 w-5 text-[#D9A521] mx-auto mb-1" />
                  <p className="text-xs font-semibold text-[#C9AE86]">{feature.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
