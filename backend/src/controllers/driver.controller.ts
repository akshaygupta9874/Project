import { Request, Response } from "express";
import asyncTryCatchHandler from "../middlewares/TryCatch.js";
import { AuthenticatedRequest } from "../middlewares/isAuthenticated.js";
import { DriverRegistrationInput, driverRegistrationSchema, updateLocationSchema } from "../zodSchemas/driver.schema.js";
import { DriverModel } from "../models/driver.model.js";
import { updateDriverLocation } from "../redis/services/geo.service.js";


export const driverRegistrationController = asyncTryCatchHandler(
    async (request: Request, response: Response) => {
        const authRequest = request as AuthenticatedRequest;
        const userId = authRequest.userId;
        const zodValidatedData = driverRegistrationSchema.safeParse(authRequest.body);
        if (!zodValidatedData.success) {
            return response.status(400).json({
                success: false,
                message: "Invalid input data",
                errors: zodValidatedData.error.issues
            });
        }
        const { profilePhoto, vehicleImages, vehicle, documents } = zodValidatedData.data as DriverRegistrationInput;
        const existingDriver = await DriverModel.findOne({ user: userId });
        if (existingDriver && existingDriver.isVerified) {
            return response.status(400).json({
                success: false,
                message: "Driver profile already exists and is verified."
            });
        }
        if (existingDriver && !existingDriver.isVerified) {
            return response.status(400).json({
                success: false,
                message: "You Already Applied for Driver Verification. Please wait for the approval.or Re Apply with correct credentials if rejected",
                verificationStatus: existingDriver.verificationStatus
            })
        }
        try {
            const newDriver = await DriverModel.create(
                {
                    user: userId,
                    profilePhoto,
                    vehicleImages,
                    vehicle,
                    documents
                }
            )
            return response.status(201).json({
                success: true,
                message: "Driver profile created successfully. Awaiting verification.",
                data: {
                    id: newDriver._id,
                    verificationStatus: newDriver.verificationStatus
                }
            });


        } catch (error: any) {
            //look after race condtion jab do request ik sath aa jayega client side se aur do entries create ho jayenge same user ke liye tab mongodb 11000 error code se error throe karega
            if (error.code === 11000) {
                return response.status(409).json({
                    success: false,
                    message: "Driver profile already exists."
                });
            }

            throw error;
        }

    }
)

export const driverProfileController = asyncTryCatchHandler(
    async (request: Request, response: Response) => {
        const authRequest = request as AuthenticatedRequest;
        const userId = authRequest.userId;
        const driverProfile = await DriverModel.findOne({ userId: userId }).select("-_id");
        if (!driverProfile) {
            return response.status(404).json(
                {
                    message: "You have not Registered for the Driver Role till now "
                }
            )
        }
        return response.status(200).json(
            {
                message: "Driver Profile Fetched Successfully",
                data: driverProfile
            }
        )
    }
)

export const updateDriverLocationController = asyncTryCatchHandler(
    async (request: AuthenticatedRequest, response: Response) => {
        const zodValidatedData = updateLocationSchema.safeParse(request.body)
        if (!zodValidatedData.success) {
            return response.status(400).json({
                success: false,
                message: "Invalid input data",
                errors: zodValidatedData.error.issues
            });
        }
        const userId = request.userId

        const driverProfile = await DriverModel.findOne({ userId: userId }).select("_id");
        if (!driverProfile) {
            return response.status(404).json(
                {
                    message: "You have not Registered for the Driver Role till now "
                }
            )
        }
        const driverId = driverProfile._id;
        const {longitude , latitude} = zodValidatedData.data

        updateDriverLocation(driverId.toString(),longitude,latitude)

        return response.status(200).json(
            {
                message : "Driver ka location updated Successfully"
            }
        )

    }
)