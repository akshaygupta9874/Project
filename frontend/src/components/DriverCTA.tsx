import { motion } from "framer-motion";
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

import type { User } from "../context/authContext";

interface Driver {
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  isVerified: boolean;
}

interface DriverCTAProps {
  user: User;
  driver: Driver | null;
  loading: boolean;
}
export default function DriverCTA({
  user,
  driver,
  loading = false,
}: DriverCTAProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-8 rounded-3xl border border-[#E4D6BE] bg-[#FBF6EC] p-6"
      >
        <p className="text-sm text-[#8A7761]">
          Loading driver information...
        </p>
      </motion.div>
    );
  }

  if (user.role && !user.role.includes("DRIVER")) {
    return (
      <CardWrapper
        icon={<Car className="h-5 w-5 text-[#5C3D24]" />}
        title="Become a Driver"
        description="Earn money by driving on our platform."
      >
        <Button
          onClick={() => navigate("/driver-registration")}
          className="rounded-full"
        >
          Become Driver
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardWrapper>
    );
  }

  if (!driver) {
    return (
      <CardWrapper
        icon={<Car className="h-5 w-5 text-[#5C3D24]" />}
        title="Complete Driver Registration"
        description="Finish your registration to continue."
      >
        <Button
          onClick={() => navigate("/driver-registration")}
          className="rounded-full"
        >
          Complete Registration
        </Button>
      </CardWrapper>
    );
  }

  switch (driver.verificationStatus) {
    case "PENDING":
      return (
        <CardWrapper
          icon={<Clock3 className="h-5 w-5 text-amber-600" />}
          title="Application Under Review"
          description="Our team is reviewing your documents."
        >
          <Button disabled className="rounded-full">
            Pending Review
          </Button>
        </CardWrapper>
      );

    case "REJECTED":
      return (
        <CardWrapper
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          title="Application Rejected"
          description="Please update your documents and apply again."
        >
          <Button
            onClick={() => navigate("/driver-registration")}
            className="rounded-full"
          >
            Resubmit Application
          </Button>
        </CardWrapper>
      );

    case "APPROVED":
      return (
        <CardWrapper
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          title="You're Approved!"
          description="Go online and start accepting rides."
        >
          <Button
            onClick={() => navigate("/driver-dashboard")}
            className="rounded-full"
          >
            Go Online
          </Button>
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
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 overflow-hidden rounded-3xl border border-[#E4D6BE] bg-gradient-to-br from-[#F1E0BE]/70 via-[#F7EAD0]/40 to-transparent p-5"
    >
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F1E4CC]">
          {icon}
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold text-[#3A2A1E]">
            {title}
          </p>

          <p className="text-xs text-[#8A7761]">
            {description}
          </p>
        </div>

        {children}
      </div>
    </motion.div>
  );
}