import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import { QrCode, Navigation, Car, Bike, Zap, Star, Shield, Fingerprint, Loader2 } from "lucide-react";
import api from "./apiInterceptor";
import { AxiosError } from "axios";
import { useAuthContext } from "./context/authContext";

// ---------- Form animation (unchanged) ----------
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.25,
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

/* ---------------------------------------------------------------------- */
/* Golden-brown "instrument console" style sheet                          */
/* ---------------------------------------------------------------------- */

function LoginStyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500;700&display=swap');

      .brass-display { font-family: 'Fraunces', ui-serif, Georgia, serif; letter-spacing: -0.01em; }
      .brass-readout {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
      }
      .brass-text {
        background: linear-gradient(120deg, #A67C4E 0%, #F2CD7C 35%, #FBEBC9 50%, #F2CD7C 65%, #A67C4E 100%);
        background-size: 220% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: brassSheen 7s linear infinite;
      }
      @keyframes brassSheen {
        0% { background-position: 0% center; }
        100% { background-position: -220% center; }
      }
      @keyframes emberRise {
        0% { transform: translateY(0) translateX(0) scale(0.6); opacity: 0; }
        10% { opacity: 0.9; }
        90% { opacity: 0.35; }
        100% { transform: translateY(-160px) translateX(var(--drift, 12px)) scale(1); opacity: 0; }
      }
      @keyframes dialGlow {
        0%, 100% { filter: drop-shadow(0 0 6px rgba(217,165,33,0.35)); }
        50% { filter: drop-shadow(0 0 18px rgba(217,165,33,0.7)); }
      }
      @keyframes digitIn {
        0% { opacity: 0.25; filter: blur(2px); }
        100% { opacity: 1; filter: blur(0); }
      }
      .digit-flicker { animation: digitIn 0.45s ease-out; }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
        }
      }
    `}</style>
  );
}

function EmberField({ count = 14 }: { count?: number }) {
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

/* ---------------------------------------------------------------------- */
/* Animated night-map background — same composition, gold/espresso palette */
/* ---------------------------------------------------------------------- */

function CityMapBackground() {
  const verticals = useMemo(() => [60, 140, 230, 320, 410, 500, 600, 700, 820, 940, 1060, 1180, 1300], []);
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
      { d: "M -40 230 L 410 230 L 410 430 L 940 430 L 940 230 L 1380 230", dur: 14, delay: 0 },
      { d: "M 1380 540 L 820 540 L 820 740 L 320 740 L 320 540 L -40 540", dur: 18, delay: 2 },
      { d: "M 140 -40 L 140 330 L 600 330 L 600 640 L 1060 640 L 1060 900", dur: 16, delay: 4 },
    ],
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Espresso base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#241a10_0%,#160F09_55%,#0D0904_100%)]" />

      {/* Drifting brass/amber ambient blobs */}
      <motion.div
        className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-[#D9A521]/15 blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-[520px] w-[520px] rounded-full bg-[#E8843A]/12 blur-[120px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, 30, 0], scale: [1, 0.9, 1.2, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* City grid, slowly panning like a rally GPS */}
      <motion.svg
        viewBox="0 0 1340 880"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        animate={{ x: [0, -24, 0, 18, 0], y: [0, 10, 0, -8, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="riverGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D9A521" stopOpacity="0.22" />
            <stop offset="50%" stopColor="#F2CD7C" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#7A5230" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        {/* City blocks (subtle warm fills) */}
        {verticals.slice(0, -1).map((vx, i) =>
          horizontals.slice(0, -1).map((hy, j) => (
            <rect
              key={`b-${i}-${j}`}
              x={vx + 6}
              y={hy + 6}
              width={verticals[i + 1] - vx - 12}
              height={horizontals[j + 1] - hy - 12}
              fill={(i + j) % 3 === 0 ? "#2B1D12" : (i + j) % 3 === 1 ? "#332212" : "#241a10"}
              rx={3}
              opacity={0.65}
            />
          )),
        )}

        {/* Glowing boulevard diagonal */}
        <path
          d="M -50 720 C 200 660, 420 780, 700 700 S 1200 560, 1400 620 L 1400 880 L -50 880 Z"
          fill="url(#riverGlow)"
        />

        {/* Streets */}
        {verticals.map((vx) => (
          <line key={`v-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#3B2818" strokeWidth={9} />
        ))}
        {horizontals.map((hy) => (
          <line key={`h-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#3B2818" strokeWidth={9} />
        ))}

        {/* Gold lane stripes */}
        {verticals.map((vx) => (
          <line
            key={`vs-${vx}`}
            x1={vx}
            y1={-20}
            x2={vx}
            y2={900}
            stroke="#D9A521"
            strokeWidth={1}
            strokeOpacity={0.35}
            strokeDasharray="6 10"
          />
        ))}
        {horizontals.map((hy) => (
          <line
            key={`hs-${hy}`}
            x1={-20}
            y1={hy}
            x2={1360}
            y2={hy}
            stroke="#D9A521"
            strokeWidth={1}
            strokeOpacity={0.35}
            strokeDasharray="6 10"
          />
        ))}

        {/* Glowing routes being traced, with a light-trail car */}
        {routes.map((r, idx) => (
          <g key={`route-${idx}`}>
            <path d={r.d} stroke="#F2CD7C" strokeOpacity={0.12} strokeWidth={5} fill="none" strokeLinecap="round" />
            <motion.path
              d={r.d}
              stroke="#F2CD7C"
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="60 1600"
              style={{ filter: "drop-shadow(0 0 5px rgba(242,205,124,0.65))" }}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [-1660, 0] }}
              transition={{ duration: r.dur, delay: r.delay, repeat: Infinity, ease: "linear" }}
            />
            <motion.circle r={6} fill="#F2CD7C" stroke="#160F09" strokeWidth={2.5}>
              <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" begin={`${r.delay}s`} rotate="auto" path={r.d} />
            </motion.circle>
          </g>
        ))}

        {/* Pulsing gold pickup pins */}
        {pins.map((p, i) => (
          <g key={`pin-${i}`} transform={`translate(${p.x} ${p.y})`}>
            <motion.circle
              r={6}
              fill="#D9A521"
              opacity={0.4}
              animate={{ r: [6, 26, 6], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.4, delay: p.delay, repeat: Infinity, ease: "easeOut" }}
            />
            <circle r={5} fill="#7A5230" stroke="#F2CD7C" strokeWidth={1.5} />
            <circle r={2} fill="#FBEBC9" />
          </g>
        ))}
      </motion.svg>

      {/* Fades to base for legibility */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#160F09]/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#160F09]/85 to-transparent" />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Small reusable atoms                                                   */
/* ---------------------------------------------------------------------- */

function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20, mass: 0.6 });
  const display = useTransform(spring, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);
  return <motion.span className="digit-flicker">{display}</motion.span>;
}

function GlowField({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        className={`pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D9A521] via-[#E8843A] to-[#7A5230] opacity-0 blur transition duration-500 ${
          focused ? "opacity-70" : ""
        }`}
      />
      {children}
    </div>
  );
}

function ShineButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  variant?: "primary" | "muted";
}) {
  const styles: Record<string, string> = {
    primary: "bg-gradient-to-br from-[#D9A521] via-[#B8860B] to-[#7A5230] text-[#1B130C]",
    muted: "bg-gradient-to-br from-[#3B2818] via-[#2B1D12] to-[#1D140D] text-[#F2CD7C] border border-[#7A5230]",
  };
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18 });
  const sy = useSpring(y, { stiffness: 220, damping: 18 });
  const [ripples, setRipples] = useState<{ id: number; left: number; top: number }[]>([]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.15);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.25);
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
      type={type}
      style={{ x: sx, y: sy }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      onClick={handleClick}
      disabled={disabled}
      className={`relative overflow-hidden rounded-xl px-6 py-4 text-lg font-medium shadow-lg shadow-black/30 transition-shadow disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A521] focus-visible:ring-offset-2 focus-visible:ring-offset-[#160F09] ${styles[variant]} ${className}`}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
      {!disabled && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
          animate={{ x: ["-50%", "450%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-white/30"
          style={{ left: r.left, top: r.top, translateX: "-50%", translateY: "-50%" }}
          initial={{ width: 0, height: 0, opacity: 0.5 }}
          animate={{ width: 220, height: 220, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </motion.button>
  );
}

/* ---------------------------------------------------------------------- */
/* Live ambient pills                                                     */
/* ---------------------------------------------------------------------- */

function EtaPill() {
  const [eta, setEta] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setEta((e) => (e <= 1 ? 5 : e - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="inline-flex items-center gap-2 rounded-full border border-[#7A5230]/60 bg-[#241a10]/80 px-3.5 py-1.5 text-xs font-medium text-[#F6ECDA] shadow-sm backdrop-blur-md"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Navigation size={12} className="text-[#D9A521]" />
      <span className="brass-readout">
        Drivers nearby · arriving in <AnimatedNumber value={eta} /> min
      </span>
    </motion.div>
  );
}

function DriversOnlinePill() {
  const [count, setCount] = useState(1240);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => Math.max(300, c + (Math.floor(Math.random() * 7) - 3))), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.75, duration: 0.6 }}
      className="inline-flex items-center gap-2 rounded-full border border-[#7A5230]/60 bg-[#241a10]/80 px-3.5 py-1.5 text-xs font-medium text-[#C9AE86] shadow-sm backdrop-blur-md"
    >
      <Car className="h-3 w-3 text-[#D9A521]" />
      <span className="brass-readout">
        <AnimatedNumber value={count} /> drivers active nearby
      </span>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Prototype ride-booking flourishes (decorative, self-contained)         */
/* ---------------------------------------------------------------------- */

type RideKind = "BIKE" | "AUTO" | "CAR" | "PREMIUM";

const RIDE_KINDS: { key: RideKind; label: string; icon: React.ComponentType<{ className?: string }>; eta: string }[] = [
  { key: "BIKE", label: "Bike", icon: Bike, eta: "2 min" },
  { key: "AUTO", label: "Auto", icon: Zap, eta: "3 min" },
  { key: "CAR", label: "Car", icon: Car, eta: "4 min" },
  { key: "PREMIUM", label: "Premium", icon: Star, eta: "6 min" },
];

function VehicleQuickSelect() {
  const [selected, setSelected] = useState<RideKind>("CAR");
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8D7350]">
        Quick preview · pick a ride
      </p>
      <div className="grid grid-cols-4 gap-2">
        {RIDE_KINDS.map((rk) => {
          const active = rk.key === selected;
          return (
            <motion.button
              key={rk.key}
              type="button"
              onClick={() => setSelected(rk.key)}
              whileTap={{ scale: 0.94 }}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors ${
                active
                  ? "border-[#D9A521] bg-gradient-to-br from-[#3B2818] to-[#2B1D12] text-[#F2CD7C] shadow-[0_0_0_1px_rgba(217,165,33,0.3)]"
                  : "border-[#5A4128] bg-[#160F09]/40 text-[#8D7350] hover:border-[#7A5230] hover:text-[#C9AE86]"
              }`}
            >
              <rk.icon className="h-4 w-4" />
              <span className="text-[10px] font-semibold">{rk.label}</span>
              <span className="brass-readout text-[9px] opacity-70">{rk.eta}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function BiometricButton() {
  const [hint, setHint] = useState(false);
  return (
    <div className="relative">
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          setHint(true);
          setTimeout(() => setHint(false), 2200);
        }}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#7A5230]/60 bg-[#241a10]/70 py-3.5 text-base font-medium text-[#F6ECDA] transition-all hover:border-[#D9A521]/50 hover:bg-[#2B1D12] active:scale-[0.98]"
      >
        <Fingerprint className="h-5 w-5 text-[#D9A521]" />
        Use Face ID / Fingerprint
      </motion.button>
      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 -bottom-5 text-center text-[11px] text-[#C9AE86]"
          >
            Biometric sign-in is coming soon
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrustStrip() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.1, duration: 0.6 }}
      className="mt-8 flex items-center justify-center gap-6 text-center"
    >
      <div>
        <p className="brass-readout text-lg font-bold text-[#F2CD7C]">
          4.9<span className="text-[#8D7350]">★</span>
        </p>
        <p className="text-[10px] uppercase tracking-wider text-[#8D7350]">Rider rating</p>
      </div>
      <div className="h-8 w-px bg-[#3B2818]" />
      <div>
        <p className="brass-readout text-lg font-bold text-[#F2CD7C]">
          <AnimatedNumber value={2100000} format={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M+` : Math.round(v).toLocaleString())} />
        </p>
        <p className="text-[10px] uppercase tracking-wider text-[#8D7350]">Rides completed</p>
      </div>
      <div className="h-8 w-px bg-[#3B2818]" />
      <div>
        <p className="brass-readout text-lg font-bold text-[#F2CD7C]">
          <AnimatedNumber value={180} format={(v) => `${Math.round(v)}+`} />
        </p>
        <p className="text-[10px] uppercase tracking-wider text-[#8D7350]">Cities</p>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Main component — auth logic below is unchanged from the original       */
/* ---------------------------------------------------------------------- */

export default function LoginPage() {
  const navigate = useNavigate();
  const { checkAuthentication, isAuthenticated, loading } = useAuthContext();
  const [isFocused, setIsFocused] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New, purely visual focus states for the added glow treatment — additive only.
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isOtpFocused, setIsOtpFocused] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsSubmitting(true);

    try {
      const { data } = await api.post<{ message: string }>("/login", {
        email,
        password,
      });
      setStatus(data.message);
      setShowOtp(true);
    } catch (error) {
      setStatus(error instanceof AxiosError ? error.response?.data.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setStatus("");
    setIsSubmitting(true);

    try {
      const { data } = await api.post<{ message: string }>("/verify-otp", {
        email,
        otp,
      });
      setStatus(data.message);
      await checkAuthentication();
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setStatus(error instanceof AxiosError ? error.response?.data.message : "OTP verification failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#160F09] font-sans text-[#F6ECDA]">
      <LoginStyleSheet />
      <CityMapBackground />
      <EmberField />

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-10">
        {/* brass badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 16 }}
          className="mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#7A5230] bg-gradient-to-br from-[#D9A521] via-[#B8860B] to-[#5A3D24] shadow-lg"
          style={{ animation: "dialGlow 3s ease-in-out infinite" }}
        >
          <Car className="h-5 w-5 text-[#1B130C]" />
        </motion.div>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <EtaPill />
          <DriversOnlinePill />
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-[#7A5230]/60 bg-[#1D140D]/85 p-8 pt-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:p-10"
        >
          {/* Moving brass sheen */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-[#F2CD7C]/25 to-transparent"
            animate={{ x: ["0%", "420%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
          />

          <motion.h2 variants={itemVariants} className="brass-display brass-text mb-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Where to next?
          </motion.h2>
          <motion.p variants={itemVariants} className="mb-6 text-sm text-[#C9AE86]">
            Sign in to request your ride.
          </motion.p>

          <motion.div variants={itemVariants} className="mb-7">
            <VehicleQuickSelect />
          </motion.div>

          <motion.form variants={itemVariants} className="mb-6 space-y-4" onSubmit={handleLogin}>
            <GlowField focused={isFocused}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                required
                className="relative w-full rounded-xl border border-[#5A4128] bg-[#160F09]/60 px-5 py-4 text-lg text-[#F6ECDA] outline-none transition-all duration-300 placeholder:text-[#8D7350] focus:border-transparent focus:ring-2 focus:ring-[#D9A521]"
              />
            </GlowField>

            <GlowField focused={isPasswordFocused}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                required
                className="relative w-full rounded-xl border border-[#5A4128] bg-[#160F09]/60 px-5 py-4 text-lg text-[#F6ECDA] outline-none transition-all duration-300 placeholder:text-[#8D7350] focus:border-transparent focus:ring-2 focus:ring-[#D9A521]"
              />
            </GlowField>

            <ShineButton type="submit" variant="primary" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Sending..." : "Continue"}
            </ShineButton>
          </motion.form>

          {showOtp && (
            <motion.div variants={itemVariants} className="mb-6 space-y-4">
              <GlowField focused={isOtpFocused}>
                <input
                  type="text"
                  placeholder="Enter email OTP"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  onFocus={() => setIsOtpFocused(true)}
                  onBlur={() => setIsOtpFocused(false)}
                  className="relative w-full rounded-xl border border-[#5A4128] bg-[#160F09]/60 px-5 py-4 text-lg text-[#F6ECDA] outline-none transition-all duration-300 placeholder:text-[#8D7350] focus:border-transparent focus:ring-2 focus:ring-[#D9A521]"
                />
              </GlowField>
              <ShineButton
                type="button"
                variant="muted"
                disabled={isSubmitting || !otp}
                onClick={handleVerifyOtp}
                className="w-full !py-3.5 !text-base"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify OTP
              </ShineButton>
            </motion.div>
          )}

          {status && (
            <motion.p
              variants={itemVariants}
              className="mb-6 rounded-xl border border-[#7A5230]/50 bg-[#241a10]/80 px-4 py-3 text-center text-sm font-medium text-[#F2CD7C]"
            >
              {status}
            </motion.p>
          )}

          <motion.div variants={itemVariants} className="mb-6 flex items-center gap-4 opacity-70">
            <div className="h-px flex-1 bg-[#5A4128]" />
            <span className="text-xs font-medium uppercase tracking-wider text-[#8D7350]">or</span>
            <div className="h-px flex-1 bg-[#5A4128]" />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3 flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="text-sm font-medium text-[#C9AE86] underline underline-offset-4 transition-colors hover:text-[#F2CD7C]"
            >
              Dont have Account? Signup Here
            </button>

            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm font-medium text-[#C9AE86] underline underline-offset-4 transition-colors hover:text-[#F2CD7C]"
            >
              Forgot password?
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#7A5230]/60 bg-[#241a10]/70 py-3.5 text-base font-medium text-[#F6ECDA] transition-all hover:border-[#D9A521]/50 hover:bg-[#2B1D12] active:scale-[0.98]">
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#7A5230]/60 bg-[#241a10]/70 py-3.5 text-base font-medium text-[#F6ECDA] transition-all hover:border-[#D9A521]/50 hover:bg-[#2B1D12] active:scale-[0.98]">
              <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M17.05 13.57c-.02-2.12 1.73-3.15 1.81-3.2-1-1.47-2.55-1.68-3.11-1.7-1.33-.14-2.58.78-3.26.78-.68 0-1.71-.76-2.81-.74-1.42.02-2.73.82-3.46 2.1-1.49 2.58-.38 6.4 1.07 8.5.71 1.03 1.55 2.18 2.68 2.14 1.09-.04 1.5-.7 2.81-.7 1.3 0 1.69.7 2.83.68 1.16-.02 1.88-1.07 2.58-2.1 1.13-1.65 1.6-3.25 1.62-3.34-.03-.01-2.73-1.04-2.76-3.42zM15.1 6.3c.6-.73 1.01-1.75.9-2.77-.88.04-1.95.59-2.56 1.32-.54.65-.99 1.69-.87 2.7 1 .08 2.01-.52 2.53-1.25z" />
              </svg>
              Continue with Apple
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#7A5230]/60 bg-[#241a10]/70 py-3.5 text-base font-medium text-[#F6ECDA] transition-all hover:border-[#D9A521]/50 hover:bg-[#2B1D12] active:scale-[0.98]">
              <QrCode size={20} className="text-[#F6ECDA]" />
              Log in with QR code
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6">
            <BiometricButton />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-2 flex items-center justify-center gap-1.5 text-[11px] text-[#8D7350]">
            <Shield className="h-3 w-3 text-[#8FA34E]" />
            Bank-grade encryption · Your data stays private
          </motion.div>

          <motion.p variants={itemVariants} className="text-center text-[12px] leading-relaxed text-[#8D7350]">
            By proceeding, you consent to get calls, WhatsApp or SMS messages, including by automated means, from Ride and its affiliates to the number provided.
          </motion.p>
        </motion.div>

        <TrustStrip />
      </main>
    </div>
  );
}
