// Static jobs already present in index.html
let recruiterJobs = [];

// Load recruiter jobs from MongoDB
async function loadRecruiterJobs() {
    const container = document.getElementById("jobContainer");

    try {
        const response = await fetch("http://localhost:5000/api/jobs");

        if (!response.ok) {
            throw new Error("Unable to fetch jobs");
        }

        const jobs = await response.json();
        recruiterJobs = Array.isArray(jobs) ? jobs : [];

        recruiterJobs.forEach((job) => {
            const card = document.createElement("div");
            card.className = "job-card recruiter-job";
            card.dataset.jobId = job._id;
            const salary = `₹${job.salaryMin} - ${job.salaryMax} LPA`;
            const skills = Array.isArray(job.skills)
                ? job.skills.join(", ")
                : "";

            card.innerHTML = `
                <h3>${escapeHTML(job.title)}</h3>
                <p>${escapeHTML(job.company)}</p>
                <p>Location: ${escapeHTML(job.location)}</p>
                <p>Job Type: ${escapeHTML(job.jobType)}</p>
                <p>Experience: ${escapeHTML(job.experience)}</p>
                <p>Salary: ${escapeHTML(salary)}</p>
                <p>Skills: ${escapeHTML(skills)}</p>
                <button class="apply-btn">Apply Now</button>
            `;

            card.querySelector(".apply-btn").addEventListener("click", () => {
                applyJob(job.title, job.company);
            });
const detailsButton = document.createElement("button");
detailsButton.textContent = "View Details";
detailsButton.className = "details-btn";

detailsButton.addEventListener("click", () => {
    window.location.href =
        "job-details.html?id=" + encodeURIComponent(job._id);
});

card.appendChild(detailsButton);
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Recruiter Jobs Error:", error);
    }
}

// Prevent job details from being interpreted as HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// Advanced Job Search Function
function searchJobs() {
    const searchValue = document.getElementById("searchInput")
        .value.toLowerCase().trim()
        .replace(/front\s*end/g, "frontend")
        .replace(/\s+/g, "");

    const locationValue = document.getElementById("locationInput")
        .value.toLowerCase().trim();

    const jobType = document.getElementById("jobType").value;
    const experience = document.getElementById("experience").value;
    const salary = document.getElementById("salary").value;

    const jobCards = document.querySelectorAll(".job-card");
    let found = 0;

    jobCards.forEach((card) => {
        const details = card.innerText.toLowerCase();
        const normalizedDetails = details
            .replace(/front\s*end/g, "frontend")
            .replace(/\s+/g, "");

        const keywordMatch =
            !searchValue || normalizedDetails.includes(searchValue);

        const locationMatch =
            !locationValue || details.includes(locationValue);

        const typeMatch =
            !jobType || details.includes(jobType.toLowerCase());

        const experienceMatch =
            !experience || details.includes(experience.toLowerCase());

        let salaryMatch = true;

        if (salary) {
            const salaryText = details.match(/salary:\s*₹?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);

            if (salaryText) {
                const min = Number(salaryText[1]);
                const max = Number(salaryText[2]);

                if (salary === "0-3") salaryMatch = min <= 3;
                if (salary === "3-5") salaryMatch = max >= 3 && min <= 5;
                if (salary === "5-8") salaryMatch = max >= 5 && min <= 8;
                if (salary === "8+") salaryMatch = max >= 8;
            } else {
                salaryMatch = false;
            }
        }

        if (
            keywordMatch &&
            locationMatch &&
            typeMatch &&
            experienceMatch &&
            salaryMatch
        ) {
            card.style.display = "";
            found++;
        } else {
            card.style.display = "none";
        }
    });

    if (found === 0) {
        alert("No matching jobs found!");
    }
}

// Apply for Job Function with Resume Upload
async function applyJob(jobTitle, selectedCompany) {
    const userId = localStorage.getItem("userId");

    if (!userId) {
        alert("Please login first to apply for a job.");
        window.location.href = "login.html";
        return;
    }

    const companies = {
        "Frontend Developer": "ABC Technologies",
        "Web Developer": "XYZ Solutions",
        "Software Engineer": "Tech Company"
    };

    const company = selectedCompany || companies[jobTitle];

    if (!company) {
        alert("Company details not found.");
        return;
    }

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,.docx";

    fileInput.onchange = async function () {
        const resumeFile = fileInput.files[0];

        if (!resumeFile) {
            alert("Please select your resume.");
            return;
        }

        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (!allowedTypes.includes(resumeFile.type)) {
            alert("Please upload only PDF or DOCX files.");
            return;
        }

        if (resumeFile.size > 5 * 1024 * 1024) {
            alert("Resume size must be less than 5 MB.");
            return;
        }

        const formData = new FormData();
        formData.append("userId", userId);
        formData.append("jobTitle", jobTitle);
        formData.append("company", company);
        formData.append("resume", resumeFile);

        try {
            const response = await fetch(
                "http://localhost:5000/api/apply",
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

            if (response.ok) {
                alert("Application submitted successfully!");
            } else {
                alert(data.message || "Application failed.");
            }

        } catch (error) {
            console.error("Application Error:", error);
            alert("Server connection failed. Please try again.");
        }
    };

    fileInput.click();
}

// Load recruiter jobs when the homepage opens
document.addEventListener("DOMContentLoaded", loadRecruiterJobs);
// Add View Details buttons to all homepage job cards
document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("jobContainer");
    if (!container) return;

    container.querySelectorAll(".job-card").forEach((card) => {
        if (card.querySelector(".details-btn")) return;

        const button = document.createElement("button");
        button.textContent = "View Details";
        button.className = "details-btn";
        button.style.marginLeft = "8px";

        button.addEventListener("click", () => {
            const jobId = card.dataset.jobId;

            if (jobId) {
                window.location.href =
                    "job-details.html?id=" + encodeURIComponent(jobId);
            } else {
                const paragraphs = card.querySelectorAll("p");
                const title = card.querySelector("h3")?.innerText || "";
                const company = paragraphs[0]?.innerText || "";
                const location = paragraphs[1]?.innerText.replace("Location:", "").trim() || "";
                const salary = paragraphs[2]?.innerText.replace("Salary:", "").trim() || "";
                const jobType = paragraphs[3]?.innerText.replace("Job Type:", "").trim() || "";
                const experience = paragraphs[4]?.innerText.replace("Experience:", "").trim() || "";
                const skills = paragraphs[5]?.innerText.replace("Skills:", "").trim() || "";

                const params = new URLSearchParams({
                    title, company, location, salary, jobType, experience, skills
                });

                window.location.href = "job-details.html?" + params.toString();
            }
        });

        card.appendChild(button);
    });
});