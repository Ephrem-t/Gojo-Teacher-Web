import React, { useEffect, useState,useRef } from "react";
import axios from "axios";
import { FaHome, FaFileAlt, FaUpload, FaCog, FaSignOutAlt, FaSearch, FaBell, FaUsers, FaClipboardCheck, FaChalkboardTeacher, FaFacebookMessenger } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import "../styles/global.css";

const API_BASE = import.meta?.env?.VITE_API_BASE || '/api';



function TeacherNotesPage() {
  const [teacher, setTeacher] = useState(null); // single state for teacher
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [noteText, setNoteText] = useState("");
  const [file, setFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const navigate = useNavigate();

const [notifications, setNotifications] = useState([]);
const [showNotifications, setShowNotifications] = useState(false);
const [highlightedPostId, setHighlightedPostId] = useState(null);
const [selectedWeek, setSelectedWeek] = useState(null);
const [weekTopic, setWeekTopic] = useState("");
const [days, setDays] = useState([
  { dayName: "Monday", topic: "", method: "", aids: "", assessment: "" },
  { dayName: "Tuesday", topic: "", method: "", aids: "", assessment: "" },
  { dayName: "Wednesday", topic: "", method: "", aids: "", assessment: "" },
  { dayName: "Thursday", topic: "", method: "", aids: "", assessment: "" },
]);
  const [expandedWeeks, setExpandedWeeks] = useState([]); // indices of expanded week rows
const [annualRows, setAnnualRows] = useState([
  {
    month: "",
    week: "",
    days: "",
    topic: "",
    objective: "",
    method: "",
    aids: "",
    assessment: "",
  },
]);


// Refs for posts (for scrolling/highlighting)
const postRefs = useRef({});
  const teacherUserId = teacher?.userId; // safe access

  // ---------------- Load Logged-In Teacher ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, []);

// Fetch notifications from posts
useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      const postsData = res.data || [];

      // Use last 5 posts as notifications
      const latestNotifications = postsData.slice(0, 5).map((post) => ({
        id: post.postId,
        title: post.message?.substring(0, 50) || "Untitled post",
        adminName: post.adminName || "Admin",
        adminProfile: post.adminProfile || "/default-profile.png",
      }));

      setNotifications(latestNotifications);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  fetchNotifications();
}, []);

// Handle notification click
const handleNotificationClick = (postId, index) => {
  setHighlightedPostId(postId);

  // Scroll the post into view
  const postElement = postRefs.current[postId];
  if (postElement) {
    postElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Remove clicked notification
  const updatedNotifications = [...notifications];
  updatedNotifications.splice(index, 1);
  setNotifications(updatedNotifications);

  // Close popup
  setShowNotifications(false);

  // Remove highlight after 3 seconds
  setTimeout(() => setHighlightedPostId(null), 3000);
};


const handleSaveWeekPlan = async (rowIndex = null) => {
    try {
      // determine which week to save: prefer explicit rowIndex, else selectedWeek
      const idx = typeof rowIndex === 'number' ? rowIndex : selectedWeek;
      const weekVal = typeof idx === 'number' ? (annualRows[idx]?.week || idx) : idx;

      const payload = {
        teacherId: teacher.userId,
        courseId: selectedCourseId,
        academicYear: "2025/26",
        week: weekVal,
        weekTopic,
        days,
      };

      const res = await axios.post(`${API_BASE}/lesson-plans/save-week`, payload);

      // persist locally into the annualRows for the expanded row (if index provided)
      if (typeof idx === 'number') {
        const updated = [...annualRows];
        updated[idx] = {
          ...updated[idx],
          topic: weekTopic,
          weekDays: days,
        };
        setAnnualRows(updated);
      }

      console.info('Save week response:', res?.data || res);
      alert("Week plan saved successfully!");
      setSelectedWeek(null);
    } catch (error) {
      console.error('Save week error:', error);
      // Build a helpful message
      let msg = "Failed to save lesson plan";
      if (error.response) {
        msg += ` — server responded ${error.response.status}: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        msg += ' — no response received (network/CORS issue)';
      } else if (error.message) {
        msg += ` — ${error.message}`;
      }
      alert(msg);
    }
  };

  const defaultWeekDays = () => ([
    { dayName: "Monday", topic: "", method: "", aids: "", assessment: "" },
    { dayName: "Tuesday", topic: "", method: "", aids: "", assessment: "" },
    { dayName: "Wednesday", topic: "", method: "", aids: "", assessment: "" },
    { dayName: "Thursday", topic: "", method: "", aids: "", assessment: "" },
  ]);

  const openWeekPlan = (rowIndex) => {
    const row = annualRows[rowIndex] || {};
    setSelectedWeek(rowIndex);
    setWeekTopic(row.topic || "");
    setDays(row.weekDays || defaultWeekDays());
    // mark expanded
    if (!expandedWeeks.includes(rowIndex)) setExpandedWeeks([...expandedWeeks, rowIndex]);
  };

  const toggleExpand = (rowIndex) => {
    if (expandedWeeks.includes(rowIndex)) {
      setExpandedWeeks(expandedWeeks.filter((i) => i !== rowIndex));
      if (selectedWeek === rowIndex) setSelectedWeek(null);
    } else {
      // only allow one expanded week at a time
      openWeekPlan(rowIndex);
      setExpandedWeeks([rowIndex]);
    }
  };


  
  

  // ---------------- Logout ----------------
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- Guard ----------------
  if (!teacher) return null;

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-search">
          <FaSearch className="search-icon" />
          <input type="text" placeholder="Search Teacher and Student..." />
        </div>
        <div className="nav-right">
    
<div className="icon-circle">
  <div
    onClick={() => setShowNotifications(!showNotifications)}
    style={{ cursor: "pointer", position: "relative" }}
  >
    <FaBell size={24} />
    {notifications.length > 0 && (
      <span
        style={{
          position: "absolute",
          top: -5,
          right: -5,
          background: "red",
          color: "white",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {notifications.length}
      </span>
    )}
  </div>

  {showNotifications && (
    <div
      style={{
        position: "absolute",
        top: 30,
        right: 0,
        width: 300,
        maxHeight: 400,
        overflowY: "auto",
        background: "#fff",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        borderRadius: 8,
        zIndex: 100,
      }}
    >
      {notifications.length > 0 ? (
        notifications.map((post, index) => (
          <div
            key={post.id || index}
            onClick={() => {
              // Navigate to dashboard first
              navigate("/dashboard");

              // Highlight and scroll the post after a small delay to allow navigation
              setTimeout(() => handleNotificationClick(post.id, index), 100);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 15px",
              borderBottom: "1px solid #eee",
              cursor: "pointer",
            }}
          >
            <img
              src={post.adminProfile}
              alt={post.adminName}
              style={{
                width: 35,
                height: 35,
                borderRadius: "50%",
                marginRight: 10,
              }}
            />
            <div>
              <strong>{post.adminName}</strong>
              <p style={{ margin: 0, fontSize: 12 }}>{post.title}</p>
            </div>
          </div>
        ))
      ) : (
        <div style={{ padding: 15 }}>No notifications</div>
      )}
    </div>
  )}
</div>

          <div className="icon-circle"><FaFacebookMessenger /></div>
                 <Link className="icon-circle" to="/settings"><FaCog /></Link>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
        </div>
      </nav>

      <div className="google-dashboard">
        {/* Sidebar */}
        <div className="google-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-img-circle">
              <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
            </div>
            <h3>{teacher?.name}</h3>
            <p>{teacher?.username}</p>
          </div>

          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard" >
              <FaHome /> Home
            </Link>
            <Link className="sidebar-btn" to="/students"><FaUsers /> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents" >
              <FaChalkboardTeacher /> Parents
            </Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule" >
                                             <FaUsers /> Schedule
                                           </Link>
            <Link className="sidebar-btn" to="/lesson-plan" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaClipboardCheck /> Lesson Plan</Link>

     
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          marginLeft: "400px",
          width: "70%",
          padding: "100px 30px 50px",
          background: "#f3f4f6",
          minHeight: "100vh",
          fontFamily: "'Inter', sans-serif",
        }}>

<h2 style={{ marginBottom: 20 }}>Annual Lesson Plan</h2>

<div style={{ overflowX: "auto", background: "#fff", padding: 20, borderRadius: 10 }}>
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead>
      <tr>
        {["Month", "Week", "Days", "Topic", "Objective", "Method", "Aids", "Assessment"].map((head) => (
          <th
            key={head}
            style={{
              border: "1px solid #000",
              padding: 8,
              background: "#f0f0f0",
              fontWeight: "bold",
            }}
          >
            {head}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {annualRows.map((row, index) => (
        <React.Fragment key={index}>
          <tr>
            {Object.keys(row).map((field) => {
              // Render normal inputs except for the `week` field which gets an expand button
              if (field === "week") {
                return (
                  <td key={field} style={{ border: "1px solid #000", padding: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        value={row[field]}
                        onChange={(e) => {
                          const updated = [...annualRows];
                          updated[index][field] = e.target.value;
                          setAnnualRows(updated);
                        }}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                        }}
                      />
                      <button
                        onClick={() => toggleExpand(index)}
                        title={expandedWeeks.includes(index) ? "Hide Days" : "Add Days"}
                        aria-label={expandedWeeks.includes(index) ? "Hide Days" : "Add Days"}
                        style={{
                          width: 30,
                          height: 30,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: expandedWeeks.includes(index) ? "#e2e8f0" : "#4b6cb7",
                          color: expandedWeeks.includes(index) ? "#000" : "#fff",
                          border: "none",
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: 1,
                        }}
                      >
                        {expandedWeeks.includes(index) ? "−" : "+"}
                      </button>
                    </div>
                  </td>
                );
              }

              return (
                <td key={field} style={{ border: "1px solid #000", padding: 5 }}>
                  <input
                    value={row[field]}
                    onChange={(e) => {
                      const updated = [...annualRows];
                      updated[index][field] = e.target.value;
                      setAnnualRows(updated);
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                    }}
                  />
                </td>
              );
            })}
          </tr>

          {expandedWeeks.includes(index) && (
            <tr>
              <td colSpan={8} style={{ background: "#fafafa", padding: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Daily Plan for Week {row.week || index}</strong>
                    <div>
                      <button
                        onClick={() => handleSaveWeekPlan(index)}
                        style={{
                          marginRight: 8,
                          padding: "8px 12px",
                          background: "#4b6cb7",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Save Week Plan
                      </button>
                      <button
                        onClick={() => { setExpandedWeeks([]); setSelectedWeek(null); }}
                        style={{
                          padding: "8px 12px",
                          background: "#e2e8f0",
                          color: "#000",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Week Topic (e.g. Cell Biology)"
                    value={weekTopic}
                    onChange={(e) => setWeekTopic(e.target.value)}
                    style={{ width: "100%", padding: 8 }}
                  />

                  {(days || defaultWeekDays()).map((day, di) => (
                    <div key={di} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={{ width: 110 }}>{day.dayName}</div>
                      <input
                        placeholder="Topic"
                        value={days[di]?.topic || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], topic: e.target.value };
                          setDays(updated);
                        }}
                        style={{ flex: 1 }}
                      />
                      <input
                        placeholder="Method"
                        value={days[di]?.method || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], method: e.target.value };
                          setDays(updated);
                        }}
                        style={{ width: 220 }}
                      />
                      <input
                        placeholder="Aids"
                        value={days[di]?.aids || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], aids: e.target.value };
                          setDays(updated);
                        }}
                        style={{ width: 160 }}
                      />
                      <input
                        placeholder="Assessment"
                        value={days[di]?.assessment || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], assessment: e.target.value };
                          setDays(updated);
                        }}
                        style={{ width: 160 }}
                      />
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </tbody>
  </table>

  <button
    onClick={() =>
      setAnnualRows([
        ...annualRows,
        {
          month: "",
          week: "",
          days: "",
          topic: "",
          objective: "",
          method: "",
          aids: "",
          assessment: "",
        },
      ])
    }
    style={{
      marginTop: 15,
      padding: "8px 12px",
      background: "#4b6cb7",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
    }}
  >
    + Add Row
  </button>
</div>



{selectedWeek && (
  <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
    <h3>Week {selectedWeek} Plan</h3>

    <input
      type="text"
      placeholder="Week Topic (e.g. Cell Biology)"
      value={weekTopic}
      onChange={(e) => setWeekTopic(e.target.value)}
      style={{ width: "100%", padding: 8, marginBottom: 15 }}
    />

    {days.map((day, index) => (
      <div key={index} style={{ borderBottom: "1px solid #eee", paddingBottom: 10, marginBottom: 10 }}>
        <h4>{day.dayName}</h4>

        <input
          placeholder="Topic"
          value={day.topic}
          onChange={(e) => {
            const updated = [...days];
            updated[index].topic = e.target.value;
            setDays(updated);
          }}
        />

        <input
          placeholder="Method"
          value={day.method}
          onChange={(e) => {
            const updated = [...days];
            updated[index].method = e.target.value;
            setDays(updated);
          }}
        />

        <input
          placeholder="Teaching Aids"
          value={day.aids}
          onChange={(e) => {
            const updated = [...days];
            updated[index].aids = e.target.value;
            setDays(updated);
          }}
        />

        <input
          placeholder="Assessment"
          value={day.assessment}
          onChange={(e) => {
            const updated = [...days];
            updated[index].assessment = e.target.value;
            setDays(updated);
          }}
        />
      </div>
    ))}

    <button
      onClick={handleSaveWeekPlan}
      style={{
        background: "#4b6cb7",
        color: "#fff",
        padding: "10px 15px",
        borderRadius: 6,
        border: "none",
      }}
    >
      Save Week Plan
    </button>
  </div>
)}

          

       
          

        </div>
      </div>
    </div>
  );
}

export default TeacherNotesPage;
