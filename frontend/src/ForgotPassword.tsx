import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "./apiInterceptor";
import { AxiosError } from "axios";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsSubmitting(true);

    try {
      const { data } = await api.post<{ message: string }>("/forgot-password", {
        email,
      });
      setStatus(data.message);
    } catch (error) {
      setStatus(error instanceof AxiosError ? error.response?.data.message : "Unable to send reset link");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f0ece2] px-6 py-10 text-black">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-[0_30px_90px_-35px_rgba(0,0,0,0.32)] backdrop-blur-xl"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-black/50">Password reset</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Recover your account</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">
          Enter the email linked to your account and we will send a secure reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-base outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-black py-3.5 text-base font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {status && (
          <p className="mt-5 rounded-xl bg-[#f8f3e9] px-4 py-3 text-center text-sm font-medium text-black/70">
            {status}
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mt-5 text-sm font-medium text-black/70 underline underline-offset-4"
        >
          Back to login
        </button>
      </motion.section>
    </main>
  );
}
