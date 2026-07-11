import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import api from "./apiInterceptor";
import { AxiosError } from "axios";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token: routeToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => routeToken ?? searchParams.get("token") ?? "", [routeToken, searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (newPassword !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data } = await api.post<{ message: string }>("/reset-password", {
        token,
        newPassword,
      });
      setStatus(data.message);
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      setStatus(error instanceof AxiosError ? error.response?.data.message : "Unable to reset password");
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
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-black/50">Set a new password</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Create a strong password</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">
          Choose a new password for your account. You will be redirected to login after the reset completes.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-base outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-black/10 bg-white/95 px-5 py-4 text-base outline-none transition-all duration-300 placeholder:text-black/40 focus:border-transparent focus:ring-2 focus:ring-black/80"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-black py-3.5 text-base font-medium text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Updating..." : "Reset password"}
          </button>
        </form>

        {status && (
          <p className="mt-5 rounded-xl bg-[#f8f3e9] px-4 py-3 text-center text-sm font-medium text-black/70">
            {status}
          </p>
        )}
      </motion.section>
    </main>
  );
}
