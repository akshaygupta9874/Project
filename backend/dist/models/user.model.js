import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
export var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (UserRole = {}));
const userSchema = new Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
    },
    lastName: {
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
}, {
    timestamps: true,
});
// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};
const UserModel = mongoose.models.User ||
    mongoose.model("User", userSchema);
export default UserModel;
//# sourceMappingURL=user.model.js.map