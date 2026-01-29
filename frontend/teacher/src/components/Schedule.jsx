import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaUsers,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaFacebookMessenger,
  FaBell,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import "../styles/global.css";

// --- API and RTDB endpoints ---
const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

// --- Used to sort chat ids for message threading (helper) ---
const getChatId = (id1, id2) => [id1, id2].sort().join("_");

function Schedule() {
  // Sidebar toggle state for mobile (like Dashboard)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
    // Hide sidebar by default on phone size, show on desktop
    useEffect(() => {
      const handleResize = () => {
        if (window.innerWidth <= 600) {
          setSidebarOpen(false);
        } else {
          setSidebarOpen(true);
        }
      };
      window.addEventListener("resize", handleResize);
      handleResize();
      return () => window.removeEventListener("resize", handleResize);
    }, []);
  // ---------------- STATE -----------------------
  const [teacher, setTeacher] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const postRefs = useRef({});
  const navigate = useNavigate();
  const allSections = ["All", "A", "B", "C", "D"];
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);

  // --------------- RESPONSIVE --------------
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Messenger badge: count unread messages only (from notifications)
  const totalUnreadMessages = notifications.filter((n) => n.type === "message").reduce((sum, n) => sum + (n.unreadForMe || 0), 0);

  // --------------- LOAD TEACHER -------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // --------------- FETCH SCHEDULE --------------
  useEffect(() => {
    if (!teacher) return;
    async function fetchSchedule() {
      setLoading(true);
      try {
        const res = await axios.get(`${RTDB_BASE}/Schedules.json`);
        setSchedule(res.data || {});
        setError("");
      } catch (err) {
        setError("Failed to load schedule.");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, [teacher]);

  // --------------- LOGOUT HANDLER --------------
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // --------------- TEACHER PERSONAL SCHEDULE (RIGHT SIDEBAR) --------------
  const getTeacherSchedule = () => {
    if (!teacher || !schedule) return {};
    const filtered = {};
    Object.entries(schedule).forEach(([day, grades]) => {
      Object.entries(grades || {}).forEach(([grade, periods]) => {
        Object.entries(periods || {}).forEach(([periodName, info]) => {
          if (!info?.teacherName) return;
          if (info.teacherName === teacher.name) {
            if (!filtered[day]) filtered[day] = {};
            if (!filtered[day][periodName]) filtered[day][periodName] = [];
            filtered[day][periodName].push({
              class: grade,
              subject: info.subject || "-",
              time: info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A",
            });
          }
        });
      });
    });
    return filtered;
  };
  const teacherSchedule = getTeacherSchedule();

  // ---------------------- NOTIFICATIONS logic ----------------------
  function getSeenPosts(teacherId) {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
    }
  }
  // --- FETCH NOTIFICATIONS: posts + unread messages ---
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 1. Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);

        const [adminsRes, usersRes, chatsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Chats.json`),
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const chats = chatsRes.data || {};

        // Get teacher from localStorage so we know who's seen what
        const teacher = JSON.parse(localStorage.getItem("teacher"));

        // --- Helper to resolve admin info ---
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const schoolAdminRec = schoolAdmins[adminId];
            const userKey = schoolAdminRec.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || schoolAdminRec.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || schoolAdminRec.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };

        // --- Post notifications (latest 5, regardless of seen) ---
        const postNotifs = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
          })
          .filter((post) => post.postId)
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              id: post.postId,
              type: "post",
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile,
              time: post.time ? new Date(post.time).getTime() : 0,
            };
          });

        // --- Message notifications (unread only, for this teacher) ---
        let messageNotifs = [];
        if (teacher && teacher.userId) {
          Object.entries(chats).forEach(([chatId, chat]) => {
            const unreadMap = chat.unread || {};
            const unreadForMe = unreadMap[teacher.userId] || 0;
            if (!unreadForMe) return;
            const participants = chat.participants || {};
            const otherKey = Object.keys(participants).find((p) => p !== teacher.userId);
            let otherUser = users[otherKey] || { userId: otherKey, name: otherKey, profileImage: "/default-profile.png" };
            messageNotifs.push({
              chatId,
              type: "message",
              displayName: otherUser.name || otherUser.username || otherKey,
              profile: otherUser.profileImage || otherUser.profile || "/default-profile.png",
              unreadForMe,
              time: chat.lastMessage?.timeStamp ? new Date(chat.lastMessage.timeStamp).getTime() : 0,
            });
          });
        }

        // Merge and sort by recency, then take top 5
        const allNotifs = [...postNotifs, ...messageNotifs]
          .sort((a, b) => (b.time || 0) - (a.time || 0))
          .slice(0, 5);
        setNotifications(allNotifs);
      } catch (err) {}
    };
    fetchNotifications();
  }, []);

  // --- Handler to remove notification after clicked (and mark seen) ---
  const handleNotificationClick = async (notif) => {
    if (!teacher) return;
    if (notif.type === "post" && notif.id) {
      saveSeenPost(teacher.userId, notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      setShowNotifications(false);
      // Optionally: navigate to dashboard and highlight post
      navigate("/dashboard");
    } else if (notif.type === "message" && notif.chatId) {
      setNotifications((prev) => prev.filter((n) => n.chatId !== notif.chatId));
      setShowNotifications(false);
      // Mark messages as read in DB
      try {
        await axios.put(`${RTDB_BASE}/Chats/${notif.chatId}/unread/${teacher.userId}.json`, null);
      } catch (err) {}
      navigate("/all-chat");
    }
  };

  // --------------- MESSENGER LOGIC (all unread conversations) ---------------
  // ...existing code...

  // -------------------------- CSS STYLES ----------------------------
  const css = `
    body, html, #root { height: 100%; margin: 0; }
    .gojo-root-dashboard {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f0f4f8;
      overflow: hidden;
    }
    .top-navbar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      z-index: 1000;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: 60px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }
    .google-sidebar {
      position: fixed;
      top: 60px;
      left: 0;
      width: 220px;
      height: calc(100vh - 60px);
      background: #fff;
      box-shadow: 2px 0 8px rgba(0,0,0,0.04);
      z-index: 900;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 18px;
      overflow-y: auto;
      transition: width 0.2s;
      min-width: 48px;
    }
    .main-area-row {
      display: flex;
      flex: 1;
      flex-direction: row;
      height: 100vh;
      margin-top: 60px;
      width: 100%;
      min-width: 0;
    }
    .schedule-main {
      flex: 1;
      margin-left: 220px;
      padding: 30px;
      background: #f0f4f8;
      min-height: calc(100vh - 60px);
      overflow-y: auto;
      transition: margin-left 0.2s;
      position: relative;
      z-index: 20;
    }
    .right-sidebar {
      position: fixed;
      top: 60px;
      right: 0;
      width: 350px;
      height: calc(100vh - 60px);
      z-index: 300;
      background: #fff;
      box-shadow: 0 0 20px rgba(0,0,0,0.07);
      display: flex;
      flex-direction: column;
      transition: right 0.2s, left 0.2s, width 0.2s;
    }
    .close-sidebar-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      z-index: 10;
      cursor: pointer;
    }
    @media (max-width: 900px) {
      .google-sidebar { width: 60px; min-width: 60px; }
      .schedule-main { margin-left: 60px; padding: 17px 2vw; }
      .right-sidebar { width: 90vw; left: 60px; right: initial; }
    }
    @media (max-width: 600px) {
      .top-navbar { height: 54px; padding: 0 7px; }
      .google-sidebar {
        top: 54px;
        width: 48px;
        min-width: 48px;
        padding: 0;
        align-items: flex-start;
      }
      .main-area-row { margin-top: 54px; }
      .schedule-main { margin-left: 48px; padding: 8px 2vw; border-radius: 7px; }
      .right-sidebar { left: 48px; right: initial; width: 100vw; height: calc(100vh - 54px); }
      .close-sidebar-btn {
        top: 8px !important;
        right: 8px !important;
        width: 44px !important;
        height: 44px !important;
        font-size: 22px !important;
      }
    }
  `;

  // ----------------- PAGE JSX -------------------
  return (
    <div className="gojo-root-dashboard">
      <style>{css}</style>
      {/* --------- Top Navbar --------- */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        <div className="nav-right" style={{display: 'flex', alignItems: 'center', gap: 16}}>
          {/* Notifications */}
          <div className="icon-circle" style={{ position: "relative" }}>
            <div onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: "pointer", position: "relative" }}>
              <FaBell size={24} />
              {notifications.length > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {notifications.length}
                </span>
              )}
            </div>
            {showNotifications && (
              <>
                {/* Overlay for closing notification list by clicking outside */}
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.08)',
                    zIndex: 1999,
                  }}
                  onClick={() => setShowNotifications(false)}
                />
                <div
                  className="notification-popup"
                  style={
                    typeof window !== 'undefined' && window.innerWidth <= 600
                      ? {
                          position: 'fixed',
                          left: '50%',
                          top: '8%',
                          transform: 'translate(-50%, 0)',
                          width: '90vw',
                          maxWidth: 340,
                          zIndex: 2000,
                          background: '#fff',
                          borderRadius: 12,
                          boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
                          maxHeight: '70vh',
                          overflowY: 'auto',
                          padding: 12,
                        }
                      : {
                          position: 'absolute',
                          top: 28,
                          right: 0,
                          width: 300,
                          maxHeight: 400,
                          overflowY: 'auto',
                          background: '#fff',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                          borderRadius: 8,
                          zIndex: 100,
                        }
                  }
                >
                  {notifications.length ? notifications.map((post, i) => (
                    <div key={post.id || i} onClick={() => handleNotificationClick(post.id)} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                      <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                      <div>
                        <strong>{post.adminName}</strong>
                        <p style={{ margin: 0, fontSize: 12 }}>{post.title}</p>
                      </div>
                    </div>
                  )) : <div style={{ padding: 15 }}>No notifications</div>}
                </div>
              </>
            )}
          </div>
          {/* Messenger: navigates to all-chat, badge only */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={() => navigate("/all-chat")}
                 style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#ff0000", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", fontSize: 12 }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>
          </div>
          <div className="icon-circle" onClick={() => navigate("/settings")}> <FaCog /> </div>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" style={{width:36, height:36, borderRadius:"50%"}} />
        </div>
      </nav>
      {/* --------- Main Area Row ------- */}
      <div className="main-area-row">
        {/* Hamburger for mobile */}
        {typeof window !== 'undefined' && window.innerWidth <= 600 && !sidebarOpen && (
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
        {/* Sidebar overlay for mobile */}
        {typeof window !== 'undefined' && window.innerWidth <= 600 && sidebarOpen && (
          <div
            className={`sidebar-overlay visible`}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200 }}
          />
        )}
        {/* ---- Left Sidebar ---- */}
        <div
          className={`google-sidebar${typeof window !== 'undefined' && window.innerWidth <= 600 && sidebarOpen ? ' open' : ''}`}
          style={
            typeof window !== 'undefined' && window.innerWidth <= 600
              ? {
                  position: 'fixed',
                  top: 64,
                  left: sidebarOpen ? 0 : '-220px',
                  width: 200,
                  height: 'calc(100vh - 64px)',
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
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover', border: 'none', boxShadow: 'none' }} />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}
          <div className="sidebar-menu" style={{display:'flex', flexDirection:'column', gap:8, width:"100%"}}>
            <Link className="sidebar-btn" to="/dashboard"><FaHome/> Home</Link>
            <Link className="sidebar-btn" to="/students"><FaUsers/> Students</Link>
            <Link className="sidebar-btn" to="/admins"><FaUsers/> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher/> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck/> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers/> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaUsers/> Schedule</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt/> Logout</button>
          </div>
        </div>
        {/* ---- Main Content (scrollable) ---- */}
        <div className="schedule-main">
          <div className="schedule-container" style={{width:'100%', maxWidth:900, margin:'0 auto'}}>
            {/* Filters */}
            <div style={{display:"flex", gap:"20px", marginBottom:"25px", justifyContent:"center", flexWrap:"wrap"}}>
              <div>
                <label style={{marginRight:"8px", fontWeight:"600"}}>Grade:</label>
                <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                  style={{ padding:"8px 12px", borderRadius:"8px", border:"1px solid #ccc", cursor:"pointer" }}
                >
                  <option value="All">All</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                </select>
              </div>
              <div>
                <label style={{marginRight:"8px", fontWeight:"600"}}>Section:</label>
                <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}
                  style={{ padding:"8px 12px", borderRadius:"8px", border:"1px solid #ccc", cursor:"pointer"}}
                >
                  <option value="All">All</option>
                  {allSections.filter(s => s !== "All").map(s =>
                    <option key={s} value={s}>{s}</option>
                  )}
                </select>
              </div>
            </div>
            <h2 style={{textAlign:"center",marginBottom:"30px",color:"#2563eb"}}>Full Schedule</h2>
            {loading && <p style={{textAlign:"center"}}>Loading schedule...</p>}
            {error && <p style={{color:"red", textAlign:"center"}}>{error}</p>}
            {!loading && daysOfWeek.map(day => {
              const grades = schedule[day];
              if (!grades) return null;
              return (
                <div key={day} style={{marginBottom:"40px"}}>
                  <h3 style={{color:"#1c03ffff",marginBottom:"15px"}}>{day}</h3>
                  {Object.entries(grades)
                    .filter(([grade]) => selectedGrade === "All" || grade.includes(selectedGrade))
                    .map(([grade, periods]) => {
                      const sectionFromGrade = grade.slice(-1);
                      if (selectedSection !== "All" && sectionFromGrade !== selectedSection) return null;
                      return (
                        <div key={grade} style={{marginBottom:"18px"}}>
                          <h4 style={{color:"#4603fcff",marginBottom:"10px"}}>{grade}</h4>
                          <table style={{
                            width:"100%", borderCollapse:"collapse", background:"#fff",
                            borderRadius:"12px", overflow:"hidden", boxShadow:"0 8px 20px rgba(0,0,0,0.1)",
                          }}>
                            <thead style={{background:"#2563eb", color:"#fff"}}>
                              <tr>
                                <th style={{padding:"12px",textAlign:"left"}}>Period</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Subject</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Time</th>
                                <th style={{padding:"12px",textAlign:"left"}}>Teacher</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(periods).map(([periodName, info], idx) => {
                                const isMyClass = info?.teacherName === teacher?.name;
                                const time = info.time || periodName.match(/\((.*?)\)/)?.[1] || "N/A";
                                return (
                                  <tr
                                    key={idx}
                                    style={{
                                      borderBottom: "1px solid #eee",
                                      backgroundColor: isMyClass ? "#dbeafe" : "#f3f4f6",
                                      color: isMyClass ? "#1e40af" : "#6b7280",
                                      fontWeight: isMyClass ? "700" : "400",
                                      borderLeft: isMyClass ? "4px solid #2563eb" : "none",
                                      opacity: isMyClass ? 1 : 0.85,
                                    }}
                                  >
                                    <td style={{ padding: "12px" }}>{periodName}</td>
                                    <td style={{ padding: "12px" }}>{info.subject || "-"}</td>
                                    <td style={{ padding: "12px" }}>{time}</td>
                                    <td style={{ padding: "12px" }}>{info.teacherName || "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
        {/* ------ Right Sidebar: Teacher's personal schedule ---- */}
        {rightSidebarOpen && (
          <div className="right-sidebar">
            {/* ABSOLUTE close arrow always visible */}
            <button
              title="Close sidebar"
              onClick={() => setRightSidebarOpen(false)}
              className="close-sidebar-btn"
              style={{ marginRight: "40px" }}
            >
              <FaChevronRight />
            </button>
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
              color: "#fff",
              padding: "12px 48px 12px 20px",
              textAlign: "center",
              fontWeight: "600",
              fontSize: "1.2rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              borderTopLeftRadius: "1px",
              borderTopRightRadius: "1px",
              justifyContent: "flex-start"
            }}>
              My Schedule
            </div>
            <div style={{ padding: "20px", height: "calc(100% - 60px)", overflowY: "auto", background: "#f9fafb" }}>
              {loading ? (
                <p style={{ textAlign: "center", color: "#6b7280" }}>Loading schedule...</p>
              ) : Object.keys(teacherSchedule).length === 0 ? (
                <p style={{ textAlign: "center", color: "#6b7280" }}>No schedule found.</p>
              ) : (
                daysOfWeek.map((day) => {
                  const periods = teacherSchedule[day];
                  if (!periods) return null;
                  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
                  const isToday = today === day;
                  return (
                    <div key={day} style={{
                      marginBottom: "20px",
                      padding: "10px",
                      borderRadius: "12px",
                      background: isToday ? "#e0f2fe" : "#fff",
                      boxShadow: isToday ? "0 4px 12px rgba(59, 130, 246, 0.2)" : "0 2px 6px rgba(0,0,0,0.05)"
                    }}>
                      <h4 style={{ color: "#1e3a8a", marginBottom: "12px", fontWeight: "600", fontSize: "1.05rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>{day}</h4>
                      {Object.entries(periods).map(([periodName, entries]) => (
                        <div key={periodName} style={{ marginBottom: "12px", background: "#f3f4f6", padding: "12px 15px", borderRadius: "10px", borderLeft: "5px solid #2563eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "transform 0.2s, box-shadow 0.2s" }}>
                          <strong style={{ display: "block", marginBottom: "6px", color: "#1e3a8a", fontSize: "0.98rem" }}>{periodName}</strong>
                          <ul style={{ paddingLeft: "18px", margin: 0 }}>
                            {entries.map((entry, idx) => (
                              <li key={idx} style={{ marginBottom: "6px", color: "#374151", fontSize: "0.95rem" }}>
                                <span style={{ fontWeight: "600", color: "#2563eb" }}>{entry.class}</span> - {entry.subject} ({entry.time})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {!rightSidebarOpen && (
          <button
            title="Open sidebar"
            onClick={() => setRightSidebarOpen(true)}
            style={{
              position: "fixed",
              top: "80px",
              right: "20px",
              width: "35px",
              height: "40px",
              background: "linear-gradient(90deg, #2563eb, #3b82f6)",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              boxShadow: "0 4px 12px rgba(59,130,246, 0.15)",
              zIndex: 301,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "right 0.3s"
            }}
          >
            <FaChevronLeft />
          </button>
        )}
      </div>
    </div>
  );
}

export default Schedule;