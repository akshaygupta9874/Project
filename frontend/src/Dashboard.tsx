import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Clock3, Sparkles, ShieldCheck, CarFront, Compass, BellRing } from "lucide-react";
import api from "./apiInterceptor";
import LoadingScreen from "./components/LoadingScreen";

const quickActions = [
  { title: "Book a ride", subtitle: "Fastest way home", icon: CarFront },
  { title: "Plan a trip", subtitle: "Set a destination", icon: Compass },
  { title: "Ride history", subtitle: "See your recent trips", icon: Clock3 },
];

const stats = [
  { label: "Trips this week", value: "24" },
  { label: "Preferred ride", value: "Black" },
  { label: "Saved places", value: "7" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await api.post("/logout");
      navigate("/login", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (isLoggingOut) {
    return <LoadingScreen label="Signing you out" sublabel="Clearing your session and redirecting you safely" />;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff_0%,_#f5efe4_45%,_#ece2d0_100%)] px-4 py-6 text-black sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_25px_80px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700">
                <Sparkles size={14} />
                Premium ready
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good evening, Alex</h1>
              <p className="mt-2 max-w-2xl text-sm text-black/65 sm:text-base">
                Your next ride is just a tap away. Reserve a premium pickup and glide through the city in comfort.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black px-4 py-3 text-white shadow-lg">
                <BellRing size={18} />
                <div>
                  <p className="text-sm font-semibold">Driver update</p>
                  <p className="text-xs text-white/70">Your driver is 2 min away</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </motion.header>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[2rem] border border-black/10 bg-[#0f172a] p-6 text-white shadow-[0_30px_90px_-30px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">Current trip</p>
                <h2 className="mt-2 text-2xl font-semibold">Airport pickup</h2>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">Now</div>
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/10 p-4">
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-1 text-emerald-400" />
                <div>
                  <p className="text-sm text-white/60">Pickup</p>
                  <p className="text-lg font-medium">Downtown Pier 8</p>
                </div>
              </div>
              <div className="my-4 h-px bg-white/10" />
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-1 text-sky-400" />
                <div>
                  <p className="text-sm text-white/60">Destination</p>
                  <p className="text-lg font-medium">Sea View Terminal</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:-translate-y-0.5">
                Request now
              </button>
              <button className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10">
                Schedule later
              </button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-black/60">Your status</p>
                <h3 className="text-xl font-semibold">Ride-ready</h3>
              </div>
              <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {stats.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-[#f8f3e9] px-4 py-3">
                  <span className="text-sm text-black/60">{item.label}</span>
                  <span className="text-sm font-semibold text-black">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_25px_80px_-35px_rgba(0,0,0,0.25)] backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-black/60">Quick actions</p>
              <h3 className="text-xl font-semibold">Move around effortlessly</h3>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.title}
                  className="group rounded-[1.25rem] border border-black/10 bg-[#f8f3e9] p-4 text-left transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="mb-3 inline-flex rounded-2xl bg-black p-2 text-white">
                    <Icon size={18} />
                  </div>
                  <h4 className="font-semibold">{action.title}</h4>
                  <p className="mt-1 text-sm text-black/60">{action.subtitle}</p>
                  <div className="mt-4 flex items-center text-sm font-medium text-black/70">
                    Open <ArrowRight size={16} className="ml-2 transition group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.section>
      </div>
    </main>
  );
}
