import upload from "./multer.middleware.js";

export const uploadDriverDocuments = upload.fields([
  { name: "profilePhoto", maxCount: 1 },

  { name: "vehicleFront", maxCount: 1 },
  { name: "vehicleBack", maxCount: 1 },
  { name: "vehicleLeft", maxCount: 1 },
  { name: "vehicleRight", maxCount: 1 },
  { name: "vehicleInterior", maxCount: 1 },

  { name: "licenseFront", maxCount: 1 },
  { name: "licenseBack", maxCount: 1 },

  { name: "registrationCertificate", maxCount: 1 },

  { name: "insurance", maxCount: 1 },

  { name: "pollutionCertificate", maxCount: 1 },
]);