import React, { useState, useEffect, useRef } from "react";
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaSearch,
  FaBell,
  FaClipboardCheck,
  FaUsers,
  FaFacebookMessenger,
  FaCommentDots,
  FaCheck,
} from "react-icons/fa";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase"; // adjust path if needed
import "../styles/global.css";

/**
 * TeacherParent (responsive)
 *
 * - Keeps existing behavior.
 * - Right sidebar becomes a sheet on small screens / portrait (fills viewport).
 * - Adds overlay and prevents background scroll while sidebar is open.
 * - Adds a close button at the top of the sidebar.
 * - Minor polish to layout so it adapts to narrow viewports.
 */

const getChatId = (id1, id2) => [id1, id2].sort().join("_");
const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

const formatTime = (ts) => {
  if (!ts) return "";
  const d = new Date(Number(ts));
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

function TeacherParent() {
const [teacher, setTeacher] = useState(null);
  const [parents, setParents] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("Details"); // default tab
 const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
const [children, setChildren] = useState([]);
 const [notifications, setNotifications] = useState([]);
 const [showNotifications, setShowNotifications] = useState(false);
 const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  const [showMessenger, setShowMessenger] = useState(false);
    const [conversations, setConversations] = useState([]);
  
  const navigate = useNavigate();

  // detect portrait (width < height) and small screens
  const [isPortrait, setIsPortrait] = useState(window.innerWidth < window.innerHeight);
  useEffect(() => {
    const handleResize = () => setIsPortrait(window.innerWidth < window.innerHeight);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // load teacher from localStorage
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // safe teacher id for renders when `teacher` may be null briefly
  const teacherId = teacher?.userId || "";

  // fetch parents & related data
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;

    const fetchParents = async () => {
      try {
        setLoading(true);

        const [assignmentsRes, coursesRes, studentsRes, usersRes, parentsRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Parents.json`),
        ]);

        const assignments = assignmentsRes.data || {};
        const courses = coursesRes.data || {};
        const students = studentsRes.data || {};
        const users = usersRes.data || {};
        const parentsData = parentsRes.data || {};

        const teacherId = teacher.userId;

        // teacher's courses (you can re-enable filtering if you want)
        const teacherCourseIds = Object.values(assignments)
          .filter((a) => a.teacherId === teacherId)
          .map((a) => a.courseId);

        // Build student->parent map including relationship
        const studentToParentMap = {};
        Object.entries(parentsData).forEach(([parentId, parent]) => {
          if (!parent.children) return;
          Object.values(parent.children).forEach((child) => {
            if (!child.studentId) return;
            const rel = child.relationship || child.relation || child.relationToChild || child.type || child.role || null;
            if (!studentToParentMap[child.studentId]) studentToParentMap[child.studentId] = [];
            studentToParentMap[child.studentId].push({ parentId, relationship: rel });
          });
        });

        // Build parent->children map with relationship data
        const parentChildrenMap = {};
        Object.entries(students).forEach(([studentId, student]) => {
          const studentUser = Object.values(users).find((u) => String(u.userId) === String(student.userId));
          const studentName = studentUser?.name || "No Name";
          const studentProfileImage = studentUser?.profileImage || "/default-profile.png";

          const parentEntries = studentToParentMap[studentId] || [];
          parentEntries.forEach(({ parentId, relationship }) => {
            if (!parentChildrenMap[parentId]) parentChildrenMap[parentId] = [];
            parentChildrenMap[parentId].push({
              studentId,
              name: studentName,
              grade: student.grade,
              section: student.section,
              profileImage: studentProfileImage,
              userId: student.userId,
                relationship: relationship || "—",
                age: student.age || studentUser?.age || null,
                city: student.city || studentUser?.city || (student.address && student.address.city) || null,
                citizenship: student.citizenship || studentUser?.citizenship || student.nationality || null,
                address: student.address || studentUser?.address || null,
                status: student.status || "Active",
            });
          });
        });

        const finalParents = Object.keys(parentChildrenMap).map((pid) => {
          const parent = parentsData[pid] || {};
          const parentUser = Object.values(users).find((u) => String(u.userId) === String(parent.userId)) || {};
          const childrenList = parentChildrenMap[pid] || [];
          const relationships = Array.from(new Set(childrenList.map((c) => c.relationship).filter(Boolean)));
          return {
            id: pid,
            userId: parent.userId,
            name: parentUser.name || parent.name || "No Name",
            email: parentUser.email || parent.email || "N/A",
            phone: parentUser.phone || parent.phone || "",
            profileImage: parentUser.profileImage || parent.profileImage || "/default-profile.png",
            children: childrenList,
            relationships,
            age: parent.age || parentUser.age || null,
            city: parent.city || parentUser.city || parent.address?.city || null,
            citizenship: parent.citizenship || parentUser.citizenship || parent.nationality || null,
            status: parent.status || "Active",
            createdAt: parent.createdAt,
            address: parent.address || parentUser.address || null,
            extra: parent.extra,
          };
        });

        if (!cancelled) setParents(finalParents);
      } catch (err) {
        console.error("Error fetching parents:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchParents();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  // Scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // fetch messages when chat popup open for selectedParent
  useEffect(() => {
    if (!selectedParent || !teacher || !chatOpen) return;
    const chatId = getChatId(teacherId, selectedParent.userId);
    const messagesRef = ref(db, `Chats/${chatId}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data).map(([id, msg]) => ({ messageId: id, ...msg }));
      msgs.sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);
    });
    markAsSeen(chatId);
    return () => off(messagesRef);
  }, [selectedParent, teacher, chatOpen]);

  const sendMessage = async (text) => {
    if (!text?.trim() || !selectedParent || !teacher) return;
    const senderId = teacherId;
    const receiverId = selectedParent.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();
    const message = { senderId, receiverId, type: "text", text, seen: false, timeStamp };
    try {
      await axios.post(`${RTDB_BASE}/Chats/${chatId}/messages.json`, message);
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}.json`, {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text, senderId, seen: false, timeStamp },
        unread: { [senderId]: 0, [receiverId]: 1 },
      });
      setNewMessageText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  const markAsSeen = async (chatId) => {
    try {
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/unread.json`, { [teacherId]: 0 });
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}/lastMessage.json`, { seen: true });
    } catch (err) {
      console.error("Mark as seen error:", err);
    }
  };

  // notifications & messenger (kept as in your original)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Fetch posts
        const res = await axios.get(`${API_BASE}/get_posts`);
        let postsData = res.data || [];
        if (!Array.isArray(postsData) && typeof postsData === "object") postsData = Object.values(postsData);
        const [adminsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/School_Admins.json`),
          axios.get(`${RTDB_BASE}/Users.json`)
        ]);
        const schoolAdmins = adminsRes.data || {};
        const users = usersRes.data || {};
        const teacherLocal = JSON.parse(localStorage.getItem("teacher"));
        const seenPosts = getSeenPosts(teacherLocal?.userId);
        const resolveAdminInfo = (post) => {
          const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
          if (adminId && schoolAdmins[adminId]) {
            const sa = schoolAdmins[adminId];
            const userKey = sa.userId;
            const userRec = users[userKey] || null;
            const name = (userRec && userRec.name) || sa.name || post.adminName || "Admin";
            const profile = (userRec && userRec.profileImage) || sa.profileImage || post.adminProfile || "/default-profile.png";
            return { name, profile };
          }
          return { name: post.adminName || "Admin", profile: post.adminProfile || "/default-profile.png" };
        };
        const latestPosts = postsData
          .slice()
          .sort((a, b) => ((b.time ? new Date(b.time).getTime() : 0) - (a.time ? new Date(a.time).getTime() : 0)))
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              type: "post",
              id: post.postId,
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile
            };
          });

        // Fetch unread messages (conversations)
        let messageNotifs = [];
        try {
          const t = teacherLocal;
          if (t && t.userId) {
            const [chatsRes, usersRes] = await Promise.all([
              axios.get(`${RTDB_BASE}/Chats.json`),
              axios.get(`${RTDB_BASE}/Users.json`)
            ]);
            const chats = chatsRes.data || {};
            const users = usersRes.data || {};
            const usersByKey = users || {};
            const userKeyByUserId = {};
            Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
            messageNotifs = Object.entries(chats)
              .map(([chatId, chat]) => {
                const unreadMap = chat.unread || {};
                const unreadForMe = unreadMap[t.userId] || 0;
                if (!unreadForMe) return null;
                const participants = chat.participants || {};
                const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
                if (!otherKeyCandidate) return null;
                let otherPushKey = otherKeyCandidate;
                let otherRecord = usersByKey[otherPushKey];
                if (!otherRecord) {
                  const mapped = userKeyByUserId[otherKeyCandidate];
                  if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
                }
                if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
                const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
                const lastMessage = chat.lastMessage || {};
                return {
                  type: "message",
                  chatId,
                  displayName: contact.name,
                  profile: contact.profileImage,
                  lastMessageText: lastMessage.text || "",
                  lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
                  unreadForMe
                };
              })
              .filter(Boolean)
              .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          }
        } catch (err) {
          console.error("Error fetching message notifications:", err);
        }

        setNotifications([...latestPosts, ...messageNotifs]);
        setMessageNotifications(messageNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    fetchNotifications();
  }, []);

  function getSeenPosts(teacherId) {
    return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
  }
  function saveSeenPost(teacherId, postId) {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }

  // messenger conversations fetch
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }
      const [chatsRes, usersRes] = await Promise.all([axios.get(`${RTDB_BASE}/Chats.json`), axios.get(`${RTDB_BASE}/Users.json`)]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => { if (u && u.userId) userKeyByUserId[u.userId] = pushKey; });
      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null;
          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;
          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];
          if (!otherRecord) {
            const mapped = userKeyByUserId[otherKeyCandidate];
            if (mapped) { otherPushKey = mapped; otherRecord = usersByKey[mapped]; }
          }
          if (!otherRecord) otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          const contact = { pushKey: otherPushKey, userId: otherRecord.userId || otherKeyCandidate, name: otherRecord.name || otherRecord.username || otherKeyCandidate, profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png" };
          const lastMessage = chat.lastMessage || {};
          return { chatId, contact, displayName: contact.name, profile: contact.profileImage, lastMessageText: lastMessage.text || "", lastMessageTime: lastMessage.timeStamp || lastMessage.time || null, unreadForMe };
        })
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;
    navigate("/all-chat", { state: { contact, chatId, tab: "parents" } });
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacherId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = messageNotifications.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // Prevent background scroll while sidebar is open (applies on small screens)
  useEffect(() => {
    if (selectedParent) {
      document.body.classList.add("sidebar-open");
    } else {
      document.body.classList.remove("sidebar-open");
    }
    return () => document.body.classList.remove("sidebar-open");
  }, [selectedParent]);

  // Render
  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>

         <div className="nav-right">
                  {/* Notification Bell & Popup (shows posts and unread messages) */}
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
                      <div style={{ position: "absolute", top: 30, right: 0, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", borderRadius: 8, zIndex: 100 }}>
                        {notifications.length > 0 ? notifications.map((notif, index) => (
                          notif.type === "post" ? (
                            <div key={notif.id || index} onClick={() => {
                              navigate("/dashboard");
                              setTimeout(() => {
                                const postElement = postRefs?.current?.[notif.id];
                                if (postElement) {
                                  postElement.scrollIntoView({ behavior: "smooth", block: "center" });
                                  setHighlightedPostId(notif.id);
                                  setTimeout(() => setHighlightedPostId(null), 3000);
                                }
                              }, 150);
                              setNotifications(prev => prev.filter((_, i) => i !== index));
                              setShowNotifications(false);
                            }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                              <img src={notif.adminProfile} alt={notif.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                              <div><strong>{notif.adminName}</strong><p style={{ margin: 0, fontSize: 12 }}>{notif.title}</p></div>
                            </div>
                          ) : (
                            <div key={notif.chatId || index} onClick={() => {
                              setShowNotifications(false);
                              navigate("/all-chat");
                            }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                              <img src={notif.profile || "/default-profile.png"} alt={notif.displayName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                              <div><strong>{notif.displayName}</strong><p style={{ margin: 0, fontSize: 12, color: '#0b78f6' }}>New message</p></div>
                            </div>
                          )
                        )) : <div style={{ padding: 15 }}>No notifications</div>}
                      </div>
                    )}
                  </div>
        
                  {/* Messenger button: navigates to all-chat, badge only */}
                  <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
                    <div onClick={() => navigate("/all-chat")}
                         style={{ cursor: "pointer", position: "relative" }}>
                      <FaFacebookMessenger size={22} />
                      {totalUnreadMessages > 0 && (
                        <span style={{ position: "absolute", top: -6, right: -6, background: "#f60b0b", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                          {totalUnreadMessages}
                        </span>
                      )}
                    </div>
                  </div>
        
                 <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
                  <img src={teacher?.profileImage || "/default-profile.png"} alt="teacher" className="profile-img" />
                </div>
      </nav>

      <div className="google-dashboard" style={{ display: "flex" }}>
        {/* Sidebar */}
        <div className="google-sidebar" style={{
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
        }}>
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
            <Link className="sidebar-btn" to="/parents" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* MAIN */}
        <main style={{ flex: 1, padding: 30 }}>
          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <section style={{ flex: "1 1 320px", minWidth: 280 }}>
              <h2 style={{ textAlign: "center", marginBottom: 20, color: "#4b6cb7", fontWeight: 700 }}>Parents</h2>

              {loading ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#555" }}>Loading...</p>
              ) : parents.length === 0 ? (
                <p style={{ textAlign: "center", fontSize: 18, color: "#999" }}>No parents found.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                  {parents.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedParent(p)}
                      style={{
                        display: "flex",
                        gap: 15,
                        width: "calc(100% - 50px)",
                        padding: 16,
                        marginLeft: 50,
                        borderRadius: 12,
                        boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                        backgroundColor: selectedParent?.id === p.id ? "#f0f4ff" : "#fff",
                        cursor: "pointer",
                        alignItems: "center",
                      }}
                    >
                      <img src={p.profileImage} alt={p.name} style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                        <p style={{ margin: "6px 0 0 0", color: "#777" }}>{p.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Responsive Right Sidebar */}
            {selectedParent && (
              <>
                {/* overlay for mobile/portrait */}
                <div
                  className="parent-sidebar-overlay"
                  onClick={() => setSelectedParent(null)}
                  style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999 }}
                />

                <aside
                  className="parent-sidebar"
                  style={{
                    width: isPortrait ? "100%" : 420,
                    height: isPortrait ? "100vh" : "calc(100vh - 60px)",
                    position: "fixed",
                    right: 0,
                    top: isPortrait ? 0 : 60,
                    background: "#fff",
                    boxShadow: isPortrait ? "none" : "0 0 20px rgba(0,0,0,0.06)",
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    padding: isPortrait ? 18 : 24,
                    transition: "all 0.32s ease",
                  }}
                  role="dialog"
                  aria-modal="true"
                >
                  {/* close button */}
                  <button
                    onClick={() => setSelectedParent(null)}
                    style={{
                      position: "absolute",
                      top: isPortrait ? 8 : -11,
                      right: 18,
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "none",
                      background: "#fff",
                      boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      zIndex: 1010,
                      fontSize: 20,
                    }}
                    aria-label="Close details"
                  >
                    ×
                  </button>

                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <div style={{ width: 100, height: 100, margin: "0 auto 12px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
                      <img src={selectedParent.profileImage} alt={selectedParent.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <h3 style={{ margin: 0 }}>{selectedParent.name}</h3>
                    <div style={{ color: "#666", marginTop: 6 }}>{selectedParent.email}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {["Details", "Children", "Status"].map((t) => (
                      <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: activeTab === t ? "#4b6cb7" : "#f0f0f0", color: activeTab === t ? "#fff" : "#333", fontWeight: 700 }}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div style={{ paddingBottom: 40 }}>
                 {activeTab === "Details" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 28,
      padding: isPortrait ? 50 : 50,
      marginLeft: 0,
      marginRight: 0,
      borderRadius: 0,
      background: "linear-gradient(180deg,#eef2ff,#f8fafc)",
      fontFamily: "Inter, system-ui",
    }}
  >
    {/* ================= LEFT COLUMN ================= */}
    <div>
      {/* PARENT DETAILS */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          marginBottom: 18,
          marginTop: -30,
          background: "linear-gradient(90deg,#2563eb,#7c3aed)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Parent Details
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 68,
          rowGap: 14,
        }}
      >
        {[
      
          ["Email", selectedParent.email || "N/A"],
          ["Phone", selectedParent.phone || "N/A"],
          ["Relationship(s)", (selectedParent.relationships && selectedParent.relationships.length) ? selectedParent.relationships.join(", ") : "—"],
          ["Age", selectedParent.age || "—"],
          ["City", selectedParent.city || (selectedParent.address && typeof selectedParent.address === 'object' ? selectedParent.address.city : selectedParent.city) || "—"],
          ["Citizenship", selectedParent.citizenship || "—"],
          ["Status", selectedParent.status ? (selectedParent.status.charAt(0).toUpperCase() + selectedParent.status.slice(1)) : "—"],
          ["Address", (typeof selectedParent.address === 'string' ? selectedParent.address : (selectedParent.address && (selectedParent.address.street || selectedParent.address.city || JSON.stringify(selectedParent.address))) ) || "—", true],
        ].map(([label, value, span]) => (
          <div
            key={label}
            style={{
              padding: 18,
              borderRadius: 20,
              background: "#ffffff",
              boxShadow: "0 6px 10px rgba(0,0,0,0.08)",
              marginLeft: -30,
              marginRight: -30,
              gridColumn: span ? "span 2" : "span 1",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#000102",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 16,
                fontWeight: 400,
                color: "#000102",
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

     
    </div>
  </div>
)}

       {activeTab === "Children" && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
      background: "#f5f7fa",
      padding: 18,
      borderRadius: 10,
    }}
  >
    {selectedParent.children.map((c) => (
      <div
        key={c.studentId}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          background: "#fff",
          borderRadius: 16,
          padding: "22px 30px",
          boxShadow: "0 4px 24px rgba(80,90,130,0.10)",
          border: "1px solid #edeef2",
          transition: "box-shadow 0.2s, transform 0.18s",
          cursor: "pointer",
        }}
        onMouseEnter={e =>
          (e.currentTarget.style.boxShadow =
            "0 8px 32px 0 rgba(60,72,120,0.17)")
        }
        onMouseLeave={e =>
          (e.currentTarget.style.boxShadow =
            "0 4px 24px rgba(80,90,130,0.10)")
        }
      >
        {/* Profile Image */}
        <img
          src={c.profileImage}
          alt={c.name}
          style={{
            width: 66,
            height: 66,
            borderRadius: "50%",
            border: "3px solid #2868f1",
            objectFit: "cover",
            background: "#f0f4fa",
            flexShrink: 0,
            boxShadow: "0 2px 8px 0 rgba(60,72,120,0.07)",
          }}
        />
        {/* User Info */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 21, color: "#213052", marginBottom: 2 }}>
            {c.name}
          </span>
          
          {/* Badges Row */}
          <div style={{ display: "flex", columnGap: 1, marginTop: -12, marginLeft: -19 }}>
            <div
              style={{
             
                color: "#050505",
                fontWeight: 400,
                fontSize: 14,
                padding: "6px 18px",
                borderRadius: 999,
                letterSpacing: 0.5,
                boxShadow: "0 2px 8px rgba(22,119,255,.09)",
              }}
            >
              Grade:{c.grade}
            </div>
            <div
              style={{
              
                color: "#000000",
                fontWeight: 400,
                fontSize: 14,
                padding: "6px 1px",
                borderRadius: 999,
                letterSpacing: 0.5,
                boxShadow: "0 2px 8px rgba(255,126,95,.09)",
              }}
            >
              Section:{c.section}
            </div>
          </div>
          <span style={{ fontSize: 15, color: "#424242", marginTop: "-10px" }}>
            {c.relationship && `Relation: ${c.relationship}`}
          </span>
        </div>
      </div>
    ))}
  </div>
)}
                    {activeTab === "Status" && (
                      <div>
                        <p><strong>Status:</strong> {selectedParent.status || "Active"}</p>
                        <p><strong>Created:</strong> {selectedParent.createdAt ? new Date(selectedParent.createdAt).toLocaleString() : "—"}</p>
                      </div>
                    )}
                  </div>


 {/* Chat Button */}
      {!chatOpen && (
        <div
          onClick={() => setChatOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "60px",
            height: "60px",
            background: "linear-gradient(135deg, #3a6fb4, #2147f0, #457ffc)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            zIndex: 1000,
            boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
            transition: "transform 0.2s ease",
          }}
        >
          <FaCommentDots size={30} />
        </div>
      )}


{chatOpen && selectedParent && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            width: "360px",
            height: "480px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafafa",
            }}
          >
            <strong>{selectedParent.name}</strong>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Expand */}
              
              <button
  onClick={() => {
    setChatOpen(false); // properly close popup
    navigate("/all-chat", {
      state: {
        user: selectedParent, // user to auto-select
        tab: "parent",        // tab type
      },
    });
  }}
  style={{
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
  }}
>
  ⤢
</button>


              {/* Close */}
              <button
                onClick={() => setChatOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              padding: "12px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "#f9f9f9",
            }}
          >
            {messages.length === 0 ? (
              <p style={{ textAlign: "center", color: "#aaa" }}>
                Start chatting with {selectedParent.name}
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.messageId}
                    style={{
                    display: "flex",
                    flexDirection: m.senderId === teacherId ? "row-reverse" : "row",
                    alignItems: "flex-end",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: m.senderId === teacherId ? "flex-end" : "flex-start" }}>
                    <div style={{
                      background: m.senderId === teacherId ? "#4b6cb7" : "#fff",
                      color: m.senderId === teacherId ? "#fff" : "#0f172a",
                      padding: "10px 14px",
                      borderRadius: 18,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      wordBreak: "break-word",
                      position: "relative",
                      paddingBottom: "26px",
                    }}>
                      <div>{m.text}</div>
                      <div style={{ position: "absolute", right: 8, bottom: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: m.senderId === teacherId ? "rgba(255,255,255,0.9)" : "#64748b" }}>
                        <span style={{ fontSize: 11 }}>{formatTime(m.timeStamp)}</span>
                        {m.senderId === teacherId && <FaCheck size={12} color={m.seen ? (m.seenAt ? "#10b981" : "#10b981") : (m.seen ? "#10b981" : "#94a3b8")} />}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "10px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
              background: "#fff",
            }}
          >
            <input
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "999px",
                border: "1px solid #ccc",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage(newMessageText);
              }}
            />
            <button
              onClick={() => sendMessage(newMessageText)}
              style={{
                background:
                  "linear-gradient(135deg, #3a65b4, #2c4fee, #458efc)",
                border: "none",
                borderRadius: "50%",
                width: "42px",
                height: "42px",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}




                </aside>

                {/* component-scoped CSS for responsive behavior */}
                <style>{`
                  @media (max-width: 900px), (orientation: portrait) {
                    .parent-sidebar { width: 100vw !important; height: 100vh !important; left: 0 !important; top: 0 !important; border-radius: 0 !important; padding: 16px !important; }
                    .parent-sidebar-overlay { display: block !important; }
                    body.sidebar-open { overflow: hidden !important; }
                  }
                `}</style>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeacherParent;