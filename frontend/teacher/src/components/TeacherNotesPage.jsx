import React, { useEffect, useState,useRef } from "react";
import axios from "axios";
import { FaHome, FaFileAlt, FaUpload, FaCog, FaSignOutAlt, FaSearch, FaBell, FaUsers, FaClipboardCheck, FaChalkboardTeacher, FaFacebookMessenger } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";



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


  // ---------------- Fetch Courses ----------------
  useEffect(() => {
    if (!teacher) return;

    async function fetchCourses() {
      try {
        const [coursesRes, assignmentsRes, teachersRes] = await Promise.all([
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Courses.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherAssignments.json"),
          axios.get("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Teachers.json"),
        ]);

        const teacherKeyEntry = Object.entries(teachersRes.data || {}).find(
          ([key, t]) => t.userId === teacher.userId
        );
        if (!teacherKeyEntry) return;
        const teacherKey = teacherKeyEntry[0];

        const teacherAssignments = Object.values(assignmentsRes.data || {}).filter(
          a => a.teacherId === teacherKey
        );

        const teacherCourses = teacherAssignments.map(a => ({
          id: a.courseId,
          ...coursesRes.data[a.courseId]
        }));

        setCourses(teacherCourses);
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    }

    fetchCourses();
  }, [teacher]);

  // ---------------- Fetch Posts ----------------
  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await axios.get(
          "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherPosts.json"
        );
        setPosts(Object.entries(res.data || {}).map(([id, post]) => ({ id, ...post })));
      } catch (err) {
        console.error(err);
      }
    }

    fetchPosts();
  }, []);

  // ---------------- Submit Post ----------------
  const handleSubmit = async () => {
    if (!selectedCourseId || (!noteText && !file)) {
      alert("Please select a class and enter a note or upload a file");
      return;
    }

    let fileUrl = "";
    if (file) {
      fileUrl = URL.createObjectURL(file);
    }

    const postData = {
      teacherId: teacherUserId,
      courseId: selectedCourseId,
      text: noteText,
      fileUrl,
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(
        "https://ethiostore-17d9f-default-rtdb.firebaseio.com/TeacherPosts.json",
        postData
      );
      alert("Post submitted!");
      setNoteText("");
      setFile(null);
      setPosts(prev => [...prev, { ...postData, id: Date.now() }]); // temporary ID
    } catch (err) {
      console.error(err);
      alert("Failed to submit post");
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
          <div className="icon-circle"><FaCog /></div>
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
            <Link className="sidebar-btn" to="/notes" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaClipboardCheck /> Notes</Link>
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
            <Link className="sidebar-btn" to="/settings"><FaCog /> Settings</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          marginLeft: "500px",
          width: "40%",
          padding: "100px 30px 50px",
          background: "#f3f4f6",
          minHeight: "100vh",
          fontFamily: "'Inter', sans-serif",
        }}>




          {/* Page Header */}
          <div style={{
            marginBottom: "30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "linear-gradient(90deg, #e0e7ff, #c7d2fe)",
            padding: "20px 25px",
            borderRadius: "18px",
            boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
          }}>
            <h2 style={{ fontSize: "28px", fontWeight: 700, color: "#1e293b" }}>Post Notes / Files</h2>
            <span style={{ color: "#475569", fontSize: "16px", fontWeight: 500 }}>
              {teacher?.name}, share notes with your students
            </span>
          </div>

          {/* Post Form */}
          <div style={{
            marginBottom: "40px",
            background: "#fff",
            padding: "30px 25px",
            borderRadius: "18px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.08)",
          }}>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
                marginBottom: "18px",
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <option value="">Select Class & Subject</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.subject} — Grade {c.grade}{c.section}</option>
              ))}
            </select>

            <textarea
              placeholder="Write your note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{
                width: "100%",
                padding: "18px",
                borderRadius: "15px",
                border: "1px solid #cbd5e1",
                marginBottom: "18px",
                minHeight: "140px",
                fontSize: "15px",
                resize: "vertical",
                background: "#f8fafc",
              }}
            />

            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              style={{
                display: "block",
                marginBottom: "25px",
                fontSize: "15px",
                cursor: "pointer",
                padding: "10px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                width: "100%",
              }}
            />

            <button
              onClick={handleSubmit}
              style={{
                background: "linear-gradient(90deg, #4b6cb7, #182848)",
                color: "#fff",
                border: "none",
                padding: "14px 30px",
                borderRadius: "15px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 600,
                width: "100%",
              }}
            >
              <FaUpload style={{ marginRight: "10px" }} /> Submit Post
            </button>
          </div>

          {/* Posts List */}
          <div>
            <h3 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "20px", color: "#1e293b" }}>All Posts</h3>

            {posts
              .filter(post => post.teacherId === teacherUserId || post.courseId === selectedCourseId)
              .map((post, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    padding: "20px 25px",
                    borderRadius: "18px",
                    marginBottom: "18px",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  }}
                >
                  <p style={{ marginBottom: "12px", fontSize: "15px", lineHeight: "1.6", color: "#334155" }}>
                    {post.text}
                  </p>

                  {post.fileUrl && (
                    <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "20px", marginRight: "10px" }}>📄</span>
                      <a
                        href={post.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none", fontSize: "15px" }}
                      >
                        View / Download File
                      </a>
                    </div>
                  )}

                  <div style={{ fontSize: "13px", color: "#64748b", textAlign: "right" }}>
                    Posted: {new Date(post.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
          </div>

        </div>
      </div>
    </div>
  );
}

export default TeacherNotesPage;
