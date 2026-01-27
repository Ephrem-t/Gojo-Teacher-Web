import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import useDarkMode from "../hooks/useDarkMode";
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
} from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "http://127.0.0.1:5000/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

function SettingsPage() {
  const [teacher, setTeacher] = useState(null);
  const [profileImage, setProfileImage] = useState("/default-profile.png");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [darkMode, toggleDarkMode] = useDarkMode();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();

  // Messenger state (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // conversations with unread messages for this teacher

  // Utility for local notification "seen" persistence
  const getSeenNotifications = (teacherId) => {
    return JSON.parse(localStorage.getItem(`seen_notifications_${teacherId}`)) || [];
  };
  const markNotificationSeen = (teacherId, postId) => {
    const seen = getSeenNotifications(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(
        `seen_notifications_${teacherId}`,
        JSON.stringify([...seen, postId])
      );
    }
  };

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  useEffect(() => {
    if (teacher) {
      setProfileImage(teacher.profileImage || "/default-profile.png");
      setName(teacher.name || "");
      setUsername(teacher.username || "");
      // fetch messenger conversations for settings page topbar
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  const handleFileChange = (e) => setSelectedFile(e.target.files[0]);

  const handleProfileSubmit = async () => {
    if (!selectedFile) return alert("Select an image first.");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await axios.patch(
          `${RTDB_BASE}/Users/${teacher.userId}.json`,
          { profileImage: base64Image }
        );
        const updatedTeacher = { ...teacher, profileImage: base64Image };
        localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
        setProfileImage(base64Image);
        setSelectedFile(null);
        alert("Profile image updated!");
      };
    } catch (err) {
      console.error("Error updating profile image:", err);
    }
  };

  const handleInfoUpdate = async () => {
    if (!name || !username) return alert("Name and Username required!");
    try {
      await axios.patch(
        `${RTDB_BASE}/Users/${teacher.userId}.json`,
        { name, username }
      );
      const updatedTeacher = { ...teacher, name, username };
      localStorage.setItem("teacher", JSON.stringify(updatedTeacher));
      setTeacher(updatedTeacher);
      alert("Profile info updated!");
    } catch (err) {
      console.error("Error updating info:", err);
    }
  };

  const handlePasswordChange = async () => {
    if (!password || !confirmPassword) return alert("Fill both password fields.");
    if (password !== confirmPassword) return alert("Passwords do not match!");
    try {
      await axios.patch(
        `${RTDB_BASE}/Users/${teacher.userId}.json`,
        { password }
      );
      setPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    } catch (err) {
      console.error("Error updating password:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // Notification fetch
 

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
        const seenPosts = getSeenPosts(teacher?.userId);

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

        // --- Post notifications (unseen only) ---
        const postNotifs = postsData
          .slice()
          .sort((a, b) => {
            const ta = a.time ? new Date(a.time).getTime() : 0;
            const tb = b.time ? new Date(b.time).getTime() : 0;
            return tb - ta;
          })
          .filter((post) => post.postId && !seenPosts.includes(post.postId))
          .slice(0, 5)
          .map((post) => {
            const info = resolveAdminInfo(post);
            return {
              id: post.postId,
              type: "post",
              title: post.message?.substring(0, 50) || "Untitled post",
              adminName: info.name,
              adminProfile: info.profile,
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
            });
          });
        }

        // Only show up to 5 notifications (posts + messages, most recent first)
        const allNotifs = [...postNotifs, ...messageNotifs].slice(0, 5);
        setNotifications(allNotifs);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
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

function getSeenPosts(teacherId) {
  return JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || [];
}

function saveSeenPost(teacherId, postId) {
  const seen = getSeenPosts(teacherId);
  if (!seen.includes(postId)) {
    localStorage.setItem(`seen_posts_${teacherId}`, JSON.stringify([...seen, postId]));
  }
}

  // ---------------- MESSENGER FUNCTIONS (same behavior as Dashboard) ----------------
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      const [chatsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

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

    // Navigate to AllChat with contact + chatId and indicate settings tab
    navigate("/all-chat", { state: { contact, chatId, tab: "settings" } });

    // Clear unread in RTDB for this teacher (permanent)
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    // Remove from UI
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  // Messenger badge: count unread messages only (from notifications)
  const totalUnreadMessages = notifications.filter((n) => n.type === "message").reduce((sum, n) => sum + (n.unreadForMe || 0), 0);

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
       
        <div className="nav-right">
          <div className="icon-circle">
            <div
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ cursor: "pointer", position: "relative" }}
            >
              <FaBell size={24} />
              {notifications.length > 0 && (
                <span style={{
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
                }}>{notifications.length}</span>
              )}
            </div>
            {showNotifications && (
              <div style={{
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
              }}>
                {notifications.length > 0 ? (
                  notifications.map((notif, index) => (
                    notif.type === "post" ? (
                      <div
                        key={notif.id || index}
                        onClick={() => handleNotificationClick(notif)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 15px",
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                        }}
                      >
                        <img src={notif.adminProfile} alt={notif.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                        <div>
                          <strong>{notif.adminName}</strong>
                          <p style={{ margin: 0, fontSize: 12 }}>{notif.title}</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={notif.chatId || index}
                        onClick={() => handleNotificationClick(notif)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "10px 15px",
                          borderBottom: "1px solid #eee",
                          cursor: "pointer",
                        }}
                      >
                        <img src={notif.profile || "/default-profile.png"} alt={notif.displayName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                        <div><strong>{notif.displayName}</strong><p style={{ margin: 0, fontSize: 12, color: '#0b78f6' }}>New message</p></div>
                      </div>
                    )
                  ))
                ) : (
                  <div style={{ padding: 15 }}>No notifications</div>
                )}
              </div>
            )}
          </div>

          {/* Messenger: navigates to all-chat, badge only */}
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={() => navigate("/all-chat")}
                 style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#f60b0b",
                  color: "#fff",
                  borderRadius: "50%",
                  minWidth: 18,
                  height: 18,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px"
                }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>
          </div>

          <Link className="icon-circle" to="/settings">
            <FaCog />
          </Link>
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
            <Link className="sidebar-btn" to="/admins"><FaUsers /> Admins</Link>
            <Link className="sidebar-btn" to="/parents"><FaChalkboardTeacher /> Parents</Link>
            <Link className="sidebar-btn" to="/marks"><FaClipboardCheck /> Marks</Link>
            <Link className="sidebar-btn" to="/attendance"><FaUsers /> Attendance</Link>
            <Link className="sidebar-btn" to="/schedule"><FaUsers /> Schedule</Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}><FaSignOutAlt /> Logout</button>
          </div>
        </div>

        {/* Main content */}
        <div
          className="main-content"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "10px",
            padding: "10px",
            width: "100%",
            gap: "30px",
          }}
        >
          <h2>Settings</h2>

          {/* Profile Image */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <img
              src={profileImage}
              alt="profile"
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: "15px",
                border: "3px solid #4b6cb7"
              }}
            />
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleProfileSubmit} style={{
              marginTop: "15px", padding: "10px 20px", borderRadius: "8px",
              border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer"
            }}>
              Update Profile Image
            </button>
          </div>

          {/* Name / Username */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <button onClick={handleInfoUpdate} style={{
              padding: "10px 20px", borderRadius: "8px",
              border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer"
            }}>Update Info</button>
          </div>

          {/* Password */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "30px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }} />
            <button onClick={handlePasswordChange} style={{
              padding: "10px 20px", borderRadius: "8px",
              border: "none", background: "#4b6cb7", color: "#fff", cursor: "pointer"
            }}>Change Password</button>
          </div>

          {/* Dark Mode */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
            padding: "20px",
            borderRadius: "12px",
            background: darkMode ? "#3a3a3a" : "#fff",
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
          }}>
            <label style={{ fontSize: "18px", fontWeight: "500" }}>Dark Mode</label>
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;