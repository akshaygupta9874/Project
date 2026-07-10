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
        .email("Invalid email format")
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
    role: z
        .enum(UserRole)
        .default(UserRole.USER),
});
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
export const ForgotPasswordSchema = z.object({
    email: z
        .string()
        .email("Invalid email format")
        .toLowerCase()
        .trim(),
});
export const ResendVerificationEmailSchema = z.object({
    email: z
        .string()
        .email("Invalid email format")
        .toLowerCase()
        .trim(),
});
export const ResendOtpSchema = z.object({
    email: z
        .string()
        .email("Invalid email format")
        .toLowerCase()
        .trim(),
});
export const ResetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: z
        .string()
        .min(8, "Password must be at least 8 characters long")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
});
//# sourceMappingURL=user.schema.js.map