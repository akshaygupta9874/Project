import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.config.js";

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
}

class CloudinaryService {
  /**
   * Upload a single image to Cloudinary
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
        },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error) {
            return reject(error);
          }

          if (!result) {
            return reject(new Error("Cloudinary upload failed."));
          }

          resolve({
            publicId: result.public_id,
            url: result.secure_url,
          });
        },
      );

      stream.end(file.buffer);
    });
  }

  /**
   * Delete a single image
   */
  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  /**
   * Delete multiple images
   */
  async deleteImages(publicIds: string[]): Promise<void> {
    if (publicIds.length === 0) return;

    await Promise.all(
      publicIds.map((publicId) => this.deleteImage(publicId)),
    );
  }
}

export default new CloudinaryService();