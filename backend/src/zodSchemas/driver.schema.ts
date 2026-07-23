import { z } from "zod";

export const driverRegistrationSchema = z.object({
  userId: z.string(),

  vehicle: z.object({
    type: z.enum(["CAR", "BIKE", "AUTO"]),

    brand: z.string().trim().min(1, "Brand is required"),

    model: z.string().trim().min(1, "Model is required"),

    color: z.string().trim().min(1, "Color is required"),

    registrationNumber: z
      .string()
      .trim()
      .min(1, "Registration number is required")
      .transform((value) => value.toUpperCase()),

    registrationYear: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear()),
  }),

  documents: z.object({
    drivingLicense: z.object({
      number: z.string().trim().min(1, "Driving license number is required"),

      expiryDate: z.coerce.date(),
    }),

    registrationCertificate: z.object({
      number: z
        .string()
        .trim()
        .min(1, "Registration certificate number is required"),
    }),

    insurance: z.object({
      number: z.string().trim().min(1, "Insurance number is required"),

      expiryDate: z.coerce.date(),
    }),

    pollutionCertificate: z.object({
      expiryDate: z.coerce.date(),
    }),
  }),
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),

  longitude: z.number().min(-180).max(180),
});

export type DriverRegistrationInput = z.infer<
  typeof driverRegistrationSchema
>;