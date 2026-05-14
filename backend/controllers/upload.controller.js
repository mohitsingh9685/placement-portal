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

export const uploadResumeController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume file required",
      });
    }

    const student = await Student.findById(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // DELETE OLD RESUME
    if (student.resume?.key) {
      await deleteFileFromS3(student.resume.key);
    }

    // UPLOAD TO S3
    const uploadedFile = await uploadFileToS3(
      req.file,
      `resumes/${student._id}`
    );

    const signedResumeUrl = await generateSignedFileUrl(
      uploadedFile.key
    );

    student.resume = {
      key: uploadedFile.key,
      url: uploadedFile.url,
      fileName: req.file.originalname,
      uploadedAt: new Date(),
    };

    await student.save();

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      resume: {
        ...student.resume,
        signedUrl: signedResumeUrl,
      },
    });
  } catch (error) {
    console.error("Resume upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Resume upload failed",
    });
  }
};

export const getSignedResumeUrlController = async (
  req,
  res
) => {
  try {
    const student = await Student.findById(
      req.user.id
    );

    if (!student?.resume?.key) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const signedUrl =
      await generateSignedFileUrl(
        student.resume.key
      );

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

    if (!student?.resume?.key) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    const signedUrl =
      await generateSignedFileUrl(
        student.resume.key
      );

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
