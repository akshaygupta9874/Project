import { useState, useMemo, useEffect } from "react";
import { motion, type Variants, AnimatePresence } from "framer-motion";

import {
  MapPin,
  Clock3,
  ChevronDown,
  Circle,
  Square,
  Send,
  Navigation,
  Sparkles,
  Car,
  Star,
} from "lucide-react";

import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { useNavigate } from "react-router-dom";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

// ---------- Animated city map background ----------
function CityMapBackground() {
  const verticals = useMemo(
    () => [60, 140, 230, 320, 410, 500, 600, 700, 820, 940, 1060, 1180, 1300],
    [],
  );
  const horizontals = useMemo(() => [60, 140, 230, 330, 430, 540, 640, 740, 840], []);

  const pins = useMemo(
    () => [
      { x: 220, y: 200, delay: 0.2 },
      { x: 760, y: 140, delay: 1.1 },
      { x: 1080, y: 520, delay: 0.6 },
      { x: 340, y: 640, delay: 1.6 },
      { x: 980, y: 300, delay: 2.0 },
      { x: 540, y: 420, delay: 0.9 },
    ],
    [],
  );

  const routes = useMemo(
    () => [
      { d: "M -40 230 L 410 230 L 410 430 L 940 430 L 940 230 L 1380 230", dur: 14, delay: 0, color: "#0a0a0a" },
      { d: "M 1380 540 L 820 540 L 820 740 L 320 740 L 320 540 L -40 540", dur: 18, delay: 2, color: "#1a1a1a" },
      { d: "M 140 -40 L 140 330 L 600 330 L 600 640 L 1060 640 L 1060 900", dur: 16, delay: 4, color: "#0a0a0a" },
      { d: "M -40 130 L 500 130 L 500 540 L 1380 540", dur: 20, delay: 1.5, color: "#0a0a0a" },
    ],
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#fff_0%,#f3efe7_45%,#e9e2d2_100%)]" />

      <motion.div
        className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-[#0ea5e9]/15 blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-[520px] w-[520px] rounded-full bg-[#34d399]/20 blur-[120px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 30, 0], scale: [1, 0.9, 1.2, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b]/10 blur-[140px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.svg
        viewBox="0 0 1340 880"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-90"
        animate={{ x: [0, -24, 0, 18, 0], y: [0, 10, 0, -8, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      >
        {verticals.slice(0, -1).map((vx, i) =>
          horizontals.slice(0, -1).map((hy, j) => (
            <rect
              key={`b-${i}-${j}`}
              x={vx + 6}
              y={hy + 6}
              width={verticals[i + 1] - vx - 12}
              height={horizontals[j + 1] - hy - 12}
              fill={(i + j) % 3 === 0 ? "#e5dccb" : (i + j) % 3 === 1 ? "#ede5d4" : "#e0d6c2"}
              rx={3}
              opacity={0.55}
            />
          )),
        )}

        <path
          d="M -50 720 C 200 660, 420 780, 700 700 S 1200 560, 1400 620 L 1400 880 L -50 880 Z"
          fill="#bfdbfe"
          opacity="0.5"
        />

        {verticals.map((vx) => (
          <line key={`v-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#ffffff" strokeWidth={10} />
        ))}
        {horizontals.map((hy) => (
          <line key={`h-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#ffffff" strokeWidth={10} />
        ))}
        {verticals.map((vx) => (
          <line key={`vs-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#cbb98a" strokeWidth={1} strokeDasharray="6 10" />
        ))}
        {horizontals.map((hy) => (
          <line key={`hs-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#cbb98a" strokeWidth={1} strokeDasharray="6 10" />
        ))}

        {routes.map((r, idx) => (
          <g key={`route-${idx}`}>
            <path d={r.d} stroke={r.color} strokeOpacity={0.15} strokeWidth={5} fill="none" strokeLinecap="round" />
            <motion.path
              d={r.d}
              stroke={r.color}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="80 1600"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [-1680, 0] }}
              transition={{ duration: r.dur, delay: r.delay, repeat: Infinity, ease: "linear" }}
            />
            <circle r={7} fill="#0a0a0a" stroke="#fff" strokeWidth={3}>
              <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" begin={`${r.delay}s`} rotate="auto" path={r.d} />
            </circle>
          </g>
        ))}

        {pins.map((p, i) => (
          <g key={`pin-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <motion.circle
              r={6}
              fill="#0ea5e9"
              opacity={0.4}
              animate={{ r: [6, 26, 6], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
            />
            <circle r={5} fill="#0a0a0a" />
            <circle r={2} fill="#fff" />
          </g>
        ))}
      </motion.svg>

      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  );
}

// ---------- Rotating tagline ----------
const taglines = ["anywhere", "anytime", "in style", "with Uber"];
function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % taglines.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block min-w-[280px] align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={taglines[i]}
          initial={{ y: 40, opacity: 0, filter: "blur(8px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -40, opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block bg-gradient-to-r from-black via-neutral-700 to-black bg-clip-text text-transparent"
        >
          {taglines[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ---------- Floating live stats chip ----------
function LiveChip() {
  const [eta, setEta] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setEta((e) => (e <= 1 ? 6 : e - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-black/80 shadow-sm backdrop-blur-md"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Navigation size={12} />
      <span>Drivers nearby · {eta} min away</span>
    </motion.div>
  );
}

export default function LandingPage() {
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0ece2] font-sans text-black">
      <CityMapBackground />

     
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col items-center justify-between gap-16 px-8 py-10 lg:flex-row">
        {/* Left */}
        <motion.div className="flex-1" variants={containerVariants} initial="hidden" animate="visible">
          <motion.div variants={itemVariants} className="mb-5 flex flex-wrap items-center gap-3">
            <LiveChip />
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
              <Sparkles size={12} className="text-amber-500" />
              New · Schedule rides up to 30 days ahead
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6 flex items-center gap-2 text-base text-gray-800">
            <MapPin size={18} className="text-black" />
            <span className="font-medium">Kolkata, IN</span>
            <button className="text-gray-500 underline underline-offset-4 transition-colors hover:text-black">
              Change city
            </button>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="max-w-xl text-6xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
          >
            Go <RotatingWord />
            <br />
            with one tap.
          </motion.h1>

          <motion.p variants={itemVariants} className="mt-5 max-w-md text-base text-black/60">
            Request a ride, hop in, and relax. Real-time tracking, upfront pricing,
            and trusted drivers — wherever you're headed.
          </motion.p>

          <motion.div variants={itemVariants}>
            <button className="mt-7 flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow-sm ring-1 ring-black/5 transition-all hover:bg-black hover:text-white hover:shadow-lg active:scale-95">
              <Clock3 size={20} />
              <span className="text-base font-medium">Pickup now</span>
              <ChevronDown size={18} />
            </button>
          </motion.div>

          {/* Inputs */}
          <motion.div variants={itemVariants} className="mt-7 max-w-lg space-y-5">
            <div className="group relative">
              <motion.div
                className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400 opacity-0 blur transition duration-500"
                animate={{ opacity: isFocused ? 0.7 : 0 }}
              />
              <div
                className="relative"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              >
                <Circle className="absolute left-5 top-1/2 z-10 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-black" size={16} />
                <Input
                  placeholder="Pickup location"
                  className="h-16 w-full rounded-2xl border-2 border-transparent bg-white/90 pl-14 pr-14 text-lg shadow-sm backdrop-blur transition-all focus-within:border-black focus-within:bg-white focus-within:shadow-xl focus:outline-none"
                />
                <button className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-black p-2.5 text-white transition-all hover:scale-110">
                  <Send className="rotate-45" size={18} />
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-[27px] -top-6 h-10 w-0.5 overflow-hidden">
                <div className="h-full w-full bg-gray-300" />
                <motion.div
                  className="absolute top-0 left-0 h-full w-full origin-top bg-black"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: isFocused ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              </div>
              <Square
                className={`absolute left-5 top-1/2 z-10 -translate-y-1/2 transition-colors ${isFocused ? "text-black" : "text-gray-500"}`}
                size={16}
              />
              <Input
                placeholder="Dropoff location"
                className="h-16 w-full rounded-2xl border-2 border-transparent bg-white/90 pl-14 text-lg shadow-sm backdrop-blur transition-all focus-within:border-black focus-within:bg-white focus-within:shadow-xl focus:outline-none"
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-10 flex flex-wrap items-center gap-6">
            <Button
              className="group relative h-14 overflow-hidden rounded-2xl bg-black px-8 text-base text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
              onClick={() => navigate("/login")}
            >
              <span className="relative z-10">See prices</span>
              <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/20 transition-transform duration-700 group-hover:translate-x-[420%]" />
            </Button>
            <button
              type="button"
              className="group relative text-base font-medium text-gray-600 transition-colors hover:text-black"
              onClick={() => navigate("/login")}
            >
              Log in to see your recent activity
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-black transition-all duration-300 group-hover:w-full" />
            </button>
          </motion.div>

          {/* Trust row */}
          <motion.div variants={itemVariants} className="mt-10 flex items-center gap-6 text-sm text-black/60">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="font-semibold text-black">4.9</span>
              <span>· 130M+ riders</span>
            </div>
            <div className="hidden h-4 w-px bg-black/15 md:block" />
            <div className="hidden md:block">Available in 10,000+ cities</div>
          </motion.div>
        </motion.div>

        {/* Right */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
          className="relative hidden flex-1 justify-center lg:flex"
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-sky-300/40 via-transparent to-amber-300/40 blur-2xl" />
            <img
              src="https://cn-geo1.uber.com/image-proc/crop/resizecrop/udam/format=auto/width=1344/height=1344/srcb64=aHR0cHM6Ly90Yi1zdGF0aWMudWJlci5jb20vcHJvZC91ZGFtLWFzc2V0cy9jZTczNjUzMy1iMWE0LTQ3ZjktOTk0OS0zNWEzZGUyNTkyYzk="
              alt="Uber Journey"
              className="relative w-[460px] rounded-[2rem] object-cover shadow-2xl ring-1 ring-black/5"
            />

            {/* Top-left floating ETA card */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="absolute -left-8 top-10 flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
                <Car size={18} />
              </div>
              <div className="text-sm">
                <div className="font-semibold">UberX · 2 min</div>
                <div className="text-black/55">Arriving in Park Street</div>
              </div>
            </motion.div>

            {/* Right floating rating */}
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="absolute -right-6 top-1/2 flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur"
            >
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">5.0 trip</span>
            </motion.div>

            {/* Bottom card */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -bottom-6 left-1/2 flex w-[88%] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#B67863] px-6 py-5 text-white shadow-xl backdrop-blur"
            >
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Ready to travel?</h2>
                <p className="text-sm opacity-90">Plan your ride in advance.</p>
              </div>
              <Button className="rounded-full bg-white px-6 font-semibold text-black transition-transform hover:scale-105 hover:bg-gray-100">
                Schedule
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
