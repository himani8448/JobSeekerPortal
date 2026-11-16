require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");

const User = require("./models/User");
const Application = require("./models/Application");
const Job = require("./models/Job");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Resume Upload Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF and DOCX files are allowed"));
        }
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch(error => console.log("MongoDB Connection Error:", error));

// Helper: recruiter account check
async function getRecruiter(req, res) {
    const recruiter = await User.findById(req.params.recruiterId);

    if (!recruiter || recruiter.role !== "recruiter") {
        res.status(403).json({ message: "Recruiter access required" });
        return null;
    }

    return recruiter;
}

// Candidate Registration
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });

        if (existingUser) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: "candidate"
        });

        await newUser.save();

        res.status(201).json({ message: "Registration successful!" });

    } catch (error) {
        console.log("Registration Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Recruiter Registration
app.post("/api/recruiter/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const normalizedEmail = email.toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(409).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const recruiter = new User({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: "recruiter"
        });

        await recruiter.save();

        res.status(201).json({
            message: "Recruiter registration successful!"
        });

    } catch (error) {
        console.log("Recruiter Registration Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// Candidate and Recruiter Login
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                message: "User not found. Please sign up first."
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        res.status(200).json({
            message: "Login successful!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.log("Login Error:", error);
        res.status(500).json({ message: "Login failed" });
    }
});

// Job Search with Filters
app.get("/api/jobs", async (req, res) => {
    try {
        const { keyword, location, jobType, experience, minSalary, maxSalary } = req.query;

        const filter = {};

        if (keyword) {
            const words = keyword.trim().split(/\s+/).filter(Boolean);
            const escaped = words.map(word =>
                word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            );

            filter.$or = [
                { title: { $regex: escaped.join(".*"), $options: "i" } },
                { company: { $regex: keyword, $options: "i" } },
                { skills: { $regex: keyword, $options: "i" } }
            ];
        }

        if (location) {
            filter.location = { $regex: location, $options: "i" };
        }

        if (jobType) filter.jobType = jobType;
        if (experience) filter.experience = experience;

        if (minSalary || maxSalary) {
            filter.salaryMax = { $gte: Number(minSalary || 0) };

            if (maxSalary) {
                filter.salaryMin = { $lte: Number(maxSalary) };
            }
        }

        const jobs = await Job.find(filter).sort({ createdAt: -1 });
        res.status(200).json(jobs);

    } catch (error) {
        console.log("Job Search Error:", error);
        res.status(500).json({ message: "Unable to search jobs" });
    }
});

// Job Details
app.get("/api/jobs/:jobId", async (req, res) => {
    try {
        const job = await Job.findById(req.params.jobId);

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json(job);

    } catch (error) {
        res.status(500).json({ message: "Unable to fetch job details" });
    }
});

// Recruiter: Post Job
app.post("/api/recruiter/:recruiterId/jobs", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const {
            title, company, location, jobType, experience,
            salaryMin, salaryMax, description, skills
        } = req.body;

        if (
            !title || !company || !location || !jobType ||
            !experience || salaryMin === undefined ||
            salaryMax === undefined || !description
        ) {
            return res.status(400).json({ message: "Please fill all required job fields" });
        }

        const job = new Job({
            recruiterId: recruiter._id,
            title,
            company,
            location,
            jobType,
            experience,
            salaryMin: Number(salaryMin),
            salaryMax: Number(salaryMax),
            description,
            skills: Array.isArray(skills)
                ? skills
                : String(skills || "").split(",").map(s => s.trim()).filter(Boolean)
        });

        await job.save();

        res.status(201).json({
            message: "Job posted successfully!",
            job
        });

    } catch (error) {
        console.log("Post Job Error:", error);
        res.status(500).json({ message: "Unable to post job" });
    }
});

// Recruiter: View Own Jobs
app.get("/api/recruiter/:recruiterId/jobs", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const jobs = await Job.find({ recruiterId: recruiter._id })
            .sort({ createdAt: -1 });

        res.status(200).json(jobs);

    } catch (error) {
        res.status(500).json({ message: "Unable to fetch recruiter jobs" });
    }
});

// Recruiter: Edit Job
app.put("/api/recruiter/:recruiterId/jobs/:jobId", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const job = await Job.findOneAndUpdate(
            { _id: req.params.jobId, recruiterId: recruiter._id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json({ message: "Job updated successfully!", job });

    } catch (error) {
        console.log("Edit Job Error:", error);
        res.status(500).json({ message: "Unable to update job" });
    }
});

// Recruiter: Delete Job
app.delete("/api/recruiter/:recruiterId/jobs/:jobId", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const job = await Job.findOneAndDelete({
            _id: req.params.jobId,
            recruiterId: recruiter._id
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json({ message: "Job deleted successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Unable to delete job" });
    }
});

// Recruiter: View Applicants
app.get("/api/recruiter/:recruiterId/applicants", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const recruiterJobs = await Job.find({ recruiterId: recruiter._id })
            .select("title company");

        const titles = recruiterJobs.map(job => job.title);

        const applications = await Application.find({
            jobTitle: { $in: titles }
        }).sort({ appliedAt: -1 });

        res.status(200).json(applications);

    } catch (error) {
        res.status(500).json({ message: "Unable to fetch applicants" });
    }
});

// Apply for Job with Candidate Details and Resume Upload
app.post("/api/apply", upload.single("resume"), async (req, res) => {
    try {
        const {
            userId,
            jobId,
            jobTitle,
            company,
            candidateName,
            email,
            phone,
            location,
            skills
        } = req.body;

        if (
            !userId ||
            !jobTitle ||
            !company ||
            !candidateName ||
            !email ||
            !phone ||
            !req.file
        ) {
            return res.status(400).json({
                message: "Please fill all required fields and upload your resume"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        let validJobId = null;

        if (jobId) {
            if (!mongoose.Types.ObjectId.isValid(jobId)) {
                return res.status(400).json({
                    message: "Invalid job ID"
                });
            }

            validJobId = jobId;
        }

        const application = new Application({
            userId,
            jobId: validJobId,
            jobTitle,
            company,
            candidateName,
            email: email.toLowerCase().trim(),
            phone,
            location: location || "",
            skills: Array.isArray(skills)
                ? skills
                : String(skills || "")
                    .split(",")
                    .map(skill => skill.trim())
                    .filter(Boolean),
            resume: req.file.filename
        });

        await application.save();

        res.status(201).json({
            message: "Job application submitted successfully!",
            applicationId: application._id,
            resume: req.file.filename
        });

    } catch (error) {
        console.log("Application Error:", error);
        res.status(500).json({
            message: "Application submission failed"
        });
    }
});
// Get Applications of a User
app.get("/api/applications/:userId", async (req, res) => {
    try {
        const applications = await Application.find({
            userId: req.params.userId
        }).sort({ appliedAt: -1 });

        res.status(200).json(applications);

    } catch (error) {
        res.status(500).json({ message: "Unable to fetch applications" });
    }
});

// Get Profile
app.get("/api/profile/:userId", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);

    } catch (error) {
        res.status(500).json({ message: "Unable to fetch profile" });
    }
});

// Update Profile
app.put("/api/profile/:userId", async (req, res) => {
    try {
        const { name, phone, location, skills } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { name, phone, location, skills },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully!",
            user
        });

    } catch (error) {
        res.status(500).json({ message: "Profile update failed" });
    }
});

// Upload Profile Resume
app.post("/api/upload-resume/:userId", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please select a resume file" });
        }

        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.resume = req.file.filename;
        await user.save();

        res.status(200).json({
            message: "Resume uploaded successfully!",
            resume: req.file.filename
        });

    } catch (error) {
        res.status(500).json({ message: "Resume upload failed" });
    }
});

// Home Route
app.get("/", (req, res) => {
    res.send("Job Seeker Portal Backend is Running!");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.put("/api/recruiter/:recruiterId/applications/:applicationId/status", async (req, res) => {
    try {
        const recruiter = await getRecruiter(req, res);
        if (!recruiter) return;

        const { status } = req.body;
        const allowedStatuses = [
            "Applied",
            "Shortlisted",
            "Rejected",
            "Interview Scheduled",
            "Selected"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid application status" });
        }

        const application = await Application.findById(req.params.applicationId);

        if (!application) {
            return res.status(404).json({ message: "Application not found" });
        }

        if (!application.jobId) {
            return res.status(400).json({ message: "This application is not linked to a posted job" });
        }

        const job = await Job.findOne({
            _id: application.jobId,
            recruiterId: recruiter._id
        });

        if (!job) {
            return res.status(403).json({ message: "You cannot update this application" });
        }

        application.status = status;
        await application.save();

        res.status(200).json({
            message: "Application status updated successfully",
            status: application.status
        });

    } catch (error) {
        console.log("Status Update Error:", error);
        res.status(500).json({ message: "Unable to update application status" });
    }
});
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});