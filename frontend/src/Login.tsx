import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { QrCode, Navigation } from "lucide-react";
import { apiRequest } from "./lib/api";
import { AxiosError } from "axios";
import { useAuthContext } from "./context/authContext";

// ---------- Form animation ----------
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

// ---------- Animated city map background ----------
function CityMapBackground() {
  // Deterministic city blocks
  const verticals = useMemo(() => [60, 140, 230, 320, 410, 500, 600, 700, 820, 940, 1060, 1180, 1300], []);
  const horizontals = useMemo(() => [60, 140, 230, 330, 430, 540, 640, 740, 840], []);

  // Pickup pins scattered around
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

  // Routes: SVG paths each "car" rides along
  const routes = useMemo(
    () => [
      {
        d: "M -40 230 L 410 230 L 410 430 L 940 430 L 940 230 L 1380 230",
        dur: 14,
        delay: 0,
        color: "#0a0a0a",
      },
      {
        d: "M 1380 540 L 820 540 L 820 740 L 320 740 L 320 540 L -40 540",
        dur: 18,
        delay: 2,
        color: "#1a1a1a",
      },
      {
        d: "M 140 -40 L 140 330 L 600 330 L 600 640 L 1060 640 L 1060 900",
        dur: 16,
        delay: 4,
        color: "#0a0a0a",
      },
    ],
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Soft warm map base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#fff_0%,#f3efe7_45%,#e9e2d2_100%)]" />

      {/* Drifting ambient blobs */}
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

      {/* The city map SVG, slowly panning */}
      <motion.svg
        viewBox="0 0 1340 880"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        animate={{ x: [0, -24, 0, 18, 0], y: [0, 10, 0, -8, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* City blocks (subtle fills) */}
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
              opacity={0.65}
            />
          )),
        )}

        {/* River-ish diagonal */}
        <path
          d="M -50 720 C 200 660, 420 780, 700 700 S 1200 560, 1400 620 L 1400 880 L -50 880 Z"
          fill="#bfdbfe"
          opacity="0.55"
        />

        {/* Streets — verticals */}
        {verticals.map((vx) => (
          <line key={`v-${vx}`} x1={vx} y1={-20} x2={vx} y2={900} stroke="#ffffff" strokeWidth={10} />
        ))}
        {/* Streets — horizontals */}
        {horizontals.map((hy) => (
          <line key={`h-${hy}`} x1={-20} y1={hy} x2={1360} y2={hy} stroke="#ffffff" strokeWidth={10} />
        ))}
        {/* Lane stripes */}
        {verticals.map((vx) => (
          <line
            key={`vs-${vx}`}
            x1={vx}
            y1={-20}
            x2={vx}
            y2={900}
            stroke="#cbb98a"
            strokeWidth={1}
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
            stroke="#cbb98a"
            strokeWidth={1}
            strokeDasharray="6 10"
          />
        ))}

        {/* Animated routes being drawn */}
        {routes.map((r, idx) => (
          <g key={`route-${idx}`}>
            <path d={r.d} stroke={r.color} strokeOpacity={0.18} strokeWidth={5} fill="none" strokeLinecap="round" />
            <motion.path
              d={r.d}
              stroke={r.color}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="60 1600"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: [-1660, 0] }}
              transition={{ duration: r.dur, delay: r.delay, repeat: Infinity, ease: "linear" }}
            />
            {/* Car traveling the route */}
            <motion.circle
              r={7}
              fill="#0a0a0a"
              stroke="#fff"
              strokeWidth={3}
            >
              <animateMotion dur={`${r.dur}s`} repeatCount="indefinite" begin={`${r.delay}s`} rotate="auto" path={r.d} />
            </motion.circle>
          </g>
        ))}

        {/* Pulsing pickup pins */}
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

      {/* Top fade for legibility */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  );
}

// ---------- ETA ticker shown above the card ----------
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
      className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-black/80 shadow-sm backdrop-blur-md"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Navigation size={12} className="text-black/70" />
      <span>Drivers nearby · arriving in {eta} min</span>
    </motion.div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { checkAuthentication } = useAuthContext();
  const [isFocused, setIsFocused] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsSubmitting(true);

    try {
      const data = await apiRequest<{ message: string }>("/login", {
        method: "POST",
        body: { email, password },
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
      const data = await apiRequest<{ message: string }>("/verify-otp", {
        method: "POST",
        body: { email, otp },
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f0ece2] font-sans text-black">
      <CityMapBackground />

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16">
        <EtaPill />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative w-full max-w-[440px] overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-8 pt-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] backdrop-blur-2xl md:p-10"
        >
          {/* Moving sheen */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ x: ["0%", "420%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
          />

          <motion.h2 variants={itemVariants} className="mb-1 text-2xl font-semibold tracking-tight md:text-3xl">
            Where to next?
          </motion.h2>
          <motion.p variants={itemVariants} className="mb-8 text-sm text-black/60">
            Sign in to request your ride.
          </motion.p>

          <motion.form variants={itemVariants} className="mb-6 space-y-4" onSubmit={handleLogin}>
            <div className="relative">
              <div
                className={`absolute -inset-0.5 rounded-xl bg-gradient-to-r from-sky-500 via-emerald-400 to-violet-500 opacity-0 blur transition duration-500 ${isFocused ? "opacity-60" : ""
                  }`}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                required
                className="relative w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-lg outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
              />
            </div>

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="relative w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-lg outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full overflow-hidden rounded-xl bg-black py-4 text-lg font-medium text-white shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10">{isSubmitting ? "Sending..." : "Continue"}</span>
              <span className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 transition-transform duration-700 group-hover:translate-x-[420%]" />
            </button>
          </motion.form>

          {showOtp && (
            <motion.div variants={itemVariants} className="mb-6 space-y-4">
              <input
                type="text"
                placeholder="Enter email OTP"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                className="relative w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-lg outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
              />
              <button
                type="button"
                disabled={isSubmitting || !otp}
                onClick={handleVerifyOtp}
                className="w-full rounded-xl border border-black/10 bg-white/80 py-3.5 text-base font-medium transition-all hover:bg-white hover:shadow-sm active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                Verify OTP
              </button>
            </motion.div>
          )}

          {status && (
            <motion.p variants={itemVariants} className="mb-6 rounded-xl bg-white/80 px-4 py-3 text-center text-sm font-medium text-black/70">
              {status}
            </motion.p>
          )}

          <motion.div variants={itemVariants} className="mb-6 flex items-center gap-4 opacity-70">
            <div className="h-px flex-1 bg-black/15" />
            <span className="text-xs font-medium uppercase tracking-wider text-black/50">or</span>
            <div className="h-px flex-1 bg-black/15" />
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3 flex justify-between">

            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="text-sm font-medium text-black/70 underline underline-offset-4"
            >
              Dont have Account? Signup Here
            </button>

            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-sm font-medium text-black/70 underline underline-offset-4"
            >
              Forgot password?
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-3">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white/80 py-3.5 text-base font-medium transition-all hover:bg-white hover:shadow-sm active:scale-[0.98]">
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white/80 py-3.5 text-base font-medium transition-all hover:bg-white hover:shadow-sm active:scale-[0.98]">
              <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M17.05 13.57c-.02-2.12 1.73-3.15 1.81-3.2-1-1.47-2.55-1.68-3.11-1.7-1.33-.14-2.58.78-3.26.78-.68 0-1.71-.76-2.81-.74-1.42.02-2.73.82-3.46 2.1-1.49 2.58-.38 6.4 1.07 8.5.71 1.03 1.55 2.18 2.68 2.14 1.09-.04 1.5-.7 2.81-.7 1.3 0 1.69.7 2.83.68 1.16-.02 1.88-1.07 2.58-2.1 1.13-1.65 1.6-3.25 1.62-3.34-.03-.01-2.73-1.04-2.76-3.42zM15.1 6.3c.6-.73 1.01-1.75.9-2.77-.88.04-1.95.59-2.56 1.32-.54.65-.99 1.69-.87 2.7 1 .08 2.01-.52 2.53-1.25z" />
              </svg>
              Continue with Apple
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6">
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white/80 py-3.5 text-base font-medium transition-all hover:bg-white hover:shadow-sm active:scale-[0.98]">
              <QrCode size={20} className="text-black/80" />
              Log in with QR code
            </button>
          </motion.div>

          <motion.p variants={itemVariants} className="text-center text-[12px] leading-relaxed text-black/50">
            By proceeding, you consent to get calls, WhatsApp or SMS messages, including by automated means, from Ride and its affiliates to the number provided.
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
