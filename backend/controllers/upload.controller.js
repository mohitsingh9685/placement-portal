import Student from "../models/Student.js";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";
import cloudinary from "../config/cloudinary.js";

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const existingStudent = await Student.findById(req.user.id);

    if (existingStudent?.profilePicture?.publicId) {
      await cloudinary.uploader.destroy(
        existingStudent.profilePicture.publicId
      );
    }

    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      "placement-portal/profile-photos"
    );

    const updatedStudent = await Student.findByIdAndUpdate(
      req.user.id,
      {
        profilePicture: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      profilePicture: updatedStudent.profilePicture,
    });
  } catch (error) {
    console.error("Profile upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Upload failed",
    });
  }
};