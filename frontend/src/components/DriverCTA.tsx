import { motion, type Variants } from "framer-motion";
import {
  Car,
  Clock3,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export type VerificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

interface Driver {
  verificationStatus: VerificationStatus;
  isVerified: boolean;
}

interface DriverCTAProps {
  driver: Driver | null;
  loading: boolean;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

export default function DriverCTA({
  driver,
  loading = false,
}: DriverCTAProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <motion.section
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="
          relative isolate overflow-hidden
          rounded-[2rem]
          border border-[#c58a3a]/35
          bg-gradient-to-br
          from-[#3a1f0a]
          via-[#6b3a12]
          to-[#2e1808]
          backdrop-blur-xl
          p-7
          shadow-[0_30px_80px_rgba(0,0,0,.45)]
        "
      >
        <BackgroundDecor />

        <div className="relative z-10">
          <p className="text-sm text-[#F6DCA6]">
            Loading driver information...
          </p>
        </div>
      </motion.section>
    );
  }

  if (!driver) {
    return (
      <CardWrapper
        icon={<Car className="h-7 w-7 text-[#FFD88A]" />}
        title="Complete Driver Registration"
        description="Finish your registration to continue."
      >
        <CTAButton
          onClick={() => navigate("/driver-registration")}
        >
          Complete Registration
        </CTAButton>
      </CardWrapper>
    );
  }

  switch (driver.verificationStatus) {
    case "PENDING":
      return (
        <CardWrapper
          icon={
            <Clock3 className="h-7 w-7 text-amber-300" />
          }
          title="Application Under Review"
          description="Our team is reviewing your submitted documents."
        >
          <CTAButton disabled>
            Pending Review
          </CTAButton>
        </CardWrapper>
      );

    case "REJECTED":
      return (
        <CardWrapper
          icon={
            <XCircle className="h-7 w-7 text-red-300" />
          }
          title="Application Rejected"
          description="Please update your documents and submit your application again."
        >
          <CTAButton
            onClick={() => navigate("/driver-registration")}
          >
            Resubmit Application
          </CTAButton>
        </CardWrapper>
      );

    case "APPROVED":
      return (
        <CardWrapper
          icon={
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          }
          title="You're Approved!"
          description="Go online and start accepting ride requests."
        >
          <CTAButton
            onClick={() => navigate("/driver-dashboard")}
          >
            Enter Driver Dashboard
          </CTAButton>
        </CardWrapper>
      );

    default:
      return null;
  }
}

interface CardWrapperProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function CardWrapper({
  icon,
  title,
  description,
  children,
}: CardWrapperProps) {
  return (
    <motion.section
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      className="
        relative isolate overflow-hidden
        rounded-[2rem]
        border border-[#c58a3a]/35
        bg-gradient-to-br
        from-[#3a1f0a]
        via-[#6b3a12]
        to-[#2e1808]
        backdrop-blur-xl
        p-7
        shadow-[0_30px_80px_rgba(0,0,0,.45)]
      "
    >
      <BackgroundDecor />

      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-5">
          <div
            className="
              grid h-16 w-16 shrink-0 place-items-center
              rounded-2xl
              border border-[#c58a3a]/30
              bg-[#ffd88a]/10
              shadow-inner
            "
          >
            {icon}
          </div>

          <div>
            <h3
              className="
                text-2xl
                font-bold
                tracking-tight
                text-[#FFF4D6]
              "
            >
              {title}
            </h3>

            <p
              className="
                mt-2
                max-w-lg
                text-[15px]
                leading-6
                text-[#E8CFA3]
              "
            >
              {description}
            </p>
          </div>
        </div>

        <div className="shrink-0 md:ml-8">
          {children}
        </div>
      </div>
    </motion.section>
  );
}

function CTAButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      className="
        group relative
        h-14
        min-w-[240px]
        overflow-hidden
        rounded-xl
        bg-gradient-to-br
        from-[#3a1f0a]
        via-[#6b3a12]
        to-[#2e1808]
        px-8
        text-base
        font-semibold
        text-[#ffe9be]
        shadow-[0_18px_40px_-12px_rgba(58,31,10,0.7),inset_0_1px_0_rgba(255,216,138,0.35)]
        transition-all
        hover:-translate-y-0.5
        hover:shadow-[0_24px_50px_-14px_rgba(58,31,10,0.85)]
        disabled:cursor-not-allowed
        disabled:opacity-60
      "
    >
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-[#c58a3a]/40" />

      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[#ffd88a]/60 to-transparent transition-transform duration-1000 group-hover:translate-x-[460%]" />

      <span className="relative z-10 inline-flex items-center gap-2">
        {children}

        {!disabled && (
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <ArrowRight className="h-4 w-4 text-[#FFD88A]" />
          </motion.span>
        )}
      </span>
    </Button>
  );
}

function BackgroundDecor() {
  return (
    <>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#d8a24c]/20 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-[#c58a3a]/10 blur-[80px]" />
      </div>

      {/* Metallic inner border */}
      <div className="pointer-events-none absolute inset-[1px] rounded-[calc(2rem-2px)] border border-white/10" />

      {/* Brass rails */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#d7a44a] to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#d7a44a] to-transparent" />

      {/* Accent glow */}
      <div className="pointer-events-none absolute left-5 top-5 h-20 w-20 rounded-full border border-[#c58a3a]/15 bg-[#d8a24c]/5 blur-2xl" />
      <div className="pointer-events-none absolute bottom-5 right-5 h-24 w-24 rounded-full border border-[#c58a3a]/15 bg-[#d8a24c]/5 blur-3xl" />
    </>
  );
}