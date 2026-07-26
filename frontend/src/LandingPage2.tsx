import { motion, type Variants } from "framer-motion";
import { Button } from "./components/ui/button";
import {
  Car,
  CalendarDays,
  Bike,
  CarTaxiFront,
  Package,
  Plane,
  BatteryCharging,
  Users,
  PersonStanding,
  Bus,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const loginImage =
  "https://tb-static.uber.com/prod/udam-assets/850e6b6d-a29e-4960-bcab-46de99547d24.svg";

const services = [
  { icon: Car, title: "Ride", description: "Go anywhere with Uber. Request a ride, hop in, and go." },
  { icon: CalendarDays, title: "Reserve", description: "Reserve your ride in advance and travel stress free." },
  { icon: Bike, title: "Bike", description: "Quick and affordable bike rides around your city." },
  { icon: CarTaxiFront, title: "Intercity", description: "Travel comfortably between cities with Uber." },
  { icon: Package, title: "Parcel", description: "Send parcels quickly and securely." },
  { icon: Plane, title: "Airport", description: "Reliable airport pickups and drop-offs." },
  { icon: BatteryCharging, title: "Electric", description: "Choose eco-friendly electric rides." },
  { icon: Users, title: "Teens", description: "Safe rides designed for teens." },
  { icon: PersonStanding, title: "Seniors", description: "Convenient rides for senior citizens." },
  { icon: Bus, title: "Shuttle", description: "Shared rides at affordable prices." }
];

// --- Animation Variants ---

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }, // Fast stagger for the grid
  },
};

const iconVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.8 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
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

const imageRevealVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.8, ease: "easeOut", delay: 0.2 },
  },
};

export default function LandingPage2() {
  const navigate = useNavigate();

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24 overflow-hidden">
      {/* Ambient background orbs */}
      <motion.div
        className="absolute -right-64 top-0 h-[400px] w-[400px] rounded-full bg-[#D9A521]/8 blur-[120px]"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -left-64 bottom-0 h-[400px] w-[400px] rounded-full bg-[#F2CD7C]/5 blur-[120px]"
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      
      {/* SERVICES GRID */}
      <motion.div
        variants={gridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }} // Triggers when 100px away
        className="px-4 mb-32 flex flex-wrap justify-center gap-8"
      >
        {services.map(({ icon: Icon, title, description }) => (
          <motion.div
            variants={iconVariants}
            key={title}
            className="group relative flex cursor-pointer flex-col items-center"
            whileHover={{ scale: 1.08 }}
          >
            {/* Icon Box with brass gradient */}
            <motion.div 
              className="rounded-2xl bg-gradient-to-br from-[#D9A521]/20 to-[#7A5230]/10 border border-[#D9A521]/20 p-5 transition-all duration-300 group-hover:-translate-y-3 group-hover:bg-gradient-to-br group-hover:from-[#D9A521]/40 group-hover:to-[#7A5230]/20 group-hover:shadow-lg group-hover:shadow-[#D9A521]/30 backdrop-blur-sm"
              animate={{ 
                boxShadow: ['0 0 0 0 rgba(217, 165, 33, 0)', '0 0 0 8px rgba(217, 165, 33, 0)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icon size={32} strokeWidth={1.5} className="text-[#F2CD7C] group-hover:text-[#FFE5A8] transition-colors" />
            </motion.div>

            <p className="mt-3 text-sm font-semibold text-white group-hover:text-[#F2CD7C] transition-colors">
              {title}
            </p>

            {/* Premium hover tooltip with console theme */}
            <motion.div 
              className="pointer-events-none absolute top-full z-50 mt-4 w-64 origin-top rounded-2xl border border-[#D9A521]/30 bg-[#1a1612]/80 backdrop-blur-xl px-5 py-4 text-center shadow-2xl shadow-[#D9A521]/20"
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

      {/* LOGIN SECTION */}
      <div className="flex flex-col-reverse items-center gap-16 lg:flex-row">
        
        {/* Left Side (Text) */}
        <motion.div
          variants={textSlideVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex-1"
        >
          <motion.h2 
            className="max-w-lg text-5xl font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-[#F2CD7C] via-[#FFE5A8] to-[#D9A521] bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Access your premium account
          </motion.h2>

          <motion.p 
            className="mt-6 max-w-md text-xl leading-relaxed text-[#D9A521]/80"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            View past trips, tailored suggestions, support resources, and more.
          </motion.p>

          <motion.div 
            className="mt-10 flex flex-wrap items-center gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <Button
              className="group relative h-14 rounded-full bg-gradient-to-r from-[#D9A521] to-[#B8860B] px-8 text-lg font-medium text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#D9A521]/40 hover:shadow-[#F2CD7C]/50"
              onClick={() => navigate("/login")}
            >
              <span className="flex items-center gap-2">
                Log in to account
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>

            <motion.button
              type="button"
              className="group relative text-lg font-medium text-[#F2CD7C] transition-colors hover:text-[#FFE5A8]"
              onClick={() => navigate("/signup")}
              whileHover={{ scale: 1.05 }}
            >
              Create an account
              <span className="absolute -bottom-1 left-0 h-[2px] w-full bg-gradient-to-r from-[#D9A521] to-transparent transition-all duration-300 group-hover:bg-gradient-to-r group-hover:from-[#F2CD7C] group-hover:to-transparent"></span>
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Right Side (Image) */}
        <motion.div
          variants={imageRevealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-1 justify-center lg:justify-end"
        >
          <div className="overflow-hidden rounded-[2rem] bg-gray-50 shadow-sm transition-shadow duration-500 hover:shadow-2xl">
            <img
              src={loginImage}
              alt="Uber Login Illustration"
              className="w-full max-w-xl object-cover transition-transform duration-700 hover:scale-[1.03]"
            />
          </div>
        </motion.div>
        
      </div>
    </section>
  );
}
