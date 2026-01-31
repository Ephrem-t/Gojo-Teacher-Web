import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaSave,
  FaBell,
  FaClipboardCheck,
  FaUsers,
  FaChalkboardTeacher,
  FaFacebookMessenger,
  FaChevronRight
} from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

export default function AttendancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacher, setTeacher] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [showMessenger, setShowMessenger] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 600);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () =>
      window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    if (!teacher) return;
    const fetchCourses = async () => {
      try {
        const [assignmentsRes, coursesRes, teachersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Teachers.json`)
        ]);
        const teacherEntry = Object.entries(teachersRes.data || {}).find(
          ([, t]) => t.userId === teacher.userId
        );
        if (!teacherEntry) return;
        const teacherKey = teacherEntry[0];
        const assignedCourses = Object.values(assignmentsRes.data || {})
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);
        const teacherCourses = Object.entries(coursesRes.data || {})
          .filter(([courseKey]) => assignedCourses.includes(courseKey))
          .map(([courseKey, course]) => ({ id: courseKey, ...course }));
        setCourses(teacherCourses);
        if (!selectedCourse && teacherCourses.length > 0) {
          setSelectedCourse(teacherCourses[0]);
        }
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher]); // eslint-disable-line

  useEffect(() => {
    if (!selectedCourse) return;
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const [studentsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`)
        ]);
        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};
        const filtered = Object.entries(studentsData)
          .filter(([, s]) =>
            s.grade === selectedCourse.grade && s.section === selectedCourse.section
          )
          .map(([id, s]) => ({
            studentId: id,
            ...s,
            name: usersData?.[s.userId]?.name || "Unknown",
            profileImage: usersData?.[s.userId]?.profileImage || "/default-profile.png"
          }));
        setStudents(filtered);
        setError("");
      } catch (err) {
        setError("Failed to fetch students. Please try again.");
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourse) return;
    const fetchAttendance = async () => {
      try {
        const res = await axios.get(
          `${RTDB_BASE}/Attendance/${selectedCourse.id}/${date}.json`
        );
        setAttendance(res.data || {});
      } catch (err) {
        setAttendance({});
      }
    };
    fetchAttendance();
  }, [selectedCourse, date]);

  const handleMark = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedCourse) {
      alert("Please select a course");
      return;
    }
    try {
      await axios.put(
        `${RTDB_BASE}/Attendance/${selectedCourse.id}/${date}.json`,
        attendance
      );
      alert("Attendance saved successfully!");
    } catch (err) {
      alert("Failed to save attendance");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Responsive table CSS, reinforces white background
  useEffect(() => {
    const styleId = "responsive-attendance-table";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media (max-width: 600px) {
        .attendance-main-content-responsive {
          margin-left: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          padding: 8px 2vw !important;
          border-radius: 0 !important;
        }
        .attendance-table-wrapper {
          width: 100vw !important;
          max-width: 100vw !important;
          overflow-x: auto !important;
          padding: 0 1vw !important;
          background: #fff !important;
        }
        .attendance-table {
          min-width: 480px !important;
          width: auto !important;
          max-width: 100vw !important;
          table-layout: auto !important;
          overflow-x: auto !important;
          background: #fff !important;
        }
        .attendance-table th, .attendance-table td {
          font-size: 13px !important;
          padding: 7px !important;
          white-space: normal !important;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        {/* Hamburger for mobile */}
        {window.innerWidth <= 600 && !sidebarOpen && (
          <button
            className="sidebar-arrow-btn"
            style={{
              position: 'fixed',
              left: 0,
              top: 180,
              transform: 'none',
              zIndex: 1300,
              background: '#fff',
              border: 'none',
              borderRadius: '0 8px 8px 0',
              boxShadow: '2px 0 8px rgba(0,0,0,0.12)',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar menu"
          >
            <FaChevronRight size={22} />
          </button>
        )}
        <h2>Gojo Dashboard</h2>
        <div className="nav-right">
          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
        </div>
      </nav>
      <div className="google-dashboard">
        {window.innerWidth <= 600 && sidebarOpen && (
          <div
            className={`sidebar-overlay visible`}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'block' }}
          />
        )}
        <div
          className={`google-sidebar${sidebarOpen ? ' open' : ''}`}
          style={
            window.innerWidth <= 600
              ? {
                position: 'fixed',
                top: 54,
                left: sidebarOpen ? 0 : '-220px',
                width: 200,
                height: 'calc(100vh - 54px)',
                background: '#fff',
                boxShadow: '2px 0 8px rgba(0,0,0,0.12)',
                zIndex: 1200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 18,
                overflowY: 'auto',
                transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
              }
              : {
                position: 'fixed',
                top: 64,
                left: 0,
                width: 200,
                height: 'calc(100vh - 64px)',
                background: '#fff',
                boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
                zIndex: 900,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 18,
                overflowY: 'auto',
              }
          }
        >
          {teacher && (
            <div className="sidebar-profile">
              <div className="sidebar-img-circle">
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}
          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard"><FaHome /> Home</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}>
              <FaUsers /> Attendance
            </Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
             <Link className="sidebar-btn" to="/lesson-plan"><FaClipboardCheck /> Lesson Plan</Link>
            
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>
        <div
          className="attendance-main-content-responsive"
          style={
            window.innerWidth <= 600
              ? { marginLeft: 0, width: "100vw", maxWidth: "100vw", padding: "8px 2vw" }
              : { marginLeft: 220, width: "calc(100vw - 240px)", padding: 30 }
          }
        >
          <h2 style={{ textAlign: "center", marginBottom: "25px", color: "#333" }}>Attendance</h2>
          <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "15px" }}>
            <label style={{ fontWeight: "500", color: "#555" }}>Select Course:</label>
            <select
              value={selectedCourse?.id || ""}
              onChange={e => {
                const course = courses.find(c => c.id === e.target.value);
                setSelectedCourse(course || null);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                outline: "none",
                background: "#f9f9f9",
                minWidth: "200px",
                fontWeight: "500"
              }}
            >
              <option value="">-- Select Course --</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - Grade {c.grade} Section {c.section}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: "25px", display: "flex", alignItems: "center", gap: "15px" }}>
            <label style={{ fontWeight: "500", color: "#555" }}>Date:</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                outline: "none",
                background: "#f9f9f9"
              }}
            />
          </div>
          <div
            className="attendance-table-wrapper"
            style={{
              width: "100%",
              maxWidth: "100vw",
              overflowX: "auto",
              marginBottom: 20,
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          >
            {loading ? (
              <p>Loading students...</p>
            ) : error ? (
              <p style={{ color: "red" }}>{error}</p>
            ) : (
              <table
                className="attendance-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  background: "#fff"
                }}
              >
                <thead>
                  <tr style={{ background: "#4b6cb7", color: "#fff", textAlign: "left" }}>
                    <th style={{ padding: "12px" }}>Student</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Present</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Absent</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr
                      key={s.studentId}
                      style={{ borderBottom: "1px solid #eee", transition: "background 0.3s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", border: "2px solid #4b6cb7" }}>
                          <img src={s.profileImage || "/default-profile.png"} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <span style={{ fontWeight: "500", color: "#333" }}>{s.name}</span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          style={{
                            background: attendance[s.studentId] === "present" ? "#28a745" : "#e0e0e0",
                            color: attendance[s.studentId] === "present" ? "#fff" : "#333",
                            padding: "6px 12px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "0.2s"
                          }}
                          onClick={() => handleMark(s.studentId, "present")}
                        >
                          Present
                        </button>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          style={{
                            background: attendance[s.studentId] === "absent" ? "#dc3545" : "#e0e0e0",
                            color: attendance[s.studentId] === "absent" ? "#fff" : "#333",
                            padding: "6px 12px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "0.2s"
                          }}
                          onClick={() => handleMark(s.studentId, "absent")}
                        >
                          Absent
                        </button>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          style={{
                            background: attendance[s.studentId] === "late" ? "#ffc107" : "#e0e0e0",
                            color: attendance[s.studentId] === "late" ? "#fff" : "#333",
                            padding: "6px 12px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            transition: "0.2s"
                          }}
                          onClick={() => handleMark(s.studentId, "late")}
                        >
                          Late
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <button
              style={{
                marginTop: "18px",
                padding: "12px 25px",
                borderRadius: "10px",
                background: "#4b6cb7",
                color: "#fff",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                transition: "0.3s"
              }}
              onClick={handleSave}
              onMouseEnter={e => e.currentTarget.style.background = "#3a539b"}
              onMouseLeave={e => e.currentTarget.style.background = "#4b6cb7"}
            >
              Save Attendance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}