import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fdfcf8_0%,_#f6efe3_35%,_#ebdcc9_100%)] px-6 py-10 text-black">
      {/* Background Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-16 top-10 h-72 w-72 rounded-full bg-rose-400/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-amber-400/20 blur-[120px]" />
      </div>

      {/* Huge 403 */}
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute text-[16rem] font-black tracking-tight text-black select-none"
      >
        403
      </motion.h1>

      <motion.section
        initial={{ opacity: 0, y: 25, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-lg rounded-[2rem] border border-white/70 bg-white/70 p-10 text-center shadow-[0_30px_90px_-30px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
      >
        {/* Badge */}
        <div className="mb-5 inline-flex rounded-full bg-rose-100 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-rose-600">
          Unauthorized
        </div>

        {/* Icon */}
        <motion.div
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 2.5,
          }}
          className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center"
        >
          {/* Ripple */}
          <div className="absolute h-full w-full rounded-full bg-rose-300/30 animate-ping" />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-lg">
            <svg
              className="h-10 w-10"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-7 9h14a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2z"
              />
            </svg>
          </div>
        </motion.div>

        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Access Denied
        </h2>

        <p className="mt-4 leading-7 text-gray-600">
          Sorry, you don't have permission to access this page.
          <br />
          If you believe this is a mistake, please contact your administrator
          or sign in with an account that has the required permissions.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/dashboard"
            className="rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
          >
            Go to Dashboard
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-medium transition-all hover:border-black hover:bg-gray-50"
          >
            Go Back
          </button>

          <Link
            to="/"
            className="text-sm font-medium text-gray-500 transition-colors hover:text-black"
          >
            Back to Home
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-gray-200 pt-5 text-xs text-gray-500">
          Error Code: <span className="font-semibold">403 Forbidden</span>
        </div>
      </motion.section>
    </main>
  );
}