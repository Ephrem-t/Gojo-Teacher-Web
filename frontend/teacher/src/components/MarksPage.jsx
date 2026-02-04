import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaTrash,
  FaSave,
  FaEdit,
  FaHome,
  FaCog,
  FaSignOutAlt,
  FaBell,
  FaUsers,
  FaChalkboardTeacher,
  FaFacebookMessenger,
  FaChevronRight,
  FaClipboardCheck
  , FaFileExcel, FaPrint, FaFileDownload,
   FaUserCheck,
  FaCalendarAlt,
  FaBookOpen
} from "react-icons/fa";
import "../styles/global.css";

const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

export default function MarksPage() {
  // Sidebar toggle state for mobile (like Dashboard)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 600);
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assessmentList, setAssessmentList] = useState([]);
  const [studentMarks, setStudentMarks] = useState({});
  const [structureSubmitted, setStructureSubmitted] = useState(false);
  const [activeSemester, setActiveSemester] = useState("semester2"); // default
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageNotifications, setMessageNotifications] = useState([]);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]);

  // Responsive handling for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------------- LOAD TEACHER ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, [navigate]);

  const teacherUserId = teacher?.userId;

  // Messenger conversations fetch
  useEffect(() => {
    if (teacher) {
      fetchConversations(teacher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher]);

  // Load marks for course/semester
  useEffect(() => {
    if (!selectedCourseId) return;
    const loadCourseData = async () => {
      try {
        const marksRes = await axios.get(
          `${RTDB_BASE}/ClassMarks/${selectedCourseId}.json`
        );
        const course = courses.find((c) => c.id === selectedCourseId);
        if (!course) return;
        const filteredStudents = students.filter(
          (s) => s.grade === course.grade && s.section === course.section
        );
        const initMarks = {};
        let assessmentListFromDB = [];
        filteredStudents.forEach((s) => {
          const semData = marksRes.data?.[s.id]?.[activeSemester];
          if (semData?.assessments) {
            initMarks[s.id] = semData.assessments;
            if (!assessmentListFromDB.length) {
              assessmentListFromDB = Object.values(semData.assessments);
            }
          } else {
            initMarks[s.id] = {};
          }
        });
        setStudentMarks(initMarks);
        setAssessmentList(
          assessmentListFromDB.map((a) => ({ name: a.name, max: a.max }))
        );
        setStructureSubmitted(assessmentListFromDB.length > 0);
      } catch (err) {
        console.error("Error loading marks:", err);
        setStructureSubmitted(false);
        setStudentMarks({});
      }
    };
    loadCourseData();
  }, [selectedCourseId, courses, students, activeSemester]);

  // Fetch teacher's assigned courses
  useEffect(() => {
    if (!teacher) return;
    const fetchCourses = async () => {
      try {
        const [assignmentsRes, coursesRes, teachersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/Teachers.json`),
        ]);
        const teacherEntry = Object.entries(teachersRes.data || {}).find(
          ([_, t]) => t.userId === teacherUserId
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
      } catch (err) {
        console.error("Error fetching courses:", err);
      }
    };
    fetchCourses();
  }, [teacher, teacherUserId]);

  // Fetch all students
  useEffect(() => {
    if (!teacherUserId) return;
    const fetchStudents = async () => {
      try {
        const [studentsRes, usersRes] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
        ]);
        const studentsData = studentsRes.data || {};
        const usersData = usersRes.data || {};
        const mappedStudents = Object.entries(studentsData).map(([id, s]) => ({
          id,
          ...s,
          name: usersData?.[s.userId]?.name || "Unknown",
          profileImage: usersData?.[s.userId]?.profileImage || "/default-profile.png",
        }));
        setStudents(mappedStudents);
      } catch (err) {
        console.error("Error fetching students:", err);
        setStudents([]);
      }
    };
    fetchStudents();
  }, [teacherUserId]);

  // Reset assessments on course change
  useEffect(() => {
    if (!selectedCourseId) return;
    setAssessmentList([]);
    setStructureSubmitted(false);
    setStudentMarks({});
  }, [selectedCourseId]);

  // Assessment structure handling
  const addAssessment = () => setAssessmentList((p) => [...p, { name: "", max: "" }]);
  const updateAssessment = (i, field, value) => {
    const copy = [...assessmentList];
    copy[i][field] = value;
    setAssessmentList(copy);
  };
  const removeAssessment = (i) =>
    setAssessmentList((p) => p.filter((_, idx) => idx !== i));
  const submitStructure = async () => {
    if (assessmentList.reduce((sum, a) => sum + Number(a.max || 0), 0) !== 100) {
      alert("Total MAX must be exactly 100");
      return;
    }
    const structureObj = {};
    assessmentList.forEach((a, idx) => {
      structureObj[`a${idx + 1}`] = {
        name: a.name,
        max: Number(a.max),
        score: 0,
      };
    });
    try {
      const course = courses.find((c) => c.id === selectedCourseId);
      if (!course) return;
      const filteredStudents = students.filter(
        (s) => s.grade === course.grade && s.section === course.section
      );
      await Promise.all(
        filteredStudents.map((s) =>
          axios.put(
            `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${s.id}/${activeSemester}.json`,
            {
              teacherName: teacher.name,
              assessments: structureObj,
            }
          )
        )
      );
      const initMarks = {};
      filteredStudents.forEach((s) => {
        initMarks[s.id] = structureObj;
      });
      setStudentMarks(initMarks);
      setStructureSubmitted(true);
      alert("Assessment structure saved!");
    } catch (err) {
      console.error("Error submitting structure:", err);
      alert("Failed to submit structure");
    }
  };
  const updateScore = (sid, key, value) => {
    setStudentMarks((p) => ({
      ...p,
      [sid]: { ...p[sid], [key]: { ...p[sid][key], score: Number(value) } },
    }));
  };
  const saveMarks = async (sid) => {
    try {
      await axios.put(
        `${RTDB_BASE}/ClassMarks/${selectedCourseId}/${sid}/${activeSemester}.json`,
        {
          teacherName: teacher.name,
          assessments: studentMarks[sid],
        }
      );
      alert("Marks saved successfully");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save marks");
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("teacher");
    navigate("/login");
  };

  // ---------------- NOTIFICATIONS ----------------
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

  // Messenger fetching
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
    // navigate to AllChat with contact + chatId
    navigate("/all-chat", { state: { contact, chatId, tab: "marks" } });
    // clear unread in RTDB for this teacher
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }
    // remove from local UI and close dropdown
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };
  const totalUnreadMessages = messageNotifications.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // --- Mark notification as seen ---
  const handleNotificationClick = (postId) => {
    if (!teacher || !postId) return;
    saveSeenPost(teacher.userId, postId);
    setNotifications(prev => prev.filter((n) => n.id !== postId));
    setShowNotifications(false);
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

  // --- Table scroll buttons ---
  const marksWrapperRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollMarks = (direction) => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const amount = Math.max(Math.floor(el.clientWidth * 0.9), 420);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };
  const updateScrollButtons = () => {
    const el = marksWrapperRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };
  useEffect(() => {
    const el = marksWrapperRef.current;
    if (!el) return;
    updateScrollButtons();
    const onScroll = () => updateScrollButtons();
    const onResize = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [structureSubmitted, assessmentList.length]);

  // --- Responsive CSS for mobile table ---
  // Add this CSS to your global.css file if not already present
  // Or you can use a <style> block here
  useEffect(() => {
    const styleId = "responsive-marks-table-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media (max-width: 600px) {
        .google-main {
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          overflow-x: auto !important;
        }
        .marks-table-wrapper {
          width: 100vw !important;
          max-width: 100vw !important;
          overflow-x: auto !important;
          padding: 0 2vw !important;
        }
        .marks-table {
          min-width: 600px !important;
          width: auto !important;
          max-width: 100vw !important;
          table-layout: auto !important;
          overflow-x: auto !important;
        }
        .marks-table th, .marks-table td {
          font-size: 12px !important;
          padding: 8px !important;
          white-space: normal !important;
        }
        .marks-table td input {
          min-width: 40px;
          width: 100%;
          font-size: 12px;
          padding: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // --- Export / Print helpers ---
  const buildTableRows = () => {
    const headers = ["Student", ...assessmentList.map(a => `${a.name} (${a.max})`), "Total", "Grade"];
    const rows = [headers];
    Object.entries(studentMarks).forEach(([sid, marks]) => {
      const student = students.find((s) => s.id === sid) || { name: sid };
      const scores = Object.values(marks).map((m) => (m.score != null ? m.score : ""));
      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
      const grade =
        total >= 90
          ? "A"
          : total >= 80
          ? "B"
          : total >= 70
          ? "C"
          : total >= 60
          ? "D"
          : "F";
      rows.push([student.name, ...scores, total, grade]);
    });
    return rows;
  };

  const downloadCSV = (filename = "marks.csv") => {
    const rows = buildTableRows();
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            if (cell == null) return "";
            const cellStr = String(cell);
            return cellStr.includes(",") || cellStr.includes("\n") ? `"${cellStr.replace(/"/g, '""')}"` : cellStr;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadExcel = (filename = "marks.xls") => {
    const rows = buildTableRows();
    let html = "<table border=1>";
    rows.forEach((r) => {
      html += "<tr>" + r.map((c) => `<td>${String(c ?? "").replace(/</g, "&lt;")}</td>`).join("") + "</tr>";
    });
    html += "</table>";
    const uri = "data:application/vnd.ms-excel;charset=utf-8," + encodeURIComponent(html);
    const link = document.createElement("a");
    link.href = uri;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const wrapper = marksWrapperRef.current;
    if (!wrapper) return window.print();
    const html = `<!doctype html><html><head><title>Marks</title><meta charset="utf-8"><style>table{border-collapse:collapse;}td,th{padding:8px;border:1px solid #ccc;}</style></head><body>${wrapper.innerHTML}</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up blocked. Please allow popups to print.");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 200);
  };

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
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
          <div className="icon-circle" style={{ position: "relative" }}>
            <div
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ cursor: "pointer", position: "relative" }}
              aria-label="Show notifications"
              tabIndex={0}
              role="button"
              onKeyPress={e => { if (e.key === 'Enter') setShowNotifications(!showNotifications); }}
            >
              <FaBell size={24} />
              {(notifications.length + totalUnreadMessages) > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -5, background: "red", color: "white",
                  borderRadius: "50%", width: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {notifications.length + totalUnreadMessages}
                </span>
              )}
            </div>
            {showNotifications && (
              <>
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
                          top: 30,
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
                  {notifications.length > 0 && notifications.map((notif, index) => (
                    notif.type === "post" ? (
                      <div key={notif.id || index}
                        onClick={() => handleNotificationClick(notif.id)}
                        style={{ display: "flex", alignItems: "center", padding: "10px 15px", borderBottom: "1px solid #eee", cursor: "pointer" }}>
                        <img src={notif.adminProfile} alt={notif.adminName} style={{ width: 35, height: 35, borderRadius: "50%", marginRight: 10 }} />
                        <div>
                          <strong>{notif.adminName}</strong>
                          <p style={{ margin: 0, fontSize: 12 }}>{notif.title}</p>
                        </div>
                      </div>
                    ) : null
                  ))}
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
              </>
            )}
          </div>
          <div className="icon-circle" style={{ position: "relative", marginLeft: 12 }}>
            <div onClick={() => navigate("/all-chat")}
                 style={{ cursor: "pointer", position: "relative" }}>
              <FaFacebookMessenger size={22} />
              {totalUnreadMessages > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#f60b0b", color: "#fff", borderRadius: "50%", minWidth: 18, height: 18, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>
                  {totalUnreadMessages}
                </span>
              )}
            </div>
          </div>
          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} alt="profile" />
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
                <img src={teacher.profileImage || "/default-profile.png"} alt="profile" />
              </div>
              <h3>{teacher.name}</h3>
              <p>{teacher.username}</p>
            </div>
          )}
          <div className="sidebar-menu">
            <Link className="sidebar-btn" to="/dashboard">
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
            <Link
              className="sidebar-btn"
              to="/marks"
              style={{ backgroundColor: "#4b6cb7", color: "#fff" }}
            >
              <FaClipboardCheck /> Marks
            </Link>
            <Link className="sidebar-btn" to="/attendance" ><FaUserCheck/> Attendance</Link>
                                                <Link className="sidebar-btn" to="/schedule" ><FaCalendarAlt/> Schedule</Link>
                                                <Link className="sidebar-btn" to="/lesson-plan" >< FaBookOpen/> Lesson Plan</Link>
                 
            
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div
          className="google-main"
          style={
            window.innerWidth <= 600
              ? { width: "100vw", maxWidth: "100vw", marginLeft: 0, paddingLeft: 0 }
              : { textAlign: 'left', marginLeft: 200, paddingLeft: 0 }
          }
        >
          <div className="main-inner">
            <h2
              style={{
                textAlign: "center",
                marginBottom: "35px",
                color: "#1e3a8a",
                fontSize: "36px",
                fontWeight: "700",
                letterSpacing: "1px",
              }}
            >
              Marks Entry Dashboard
            </h2>
            <div
              style={{
                marginBottom: "30px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "15px",
              }}
            >
              <label
                style={{
                  fontWeight: "600",
                  color: "#374151",
                  fontSize: "16px",
                }}
              >
                Select Course:
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  minWidth: "300px",
                  fontSize: "15px",
                  fontWeight: "500",
                  boxShadow: "0 6px 15px rgba(0,0,0,0.08)",
                  transition: "0.3s all",
                }}
              >
                <option value="">-- Select Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subject} - Grade {c.grade} Section {c.section}
                  </option>
                ))}
              </select>
            </div>
            {/* Semester Tabs */}
            {selectedCourseId && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "40px",
                  marginBottom: "35px",
                  borderBottom: "2px solid #c7d2fe",
                  paddingBottom: "10px",
                }}
              >
                {["semester1", "semester2"].map((sem) => {
                  const isActive = activeSemester === sem;
                  return (
                    <button
                      key={sem}
                      onClick={() => {
                        setActiveSemester(sem);
                        setStructureSubmitted(false);
                        setAssessmentList([]);
                        setStudentMarks({});
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        fontWeight: "700",
                        letterSpacing: "1px",
                        color: isActive ? "#1e40af" : "#6b7280",
                        paddingBottom: "12px",
                        position: "relative",
                        transition: "0.3s all",
                      }}
                    >
                      {sem === "semester1" ? "Semester 1" : "Semester 2"}
                      {isActive && (
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            bottom: "-2px",
                            width: "100%",
                            height: "4px",
                            borderRadius: "6px",
                            background: "linear-gradient(135deg, #4b6cb7, #1e40af)",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

    {structureSubmitted && (
      <div style={{ display: "flex", gap: "16px", marginBottom: "30px" }}>
        <button
          style={{
            marginBottom: "0px",
            padding: "10px 18px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            color: "#fff",
            borderRadius: "12px",
            border: "none",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            transition: "0.3s all",
          }}
          onClick={() => {
            setStructureSubmitted(false);
            setStudentMarks({});
          }}
        >
          <FaEdit /> Edit Assessment Structure
        </button>
        <button
          onClick={() => downloadExcel()}
          style={{
            padding: "10px 16px",
            background: "#28a745",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            marginLeft: "0px",
            gap: 8,
            boxShadow: "0 2px 8px 0 rgba(40,167,69,.07)",
            cursor: "pointer"
          }}
          title="Download as Excel"
        >
          <FaFileExcel /> Download Excel
        </button>
      </div>
    )}

            {/* Assessment Builder */}
            {selectedCourseId && !structureSubmitted && (
              <div
                style={{
                  backdropFilter: "blur(15px)",
                  background: "rgba(255, 255, 255, 0.85)",
                  padding: "30px",
                  borderRadius: "20px",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.08)",
                  marginBottom: "40px",
                  transition: "all 0.3s ease",
                }}
              >
                <h3 style={{ marginBottom: "25px", color: "#1f2937", fontWeight: "600", fontSize: "20px" }}>
                  Assessment Structure
                </h3>
                {assessmentList.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "18px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      placeholder="Assessment Name"
                      value={a.name}
                      onChange={(e) => updateAssessment(i, "name", e.target.value)}
                      style={{
                        flex: 2,
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #d1d5db",
                        outline: "none",
                        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                        fontWeight: "500",
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={a.max}
                      onChange={(e) => updateAssessment(i, "max", e.target.value)}
                      style={{
                        flex: 1,
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "1px solid #d1d5db",
                        outline: "none",
                        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                        fontWeight: "500",
                      }}
                    />
                    <button
                      onClick={() => removeAssessment(i)}
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        border: "none",
                        cursor: "pointer",
                        boxShadow: "0 6px 15px rgba(0,0,0,0.12)",
                        transition: "0.3s all",
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "20px" }}>
                  <button
                    style={{
                      padding: "12px 20px",
                      borderRadius: "14px",
                      background: "#10b981",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                      transition: "0.3s all",
                    }}
                    onClick={addAssessment}
                  >
                    <FaPlus /> Add Assessment
                  </button>
                  <span style={{ fontWeight: "600", color: "#374151", fontSize: "16px" }}>
                    Total Max: {assessmentList.reduce((sum, a) => sum + Number(a.max || 0), 0)} / 100
                  </span>
                </div>
                <button
                  style={{
                    marginTop: "30px",
                    padding: "14px 20px",
                    borderRadius: "16px",
                    background: "linear-gradient(135deg, #4b6cb7, #1e40af)",
                    color: "#fff",
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                    transition: "0.3s all",
                    fontSize: "16px",
                  }}
                  onClick={submitStructure}
                >
                  Submit Structure
                </button>

                
              </div>
            )}

            {structureSubmitted && (
              <div
                className="marks-table-wrapper"
                ref={marksWrapperRef}
                style={{
                  position: "relative",
                  overflowX: "visible",
                  overflowY: "visible",
                  minHeight: 120,
                  width: "100%",
                  maxWidth: "100vw",
                  paddingBottom: 32,
                  whiteSpace: "normal",
                }}
              >
                  
 
    
                <table
                  className="marks-table"
                  style={{
                    borderCollapse: "separate",
                    borderSpacing: "0 12px",
                    fontSize: "15px",
                    minWidth: 0,
                    width: "100%",
                    maxWidth: "100vw",
                    tableLayout: "auto",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "linear-gradient(135deg, #4b6cb7, #1e3a8a)",
                        color: "#fff",
                        borderRadius: "16px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontWeight: "600",
                        fontSize: "14px",
                      }}
                    >
                      <th
                        style={{
                          padding: "16px 20px",
                          textAlign: "left",
                          borderRadius: "16px 0 0 16px",
                          background: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <FaUsers /> Student
                        </span>
                      </th>
                      {assessmentList.map((a, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "16px 18px",
                            background: "rgba(255,255,255,0.05)",
                            textAlign: "center",
                            transition: "0.3s all",
                          }}
                        >
                          {a.name} ({a.max})
                        </th>
                      ))}
                      <th
                        style={{
                          padding: "16px 18px",
                          background: "rgba(255,255,255,0.05)",
                          textAlign: "center",
                        }}
                      >
                        Total
                      </th>
                      <th
                        style={{
                          padding: "16px 18px",
                          background: "rgba(255,255,255,0.05)",
                          textAlign: "center",
                        }}
                      >
                        Grade
                      </th>
                      <th
                        style={{
                          padding: "16px 20px",
                          borderRadius: "0 16px 16px 0",
                          background: "rgba(255,255,255,0.1)",
                          textAlign: "center",
                        }}
                      >
                        <FaSave /> Save
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(studentMarks).map(([sid, marks]) => {
                      const total = Object.values(marks).reduce((s, a) => s + (a.score || 0), 0);
                      const grade =
                        total >= 90
                          ? "A"
                          : total >= 80
                          ? "B"
                          : total >= 70
                          ? "C"
                          : total >= 60
                          ? "D"
                          : "F";
                      const student = students.find((s) => s.id === sid);
                      const gradeColor =
                        grade === "A"
                          ? "#16a34a"
                          : grade === "B"
                          ? "#2563eb"
                          : grade === "C"
                          ? "#f59e0b"
                          : grade === "D"
                          ? "#f97316"
                          : "#ef4444";
                      return (
                        <tr
                          key={sid}
                          style={{
                            background: "#f9fafb",
                            borderRadius: "12px",
                            marginBottom: "10px",
                            transition: "0.3s all",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e7ff")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        >
                          <td
                            style={{
                              padding: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              fontWeight: "600",
                            }}
                          >
                            <div
                              style={{
                                width: "45px",
                                height: "45px",
                                borderRadius: "50%",
                                overflow: "hidden",
                                border: "2px solid #4b6cb7",
                              }}
                            >
                              <img
                                src={student?.profileImage || "/default-profile.png"}
                                alt={student?.name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                            {student?.name}
                          </td>
                          {Object.entries(marks).map(([k, a]) => (
                            <td key={k} style={{ padding: "12px" }}>
                              <input
                                type="number"
                                min="0"
                                max={a.max}
                                value={a.score}
                                onChange={(e) => updateScore(sid, k, e.target.value)}
                                style={{
                                  width: "70px",
                                  padding: "8px 12px",
                                  borderRadius: "10px",
                                  border: "1px solid #cbd5e1",
                                  textAlign: "center",
                                  boxShadow: "inset 0 3px 6px rgba(0,0,0,0.06)",
                                  transition: "0.3s all",
                                  fontWeight: "500",
                                }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: "12px", fontWeight: "600" }}>{total}</td>
                          <td style={{ padding: "12px", fontWeight: "700", color: gradeColor }}>{grade}</td>
                          <td style={{ padding: "12px" }}>
                            <button
                              style={{
                                padding: "8px 14px",
                                borderRadius: "12px",
                                background: "#2563eb",
                                color: "#fff",
                                border: "none",
                                cursor: "pointer",
                                transition: "0.3s all",
                              }}
                              onClick={() => saveMarks(sid)}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e40af")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
                            >
                              <FaSave />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}