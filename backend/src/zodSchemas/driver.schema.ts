import { z } from "zod";

export const driverRegistrationSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid User ID"), // Validates MongoDB ObjectId
  
  profilePhoto: z.object({
    url: z.string().url(),
    publicId: z.string(),
  }),

  vehicleImages: z.object({
    front: z.string().url(),
    back: z.string().url(),
    left: z.string().url(),
    right: z.string().url(),
    interior: z.string().url(),
  }),

  vehicle: z.object({
    type: z.enum(["CAR", "BIKE", "AUTO"]),
    brand: z.string().trim().min(1, "Brand is required"),
    model: z.string().trim().min(1, "Model is required"),
    color: z.string().trim().min(1, "Color is required"),
    registrationNumber: z.string().trim().min(1, "Registration number is required"),
    registrationYear: z.number().int().min(1900).max(new Date().getFullYear()),
  }),

  documents: z.object({
    drivingLicense: z.object({
      number: z.string(),
      expiryDate: z.coerce.date(),
      frontImage: z.string().url(),
      backImage: z.string().url(),
      verified: z.boolean().default(false),
    }),
    registrationCertificate: z.object({
      number: z.string(),
      image: z.string().url(),
      verified: z.boolean().default(false),
    }),
    insurance: z.object({
      number: z.string(),
      expiryDate: z.coerce.date(),
      image: z.string().url(),
      verified: z.boolean().default(false),
    }),
    pollutionCertificate: z.object({
      expiryDate: z.coerce.date(),
      image: z.string().url(),
    }),
  }),
});

export const updateLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

export type DriverRegistrationInput = z.infer<typeof driverRegistrationSchema>;