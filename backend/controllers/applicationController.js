import Application from "../models/Application.js";
import Company from "../models/Company.js";


// APPLY TO COMPANY
export const applyToCompany = async (req, res, next) => {
  try {
    const studentId = req.user._id;
    const { companyId } = req.body;

    // check input
    if (!companyId) {
      return res.status(400).json({ message: "Company ID is required" });
    }

    // check company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // fetch student from req.user
    const student = req.user;

    if (!student.profileCompleted || !Number.isFinite(student.cgpa) || student.cgpa < 0 || student.cgpa > 10 ||
        !Number.isInteger(student.activeBacklogs) || student.activeBacklogs < 0) {
      return res.status(400).json({ message: "Complete a valid academic profile before applying" });
    }
    if (company.registrationDeadline && new Date(company.registrationDeadline) <= new Date()) {
      return res.status(400).json({ message: "Registration deadline has passed" });
    }

    // CGPA check
    if (student.cgpa < company.minCgpa) {
      return res.status(400).json({
        message: "Not eligible: CGPA too low",
      });
    }

    // branch check (case and whitespace insensitive, robust normalization)
    const userBranch = String(student.branch || "")
      .toUpperCase()
      .trim();

    // normalize allowed branches safely (handles array OR string from DB)
    let allowedBranchesRaw = company.allowedBranches || [];

    if (typeof allowedBranchesRaw === "string") {
      allowedBranchesRaw = allowedBranchesRaw.split(",");
    }

    const allowedBranches = allowedBranchesRaw
      .map((b) => String(b).toUpperCase().trim())
      .filter(Boolean);

    if (!allowedBranches.includes(userBranch)) {
      return res.status(400).json({
        message: "Not eligible: Branch not allowed",
      });
    }

    // active backlog count check
    if (student.activeBacklogs > company.maxBacklogsAllowed) {
      return res.status(400).json({
        message: "Not eligible: Too many active backlogs",
      });
    }

    // strict backlog rule (make safe if allowActiveBacklogs is undefined)
    if (company.allowActiveBacklogs === false && student.activeBacklogs > 0) {
      return res.status(400).json({
        message: "Not eligible: Active backlog not allowed",
      });
    }

    // check already applied
    const existingApplication = await Application.findOne({
      student: studentId,
      company: companyId,
    });

    if (existingApplication) {
      return res.status(400).json({ message: "Already applied" });
    }

    // create application
    const application = await Application.create({
      student: studentId,
      company: companyId,
      isEligible: true,

      snapshot: {
        name: student.name,
        email: student.email,
        cgpa: student.cgpa,
        branch: student.branch,
        backlogs: student.activeBacklogs || 0
      }
    });

    res.status(201).json({
      message: "Applied successfully",
      application,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Already applied" });
    next(error);
  }

};

// GET APPLICATIONS BY COMPANY (Admin)
export const getApplicationsByCompany = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const applications = await Application.find({ company: companyId })
      .populate("student", "-refreshToken -password -googleId")
      .populate("company");

    res.status(200).json(applications);
  } catch (error) {
    next(error);
  }
};

// GET MY APPLICATIONS (Student Dashboard)
export const getMyApplications = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    const applications = await Application.find({
      student: studentId,
    }).populate("company");

    res.status(200).json(applications);
  } catch (error) {
    next(error);
  }
};

// GET ALL APPLICATIONS (Admin Dashboard)
export const getAllApplications = async (req, res, next) => {
  try {
    const applications = await Application.find()
      .populate("student", "-refreshToken -password -googleId")
      .populate("company");

    res.status(200).json(applications);
  } catch (error) {
    next(error);
  }
};

// UPDATE APPLICATION STATUS (Admin)
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    // fetch application with student populated
    const application = await Application.findById(applicationId).populate("student", "-refreshToken -password -googleId");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // FIX 1: ensure valid enum format
    const updatedStatus = status.toUpperCase();

    // FIX 2: ensure snapshot exists (required fields)
    if (!application.snapshot || !application.snapshot.name || !application.snapshot.email) {
      application.snapshot = {
        name: application.student?.name || "N/A",
        email: application.student?.email || "N/A"
      };
    }

    // update status
    application.status = updatedStatus;

    await application.save();

    res.status(200).json({
      message: "Status updated",
      application,
    });
  } catch (error) {
    next(error);
  }
};
export const deleteApplication = async (req, res, next) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Only student can delete their own application
    if (application.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await application.deleteOne();

    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    next(error);
  }
};