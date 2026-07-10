import { motion } from "framer-motion";

type LoadingScreenProps = {
  label?: string;
  sublabel?: string;
};

export default function LoadingScreen({
  label = "Loading",
  sublabel = "Preparing your experience",
}: LoadingScreenProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fdfcf8_0%,_#f6efe3_35%,_#ebdcc9_100%)] px-6 py-10 text-black">
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-sky-400/20 blur-[120px]"
          animate={{ x: [0, 40, -20, 0], y: [0, -20, 30, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-400/20 blur-[120px]"
          animate={{ x: [0, -50, 20, 0], y: [0, 30, -25, 0], scale: [1, 0.92, 1.05, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/70 p-8 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-black/10 bg-white/80 shadow-inner">
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 border-r-emerald-400"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-3 rounded-full border-4 border-transparent border-b-violet-500 border-l-slate-700"
              animate={{ rotate: -360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
            />
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-500 via-emerald-400 to-violet-500" />
          </div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-semibold tracking-tight"
          >
            {label}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-3 max-w-md text-sm leading-6 text-black/65"
          >
            {sublabel}
          </motion.p>

          <div className="mt-6 flex items-center gap-2">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-2.5 w-2.5 rounded-full bg-black/70"
                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.16 }}
              />
            ))}
          </div>
        </div>
      </motion.section>
    </main>
  );
}
