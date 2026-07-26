import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Mail, Lock, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import api from "./apiInterceptor";
import { AxiosError } from "axios";

// ---------- Premium console animations ----------
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.3,
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

// ---------- Premium console background with embers ----------
function PremiumConsoleBackground() {
  const embers = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    delay: (i * 0.6) % 8,
    duration: 6 + ((i * 3) % 6),
    left: (i * 18) % 100,
    size: 1.5 + (i % 3),
    drift: ((i % 5) - 2) * 12,
  })), []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Premium golden-brown console gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2a2218] via-[#3B2818] to-[#1B130C]" />
      
      {/* Breathing brass orbs */}
      <motion.div
        className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-[#D9A521]/20 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, 15, 0], scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[#D9A521]/15 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, -15, 0], scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[#E8843A]/10 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Rising ember particles */}
      {embers.map(e => (
        <motion.span
          key={`ember-${e.id}`}
          className="pointer-events-none absolute bottom-0 rounded-full"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            backgroundColor: "#F2CD7C",
            boxShadow: "0 0 8px rgba(242,205,124,0.9)",
          }}
          animate={{
            y: [-20, -window.innerHeight],
            opacity: [0.8, 0],
            scale: [1, 0.4],
            x: [0, e.drift],
          }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Scanline effect overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,.15),rgba(0,0,0,.15)_1px,transparent_1px,transparent_2px)] opacity-30" />
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;

      setSuccess(true);
      localStorage.setItem("authToken", token);
      localStorage.setItem("user", JSON.stringify(user));

      setTimeout(() => {
        if (user.role === "DRIVER") {
          navigate("/driver-dashboard");
        } else {
          navigate("/dashboard");
        }
      }, 1000);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(axiosError.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="console-root relative flex min-h-screen items-center justify-center px-4 py-8">
      <PremiumConsoleBackground />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-md"
      >
        {/* Header with brass accent */}
        <motion.div variants={itemVariants} className="mb-10 text-center">
          <motion.div
            className="mb-4 inline-block rounded-full border border-[#D9A521]/30 bg-[#241a10]/60 px-4 py-2 backdrop-blur"
            whileHover={{ scale: 1.05, borderColor: "#F2CD7C" }}
          >
            <p className="text-xs uppercase tracking-widest text-[#F2CD7C] font-semibold">Premium Access</p>
          </motion.div>
          <h1 className="console-display text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#F2CD7C] via-[#FBEBC9] to-[#D9A521] bg-clip-text text-transparent drop-shadow-lg">
            Welcome Back
          </h1>
          <p className="mt-3 text-[#C9AE86] font-medium">Enter your credentials to continue</p>
        </motion.div>

        {/* Form Container */}
        <motion.form
          onSubmit={handleSubmit}
          variants={containerVariants}
          className="space-y-5"
        >
          {/* Email Input */}
          <motion.div variants={itemVariants} className="relative group">
            <label className="block text-xs uppercase tracking-widest text-[#C9AE86] font-semibold mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D9A521]/60 group-focus-within:text-[#F2CD7C] transition-colors" />
              <motion.div
                className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D9A521]/40 via-[#F2CD7C]/20 to-[#D9A521]/40 opacity-0 blur group-focus-within:opacity-100 transition-opacity"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="relative w-full rounded-xl border border-[#7A5230]/40 bg-[#241a10]/60 pl-12 pr-4 py-3.5 text-[#F6ECDA] placeholder-[#8D7350] outline-none transition-all focus:border-[#F2CD7C]/60 focus:bg-[#241a10] focus:shadow-lg focus:shadow-[#D9A521]/20 backdrop-blur"
                required
              />
            </div>
          </motion.div>

          {/* Password Input */}
          <motion.div variants={itemVariants} className="relative group">
            <label className="block text-xs uppercase tracking-widest text-[#C9AE86] font-semibold mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D9A521]/60 group-focus-within:text-[#F2CD7C] transition-colors" />
              <motion.div
                className="pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r from-[#D9A521]/40 via-[#F2CD7C]/20 to-[#D9A521]/40 opacity-0 blur group-focus-within:opacity-100 transition-opacity"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="relative w-full rounded-xl border border-[#7A5230]/40 bg-[#241a10]/60 pl-12 pr-4 py-3.5 text-[#F6ECDA] placeholder-[#8D7350] outline-none transition-all focus:border-[#F2CD7C]/60 focus:bg-[#241a10] focus:shadow-lg focus:shadow-[#D9A521]/20 backdrop-blur"
                required
              />
            </div>
          </motion.div>

          {/* Error Alert */}
          {error && (
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 rounded-lg border border-[#B54834]/40 bg-[#B54834]/10 px-4 py-3 backdrop-blur"
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-[#E2A08E]" />
              <p className="text-sm text-[#E2A08E]">{error}</p>
            </motion.div>
          )}

          {/* Success Alert */}
          {success && (
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 rounded-lg border border-[#8FA34E]/40 bg-[#8FA34E]/10 px-4 py-3 backdrop-blur"
            >
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[#C7D69E]" />
              <p className="text-sm text-[#C7D69E]">Login successful! Redirecting...</p>
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.button
            variants={itemVariants}
            type="submit"
            disabled={loading || success}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#D9A521] via-[#E8A845] to-[#B8860B] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#D9A521]/40 transition-all hover:shadow-[#F2CD7C]/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
            {/* Shine sweep */}
            <motion.span
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25"
              animate={{ x: ["0%", "400%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
          </motion.button>
        </motion.form>

        {/* Footer */}
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <p className="text-[#8D7350] text-sm">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="font-semibold text-[#F2CD7C] hover:text-[#FBEBC9] transition-colors underline-offset-2 hover:underline"
            >
              Create one now
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
