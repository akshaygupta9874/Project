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
    <section className="mx-auto max-w-7xl px-6 py-24 overflow-hidden">
      
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
          >
            {/* Icon Box */}
            <div className="rounded-2xl bg-gray-100 p-5 transition-all duration-300 group-hover:-translate-y-2 group-hover:bg-black group-hover:text-white group-hover:shadow-xl">
              <Icon size={32} strokeWidth={1.5} />
            </div>

            <p className="mt-3 text-sm font-semibold text-gray-800 transition-colors group-hover:text-black">
              {title}
            </p>

            {/* CSS-Only Hover Tooltip (Optimized) */}
            <div className="pointer-events-none absolute top-full z-50 mt-4 w-64 origin-top scale-95 rounded-2xl bg-black px-5 py-4 text-center text-white opacity-0 shadow-2xl transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              {/* Arrow pointer */}
              <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-black" />
              <p className="text-sm font-medium leading-relaxed shadow-black drop-shadow-md">
                {description}
              </p>
            </div>
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
          <h2 className="max-w-lg text-5xl font-extrabold leading-[1.1] tracking-tight text-gray-900">
            Log in to see your account details
          </h2>

          <p className="mt-6 max-w-md text-xl leading-relaxed text-gray-600">
            View past trips, tailored suggestions, support resources, and more.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Button
              className="h-14 rounded-full bg-black px-8 text-lg font-medium text-white transition-transform hover:scale-105 hover:bg-gray-900 active:scale-95"
              onClick={() => navigate("/login")}
            >
              Log in to your account
            </Button>

            <button
              type="button"
              className="group relative text-lg font-medium text-gray-700 transition-colors hover:text-black"
              onClick={() => navigate("/signup")}
            >
              Create an account
              <span className="absolute -bottom-1 left-0 h-[2px] w-full bg-gray-300 transition-all duration-300 group-hover:bg-black"></span>
            </button>
          </div>
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
