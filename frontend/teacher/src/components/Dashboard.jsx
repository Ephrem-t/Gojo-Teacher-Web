import React, { useEffect, useState, useRef } from "react";
import { FaChevronRight } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaUsers,
  FaSearch,
  FaRegHeart,
  FaHeart,
  FaClipboardCheck,
  FaFacebookMessenger,
} from "react-icons/fa";

import axios from "axios";
import "../styles/global.css";
import { db } from "../firebase";
import { ref, get } from "firebase/database";

const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

// === Defensive helper ===
function getSafeProfileImage(profileImage) {
  if (!profileImage) return "/default-profile.png";
  if (
    typeof profileImage !== "string" ||
    !profileImage.trim() ||
    profileImage === "null" ||
    profileImage === "undefined"
  )
    return "/default-profile.png";
  return profileImage;
}

export default function Dashboard() {
  // Sidebar toggle state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [posts, setPosts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messageNotifs, setMessageNotifs] = useState([]); // for message notifications
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Messenger state
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]);
  const postRefs = useRef({});
  const teacherId = teacher?.userId || null;

  useEffect(() => {
    // Load teacher from localStorage first
    const stored = JSON.parse(localStorage.getItem("teacher"));
    if (!stored) {
      navigate("/login");
      return;
    }

    // Fetch teacher profile from Users node in Firebase
    const fetchTeacherProfile = async () => {
      try {
        const usersRef = ref(db, `Users`);
        const snapshot = await get(usersRef);
        const usersData = snapshot.val() || {};
        // Find the user with matching userId
        const teacherEntry = Object.values(usersData).find(
          (u) => u.userId === stored.userId
        );
        if (teacherEntry) {
          // Merge the teacherEntry (from Users) with stored (from localStorage/API)
          const merged = { ...stored, ...teacherEntry };
          setTeacher(merged);
          localStorage.setItem("teacher", JSON.stringify(merged));
        } else {
          setTeacher(stored);
        }
      } catch (err) {
        setTeacher(stored);
      }
    };

    // Fetch unread messages for notification dropdown
    const fetchMessageNotifs = async (teacherObj) => {
      try {
        const t = teacherObj || JSON.parse(localStorage.getItem("teacher"));
        if (!t || !t.userId) {
          setMessageNotifs([]);
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
        const notifs = Object.entries(chats)
          .map(([chatId, chat]) => {
            const unreadMap = chat.unread || {};
            const unreadForMe = unreadMap[t.userId] || 0;
            if (!unreadForMe) return null;
            const participants = chat.participants || {};
            const otherKeyCandidate = Object.keys(participants || {}).find(
              (p) => p !== t.userId
            );
            if (!otherKeyCandidate) return null;
            let otherPushKey = otherKeyCandidate;
            let otherRecord = usersByKey[otherPushKey];
            if (!otherRecord) {
              const mappedPushKey = userKeyByUserId[otherKeyCandidate];
              if (mappedPushKey) {
                otherPushKey = mappedPushKey;
                otherRecord = usersByKey[mappedPushKey];
              }
            }
            if (!otherRecord) {
              otherRecord = {
                userId: otherKeyCandidate,
                name: otherKeyCandidate,
                profileImage: "/default-profile.png",
              };
            }
            const contact = {
              pushKey: otherPushKey,
              userId: otherRecord.userId || otherKeyCandidate,
              name:
                otherRecord.name ||
                otherRecord.username ||
                otherKeyCandidate,
              profileImage: getSafeProfileImage(
                otherRecord.profileImage ||
                  otherRecord.profile ||
                  ""
              ),
            };
            const lastMessage = chat.lastMessage || {};
            return {
              id: chatId,
              title: lastMessage.text || "New message",
              adminName: contact.name,
              adminProfile: contact.profileImage,
              isMessage: true,
              unreadForMe,
            };
          })
          .filter(Boolean);
        setMessageNotifs(notifs);
      } catch (err) {
        setMessageNotifs([]);
      }
    };

    fetchTeacherProfile();
    fetchPostsAndAdmins();
    fetchConversations(stored);
    fetchMessageNotifs(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEBUG: log teacher object for troubleshooting
  useEffect(() => {
    if (teacher) {
      // Only enable this for debugging
      // eslint-disable-next-line no-console
      console.log("Teacher object (debug):", teacher);
    }
  }, [teacher]);

  // Fetch posts and resolve admin info
  const fetchPostsAndAdmins = async () => {
    try {
      const postsResp = await axios.get(`${API_BASE}/get_posts`);
      let postsData = postsResp.data || [];
      if (!Array.isArray(postsData) && typeof postsData === "object")
        postsData = Object.values(postsData);

      const [adminsResp, usersResp] = await Promise.all([
        axios.get(`${RTDB_BASE}/School_Admins.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const schoolAdmins = adminsResp.data || {};
      const users = usersResp.data || {};

      const resolveAdminInfo = (adminId) => {
        if (!adminId)
          return { name: "Admin", profile: "/default-profile.png" };
        const adminRec = schoolAdmins[adminId];
        if (!adminRec)
          return { name: adminId, profile: "/default-profile.png" };
        const userKey = adminRec.userId;
        const userRec = userKey ? users[userKey] : null;
        const name = userRec?.name || adminRec?.title || adminId;
        const profile = getSafeProfileImage(userRec?.profileImage);
        return { name, profile };
      };

      const finalPosts = postsData.map((post) => {
        const postId = post.postId || post.id || post.key || "";
        const { name, profile } = resolveAdminInfo(post.adminId);
        let likesArray = [];
        if (Array.isArray(post.likes)) likesArray = post.likes;
        else if (post.likes && typeof post.likes === "object")
          likesArray = Object.keys(post.likes);

        const timeValue =
          post.time || post.timestamp || post.createdAt || null;

        return {
          ...post,
          postId,
          adminName: name,
          adminProfile: profile,
          time: timeValue,
          likes: likesArray,
          likeCount: post.likeCount || likesArray.length || 0,
        };
      });

      finalPosts.sort((a, b) => {
        const ta = a.time ? new Date(a.time).getTime() : 0;
        const tb = b.time ? new Date(b.time).getTime() : 0;
        return tb - ta;
      });

      setPosts(finalPosts);

      const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
      const seenPosts = getSeenPosts(storedTeacher?.userId);

      const notifs = finalPosts
        .filter((p) => !seenPosts.includes(p.postId))
        .slice(0, 5)
        .map((p) => ({
          id: p.postId,
          title: p.message?.substring(0, 80) || "Untitled post",
          adminName: p.adminName,
          adminProfile: p.adminProfile,
        }));

      setNotifications(notifs);
    } catch (err) {
      console.error("Error fetching posts/admins handshake:", err);
    }
  };

  // ---------------- HANDLE LIKE ----------------
  const handleLike = async (postId) => {
    try {
      if (!teacherId) {
        // no teacher logged in, ignore like
        return;
      }
      // ✅ Use full backend URL
      const res = await axios.post(`https://gojo-teacher-web.onrender.com/api/like_post`, {
        postId,
        teacherId: teacherId, // or teacher.teacherId if your backend expects it
      });

      if (res.data.success) {
        const liked = res.data.liked; // boolean returned by backend
        const likeCount = res.data.likeCount; // number returned by backend

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.postId === postId
              ? {
                  ...post,
                  likeCount,
                  likes: {
                      ...post.likes,
                      [teacherId]: liked ? true : undefined,
                    },
                }
              : post
          )
        );
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const getSeenPosts = (teacherId) => {
    return (
      JSON.parse(localStorage.getItem(`seen_posts_${teacherId}`)) || []
    );
  };

  const saveSeenPost = (teacherId, postId) => {
    const seen = getSeenPosts(teacherId);
    if (!seen.includes(postId)) {
      localStorage.setItem(
        `seen_posts_${teacherId}`,
        JSON.stringify([...seen, postId])
      );
    }
  };

  const handleNotificationClick = (postId) => {
    if (!teacher) return;
    if (teacherId) saveSeenPost(teacherId, postId);
    setHighlightedPostId(postId);
    const el = postRefs.current[postId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setNotifications((prev) => prev.filter((n) => n.id !== postId));
    setShowNotifications(false);
    setTimeout(() => setHighlightedPostId(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t =
        currentTeacher || JSON.parse(localStorage.getItem("teacher"));
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
          const otherKeyCandidate = Object.keys(participants || {}).find(
            (p) => p !== t.userId
          );
          if (!otherKeyCandidate) return null;

          let otherPushKey = otherKeyCandidate;
          let otherRecord = usersByKey[otherPushKey];

          if (!otherRecord) {
            const mappedPushKey = userKeyByUserId[otherKeyCandidate];
            if (mappedPushKey) {
              otherPushKey = mappedPushKey;
              otherRecord = usersByKey[mappedPushKey];
            }
          }

          if (!otherRecord) {
            otherRecord = {
              userId: otherKeyCandidate,
              name: otherKeyCandidate,
              profileImage: "/default-profile.png",
            };
          }

          const contact = {
            pushKey: otherPushKey,
            userId: otherRecord.userId || otherKeyCandidate,
            name:
              otherRecord.name ||
              otherRecord.username ||
              otherKeyCandidate,
            profileImage: getSafeProfileImage(
              otherRecord.profileImage ||
                otherRecord.profile ||
                ""
            ),
          };

          const lastMessage = chat.lastMessage || {};

          return {
            chatId,
            contact,
            displayName: contact.name,
            profile: contact.profileImage,
            lastMessageText: lastMessage.text || "",
            lastMessageTime:
              lastMessage.timeStamp || lastMessage.time || null,
            unreadForMe,
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
        );

      setConversations(convs);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setConversations([]);
    }
  };

  const handleOpenConversation = async (conv, index) => {
    if (!teacher || !conv) return;
    const { chatId, contact } = conv;

    navigate("/all-chat", { state: { contact, chatId } });

    try {
      await axios.put(
        `${RTDB_BASE}/Chats/${chatId}/unread/${teacherId}.json`,
        null
      );
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const handleMessengerToggle = async () => {
    setShowMessenger((s) => !s);
    await fetchConversations();
  };

  const totalUnreadMessages = conversations.reduce(
    (sum, c) => sum + (c.unreadForMe || 0),
    0
  );
  const t = teacher || {};
  // Close sidebar on overlay click (mobile)
  const handleSidebarOverlay = () => setSidebarOpen(false);

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

  return (
    <div className="dashboard-page">
      <nav className="top-navbar">
        {/* Hamburger for mobile */}
        {/* Left arrow button for opening sidebar on phone size */}
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
          {/* Notifications */}
         {/* Notifications */}
<div className="icon-circle" style={{ position: "relative" }}>
  <div
    onClick={() => setShowNotifications(!showNotifications)}
    style={{ cursor: "pointer", position: "relative" }}
    aria-label="Show notifications"
    tabIndex={0}
    role="button"
    onKeyPress={e => { if (e.key === 'Enter') setShowNotifications(!showNotifications); }}
  >
    <FaBell size={22} />
    {(notifications.length + messageNotifs.length) > 0 && (
      <span
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          background: "red",
          color: "#fff",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {notifications.length + messageNotifs.length}
      </span>
    )}
  </div>

              {showNotifications && (
    <div className="notification-popup">
      {[...notifications, ...messageNotifs].length > 0 ? (
        [...notifications, ...messageNotifs].map((n, i) => (
          <div
            key={n.id || i}
            className="notification-item"
            onClick={() => {
              if (n.isMessage) {
                navigate("/all-chat");
                setShowNotifications(false);
              } else {
                            if (teacherId) saveSeenPost(teacherId, n.id); // mark as seen
                setNotifications(prev => prev.filter(o => o.id !== n.id));
                setShowNotifications(false);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={n.isMessage ? "See message notification " + n.title : "See post notification " + n.title}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                if (n.isMessage) {
                  navigate("/all-chat");
                  setShowNotifications(false);
                } else {
                  if (teacherId) saveSeenPost(teacherId, n.id);
                  setNotifications(prev => prev.filter(o => o.id !== n.id));
                  setShowNotifications(false);
                }
              }
            }}
          >
            <img
              src={getSafeProfileImage(n.adminProfile)}
              alt={n.adminName || "Admin"}
              className="notification-profile"
            />
            <div>
              <strong>{n.adminName}</strong>
              <div className="notification-title">{n.title}</div>
              {n.isMessage && (
                <span style={{ color: '#0b78f6', fontSize: 12, fontWeight: 500 }}>[Message]</span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="no-notifications">No notifications</div>
      )}
    </div>
  )}
</div>

          {/* Messenger */}
          <div
            className="icon-circle"
            style={{ position: "relative", marginLeft: 12, cursor: "pointer" }}
            onClick={() => navigate("/all-chat")}
            aria-label="Go to all chat"
            tabIndex={0}
            role="button"
            onKeyPress={e => { if (e.key === 'Enter') navigate("/all-chat"); }}
          >
            <FaFacebookMessenger size={22} />
            {totalUnreadMessages > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 1,
                  right: 0,
                  background: "#f60b0b",
                  color: "#fff",
                  borderRadius: "50%",
                  minWidth: 18,
                  height: 18,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                }}
              >
                {totalUnreadMessages}
              </span>
            )}
          </div>

          <div
            className="icon-circle"
            onClick={() => navigate("/settings")}
          >
            <FaCog />
          </div>

          <img
            src={getSafeProfileImage(t.profileImage)}
            alt="teacher"
            className="profile-img"
          />
        </div>
      </nav>

      <div className="google-dashboard">
        {/* Sidebar overlay for mobile */}
        {/* Only show overlay and toggle sidebar on phone size */}
        {window.innerWidth <= 600 && sidebarOpen && (
          <div
            className={`sidebar-overlay visible`}
            onClick={handleSidebarOverlay}
            style={{ display: 'block' }}
          />
        )}
        <div
          className={`google-sidebar${sidebarOpen ? ' open' : ''}`}
          style={
            window.innerWidth <= 600
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
          {/* Close button for mobile sidebar */}
          {/* No close button on sidebar for phone size, overlay closes sidebar */}
          {teacher && (
            <div className="sidebar-profile">
              <div className="sidebar-img-circle">
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover', border: 'none', boxShadow: 'none' }} />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}

          <div className="sidebar-menu">
            <Link
              className="sidebar-btn"
              to="/dashboard"
              style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
            >
              <FaHome /> Home
            </Link>
            <Link className="sidebar-btn" to="/students">
              <FaUsers /> Students
            </Link>
            <Link className="sidebar-btn" to="/admins">
              <FaUsers /> Admins
            </Link>
            <Link className="sidebar-btn" to="/parents">
              <FaChalkboardTeacher /> Parents
            </Link>
            <Link className="sidebar-btn" to="/marks">
              <FaClipboardCheck /> Marks
            </Link>
            <Link className="sidebar-btn" to="/attendance">
              <FaUsers /> Attendance
            </Link>
            <Link className="sidebar-btn" to="/schedule">
              <FaUsers /> Schedule
            </Link>
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        <div className="google-main posts-full-mobile">
          <div className="posts-container">
            {posts.length === 0 && <p>No posts available</p>}
            {posts.map((post) => (
              <div
                key={post.postId}
                ref={(el) => (postRefs.current[post.postId] = el)}
                className="post-box"
                style={{
                  border:
                    highlightedPostId === post.postId
                      ? "2px solid #4b6cb7"
                      : "1px solid #eee",
                  backgroundColor:
                    highlightedPostId === post.postId
                      ? "#fff9c4"
                      : "#fff",
                  transition: "background-color 0.4s, border 0.2s",
                  marginBottom: 18,
                }}
              >
                <div className="fb-post-top">
                  <img
                    src={getSafeProfileImage(post.adminProfile)}
                    alt={post.adminName || "Admin"}
                  />
                  <div className="post-info">
                    <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                      {post.adminName || "Admin"}
                    </h4>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {post.time
                        ? new Date(post.time).toLocaleString()
                        : ""}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 17, lineHeight: 1.6, color: '#222', wordBreak: 'break-word', paddingLeft:"10px" }}>
                  {post.message}
                </div>

                {post.postUrl && (
                  <img
                    src={post.postUrl}
                    alt="post media"
                    className="post-media"
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      marginTop: 8,
                      maxHeight: 400,
                      objectFit: 'cover',
                    }}
                  />
                )}

                <div className="post-actions" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 18 }}>
                  <button
                    onClick={() => handleLike(post.postId)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 18px",
                      background: "#f0f2f5",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "500",
                      color: post.likes && teacherId && post.likes[teacherId] ? "#e0245e" : "#555",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {post.likes && teacherId && post.likes[teacherId] ? (
                      <FaHeart style={{ color: "#e0245e", fontSize: "16px" }} />
                    ) : (
                      <FaRegHeart style={{ fontSize: "16px" }} />
                    )}
                    {post.likes && teacherId && post.likes[teacherId] ? "Liked" : "Like"}
                    <span style={{ marginLeft: 8, fontSize: "15px", color: "#777" }}>
                      {post.likeCount || 0}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <style>{`
          .posts-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            margin-left: 120px;
          }
          .post-box {
            margin-left: 0;
            margin-right: auto;
            margin-top: 12px;
          }
          @media (max-width: 600px) {
            .posts-container {
              margin-left: 0 !important;
            }
            .post-box {
              margin-top: 0 !important;
            }
          }
          @media (max-width: 600px) {
            .posts-full-mobile, .posts-container, .post-box {
              width: 100vw !important;
              max-width: 100vw !important;
              margin: 0 !important;
              padding: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .posts-container {
              align-items: stretch;
            }
            .google-sidebar {
              left: -220px;
              transition: left 0.25s cubic-bezier(.4,0,.2,1);
            }
            .google-sidebar.open {
              left: 0 !important;
              z-index: 1202;
            }
            .sidebar-overlay {
              display: block;
              position: fixed;
              inset: 0;
              background: rgba(0,0,0,0.35);
              z-index: 1200;
              transition: opacity 0.2s;
            }
            .sidebar-arrow-btn {
              display: flex !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
      {/* Responsive style for post message size */}
      <style>{`
        .post-message {
          font-size: 1.08rem;
        }
        @media (max-width: 600px) {
          .post-message {
            font-size: 0.92rem;
          }
        }
      `}</style>
}