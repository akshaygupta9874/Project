import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  Car,
  Camera,
  FileText,
  ClipboardCheck,
  IdCard,
  FileCheck2,
  ShieldCheck,
  Leaf,
  Upload,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import LoadingScreen from "./components/LoadingScreen";
import { useAuthContext } from "./context/authContext";
import { registerDriver } from "./lib/driverApi";

/**
 * Driver Registration — "Driver's Logbook"
 * - Fixed Zod parse payload by mapping form fields directly as flat key-value pairs 
 *   (e.g., vehicle.type, documents.drivingLicense.number) so standard multer / body-parser 
 *   middleware parses nested objects correctly without failing string-to-object coercion.
 */

const DISPLAY_FONT = "'Fraunces', 'Iowan Old Style', Georgia, serif";
const BODY_FONT = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

type FormState = {
  profilePhoto: File | null;
  vehicleFront: File | null;
  vehicleBack: File | null;
  vehicleLeft: File | null;
  vehicleRight: File | null;
  vehicleInterior: File | null;
  vehicleType: "CAR" | "BIKE" | "AUTO";
  vehicleBrand: string;
  vehicleModel: string;
  vehicleColor: string;
  registrationNumber: string;
  registrationYear: number;
  licenseNumber: string;
  licenseExpiry: string;
  licenseFront: File | null;
  licenseBack: File | null;
  registrationCertificateNumber: string;
  registrationCertificateImage: File | null;
  insuranceNumber: string;
  insuranceExpiry: string;
  insuranceImage: File | null;
  pollutionExpiry: string;
  pollutionImage: File | null;
};

const STEPS: { key: string; title: string; icon: LucideIcon }[] = [
  { key: "profile", title: "Profile", icon: User },
  { key: "vehicle", title: "Vehicle", icon: Car },
  { key: "photos", title: "Vehicle photos", icon: Camera },
  { key: "documents", title: "Documents", icon: FileText },
  { key: "review", title: "Review", icon: ClipboardCheck },
];

export default function DriverRegistration() {
  const { user, isAuthenticated, loading } = useAuthContext();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [referenceCode] = useState(() => `NV-${Date.now().toString().slice(-6)}`);

  const [form, setForm] = useState<FormState>({
    profilePhoto: null,
    vehicleFront: null,
    vehicleBack: null,
    vehicleLeft: null,
    vehicleRight: null,
    vehicleInterior: null,
    vehicleType: "CAR",
    vehicleBrand: "",
    vehicleModel: "",
    vehicleColor: "",
    registrationNumber: "",
    registrationYear: new Date().getFullYear(),
    licenseNumber: "",
    licenseExpiry: "",
    licenseFront: null,
    licenseBack: null,
    registrationCertificateNumber: "",
    registrationCertificateImage: null,
    insuranceNumber: "",
    insuranceExpiry: "",
    insuranceImage: null,
    pollutionExpiry: "",
    pollutionImage: null,
  });

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return <LoadingScreen label="Getting things ready" sublabel="Verifying your session" />;
  }

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!form.profilePhoto;
      case 1:
        return !!(
          form.vehicleType &&
          form.vehicleBrand.trim() &&
          form.vehicleModel.trim() &&
          form.vehicleColor.trim() &&
          form.registrationNumber.trim() &&
          form.registrationYear > 0
        );
      case 2:
        return !!(
          form.vehicleFront &&
          form.vehicleBack &&
          form.vehicleLeft &&
          form.vehicleRight &&
          form.vehicleInterior
        );
      case 3:
        return !!(
          form.licenseNumber.trim() &&
          form.licenseExpiry &&
          form.licenseFront &&
          form.licenseBack &&
          form.registrationCertificateNumber.trim() &&
          form.registrationCertificateImage &&
          form.insuranceNumber.trim() &&
          form.insuranceExpiry &&
          form.insuranceImage &&
          form.pollutionExpiry &&
          form.pollutionImage
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const goToStep = (index: number) => {
    if (index <= furthestStep) setCurrentStep(index);
  };

  const handleBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const handleNext = () => {
    if (!isStepComplete(currentStep)) return;
    const next = Math.min(STEPS.length - 1, currentStep + 1);
    setCurrentStep(next);
    setFurthestStep((f) => Math.max(f, next));
  };

 const submitApplication = async () => {
  setError("");
  setStatus("");

  if (!user?._id) {
    setError("Unable to determine your account. Please log in again.");
    return;
  }

  const formData = new FormData();

  formData.append("userId", user._id);

  formData.append(
    "vehicle",
    JSON.stringify({
      type: form.vehicleType,
      brand: form.vehicleBrand,
      model: form.vehicleModel,
      color: form.vehicleColor,
      registrationNumber: form.registrationNumber,
      registrationYear: form.registrationYear,
    })
  );

  formData.append(
    "documents",
    JSON.stringify({
      drivingLicense: {
        number: form.licenseNumber,
        expiryDate: form.licenseExpiry,
      },
      registrationCertificate: {
        number: form.registrationCertificateNumber,
      },
      insurance: {
        number: form.insuranceNumber,
        expiryDate: form.insuranceExpiry,
      },
      pollutionCertificate: {
        expiryDate: form.pollutionExpiry,
      },
    })
  );

  if (form.profilePhoto)
    formData.append("profilePhoto", form.profilePhoto);

  if (form.vehicleFront)
    formData.append("vehicleFront", form.vehicleFront);

  if (form.vehicleBack)
    formData.append("vehicleBack", form.vehicleBack);

  if (form.vehicleLeft)
    formData.append("vehicleLeft", form.vehicleLeft);

  if (form.vehicleRight)
    formData.append("vehicleRight", form.vehicleRight);

  if (form.vehicleInterior)
    formData.append("vehicleInterior", form.vehicleInterior);

  if (form.licenseFront)
    formData.append("licenseFront", form.licenseFront);

  if (form.licenseBack)
    formData.append("licenseBack", form.licenseBack);

  if (form.registrationCertificateImage)
    formData.append(
      "registrationCertificate",
      form.registrationCertificateImage
    );

  if (form.insuranceImage)
    formData.append("insurance", form.insuranceImage);

  if (form.pollutionImage)
    formData.append("pollutionCertificate", form.pollutionImage);

  setSubmitting(true);

  try {
    await registerDriver(formData);

    setStatus(
      "Application submitted successfully. Redirecting to dashboard..."
    );

    setTimeout(() => {
      navigate("/driver-dashboard", { replace: true });
    }, 1200);
  } catch (err: any) {
    setError(
      err?.response?.data?.message ??
        "Unable to register as driver. Please try again."
    );
  } finally {
    setSubmitting(false);
  }
}

  const photosAdded = [
    form.vehicleFront,
    form.vehicleBack,
    form.vehicleLeft,
    form.vehicleRight,
    form.vehicleInterior,
  ].filter(Boolean).length;

  const documentsComplete = [
    Boolean(form.licenseNumber && form.licenseExpiry && form.licenseFront && form.licenseBack),
    Boolean(form.registrationCertificateNumber && form.registrationCertificateImage),
    Boolean(form.insuranceNumber && form.insuranceExpiry && form.insuranceImage),
    Boolean(form.pollutionExpiry && form.pollutionImage),
  ].filter(Boolean).length;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#EFEBE9] text-[#3E2723]" style={{ fontFamily: BODY_FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap');
      `}</style>

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-[#D7CCC8]/30 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-[#D7CCC8]/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#E4D8D3]/30 blur-3xl" />
      </div>

      <div className="relative w-full px-4 sm:px-8 lg:px-12 py-8 space-y-8">
        
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full rounded-3xl border border-[#D7CCC8]/60 bg-[#FAF6F0]/90 backdrop-blur-xl shadow-lg px-6 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D7CCC8] bg-[#FAF6F0] text-[#5D4037] transition hover:bg-[#EFEBE9]"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#795548]">
                Uber · Driver onboarding
              </p>
              <h1
                className="text-xl sm:text-2xl font-semibold text-[#3E2723]"
                style={{ fontFamily: DISPLAY_FONT }}
              >
                Apply to drive with us
              </h1>
            </div>
          </div>

          <div className="hidden shrink-0 rounded-2xl border border-[#D7CCC8] bg-[#FAF6F0] px-4 py-2.5 text-right sm:block shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#795548]">Logbook no.</p>
            <p className="text-sm font-bold text-[#5D4037]">{referenceCode}</p>
          </div>
        </motion.header>

        {/* Progress Tracker */}
        <div className="w-full rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-6 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#795548]">
            <span>
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span>{STEPS[currentStep].title}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFEBE9]">
            <motion.div
              className="h-full rounded-full bg-[#5D4037]"
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-4 text-sm text-[#5D4037]"
            >
              {error}
            </motion.div>
          )}
          {status && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9] p-4 text-sm text-[#3E2723] font-medium"
            >
              {status}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wizard Layout */}
        <div className="grid gap-8 lg:grid-cols-[280px_1fr] w-full items-start">
          
          {/* Step Rail Navigation */}
          <div className="h-fit rounded-3xl border border-[#D7CCC8] bg-[#FAF6F0] p-4 shadow-xl lg:sticky lg:top-8 w-full">
            <div className="space-y-2">
              {STEPS.map((step, index) => (
                <StepTab
                  key={step.key}
                  title={step.title}
                  Icon={step.icon}
                  active={index === currentStep}
                  complete={index < STEPS.length - 1 ? isStepComplete(index) : false}
                  reachable={index <= furthestStep}
                  onClick={() => goToStep(index)}
                />
              ))}
            </div>
          </div>

          {/* Step Content Card */}
          <div className="rounded-[32px] border border-[#D7CCC8] bg-[#FAF6F0] p-6 sm:p-10 shadow-xl w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {currentStep === 0 && (
                  <div>
                    <StepHeader
                      icon={User}
                      title="Profile photo"
                      description="Upload a clear profile photo for verification and riders."
                    />
                    <div className="mb-6 flex items-center gap-4">
                      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#D7CCC8] bg-[#EFEBE9] shadow-inner">
                        {form.profilePhoto ? (
                          <img
                            src={URL.createObjectURL(form.profilePhoto)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-8 w-8 text-[#A1887F]" />
                        )}
                      </div>
                      <p className="text-sm text-[#795548]">
                        Choose an image file from your device.
                      </p>
                    </div>
                    <FileField
                      label="Upload profile photo"
                      file={form.profilePhoto}
                      onChange={(file) => updateField("profilePhoto", file)}
                      required
                    />
                  </div>
                )}

                {currentStep === 1 && (
                  <div>
                    <StepHeader
                      icon={Car}
                      title="Vehicle details"
                      description="Tell us about the vehicle you'll be driving."
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      <SelectField
                        label="Type"
                        value={form.vehicleType}
                        onChange={(v) => updateField("vehicleType", v as FormState["vehicleType"])}
                        options={[
                          { value: "CAR", label: "Car" },
                          { value: "BIKE", label: "Bike" },
                          { value: "AUTO", label: "Auto" },
                        ]}
                        required
                      />
                      <Field
                        label="Registration number"
                        value={form.registrationNumber}
                        onChange={(v) => updateField("registrationNumber", v.toUpperCase())}
                        placeholder="WB 25 AB 1234"
                        required
                      />
                      <Field
                        label="Brand"
                        value={form.vehicleBrand}
                        onChange={(v) => updateField("vehicleBrand", v)}
                        placeholder="e.g. Maruti Suzuki"
                        required
                      />
                      <Field
                        label="Model"
                        value={form.vehicleModel}
                        onChange={(v) => updateField("vehicleModel", v)}
                        placeholder="e.g. Swift Dzire"
                        required
                      />
                      <Field
                        label="Color"
                        value={form.vehicleColor}
                        onChange={(v) => updateField("vehicleColor", v)}
                        placeholder="e.g. Pearl white"
                        required
                      />
                      <Field
                        label="Registration year"
                        type="number"
                        value={String(form.registrationYear)}
                        onChange={(v) => updateField("registrationYear", Number(v))}
                        required
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div>
                    <StepHeader
                      icon={Camera}
                      title="Vehicle photos"
                      description="Upload clear image files from all four sides plus the interior."
                    />
                    <div className="grid gap-6 sm:grid-cols-2">
                      <FileField
                        label="Front view"
                        file={form.vehicleFront}
                        onChange={(f) => updateField("vehicleFront", f)}
                        required
                      />
                      <FileField
                        label="Back view"
                        file={form.vehicleBack}
                        onChange={(f) => updateField("vehicleBack", f)}
                        required
                      />
                      <FileField
                        label="Left side view"
                        file={form.vehicleLeft}
                        onChange={(f) => updateField("vehicleLeft", f)}
                        required
                      />
                      <FileField
                        label="Right side view"
                        file={form.vehicleRight}
                        onChange={(f) => updateField("vehicleRight", f)}
                        required
                      />
                      <FileField
                        label="Interior view"
                        file={form.vehicleInterior}
                        onChange={(f) => updateField("vehicleInterior", f)}
                        required
                      />
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div>
                    <StepHeader
                      icon={FileText}
                      title="Documents"
                      description="Upload valid official documents and images."
                    />
                    <div className="space-y-6">
                      <DocumentCard
                        icon={IdCard}
                        title="Driving license"
                        complete={Boolean(
                          form.licenseNumber &&
                            form.licenseExpiry &&
                            form.licenseFront &&
                            form.licenseBack
                        )}
                      >
                        <Field
                          label="License number"
                          value={form.licenseNumber}
                          onChange={(v) => updateField("licenseNumber", v)}
                          placeholder="License number"
                          required
                        />
                        <Field
                          label="Expiry date"
                          type="date"
                          value={form.licenseExpiry}
                          onChange={(v) => updateField("licenseExpiry", v)}
                          required
                        />
                        <FileField
                          label="Front image"
                          file={form.licenseFront}
                          onChange={(f) => updateField("licenseFront", f)}
                          required
                        />
                        <FileField
                          label="Back image"
                          file={form.licenseBack}
                          onChange={(f) => updateField("licenseBack", f)}
                          required
                        />
                      </DocumentCard>

                      <DocumentCard
                        icon={FileCheck2}
                        title="Registration certificate (RC)"
                        complete={Boolean(
                          form.registrationCertificateNumber && form.registrationCertificateImage
                        )}
                      >
                        <Field
                          label="Certificate number"
                          value={form.registrationCertificateNumber}
                          onChange={(v) => updateField("registrationCertificateNumber", v)}
                          placeholder="Certificate number"
                          required
                        />
                        <FileField
                          label="Certificate image"
                          file={form.registrationCertificateImage}
                          onChange={(f) => updateField("registrationCertificateImage", f)}
                          required
                        />
                      </DocumentCard>

                      <DocumentCard
                        icon={ShieldCheck}
                        title="Insurance"
                        complete={Boolean(
                          form.insuranceNumber && form.insuranceExpiry && form.insuranceImage
                        )}
                      >
                        <Field
                          label="Policy number"
                          value={form.insuranceNumber}
                          onChange={(v) => updateField("insuranceNumber", v)}
                          placeholder="Policy number"
                          required
                        />
                        <Field
                          label="Expiry date"
                          type="date"
                          value={form.insuranceExpiry}
                          onChange={(v) => updateField("insuranceExpiry", v)}
                          required
                        />
                        <FileField
                          label="Policy image"
                          file={form.insuranceImage}
                          onChange={(f) => updateField("insuranceImage", f)}
                          required
                        />
                      </DocumentCard>

                      <DocumentCard
                        icon={Leaf}
                        title="Pollution certificate (PUC)"
                        complete={Boolean(form.pollutionExpiry && form.pollutionImage)}
                      >
                        <Field
                          label="Expiry date"
                          type="date"
                          value={form.pollutionExpiry}
                          onChange={(v) => updateField("pollutionExpiry", v)}
                          required
                        />
                        <FileField
                          label="Certificate image"
                          file={form.pollutionImage}
                          onChange={(f) => updateField("pollutionImage", f)}
                          required
                        />
                      </DocumentCard>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div>
                    <StepHeader
                      icon={ClipboardCheck}
                      title="Review & submit"
                      description="Double check everything before sending your application."
                    />
                    <div className="space-y-4">
                      <ReviewRow
                        title="Profile photo"
                        value={form.profilePhoto ? form.profilePhoto.name : "Missing"}
                        onEdit={() => goToStep(0)}
                      />
                      <ReviewRow
                        title="Vehicle"
                        value={`${form.vehicleBrand || "—"} ${form.vehicleModel || ""} · ${
                          form.vehicleColor || "—"
                        } · ${form.registrationNumber || "no reg. number"}`}
                        onEdit={() => goToStep(1)}
                      />
                      <ReviewRow
                        title="Vehicle photos"
                        value={`${photosAdded} of 5 photos added`}
                        onEdit={() => goToStep(2)}
                      />
                      <ReviewRow
                        title="Documents"
                        value={`${documentsComplete} of 4 documents complete`}
                        onEdit={() => goToStep(3)}
                      />
                    </div>
                    <p className="mt-6 text-sm text-[#795548]">
                      Once approved by the admin, you'll be able to access your driver dashboard and
                      receive ride requests.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Step Navigation Footer */}
            <div className="mt-10 flex items-center justify-between border-t border-dashed border-[#D7CCC8] pt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="inline-flex items-center gap-2 rounded-full border border-[#D7CCC8] bg-[#FAF6F0] px-5 py-2.5 text-sm font-semibold text-[#5D4037] transition hover:bg-[#EFEBE9] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              {currentStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepComplete(currentStep)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#5D4037] px-6 py-3 text-sm font-bold text-[#FAF6F0] shadow-lg shadow-[#3E2723]/20 transition hover:bg-[#4E342E] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitApplication}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[#5D4037] px-6 py-3 text-sm font-bold text-[#FAF6F0] shadow-lg shadow-[#3E2723]/20 transition hover:bg-[#4E342E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      Submit application <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function StepTab({
  title,
  Icon,
  active,
  complete,
  reachable,
  onClick,
}: {
  title: string;
  Icon: LucideIcon;
  active: boolean;
  complete: boolean;
  reachable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!reachable}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "bg-[#3E2723] text-[#FAF6F0] shadow-md shadow-[#3E2723]/20"
          : complete
            ? "bg-[#EFEBE9] text-[#5D4037] hover:bg-[#D7CCC8]/40"
            : "text-[#795548] hover:bg-[#EFEBE9]/60"
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
          active
            ? "border-white/20 bg-[#5D4037] text-white"
            : complete
              ? "border-[#D7CCC8] bg-[#FAF6F0] text-[#5D4037]"
              : "border-[#D7CCC8] bg-[#FAF6F0] text-[#795548]"
        }`}
      >
        {complete && !active ? (
          <Check className="h-4 w-4 text-[#5D4037]" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </button>
  );
}

function StepHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#5D4037] text-[#FAF6F0] shadow-md shadow-[#3E2723]/20">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#3E2723]" style={{ fontFamily: DISPLAY_FONT }}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-[#795548]">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "number";
  required?: boolean;
}) {
  return (
    <label className="block w-full">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#795548]">
        {label}
        {required && <span className="text-[#5D4037]"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/60 px-4 py-3.5 text-sm text-[#3E2723] outline-none transition placeholder:text-[#A1887F] focus:border-[#5D4037] focus:ring-2 focus:ring-[#5D4037]/20 shadow-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="block w-full">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#795548]">
        {label}
        {required && <span className="text-[#5D4037]"> *</span>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/60 px-4 py-3.5 text-sm text-[#3E2723] outline-none transition focus:border-[#5D4037] focus:ring-2 focus:ring-[#5D4037]/20 shadow-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileField({
  label,
  file,
  onChange,
  required,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block w-full">
      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-[#795548]">
        {label}
        {required && <span className="text-[#5D4037]"> *</span>}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 cursor-pointer items-center justify-between rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/60 px-4 py-3.5 text-sm text-[#3E2723] transition hover:bg-[#D7CCC8]/40 shadow-sm">
          <span className="truncate text-sm text-[#5D4037]">
            {file ? file.name : "Choose file..."}
          </span>
          <Upload className="h-4 w-4 shrink-0 text-[#795548]" />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            required={required && !file}
            className="hidden"
          />
        </label>
      </div>
    </label>
  );
}

function DocumentCard({
  icon: Icon,
  title,
  complete,
  children,
}: {
  icon: LucideIcon;
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#D7CCC8] bg-[#EFEBE9]/40 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#D7CCC8]/60 text-[#5D4037]">
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-base font-bold text-[#3E2723]">{title}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {complete ? "Complete" : "Pending"}
        </span>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ReviewRow({ title, value, onEdit }: { title: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#D7CCC8] bg-[#EFEBE9]/50 px-5 py-4 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#795548]">{title}</p>
        <p className="mt-1 text-sm font-semibold text-[#3E2723]">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#D7CCC8] bg-[#FAF6F0] px-4 py-2 text-xs font-bold text-[#5D4037] transition hover:bg-[#EFEBE9] shadow-sm"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
    </div>
  );
}