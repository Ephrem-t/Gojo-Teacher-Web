import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ref, onValue, off, update } from "firebase/database";
import { db } from "../firebase";
import {
  FaHome,
  FaUsers,
  FaClipboardCheck,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaSearch,
  FaChalkboardTeacher,
  FaFacebookMessenger,
  FaCommentDots,
  FaCheck,
  FaPaperPlane,
} from "react-icons/fa";
import "../styles/global.css";

const getChatId = (id1, id2) => [id1, id2].sort().join("_");

const formatTime = (timeStamp) => {
  if (!timeStamp) return "";
  const date = new Date(timeStamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatDateLabel = (ts) => {
  if (!ts) return "";
  const msgDate = new Date(Number(ts));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsgDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());
  const diffMs = startOfToday - startOfMsgDay;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return msgDate.toLocaleDateString();
};

const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

// Admin item component
const AdminItem = ({ admin, selected, onClick }) => (
  <div
    onClick={() => onClick(admin)}
    style={{
      width: "100%",
      borderRadius: "12px",
      padding: "15px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      cursor: "pointer",
      background: selected ? "#e0e7ff" : "#fff",
      border: selected ? "2px solid #4b6cb7" : "1px solid #ddd",
      boxShadow: selected ? "0 6px 15px rgba(75,108,183,0.3)" : "0 4px 10px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease",
    }}
  >
    <img
      src={admin.profileImage || "/default-profile.png"}
      alt={admin.name}
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid transparent",
      }}
    />
    <div>
      <h3 style={{ margin: 0 }}>{admin.name}</h3>
      <p style={{ margin: "4px 0", color: "#555" }}>{admin.username || admin.email}</p>
    </div>
  </div>
);

function AdminPage() {
  // ---------------- State ----------------
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminTab, setAdminTab] = useState("details");
  const [adminChatOpen, setAdminChatOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);

  const [teacher, setTeacher] = useState(null);
  const teacherData = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacherData.userId || "");
  const [selectedChatUser, setSelectedChatUser] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const postRefs = useRef({});

  // Messenger states (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this admin

  const navigate = useNavigate();

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  // fetch conversations when teacher is available
  useEffect(() => {
    if (teacher) fetchConversations(teacher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- FETCH ADMINS ----------------
  useEffect(() => {
  async function fetchAdmins() {
    try {
      setLoading(true);
      const [usersRes, schoolAdminsRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Users.json`),
        axios.get(`${RTDB_BASE}/School_Admins.json`),
      ]);
      const users = usersRes.data || {};
      const schoolAdmins = schoolAdminsRes.data || {};

      // Build a map of userId => schoolAdmin entry
      const adminByUserId = {};
      Object.entries(schoolAdmins).forEach(([adminKey, sa]) => {
        if (sa.userId) adminByUserId[sa.userId] = { ...sa, adminKey };
      });

      // Get all users with admin role (as before), but merge schoolAdmin fields if available
      const adminsArray = Object.entries(users)
        .filter(([_, u]) => {
          const role = (u.role || u.userType || "").toLowerCase();
          return role === "admin" || role === "school_admin" || role === "school_admins";
        })
        .map(([key, u]) => {
          const schoolAdminInfo = adminByUserId[u.userId];
          return {
            adminId: (schoolAdminInfo && schoolAdminInfo.adminKey) || key,
            ...u,
            ...(schoolAdminInfo
              ? {
                  title: schoolAdminInfo.title,
                  status: schoolAdminInfo.status,
                  schoolAdminKey: schoolAdminInfo.adminKey,
                }
              : {}),
          };
        });
      setAdmins(adminsArray);
      setError(adminsArray.length === 0 ? "No admins found" : "");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch admins");
    } finally {
      setLoading(false);
    }
  }
  fetchAdmins();
}, []);
  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------- Real-time messages for popup/chat window ----------------
  useEffect(() => {
    if (!teacherUserId || !selectedChatUser) return;
    const chatKey = getChatId(teacherUserId, selectedChatUser.userId);
    const messagesRef = ref(db, `Chats/${chatKey}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);
      setMessages(msgs);

      // mark seen for messages where teacher is receiver and set seenAt
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          const ts = Date.now();
          update(ref(db, `Chats/${chatKey}/messages/${id}`), { seen: true, seenAt: ts }).catch(() => {});
        }
      });

      // reset unread count for this teacher in this chat
      update(ref(db, `Chats/${chatKey}/unread`), { [teacherUserId]: 0 }).catch(() => {});
    });

    return () => off(messagesRef);
  }, [teacherUserId, selectedChatUser]);

  // ---------------- Send Message ----------------
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedAdmin) return;

    const senderId = teacherUserId;
    const receiverId = selectedAdmin.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();

    const message = {
      senderId,
      receiverId,
      type: "text",
      text: newMessageText,
      imageUrl: null,
      replyTo: null,
      seen: false,
      edited: false,
      deleted: false,
      timeStamp,
    };

    try {
      await axios.post(`${RTDB_BASE}/Chats/${chatId}/messages.json`, message);
      await axios.patch(`${RTDB_BASE}/Chats/${chatId}.json`, {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text: newMessageText, senderId, seen: false, timeStamp },
        unread: { [senderId]: 0, [receiverId]: 1 },
      });
      setNewMessageText("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  
  // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
   // ---------------- FETCH NOTIFICATIONS (ENRICHED WITH ADMIN INFO) ----------------
  useEffect(() => {
  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/get_posts`);
      let postsData = res.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object") {
        postsData = Object.values(postsData);
      }

      const [adminsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const schoolAdmins = adminsRes.data || {};
      const users = usersRes.data || {};

      // Get teacher from localStorage so we know who's seen what
      const teacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(teacher?.userId);

      // ...resolveAdminInfo as before...

      const resolveAdminInfo = (post) => {
        const adminId = post.adminId || post.posterAdminId || post.poster || post.admin || null;
        // ...same as your code...
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

      const latest = postsData
        .slice()
        .sort((a, b) => {
          const ta = a.time ? new Date(a.time).getTime() : 0;
          const tb = b.time ? new Date(b.time).getTime() : 0;
          return tb - ta;
        })
        // ONLY SHOW NOTIFICATIONS FOR UNSEEN POSTS
        .filter((post) => post.postId && !seenPosts.includes(post.postId))
        .slice(0, 5)
        .map((post) => {
          const info = resolveAdminInfo(post);
          return {
            id: post.postId,
            title: post.message?.substring(0, 50) || "Untitled post",
            adminName: info.name,
            adminProfile: info.profile,
          };
        });

      setNotifications(latest);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  fetchNotifications();
}, []);


// --- 3. Handler to remove notification after clicked (and mark seen) ---

const handleNotificationClick = (postId) => {
  if (!teacher || !postId) return;
  // Save to localStorage
  saveSeenPost(teacher.userId, postId);
  // Remove from UI right away
  setNotifications(prev => prev.filter((n) => n.id !== postId));
  setShowNotifications(false); // Optionally close the notification panel
};

function getSeenPosts(teacherId) {
  return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
}

function saveSeenPost(teacherId, postId) {
  const seen = getSeenPosts(teacherId);
  if (!seen.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }
}
  // ---------------- MESSENGER: fetch conversations with unread messages (same as Dashboard) ----------------
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

      // build maps
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

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
            if (mapped) {
              otherPushKey = mapped;
              otherRecord = usersByKey[mapped];
            }
          }

          if (!otherRecord) {
            otherRecord = { userId: otherKeyCandidate, name: otherKeyCandidate, profileImage: "/default-profile.png" };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name: otherRecord.name || otherRecord.username || otherKeyCandidate,
            profileImage: otherRecord.profileImage || otherRecord.profile || "/default-profile.png",
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime: lastMessage.timeStamp || lastMessage.time || null,
            unreadForMe,
          };
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

    // Navigate to AllChat with contact + chatId and indicate admin tab
    navigate("/all-chat", { state: { contact, chatId, tab: "admin" } });

    // Clear unread for this teacher in DB
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

const [isPortrait, setIsPortrait] = React.useState(window.innerWidth < window.innerHeight);
const [screenWidth, setScreenWidth] = React.useState(window.innerWidth);

React.useEffect(() => {
  const handleResize = () => {
    const w = window.innerWidth;
    setIsPortrait(w < window.innerHeight);
    setScreenWidth(w);
  };

  // initialize
  handleResize();

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

// compute admin list main column width: keep small-device default, expand on larger screens
const mainListWidth = (() => {
  if (screenWidth >= 1800) return "800px";
  if (screenWidth >= 1500) return "600px";
  if (screenWidth >= 1200) return "400px";
  return "300px"; // default for small and medium screens (preserves existing look)
})();




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
              {(notifications.length + totalUnreadMessages) > 0 && (
                <span style={{ position: "absolute", top: -5, right: -5, background: "red", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {notifications.length + totalUnreadMessages}
                </span>
              )}
            </div>

            {showNotifications && (
              <div style={{ position: "absolute", top: 30, right: 0, width: 300, maxHeight: 400, overflowY: "auto", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", borderRadius: 8, zIndex: 100 }}>
                {/* Show post notifications */}
                {notifications.length > 0 && notifications.map((post, index) => (
                  <div key={post.id || index} onClick={() => {
                    navigate("/dashboard");
                    setTimeout(() => {
                      const postElement = postRefs.current[post.id];
                      if (postElement) {
                        postElement.scrollIntoView({ behavior: "smooth", block: "center" });
                        setHighlightedPostId(post.id);
                        setTimeout(() => setHighlightedPostId(null), 3000);
                      }
                    }, 150);
                    setNotifications(prev => prev.filter((_, i) => i !== index));
                    setShowNotifications(false);
                  }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={post.adminProfile} alt={post.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                    <div><strong>{post.adminName}</strong><p style={{ margin: 0, fontSize: 12 }}>{post.title}</p></div>
                  </div>
                ))}
                {/* Show unread message notifications */}
                {totalUnreadMessages > 0 && conversations.filter(c => c.unreadForMe > 0).map((conv, idx) => (
                  <div key={conv.chatId || idx} onClick={() => {
                    setShowNotifications(false);
                    navigate("/all-chat");
                  }} style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <img src={conv.profile || "/default-profile.png"} alt={conv.displayName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                    <div><strong>{conv.displayName}</strong><p style={{ margin: 0, fontSize: 12, color: '#0b78f6' }}>New message</p></div>
                  </div>
                ))}
                {notifications.length === 0 && totalUnreadMessages === 0 && <div style={{ padding: 15 }}>No notifications</div>}
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

      <div className="google-dashboard">
        {/* Sidebar */}
        <div className="google-sidebar">
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
            <Link className="sidebar-btn" to="/admins" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "30px" }}>
          <div style={{ width: mainListWidth, marginLeft: "40px" }}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>All Admins</h2>

            {loading && <p>Loading admins...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {admins.map((a) => (
                <AdminItem
                  key={a.adminId}
                  admin={a}
                  selected={selectedAdmin?.adminId === a.adminId}
                  onClick={(admin) => {
                    setSelectedAdmin(admin);
                    setSelectedChatUser(admin);
                  }}
                />
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR (selected admin detail & chat toggle) */}
{selectedAdmin && (
  <div
    style={{
      width: isPortrait ? "100%" : "30%",
      height: isPortrait ? "100vh" : "calc(100vh - 60px)",
      position: "fixed",
      right: 0,
      top: isPortrait ? 0 : "60px",
      background: "#fff",
      boxShadow: isPortrait
        ? "0 0 0 rgba(0,0,0,0)"
        : "0 0 15px rgba(0,0,0,0.05)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      padding: isPortrait ? "18px" : "25px",
      transition: "all 0.35s ease",
    }}
  >

    {/* Close button (top-right) */}
<button
  onClick={() => setSelectedAdmin(null)}
  aria-label="Close admin details"
  title="Close"
  style={{
    position: "fixed",
    top: 52,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: "12px",
    border: "none",
    background: "#fff",
    boxShadow: "0 8px 18px rgba(2,6,23,0.15)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    zIndex: 2000,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
  }}
>
  ×
</button>


    <div style={{ textAlign: "center", marginBottom: "20px" }}>
      <div style={{ width: "120px", height: "120px", margin: "0 auto 15px", borderRadius: "50%", overflow: "hidden", border: "4px solid #4b6cb7" }}>
        <img src={selectedAdmin.profileImage || "/default-profile.png"} alt={selectedAdmin.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <h2>{selectedAdmin.name}</h2>
      <p>{selectedAdmin.username}</p>
    </div>

              <div style={{ display: "flex", marginBottom: "15px" }}>
                {["details", "Plan", "Report"].map((tab) => (
                  <button key={tab} onClick={() => setAdminTab(tab)} style={{ flex: 1, padding: "10px", border: "none", background: "none", cursor: "pointer", fontWeight: "600", color: adminTab === tab ? "#4b6cb7" : "#777", borderBottom: adminTab === tab ? "3px solid #4b6cb7" : "3px solid transparent" }}>{tab.toUpperCase()}</button>
                ))}
              </div>

              {adminTab === "details" && selectedAdmin && (
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
      {/* ADMINISTRATOR DETAILS */}
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
        Administrator Details
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
          ["Admin ID", selectedAdmin.adminId || selectedAdmin.userId],
          ["Email", selectedAdmin.email],
          ["Phone", selectedAdmin.phone],
          ["Gender", selectedAdmin.gender ? (selectedAdmin.gender.charAt(0).toUpperCase() + selectedAdmin.gender.slice(1)) : null],
          ["Title", selectedAdmin.title],
          ["Status", selectedAdmin.status ? (selectedAdmin.status.charAt(0).toUpperCase() + selectedAdmin.status.slice(1)) : null],
         
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              padding: 18,
              borderRadius: 20,
              background: "#ffffff",
              boxShadow: "0 6px 10px rgba(0,0,0,0.08)",
              marginLeft: -30,
              marginRight: -30,
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
              {value || "—"}
            </div>
          </div>
        ))}
      </div>

      
    </div>
  </div>
)}
              {adminTab === "Plan" && <p>Plan data here.</p>}
              {adminTab === "Report" && <p>Report data here.</p>}

              {!adminChatOpen && selectedAdmin && (
                <div onClick={() => setAdminChatOpen(true)} style={{ position: "fixed", bottom: "20px", right: "20px", width: "60px", height: "60px", background: "linear-gradient(135deg, #833ab4, #202ef3, #395a8b)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", zIndex: 1000, boxShadow: "0 8px 18px rgba(0,0,0,0.25)" }}>
                  <FaCommentDots size={30} />
                </div>
              )}

              {/* Admin Chat Popup */}
              {adminChatOpen && selectedAdmin && teacher && (
                <div style={{ position: "fixed", bottom: "20px", right: "20px", width: "360px", height: "480px", background: "#fff", borderRadius: "16px", boxShadow: "0 12px 30px rgba(0,0,0,0.25)", zIndex: 2000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ padding: "14px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
                    <strong>{selectedAdmin.name}</strong>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => { setAdminChatOpen(false); navigate("/all-chat", { state: { contact: selectedAdmin, tab: "admin" } }); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>⤢</button>
                      <button onClick={() => setAdminChatOpen(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>×</button>
                    </div>
                  </div>

                  <div style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", background: "#f9f9f9" }}>
                    {messages.length === 0 ? (
                      <p style={{ textAlign: "center", color: "#aaa" }}>Start chatting with {selectedAdmin.name}</p>
                    ) : messages.map((m) => (
                      <div key={m.id} style={{ display: "flex", flexDirection: m.isTeacher ? "row-reverse" : "row", alignItems: "flex-end", marginBottom: 10 }}>
                        <div style={{ background: m.isTeacher ? "#4facfe" : "#fff", color: m.isTeacher ? "#fff" : "#000", padding: "10px 14px", borderRadius: 18, maxWidth: "65%", position: "relative", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                          {m.text}
                          <div style={{ fontSize: 10, color: "#888", marginTop: 4, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                            {formatTime(m.timeStamp)}
                            {m.isTeacher && <FaCheck size={10} color={m.seen ? "#4facfe" : "#ccc"} />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div style={{ padding: "10px", borderTop: "1px solid #eee", display: "flex", gap: "8px", background: "#fff" }}>
                    <input value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: "10px 14px", borderRadius: "999px", border: "1px solid #ccc", outline: "none" }} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
                    <button onClick={sendMessage} style={{ background: "linear-gradient(135deg, #0751f1, #0e35e4, #0f5afc)", border: "none", borderRadius: "50%", width: "42px", height: "42px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>➤</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;