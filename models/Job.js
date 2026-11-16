const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    recruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    jobType: {
        type: String,
        enum: ["Full Time", "Part Time", "Internship", "Remote"],
        required: true
    },
    experience: {
        type: String,
        required: true
    },
    salaryMin: {
        type: Number,
        required: true
    },
    salaryMax: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    skills: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Job", jobSchema);