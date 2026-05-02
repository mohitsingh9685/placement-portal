import Application from "../models/Application.js";
import Company from "../models/Company.js";
import Student from "../models/Student.js"; 

// APPLY TO COMPANY
export const applyToCompany = async (req, res) => {
  try {
    console.log("USER:", req.user);
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

    // CGPA check
    if (student.cgpa < company.minCgpa) {
      return res.status(400).json({
        message: "Not eligible: CGPA too low",
      });
    }

    // branch check
    if (!company.allowedBranches.includes(student.branch)) {
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

    // strict backlog rule
    if (!company.allowActiveBacklogs && student.hasActiveBacklog) {
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
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }

};

// GET APPLICATIONS BY COMPANY (Admin)
export const getApplicationsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const applications = await Application.find({ company: companyId })
      .populate("student")
      .populate("company");

    res.status(200).json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET MY APPLICATIONS (Student Dashboard)
export const getMyApplications = async (req, res) => {
  try {
    const studentId = req.user._id;

    const applications = await Application.find({
      student: studentId,
    }).populate("company");

    res.status(200).json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET ALL APPLICATIONS (Admin Dashboard)
export const getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate("student")
      .populate("company");

    res.status(200).json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// UPDATE APPLICATION STATUS (Admin)
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    // fetch application with student populated
    const application = await Application.findById(applicationId).populate("student");

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
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
