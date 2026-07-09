import mongoose from "mongoose";
import dotenv from "dotenv"
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
}

const connectDB: () => Promise<void> = async () => {

    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: "uber"
        })
        console.log("Connected to Mongo DB")

    } catch (error) {
        console.log(error)
        process.exit(1)
    }

}

export default connectDB