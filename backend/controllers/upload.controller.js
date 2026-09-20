import Admin from "../models/Admin.js";
import { isStaffRole } from "../config/permissions.js";
import ResumeVersion from "../models/ResumeVersion.js";
import { saveResumeVersion } from "../services/resumeService.js";
import Student from "../models/Student.js";
import Company from "../models/Company.js";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";
import cloudinary from "../config/cloudinary.js";
import {
  uploadFileToS3,
  deleteFileFromS3,
  generateSignedFileUrl,
} from "../services/s3Service.js";

export const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const Profile = isStaffRole(req.user.role) ? Admin : Student;
    const existingStudent = await Profile.findById(req.user.id);

    const uploadResult = await uploadToCloudinary(
      req.file.buffer,
      "placement-portal/profile-photos"
    );

    const updatedStudent = await Profile.findByIdAndUpdate(
      req.user.id,
      {
        profilePicture: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
      },
      { returnDocument: "after" }
    );

    if (existingStudent?.profilePicture?.publicId) await cloudinary.uploader.destroy(existingStudent.profilePicture.publicId).catch(() => {});

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

export const uploadResumeController = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Resume file required" });
    const resume = await saveResumeVersion(req.user._id, req.file);
    return res.json({ success: true, message: "Resume uploaded successfully", resume });
  } catch (error) { next(error); }
};

export const listResumeVersions = async (req, res, next) => {
  try {
    const versions = await ResumeVersion.find({ student: req.user._id }).select("fileName contentType uploadedAt createdAt").sort({ createdAt: -1 }).limit(50);
    res.json({ versions });
  } catch (error) { next(error); }
};

export const getSignedResumeUrlController = async (
  req,
  res
) => {
  try {
    const student = await Student.findById(
      req.user.id
    );

    if (!student || (!req.query.versionId && !student.resume?.key)) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    let key = student.resume?.key;
    if (req.query.versionId) {
      if (!/^[a-f\d]{24}$/i.test(req.query.versionId)) return res.status(400).json({ message: "Invalid resume version" });
      const version = await ResumeVersion.findOne({ _id: req.query.versionId, student: student._id });
      if (!version) return res.status(404).json({ message: "Resume version not found" });
      key = version.key;
    }
    const signedUrl = await generateSignedFileUrl(key);

    return res.status(200).json({
      success: true,
      signedUrl,
    });
  } catch (error) {
    console.error(
      "Signed URL generation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate resume URL",
    });
  }
};

export const getStudentResumeByAdminController = async (
  req,
  res
) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(
      studentId
    );

    if (!student || (!req.query.versionId && !student.resume?.key)) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    let key = student.resume?.key;
    if (req.query.versionId) {
      if (!/^[a-f\d]{24}$/i.test(req.query.versionId)) return res.status(400).json({ message: "Invalid resume version" });
      const version = await ResumeVersion.findOne({ _id: req.query.versionId, student: student._id });
      if (!version) return res.status(404).json({ message: "Resume version not found" });
      key = version.key;
    }
    const signedUrl = await generateSignedFileUrl(key);

    return res.status(200).json({
      success: true,
      signedUrl,
    });
  } catch (error) {
    console.error(
      "Admin resume access error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to generate resume URL",
    });
  }
};

export const uploadJDController = async (
  req,
  res
) => {
  try {
    const { companyId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "JD file required",
      });
    }

    const company = await Company.findById(
      companyId
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // DELETE OLD JD
    if (company.jobDescription?.key) {
      await deleteFileFromS3(
        company.jobDescription.key
      );
    }

    // UPLOAD NEW JD
    const uploadedFile = await uploadFileToS3(
      req.file,
      `jds/${company._id}`
    );

    const signedJDUrl = await generateSignedFileUrl(
      uploadedFile.key
    );

    company.jobDescription = {
      key: uploadedFile.key,
      url: uploadedFile.url,
      fileName: req.file.originalname,
      uploadedAt: new Date(),
    };

    await company.save();

    return res.status(200).json({
      success: true,
      message: "JD uploaded successfully",
      jobDescription: {
        ...company.jobDescription,
        signedUrl: signedJDUrl,
      },
    });
  } catch (error) {
    console.error("JD upload error:", error);

    return res.status(500).json({
      success: false,
      message: "JD upload failed",
    });
  }
};

export const getSignedJDUrlController = async (
  req,
  res
) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(
      companyId
    );

    if (!company?.jobDescription?.key) {
      return res.status(404).json({
        success: false,
        message: "JD not found",
      });
    }

    const signedUrl =
      await generateSignedFileUrl(
        company.jobDescription.key
      );

    return res.status(200).json({
      success: true,
      signedUrl,
    });
  } catch (error) {
    console.error(
      "JD signed URL error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate JD URL",
    });
  }
};
