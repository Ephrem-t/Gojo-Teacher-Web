import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";

export default function Register() {
  const navigate = useNavigate();

  const gradeOptions = ["7", "8", "9", "10", "11 Social", "11 Natural", "12 Social", "12 Natural"];
  const sectionOptions = ["A", "B", "C"];
  const subjectOptions = {
    "7": [
      "Mathematics",
      "Amharic",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Oromifa",
      "Physical Education",
    ],
    "8": [
     "Mathematics",
      "Amharic",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Oromifa",
      "Physical Education",
    ],
    "9": [
      "Mathematics",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Physical Education",
    ],
    "10": [
     "Mathematics",
      "English",
      "Biology",
      "Physics",
      "Chemistry",
      "Geography",
      "History",
      "Civics",
      "ICT",
      "Physical Education",
    ],
    "11 Social": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],

    "11 Natural": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
    "12 Social": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
    "12 Natural": [
      "Mathematics",
      "English",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Geography",
      "History",
    ],
  };

  const [formData, setFormData] = useState({
    name: "",
    password: "",
    email: "",
    phone: "",
    gender: "",
    courses: [{ grade: "", section: "", subject: "" }],
  });
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [assignedTeacherId, setAssignedTeacherId] = useState("");

  const handleChange = (e, index = null) => {
    const { name, value } = e.target;
    if (index !== null) {
      const updatedCourses = [...formData.courses];
      updatedCourses[index][name] = value;
      if (name === "grade") updatedCourses[index]["subject"] = "";
      setFormData({ ...formData, courses: updatedCourses });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const addCourse = () => {
    setFormData({
      ...formData,
      courses: [...formData.courses, { grade: "", section: "", subject: "" }],
    });
  };

  const removeCourse = (index) => {
    const updatedCourses = formData.courses.filter((_, i) => i !== index);
    setFormData({ ...formData, courses: updatedCourses });
  };

  const hasDuplicateCourse = () => {
    const seen = new Set();

    for (let c of formData.courses) {
      if (!c.grade || !c.section || !c.subject) continue;

      const key = `${c.grade}${c.section}-${c.subject}`;

      if (seen.has(key)) {
        return true;
      }
      seen.add(key);
    }
    return false;
  };

  const validateEmail = (email) =>
    email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());

  const validatePhone = (phone) =>
    /^[0-9+()\-\s]{6,20}$/.test(String(phone).trim());

  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage("");
    setAssignedTeacherId("");

    // Frontend validation
    if (!validateEmail(formData.email)) {
      setMessage("Please enter a valid email address or leave it empty.");
      return;
    }
    if (!validatePhone(formData.phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }
    if (!formData.gender) {
      setMessage("Please select gender.");
      return;
    }
    if (!formData.name || !formData.password) {
      setMessage("Name and password are required.");
      return;
    }
    if (hasDuplicateCourse()) {
      setMessage(
        "Duplicate subject detected! A subject can only be taught once per grade and section."
      );
      return;
    }

    try {
      const dataToSend = new FormData();
      // NOTE: username removed from frontend. Server will set username = teacherId
      dataToSend.append("name", formData.name);
      dataToSend.append("password", formData.password);
      dataToSend.append("email", formData.email);
      dataToSend.append("phone", formData.phone);
      dataToSend.append("gender", formData.gender);
      dataToSend.append("courses", JSON.stringify(formData.courses));
      if (profile) dataToSend.append("profile", profile);

      const res = await fetch("https://gojo-teacher-web.onrender.com/register/teacher", {
        method: "POST",
        body: dataToSend,
      });

      const data = await res.json();

      if (data.success) {
        // Backend returns teacherId in response (assigned username)
        const tid = data.teacherKey || data.teacherId || data.teacherKey || data.teacherId || "";
        setAssignedTeacherId(tid);
        setFormData({
          name: "",
          password: "",
          email: "",
          phone: "",
          gender: "",
          courses: [{ grade: "", section: "", subject: "" }],
        });
        setProfile(null);
        setMessage("Registration successful. Your teacherId (username) is shown below.");
        // Optionally auto-navigate to login after a short delay:
        // setTimeout(() => navigate("/login"), 4000);
      } else {
        setMessage(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setMessage("Server error. Check console.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box" style={{ maxWidth: "600px" }}>
        <h2>Teacher Registration</h2>
        {message && <p className="auth-error">{message}</p>}

        <form onSubmit={handleRegister}>
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          {/* Username removed from form - server will assign teacherId as username */}

          <input
            type="email"
            name="email"
            placeholder="Email (optional)"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone number"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <div className="profile-upload">
            {profile && (
              <img
                src={URL.createObjectURL(profile)}
                alt="Profile Preview"
                className="profile-preview"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfile(e.target.files[0])}
            />
          </div>

          <h3>Courses</h3>
          {formData.courses.map((course, index) => (
            <div className="course-group" key={index}>
              <select
                name="grade"
                value={course.grade}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Grade</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              <select
                name="section"
                value={course.section}
                onChange={(e) => handleChange(e, index)}
                required
              >
                <option value="">Select Section</option>
                {sectionOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                name="subject"
                value={course.subject}
                onChange={(e) => handleChange(e, index)}
                required
                disabled={!course.grade}
              >
                <option value="">Select Subject</option>
                {course.grade &&
                  subjectOptions[course.grade].map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
              </select>

              {formData.courses.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeCourse(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}

          <button type="button" className="add-btn" onClick={addCourse}>
            Add Course
          </button>
          <button type="submit" className="submit-btn">
            Register
          </button>
        </form>

        {assignedTeacherId && (
          <div className="auth-success" style={{ marginTop: 12 }}>
            <p>
              Registration complete. Your teacherId (username) is:{" "}
              <strong>{assignedTeacherId}</strong>
            </p>
            <p>
              Use this ID to log in: <Link to="/login">Go to Login</Link>
            </p>
          </div>
        )}

        <p className="auth-link">
          Already have an account? <Link to="/login">Go to Login</Link>
        </p>
      </div>
    </div>
  );
}