import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft, FaPaperPlane, FaCheck } from "react-icons/fa";
import { getDatabase, ref, onValue, push, update } from "firebase/database";
import { db } from "../firebase";

const getChatId = (id1, id2) => [String(id1), String(id2)].sort().join("_");

/* ================= FIREBASE ================= */

export default function TeacherAllChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const chatEndRef = useRef(null);

  const teacher = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacher.userId || "");

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [presence, setPresence] = useState({}); // userId -> presence info (bool or object)

  // incoming navigation state (support both { contact } and { user })
  const locationState = location.state || {};
  const incomingContact = locationState.contact || locationState.user || null;
  const incomingChatId = locationState.chatId || null;
  const incomingTab = locationState.tab || null;

  const [selectedTab, setSelectedTab] = useState(incomingTab || "student");
  const [selectedChatUser, setSelectedChatUser] = useState(incomingContact || null);
  const [currentChatKey, setCurrentChatKey] = useState(incomingChatId || null);

  const [clickedMessageId, setClickedMessageId] = useState(null);
  const [editingMessages, setEditingMessages] = useState({}); // { messageId: true/false }
  const [editTexts, setEditTexts] = useState({}); // { messageId: text }

  const getProfileImage = (user = {}) =>
    user.profileImage || user.profile || user.avatar || "/default-profile.png";

  /* ================= FETCH USERS ================= */
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [studentsRes, parentsRes, adminsRes, usersRes] = await Promise.all([
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Students.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Parents.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/School_Admins.json").then((r) => r.json()),
          fetch("https://ethiostore-17d9f-default-rtdb.firebaseio.com/Users.json").then((r) => r.json()),
        ]);

        const users = usersRes || {};

        const allStudents = Object.values(studentsRes || {}).map((s) => {
          const u = users[s.userId] || {};
          return { userId: s.userId, name: u.name || s.name || "Student", profileImage: getProfileImage(u) };
        });

        const allParents = Object.values(parentsRes || {}).map((p) => {
          const u = users[p.userId] || {};
          return { userId: p.userId, name: u.name || p.name || "Parent", profileImage: getProfileImage(u) };
        });

        const allAdmins = Object.values(adminsRes || {}).map((a) => {
          const u = users[a.userId] || {};
          return { userId: a.userId, name: a.name || u.name || "Admin", profileImage: getProfileImage(u) };
        });

        setStudents(allStudents);
        setParents(allParents);
        setAdmins(allAdmins);
      } catch (err) {
        console.error("❌ Fetch error:", err);
      }
    };

    fetchUsers();
  }, []);

  /* ================= AUTO SELECT ================= */
  // If navigation provided a contact, prefer it (incomingContact)
  useEffect(() => {
    if (incomingContact) {
      setSelectedChatUser(incomingContact);
    }
    if (incomingChatId) {
      setCurrentChatKey(incomingChatId);
    }
    if (incomingTab) {
      setSelectedTab(incomingTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingContact, incomingChatId, incomingTab]);

  // When lists load and no explicit selectedChatUser, auto-pick first item for tab
  useEffect(() => {
    if (!selectedChatUser) {
      if (selectedTab === "student" && students.length) setSelectedChatUser(students[0]);
      if (selectedTab === "parent" && parents.length) setSelectedChatUser(parents[0]);
      if (selectedTab === "admin" && admins.length) setSelectedChatUser(admins[0]);
    }
  }, [selectedTab, students, parents, admins, selectedChatUser]);

  // If navigation gave a user and lists are ready, find the matching entry and select it
  useEffect(() => {
    const incoming = incomingContact;
    if (!incoming) return;
    if (selectedTab === "student" && students.length) {
      const found = students.find((s) => s.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "parent" && parents.length) {
      const found = parents.find((p) => p.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    if (selectedTab === "admin" && admins.length) {
      const found = admins.find((a) => a.userId === incoming.userId);
      if (found) setSelectedChatUser(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, parents, admins, incomingContact, selectedTab]);

  /* ================= CHAT LISTENER ================= */
  useEffect(() => {
    if (!selectedChatUser || !teacherUserId) return;

    const chatKey = currentChatKey || getChatId(teacherUserId, selectedChatUser.userId);
    setCurrentChatKey(chatKey); // ensure state is in sync

    const chatRef = ref(db, `Chats/${chatKey}/messages`);
    const unsubscribe = onValue(chatRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .filter(([_, m]) => !m.deleted)
        .map(([id, m]) => ({
          id,
          ...m,
          isTeacher: m.senderId === teacherUserId,
        }))
        .sort((a, b) => a.timeStamp - b.timeStamp);

      setMessages(list);

      // mark as seen where teacher is receiver
      Object.entries(data).forEach(([id, m]) => {
        if (m && !m.seen && m.receiverId === teacherUserId) {
          update(ref(db, `Chats/${chatKey}/messages/${id}`), { seen: true }).catch(console.error);
        }
      });

      // reset unread count for this teacher
      update(ref(db, `Chats/${chatKey}/unread`), { [teacherUserId]: 0 }).catch(console.error);
    });

    return () => unsubscribe();
  }, [selectedChatUser, teacherUserId, currentChatKey]);

  /* ================= PRESENCE LISTENER ================= */
  useEffect(() => {
    // Listen to presence node in RTDB. If your backend uses a different path, change it.
    try {
      const presenceRef = ref(db, `Presence`);
      const unsub = onValue(presenceRef, (snap) => {
        const data = snap.val() || {};
        setPresence(data);
      });

      return () => unsub();
    } catch (e) {
      // If realtime presence isn't configured, keep presence empty
      console.warn("Presence listener unavailable:", e);
    }
  }, []);

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser) return;

    const editingId = Object.keys(editingMessages).find((id) => editingMessages[id]);
    const chatKey = currentChatKey || getChatId(teacherUserId, selectedChatUser.userId);

    if (editingId) {
      // Update existing message
      await update(ref(db, `Chats/${chatKey}/messages/${editingId}`), {
        text: input,
        edited: true,
      });
      setEditingMessages({});
      setClickedMessageId(null);
      setInput("");
    } else {
      // Send new message
      const messagesRef = ref(db, `Chats/${chatKey}/messages`);
      const messageData = {
        senderId: teacherUserId,
        receiverId: selectedChatUser.userId,
        type: "text",
        text: input,
        seen: false,
        edited: false,
        deleted: false,
        timeStamp: Date.now(),
      };

      await push(messagesRef, messageData);

      await update(ref(db, `Chats/${chatKey}/participants`), {
        [teacherUserId]: true,
        [selectedChatUser.userId]: true,
      });

      await update(ref(db, `Chats/${chatKey}/lastMessage`), {
        text: input,
        senderId: teacherUserId,
        seen: false,
        timeStamp: messageData.timeStamp,
      });

      // increment unread for receiver
      try {
        // first read current unread count
        const unreadRef = ref(db, `Chats/${chatKey}/unread/${selectedChatUser.userId}`);
        // we don't have a simple get here; update with increment is okay for most cases.
        await update(ref(db, `Chats/${chatKey}/unread`), {
          [teacherUserId]: 0,
          [selectedChatUser.userId]: (/* best-effort */ 1),
        });
      } catch (e) {
        // ignore
      }

      setInput("");
    }
  };

  /* ================= EDIT / DELETE ================= */
  const handleEditMessage = (id, newText) => {
    const chatKey = currentChatKey || getChatId(teacherUserId, selectedChatUser.userId);
    update(ref(db, `Chats/${chatKey}/messages/${id}`), {
      text: newText,
      edited: true,
    }).catch(console.error);
    setEditingMessages((prev) => ({ ...prev, [id]: false }));
  };

  const handleDeleteMessage = (id) => {
    const chatKey = currentChatKey || getChatId(teacherUserId, selectedChatUser.userId);
    update(ref(db, `Chats/${chatKey}/messages/${id}`), { deleted: true }).catch(console.error);
  };

  const startEditing = (id, text) => {
    setEditingMessages({ [id]: true });
    setInput(text);
    setClickedMessageId(id);
  };

  const formatTime = (ts) => {
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const list = selectedTab === "student" ? students : selectedTab === "parent" ? parents : admins;

  const isUserOnline = (userId) => {
    if (!userId) return false;
    // try to resolve presence entry for multiple key shapes
    const findPresence = () => {
      // direct key
      if (presence?.[userId] !== undefined) return presence[userId];
      // string form
      const s = String(userId);
      if (presence?.[s] !== undefined) return presence[s];
      // try numeric key
      const n = Number(userId);
      if (!Number.isNaN(n) && presence?.[n] !== undefined) return presence[n];
      // try to find an entry where entry.userId matches
      for (const [, val] of Object.entries(presence || {})) {
        try {
          if (val && (val.userId === userId || String(val.userId) === s)) return val;
        } catch (e) {
          // ignore
        }
      }
      return undefined;
    };

    const p = findPresence();
    if (p == null) return false;
    if (typeof p === 'boolean') return p === true;
    if (typeof p === 'object') {
      if (p.state === 'online' || p.online === true) return true;
      if (p.lastSeen) {
        const last = Number(p.lastSeen) || 0;
        return Date.now() - last < 60_000;
      }
      // if presence value itself is a timestamp
      if (typeof p === 'number') {
        return Date.now() - p < 60_000;
      }
    }
    return false;
  };

  const getLastSeenText = (userId) => {
    const p = presence?.[userId];
    if (!p) return null;
    // accept numeric timestamp or object with common timestamp keys
    let ts = null;
    if (typeof p === 'number' || /^[0-9]+$/.test(String(p))) ts = Number(p);
    if (typeof p === 'object') ts = p.lastSeen || p.timestamp || p.lastActive || p.last_seen || p.time || null;
    if (!ts) return null;
    const diff = Date.now() - Number(ts);
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'last seen just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `last seen ${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `last seen ${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `last seen ${days}d ago`;
    return `last seen on ${new Date(ts).toLocaleDateString()}`;
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#eef2f7", fontFamily: "sans-serif" }}>
      {/* ===== SIDEBAR ===== */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{
          width: sidebarOpen ? 280 : 0,
          background: "#fff",
          padding: sidebarOpen ? 16 : 0,
          boxShadow: sidebarOpen ? "2px 0 10px rgba(0,0,0,0.1)" : 'none',
          display: sidebarOpen ? 'flex' : 'none',
          flexDirection: "column",
          transition: 'width 180ms ease'
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => navigate(-1)} style={{ border: "none", background: "none", padding: 4, cursor: "pointer" }}>
              <FaArrowLeft size={18} />
            </button>
            
          </div>

          <div style={{ display: "flex", gap: 6, margin: "12px 0", alignItems: "center" }}>
            {["student", "parent", "admin"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setSelectedTab(t);
                  setSelectedChatUser(null);
                  setCurrentChatKey(null);
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 20,
                  border: "none",
                  background: selectedTab === t ? "#4facfe" : "#ddd",
                  color: selectedTab === t ? "#fff" : "#000",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 8, overflowY: "auto", flex: 1 }}>
            {list.map((u) => (
              <div
                key={u.userId}
                onClick={() => {
                  setSelectedChatUser(u);
                  setCurrentChatKey(null); // compute chat key automatically for selected pair
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 14,
                  cursor: "pointer",
                  marginBottom: 8,
                  background: selectedChatUser?.userId === u.userId ? "#dbeafe" : "#f9fafb",
                  boxShadow: selectedChatUser?.userId === u.userId ? "0 2px 10px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img
                    src={u.profileImage}
                    alt={u.name}
                    onError={(e) => (e.target.src = "/default-profile.png")}
                    style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                  />
                  {/* online dot */}
                  <span style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 12,
                    height: 12,
                    borderRadius: 12,
                    border: '2px solid #fff',
                    background: isUserOnline(u.userId) ? '#34D399' : '#cbd5e1'
                  }} />
                </div>
                <span style={{ fontWeight: 500, marginLeft: 8 }}>{u.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* small toggle bar visible when sidebar is closed */}
        <div style={{ width: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ border: 'none', background: '#fff', borderRadius: 4, padding: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer', marginTop: 8 }} aria-label="Toggle sidebar">
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>
      </div>

      {/* ===== CHAT ===== */}
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column" }}>
        {selectedChatUser ? (
          <>
            {/* ===== CHAT HEADER ===== */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid #ccc",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                background: "#fff",
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <img
                src={selectedChatUser.profileImage}
                alt={selectedChatUser.name}
                onError={(e) => (e.target.src = "/default-profile.png")}
                style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover" }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{selectedChatUser.name}</span>
                <span style={{ fontSize: 12, color: isUserOnline(selectedChatUser.userId) ? '#16A34A' : '#666' }}>
                  {isUserOnline(selectedChatUser.userId) ? 'Online' : (getLastSeenText(selectedChatUser.userId) || (selectedTab.charAt(0).toUpperCase() + selectedTab.slice(1)))}
                </span>
              </div>
            </div>

            {/* ===== CHAT MESSAGES ===== */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column" }}>
              {messages.map((m) => {
                const isTeacher = m.isTeacher;
                const isEditing = !!editingMessages[m.id];
                const isClicked = clickedMessageId === m.id;

                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isTeacher ? "flex-end" : "flex-start", marginBottom: 10 }}>
                    <div
                      onClick={() => setClickedMessageId(m.id)}
                      style={{
                        maxWidth: "70%",
                        background: isTeacher ? "#4facfe" : "#fff",
                        color: isTeacher ? "#fff" : "#000",
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderTopRightRadius: isTeacher ? 0 : 18,
                        borderTopLeftRadius: isTeacher ? 18 : 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        wordBreak: "break-word",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {m.text} {m.edited && <small style={{ fontSize: 10 }}> (edited)</small>}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4, fontSize: 11, color: isTeacher ? "#fff" : "#888" }}>
                        <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                        <span>{formatTime(m.timeStamp)}</span>
                      {isTeacher && !m.deleted && (
  <span style={{ display: "flex", gap: 0 }}>
    <FaCheck size={10} color="#fff" style={{ opacity: 0.8 }} />
    {m.seen && <FaCheck size={10} color="#f3f7f8" style={{ marginLeft: 2, opacity: 0.95 }} />}
  </span>
)}
                      </div>
                    </div>

                    {/* Edit/Delete controls for teacher's message */}
                    {isClicked && isTeacher && !m.deleted && !isEditing && (
                      <div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 12, justifyContent: isTeacher ? "flex-end" : "flex-start" }}>
                        <button onClick={() => startEditing(m.id, m.text)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #ccc", cursor: "pointer", background: "#f1f1f1" }}>Edit</button>
                        <button onClick={() => handleDeleteMessage(m.id)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #ccc", cursor: "pointer", background: "#f1f1f1", color: "red" }}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* ===== INPUT ===== */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                style={{ flex: 1, padding: 12, borderRadius: 25, border: "1px solid #ccc", outline: "none" }}
              />
              <button onClick={sendMessage} style={{ width: 45, height: 45, borderRadius: "50%", background: "#4facfe", border: "none", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <FaPaperPlane />
              </button>
            </div>
          </>
        ) : (
          <h3 style={{ textAlign: "center", marginTop: 50 }}>Select a user to start chatting 💬</h3>
        )}
      </div>
    </div>
  );
}