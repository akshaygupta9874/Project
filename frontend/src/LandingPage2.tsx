import { motion, type Variants } from "framer-motion";
import { useMemo } from "react";
import { Button } from "./components/ui/button";
import {
  Car,
  CalendarDays,
  Bike,
  CarTaxiFront,
  Package,
  Plane,
  ArrowRight,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ========== CONSOLE STYLESHEET ==========
function ConsoleStyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap');
      .console-display { font-family: 'Fraunces', ui-serif, Georgia, serif; }
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
    `}</style>
  );
}

const services = [
  { icon: Car, title: "Ride", description: "Book a ride anywhere with verified drivers and real-time tracking." },
  { icon: CalendarDays, title: "Reserve", description: "Schedule rides up to 30 days in advance." },
  { icon: Bike, title: "Bike", description: "Quick and affordable bike rides around your city." },
  { icon: CarTaxiFront, title: "Intercity", description: "Travel comfortably between cities." },
  { icon: Package, title: "Parcel", description: "Send parcels quickly and securely." },
  { icon: Plane, title: "Airport", description: "Reliable airport pickups and drop-offs." },
];

// --- Animation Variants ---
const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const iconVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 250, damping: 22 },
  },
};

const textSlideVariants: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

export default function LandingPage2() {
  const navigate = useNavigate();

  // Ember particles
  const embers = useMemo(() => Array.from({ length: 25 }, (_, i) => ({
    id: i,
    delay: (i * 0.5) % 8,
    duration: 6 + ((i * 3) % 6),
    left: (i * 16) % 100,
    size: 1.5 + (i % 3),
    drift: ((i % 5) - 2) * 12,
  })), []);

  return (
    <div className="relative bg-gradient-to-br from-[#2a2218] via-[#3B2818] to-[#1B130C] overflow-hidden">
      <ConsoleStyleSheet />

      {/* Ambient background orbs */}
      <motion.div
        className="pointer-events-none absolute -right-64 top-0 h-[400px] w-[400px] rounded-full bg-[#D9A521]/15 blur-[120px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -left-64 bottom-0 h-[400px] w-[400px] rounded-full bg-[#F2CD7C]/10 blur-[120px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Rising embers */}
      {embers.map((e: any) => (
        <span
          key={`ember-${e.id}`}
          className="pointer-events-none absolute bottom-0 rounded-full"
          style={{
            left: `${e.left}%`,
            width: e.size,
            height: e.size,
            backgroundColor: "#F2CD7C",
            boxShadow: "0 0 8px 1px rgba(242,205,124,0.8)",
            animation: `emberRise ${e.duration}s ease-in ${e.delay}s infinite`,
            "--drift": `${e.drift}px`,
          } as React.CSSProperties}
        />
      ))}

      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24 overflow-hidden">
        {/* Section Header */}
        <motion.div
          className="mb-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <motion.div className="inline-block mb-4 rounded-full border border-[#D9A521]/30 bg-[#241a10]/60 px-4 py-2 backdrop-blur">
            <p className="text-xs uppercase tracking-widest text-[#F2CD7C] font-semibold">Our Services</p>
          </motion.div>
          <h2 className="console-display text-5xl sm:text-6xl font-bold bg-gradient-to-r from-[#F2CD7C] via-[#FBEBC9] to-[#D9A521] bg-clip-text text-transparent mb-4">
            Multiple Ways to Move
          </h2>
          <p className="text-[#C9AE86] font-medium max-w-2xl mx-auto">
            Choose from our premium fleet designed for every journey and every budget.
          </p>
        </motion.div>

        {/* SERVICES GRID */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20"
        >
          {services.map(({ icon: Icon, title, description }) => (
            <motion.div
              variants={iconVariants}
              key={title}
              className="group relative flex cursor-pointer flex-col items-center text-center"
              whileHover={{ scale: 1.08 }}
            >
              {/* Icon Box with brass gradient */}
              <motion.div 
                className="rounded-2xl bg-gradient-to-br from-[#D9A521]/20 to-[#7A5230]/10 border border-[#D9A521]/20 p-6 transition-all duration-300 group-hover:-translate-y-3 group-hover:bg-gradient-to-br group-hover:from-[#D9A521]/40 group-hover:to-[#7A5230]/20 group-hover:shadow-lg group-hover:shadow-[#D9A521]/30 backdrop-blur-sm w-full"
                animate={{ 
                  boxShadow: ['0 0 0 0 rgba(217, 165, 33, 0)', '0 0 0 8px rgba(217, 165, 33, 0)']
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon size={40} strokeWidth={1.5} className="text-[#F2CD7C] group-hover:text-[#FFE5A8] transition-colors mx-auto" />
              </motion.div>

              <p className="mt-4 text-lg font-semibold text-[#F6ECDA] group-hover:text-[#F2CD7C] transition-colors">
                {title}
              </p>

              {/* Premium hover tooltip with console theme */}
              <motion.div 
                className="pointer-events-none absolute top-full z-50 mt-4 w-72 origin-top rounded-2xl border border-[#D9A521]/30 bg-[#1a1612]/90 backdrop-blur-xl px-6 py-4 text-center shadow-2xl shadow-[#D9A521]/20"
                initial={{ scale: 0.95, opacity: 0 }}
                whileHover={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Arrow pointer */}
                <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-[#1a1612] border border-[#D9A521]/30" />
                <p className="text-sm font-medium leading-relaxed text-[#F2CD7C] drop-shadow-md">
                  {description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* WHY CHOOSE US SECTION */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center py-12 mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Left: Features */}
          <motion.div
            className="space-y-6"
          >
            <motion.div variants={textSlideVariants}>
              <h3 className="console-display text-4xl font-bold text-[#F6ECDA] mb-3">Why Choose Us?</h3>
              <p className="text-[#C9AE86] leading-relaxed">
                Experience premium ride-booking with cutting-edge technology, verified drivers, and customer-first approach.
              </p>
            </motion.div>

            {[
              { icon: TrendingUp, label: "Real-time Tracking", desc: "Live GPS updates every second" },
              { icon: Zap, label: "Instant Booking", desc: "Get a ride in under 60 seconds" },
              { icon: Users, label: "Verified Drivers", desc: "Background checked professionals" },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={textSlideVariants}
                className="flex gap-4 p-4 rounded-xl border border-[#D9A521]/20 bg-[#241a10]/60 hover:border-[#D9A521]/60 transition-all"
              >
                <item.icon className="h-6 w-6 text-[#D9A521] flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-[#F2CD7C]">{item.label}</p>
                  <p className="text-sm text-[#8D7350]">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: Call to Action */}
          <motion.div
            variants={textSlideVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.div
              className="rounded-2xl border border-[#D9A521]/30 bg-[#241a10]/80 p-8 sm:p-10 backdrop-blur-xl"
              whileHover={{ borderColor: "#F2CD7C", boxShadow: "0 0 30px rgba(242,205,124,0.2)" }}
            >
              <h3 className="console-display text-3xl font-bold bg-gradient-to-r from-[#F2CD7C] via-[#FBEBC9] to-[#D9A521] bg-clip-text text-transparent mb-4">
                Access Your Account
              </h3>

              <p className="text-[#C9AE86] font-medium mb-8">
                View past trips, tailored suggestions, support resources, and more.
              </p>

              <motion.div className="space-y-3">
                <motion.button
                  type="button"
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#D9A521] to-[#B8860B] px-8 py-3.5 font-semibold text-white shadow-lg shadow-[#D9A521]/40 hover:shadow-[#F2CD7C]/50 transition-all hover:scale-105 active:scale-95"
                  onClick={() => navigate("/login")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Log in to account
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <motion.span
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25"
                    animate={{ x: ["0%", "400%"] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  />
                </motion.button>

                <motion.button
                  type="button"
                  className="w-full rounded-xl border border-[#D9A521]/40 bg-[#1B130C]/60 px-8 py-3.5 font-semibold text-[#F2CD7C] hover:border-[#F2CD7C]/60 hover:bg-[#241a10] transition-all"
                  onClick={() => navigate("/signup")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Create an account
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="rounded-2xl border border-[#D9A521]/30 bg-gradient-to-r from-[#D9A521]/10 to-[#E8843A]/10 p-12 text-center backdrop-blur"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h3 className="console-display text-3xl sm:text-4xl font-bold text-[#F6ECDA] mb-4">
            Ready for your next ride?
          </h3>
          <p className="text-[#C9AE86] mb-8 max-w-2xl mx-auto">
            Join thousands of satisfied riders. Experience premium mobility today.
          </p>
          <Button
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#D9A521] to-[#B8860B] px-10 py-3.5 font-semibold text-white shadow-lg shadow-[#D9A521]/40 hover:shadow-[#F2CD7C]/50 transition-all hover:scale-105 active:scale-95"
            onClick={() => navigate("/dashboard")}
          >
            <span className="relative z-10 flex items-center gap-2">
              <Zap size={18} />
              Book Your First Ride
            </span>
            <motion.span
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25"
              animate={{ x: ["0%", "400%"] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
          </Button>
        </motion.div>
      </section>
    </div>
  );
}
