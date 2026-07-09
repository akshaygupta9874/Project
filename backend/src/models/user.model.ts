import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export enum UserRole {
  USER = "USER",
  ADMIN = "ADMIN",
}

export interface IUser extends Document {
  firstName: string;
  lastName : string
  email: string;
  password: string;
  role: UserRole;

//   isVerified: boolean;
//   refreshToken?: string;

//   passwordChangedAt?: Date;

//   passwordResetToken?: string;
//   passwordResetExpires?: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    lastName : {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },

    // isVerified: {
    //   type: Boolean,
    //   default: false,
    // },

    // refreshToken: {
    //   type: String,
    //   default: null,
    //   select: false,
    // },

    // passwordChangedAt: {
    //   type: Date,
    // },

    // passwordResetToken: {
    //   type: String,
    //   select: false,
    // },

    // passwordResetExpires: {
    //   type: Date,
    //   select: false,
    // },
  },
  {
    timestamps: true,
  }
);

// Compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
) {
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);

export default UserModel;