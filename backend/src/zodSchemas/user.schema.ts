import { z } from 'zod';
import { UserRole } from '../models/user.model.js';

export const UserRegistrationSchema = z.object({
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters long")
    .max(50, "First name cannot exceed 50 characters")
    .trim(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters long")
    .max(50, "Last name cannot exceed 50 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email format")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    // Optional: add regex for password complexity
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
  role: z
    .enum(UserRole)
    .default(UserRole.USER),

});

// Infer the type from the schema so you don't have to define it twice
export type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;

export const UserLoginSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    // Optional: add regex for password complexity
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
  role: z
    .enum(UserRole)
    .default(UserRole.USER),

});

// Infer the type from the schema so you don't have to define it twice
export type UserLoginInput = z.infer<typeof UserLoginSchema>;