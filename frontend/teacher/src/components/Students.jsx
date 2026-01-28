import React, { useEffect, useState, useRef } from "react";
import { FaChevronRight } from "react-icons/fa";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  FaHome,
  FaFileAlt,
  FaChalkboardTeacher,
  FaCog,
  FaSignOutAlt,
  FaSearch,
  FaBell,
  FaUsers,
  FaClipboardCheck,
  FaStar,
  FaCheckCircle,
  FaCheck,
  FaTimesCircle,
  FaFacebookMessenger,
  FaCommentDots,
  FaPaperPlane,
} from "react-icons/fa";
import "../styles/global.css";

// NOTE: we alias `ref` to `dbRef` to avoid confusion with other `ref` variables
import {
  getDatabase,
  ref as dbRef,
  get,
  onValue,
  off,
  update,
} from "firebase/database";
import { db } from "../firebase";

const getChatId = (id1, id2) => {
  return [id1, id2].sort().join("_");
};


// helper: ISO week number for a Date
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return weekNo;
};

// place this inside StudentsPage (above the JSX that uses it)
const formatSubjectName = (courseId = "") => {
  if (!courseId) return "Unknown";
  // remove common prefixes/suffixes and underscores, then title-case words
  const clean = String(courseId)
    .replace(/^course_/, "")
    .replace(/_[0-9A-Za-z]+$/, "") // remove trailing class id like _9A if present
    .replace(/_/g, " ")
    .trim();

  // Title-case each word and return
  return clean
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");

};

const API_BASE = "https://gojo-teacher-web.onrender.com/api";
const RTDB_BASE = "https://ethiostore-17d9f-default-rtdb.firebaseio.com";

// compute age helper
const computeAge = (rawDob) => {
  if (!rawDob) return null;
  let d;
  if (typeof rawDob === "number") d = new Date(rawDob);
  else d = new Date(String(rawDob));
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

// helpers for message time display (copied from AllChat)
const formatTime = (ts) => {
  if (!ts) return "";
  const date = new Date(Number(ts));
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

// find user by userId in Users node object
const findUserByUserId = (usersObj, userId) => {
  if (!usersObj || !userId) return null;
  return Object.values(usersObj).find((u) => String(u?.userId) === String(userId)) || null;
};

const StudentItem = ({ student, selected, onClick }) => (
  <div
    onClick={() => onClick(student)}
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
      src={student.profileImage || "/default-profile.png"}
      alt={student.name}
      style={{
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        objectFit: "cover",
        border: selected ? "3px solid #4b6cb7" : "3px solid red",
      }}
    />
    <div>
      <h3 style={{ margin: 0 }}>{student.name}</h3>
      <p style={{ margin: "4px 0", color: "#555" }}>
        Grade {student.grade} - Section {student.section}
      </p>
    </div>
  </div>
);

function StudentsPage() {
  // Responsive sidebar state for mobile
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth > 600 : true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [sections, setSections] = useState([]);

  const [studentTab, setStudentTab] = useState("details");

  const [popupMessages, setPopupMessages] = useState([]);
  const [popupInput, setPopupInput] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState("daily");
  const [assignmentsData, setAssignmentsData] = useState({});
  const [teachersData, setTeachersData] = useState({});
  const [usersData, setUsersData] = useState({});
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [teacherNotes, setTeacherNotes] = useState([]);
  const [newTeacherNote, setNewTeacherNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  // default
  const [marksData, setMarksData] = useState({});
  const [teacher, setTeacher] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentChatOpen, setStudentChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const messagesEndRef = useRef(null);
  const teacherData = JSON.parse(localStorage.getItem("teacher")) || {};
  const teacherUserId = String(teacherData.userId || "");
  const [studentMarksFlattened, setStudentMarksFlattened] = useState({});
  const [performance, setPerformance] = useState([]);
const [attendanceView, setAttendanceView] = useState("daily");
  const [attendanceCourseFilter, setAttendanceCourseFilter] = useState("All");
  const [expandedCards, setExpandedCards] = useState({});
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState([]);

  const [activeSemester, setActiveSemester] = useState("semester2");

  const [studentMarks, setStudentMarks] = useState({});
// state: attendance entries for the selected student (normalized)
const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState(null);
  // Refs for posts (for scrolling/highlighting)
  const postRefs = useRef({});
  const navigate = useNavigate();

  // Messenger states (same behavior as Dashboard)
  const [showMessenger, setShowMessenger] = useState(false);
  const [conversations, setConversations] = useState([]); // only conversations that have unread messages for me

  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login"); // redirect if not logged in
      return;
    }
    setTeacher(storedTeacher);
    // fetch messenger conversations for student page as Dashboard does
    fetchConversations(storedTeacher);
  }, [navigate]);

  // ---------------- LOAD TEACHER INFO ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacherInfo(storedTeacher);
  }, [navigate]);

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

        const latest = postsData
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

  // ---------------- MESSENGER FUNCTIONS (same behavior as Dashboard) ----------------
  const fetchConversations = async (currentTeacher = teacher) => {
    try {
      const t = currentTeacher || JSON.parse(localStorage.getItem("teacher"));
      if (!t || !t.userId) {
        setConversations([]);
        return;
      }

      // Fetch chats and users
      const [chatsRes, usersRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Chats.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
      ]);
      const chats = chatsRes.data || {};
      const users = usersRes.data || {};

      // Build user mappings
      const usersByKey = users || {};
      const userKeyByUserId = {};
      Object.entries(usersByKey).forEach(([pushKey, u]) => {
        if (u && u.userId) userKeyByUserId[u.userId] = pushKey;
      });

      const convs = Object.entries(chats)
        .map(([chatId, chat]) => {
          const unreadMap = chat.unread || {};
          const unreadForMe = unreadMap[t.userId] || 0;
          if (!unreadForMe) return null; // only show conversations with unread messages

          const participants = chat.participants || {};
          const otherKeyCandidate = Object.keys(participants || {}).find((p) => p !== t.userId);
          if (!otherKeyCandidate) return null;

          // Resolve other participant to a Users pushKey + record (if possible)
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
            // fallback minimal record
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
            lastMessageSeen: Boolean(lastMessage.seen),
            lastMessageSeenAt: lastMessage.seenAt || lastMessage.seenAt || null,
            lastMessageSenderId: lastMessage.senderId || null,
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

    // navigate to AllChat, pass full contact and chatId
    navigate("/all-chat", { state: { contact, chatId, tab: "student" } });

    // clear unread in RTDB for this teacher
    try {
      await axios.put(`${RTDB_BASE}/Chats/${chatId}/unread/${teacher.userId}.json`, null);
    } catch (err) {
      console.error("Failed to clear unread in DB:", err);
    }

    // remove from UI
    setConversations((prev) => prev.filter((_, i) => i !== index));
    setShowMessenger(false);
  };

  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadForMe || 0), 0);

  // ---------------- FETCH STUDENTS ----------------
  // FETCH STUDENTS + USERS + COURSES + ASSIGNMENTS + TEACHERS
  useEffect(() => {
    if (!teacherInfo?.userId) return;
    let cancelled = false;

    const fetchStudents = async () => {
      setLoading(true);
      try {
        const [
          studentsRes,
          usersRes,
          coursesRes,
          assignmentsRes,
          teachersRes,
        ] = await Promise.all([
          axios.get(`${RTDB_BASE}/Students.json`),
          axios.get(`${RTDB_BASE}/Users.json`),
          axios.get(`${RTDB_BASE}/Courses.json`),
          axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
          axios.get(`${RTDB_BASE}/Teachers.json`),
        ]);

        const teachers = teachersRes.data || {};
        const teacherEntry = Object.entries(teachers).find(([_, t]) => t.userId === teacherInfo.userId);

        if (!teacherEntry) {
          console.warn("Teacher not found in Teachers node");
          if (!cancelled) {
            setStudents([]);
            setLoading(false);
            setError("No teacher assignment found");
          }
          return;
        }
        const teacherKey = teacherEntry[0];

        const assignedCourses = Object.values(assignmentsRes.data || {})
          .filter((a) => a.teacherId === teacherKey)
          .map((a) => a.courseId);

        const usersObj = usersRes.data || {};
        setUsersData(usersObj);

        // helper to find user record
        const findUser = (userId) => findUserByUserId(usersObj, userId);

        const studentsArr = Object.entries(studentsRes.data || {}).map(([studentId, s]) => {
          const user = findUser(s.userId);

          // attempt to resolve parentName/parentPhone from student raw or user record
          const parentName =
            s.parentName ||
            s.parent?.name ||
            user?.parentName ||
            s.rawParentName ||
            null;

          const parentPhone =
            s.parentPhone ||
            s.parent?.phone ||
            user?.parentPhone ||
            s.rawParentPhone ||
            null;

          // detect DOB/age
          const rawDob = user?.dob || user?.birthDate || s.dob || s.birthDate || null;
          const age = computeAge(rawDob);

          return {
            ...s,
            studentId,
            name: user?.name || s.name || "Unknown",
            email: user?.email || s.email || "",
            profileImage: user?.profileImage || s.profileImage || "/default-profile.png",
            phone: user?.phone || s.phone || "",
            gender: user?.gender || s.gender || "",
            dob: rawDob,
            age: age,
            parentName: parentName || null,
            parentPhone: parentPhone || null,
            raw: s,
          };
        }).filter((s) =>
          assignedCourses.some((cid) => {
            const c = coursesRes.data?.[cid];
            return c && c.grade === s.grade && c.section === s.section;
          })
        );

        if (!cancelled) {
          setStudents(studentsArr);
          setError("");
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStudents();
    return () => (cancelled = true);
  }, [teacherInfo]);

  // When user picks a student, set immediate fallback details (so UI won't crash),
  // then fetch Users node and resolve authoritative details (phone/gender/email/parent/dob->age).
  useEffect(() => {
    if (!selectedStudent) {
      setSelectedStudentDetails(null);
      return;
    }

    // immediate fallback derived from selectedStudent to avoid UI errors
    const fallback = {
      fullName: selectedStudent.name || "—",
      phone: selectedStudent.phone || selectedStudent.raw?.phone || "—",
      gender: selectedStudent.gender || selectedStudent.raw?.gender || "—",
      email: selectedStudent.email || "—",
      grade: selectedStudent.grade || "—",
      section: selectedStudent.section || "—",
      parentName: selectedStudent.parentName || selectedStudent.raw?.parentName || "—",
      parentPhone: selectedStudent.parentPhone || selectedStudent.raw?.parentPhone || "—",
      dob: selectedStudent.dob || selectedStudent.raw?.dob || "—",
      age: selectedStudent.age ?? computeAge(selectedStudent.dob || selectedStudent.raw?.dob) ?? "—",
      profileImage: selectedStudent.profileImage || "/default-profile.png",
    };

    setSelectedStudentDetails(fallback);

    let cancelled = false;
    const loadDetails = async () => {
      try {
        // use cached usersData if present, otherwise fetch Users node
        let usersObj = usersData;
        if (!usersObj || Object.keys(usersObj).length === 0) {
          const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
          usersObj = usersRes.data || {};
          setUsersData(usersObj);
        }

        const userRec = findUserByUserId(usersObj, selectedStudent.userId) || {};
        // Try multiple parent id fields on student or user record
        const parentId =
          selectedStudent.raw?.parentId ||
          selectedStudent.raw?.parentUserId ||
          userRec?.parentId ||
          userRec?.parentUserId ||
          null;

        const parentRec = parentId ? findUserByUserId(usersObj, parentId) : null;

        const parentName =
          parentRec?.name ||
          selectedStudent.raw?.parentName ||
          selectedStudent.parentName ||
          "—";

        const parentPhone =
          parentRec?.phone ||
          selectedStudent.raw?.parentPhone ||
          selectedStudent.parentPhone ||
          "—";

        const phone = userRec?.phone || selectedStudent.phone || selectedStudent.raw?.phone || "—";
        const gender = userRec?.gender || selectedStudent.gender || selectedStudent.raw?.gender || "—";
        const email = userRec?.email || selectedStudent.email || "—";
        const dob = userRec?.dob || userRec?.birthDate || selectedStudent.dob || selectedStudent.raw?.dob || null;
        const age = computeAge(dob) ?? selectedStudent.age ?? "—";

        const details = {
          fullName: userRec?.name || selectedStudent.name || "—",
          phone,
          gender,
          email,
          grade: selectedStudent.grade || "—",
          section: selectedStudent.section || "—",
          parentName,
          parentPhone,
          dob: dob || "—",
          age,
          profileImage: userRec?.profileImage || selectedStudent.profileImage || "/default-profile.png",
          userRec,
          parentRec,
        };

        if (!cancelled) setSelectedStudentDetails(details);
      } catch (err) {
        console.error("Failed to derive student details", err);
        // keep fallback already set
      }
    };

    loadDetails();
    return () => { cancelled = true; };
  }, [selectedStudent, usersData]);

  // Ensure parent info is resolved from Parents node if not already present
  useEffect(() => {
    if (!selectedStudent) return;
    let cancelled = false;

    const resolveParent = async () => {
      try {
        const parentsRes = await axios.get(`${RTDB_BASE}/Parents.json`);
        const parentsObj = parentsRes.data || {};

        // candidate keys that might point to parent record or userId
        const candidates = [
          selectedStudent.raw?.parentId,
          selectedStudent.raw?.parentUserId,
          selectedStudent.parentId,
          selectedStudent.parentUserId,
        ].filter(Boolean);

        let foundParent = null;

        // direct lookup by key
        for (const k of candidates) {
          if (parentsObj[k]) {
            foundParent = parentsObj[k];
            break;
          }
          // also try matching parent.userId === k
          const byUserId = Object.values(parentsObj).find((p) => String(p.userId) === String(k));
          if (byUserId) {
            foundParent = byUserId;
            break;
          }
        }

        // if not found, search children lists for this student
        if (!foundParent) {
          const sid = selectedStudent.studentId || selectedStudent.userId;
          for (const p of Object.values(parentsObj)) {
            const children = p?.children || {};
            const match = Object.values(children).find((c) => String(c?.studentId) === String(sid));
            if (match) {
              foundParent = p;
              break;
            }
          }
        }

        let parentName = null;
        let parentPhone = null;

        if (foundParent) {
          parentName = foundParent.name || foundParent.displayName || null;
          parentPhone = foundParent.phone || foundParent.phoneNumber || foundParent.contact || null;

          // if parent has userId, try to enrich from Users node
          if ((!parentName || !parentPhone) && foundParent.userId) {
            try {
              const usersRes = await axios.get(`${RTDB_BASE}/Users.json`);
              const usersObj = usersRes.data || {};
              const userRec = Object.values(usersObj).find((u) => String(u.userId) === String(foundParent.userId));
              if (userRec) {
                parentName = parentName || userRec.name || null;
                parentPhone = parentPhone || userRec.phone || null;
              }
            } catch (err) {
              // ignore
            }
          }
        }

        if (!cancelled) {
          setSelectedStudentDetails((prev) => ({
            ...(prev || {}),
            parentName: parentName || prev?.parentName || "—",
            parentPhone: parentPhone || prev?.parentPhone || "—",
          }));
        }
      } catch (err) {
        console.error("Error resolving parent info:", err);
      }
    };

    resolveParent();
    return () => (cancelled = true);
  }, [selectedStudent]);

  useEffect(() => {
    const chatContainer = document.querySelector(".chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [popupMessages]);

  useEffect(() => {
    if (selectedGrade === "All") {
      setSections([]);
      setSelectedSection("All");
    } else {
      const gradeSections = [
        ...new Set(
          students.filter((s) => s.grade === selectedGrade).map((s) => s.section)
        ),
      ];
      setSections(gradeSections);
      setSelectedSection("All");
    }
  }, [selectedGrade, students]);

  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== "All" && s.grade !== selectedGrade) return false;
    if (selectedSection !== "All" && s.section !== selectedSection) return false;
    return true;
  });

  const grades = [...new Set(students.map((s) => s.grade))].sort();



// Fetch and normalize attendance for selectedStudent
useEffect(() => {
  if (!selectedStudent?.studentId && !selectedStudent?.userId) {
    setAttendanceRecords([]);
    return;
  }

  let cancelled = false;
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      // Fetch attendance + teachers + users to resolve teacher names when available
      const [attendanceRes, teachersRes, usersRes, assignmentsRes] = await Promise.all([
        axios.get(`${RTDB_BASE}/Attendance.json`),
        axios.get(`${RTDB_BASE}/Teachers.json`),
        axios.get(`${RTDB_BASE}/Users.json`),
        axios.get(`${RTDB_BASE}/TeacherAssignments.json`),
      ]);
      const raw = attendanceRes.data || {};
      const teachersObj = teachersRes.data || {};
      const usersObj = usersRes.data || {};
      const assignmentsObj = assignmentsRes.data || {};

      // Normalized list for this student
      const normalized = [];

      // Attendance structure (common patterns):
      // Attendance: { courseId: { dateISO: { studentId: { status, teacherName, subject } } } }
      // Also sometimes students stored as { studentId: "present" } or { status: "present" }
      Object.entries(raw).forEach(([courseId, dates]) => {
        if (!dates || typeof dates !== "object") return;
        Object.entries(dates).forEach(([dateKey, studentsMap]) => {
          if (!studentsMap || typeof studentsMap !== "object") return;

          // studentsMap might be { studentId: "present", ... } or { studentId: { status: "...", teacherName: "..."} }
          const studentEntry = studentsMap[selectedStudent.studentId] ?? studentsMap[selectedStudent.userId];

          // If not found with those keys, there might be a nested structure: { students: { studentId: {...} } }
          let record = studentEntry;
          if (!record && studentsMap.students) {
            record = studentsMap.students[selectedStudent.studentId] ?? studentsMap.students[selectedStudent.userId];
          }

          if (!record) {
            // also check each student entry for keys like userId inside object
            const found = Object.entries(studentsMap).find(([k, v]) => {
              if (!v || typeof v !== "object") return false;
              if (v.userId && (String(v.userId) === String(selectedStudent.userId) || String(v.userId) === String(selectedStudent.studentId))) return true;
              return false;
            });
            if (found) record = found[1];
          }

          if (!record) return;

          // Normalize status / teacherName / subject
          let status = "absent";
          let teacherName = "";
          let subject = courseId;

          if (typeof record === "string") {
            status = record;
          } else if (typeof record === "object") {
            status = record.status || record.attendance_status || Object.values(record)[0] || "present";

            // Resolve teacher name: prefer explicit teacherName, then teacherId -> Teachers -> Users, then teacherUserId/userId fields
            teacherName = record.teacherName || record.teacher || record.tutor || "";

            if (!teacherName) {
              // record.teacherId might be a Teachers push key
              const teacherId = record.teacherId || record.teacherKey || null;
              if (teacherId && teachersObj[teacherId]) {
                const tRec = teachersObj[teacherId];
                // try to get user linked to teacher
                if (tRec.userId) {
                  const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(tRec.userId));
                  teacherName = userRec?.name || tRec.name || teacherName;
                } else {
                  teacherName = tRec.name || teacherName;
                }
              }
            }

            if (!teacherName) {
              // sometimes record may store teacherUserId / teacherUser
              const teacherUserId = record.teacherUserId || record.teacherUser || record.takenBy || null;
              if (teacherUserId) {
                const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(teacherUserId));
                if (userRec) teacherName = userRec.name || teacherName;
              }
            }

            subject = record.subject || courseId;
          }

          // If teacherName is still missing, try to infer from TeacherAssignments (course -> teacher key -> Teachers -> Users)
          if (!teacherName) {
            const assignment = Object.values(assignmentsObj).find((a) => String(a.courseId) === String(courseId));
            if (assignment && assignment.teacherId) {
              const assignedTeacherKey = assignment.teacherId;
              const tRec = teachersObj[assignedTeacherKey];
              if (tRec) {
                if (tRec.userId) {
                  const userRec = Object.values(usersObj).find((u) => String(u?.userId) === String(tRec.userId));
                  teacherName = userRec?.name || tRec.name || teacherName;
                } else {
                  teacherName = tRec.name || teacherName;
                }
              }
            }
          }

          // store normalized record
          normalized.push({
            courseId,
            date: dateKey,
            status: String(status).toLowerCase(),
            teacherName,
            subject,
          });
        });
      });

      if (!cancelled) {
        // sort newest -> oldest
        normalized.sort((a, b) => new Date(b.date) - new Date(a.date));
        setAttendanceRecords(normalized);
      }
    } catch (err) {
      console.error("Attendance fetch error:", err);
      if (!cancelled) setAttendanceRecords([]);
    } finally {
      if (!cancelled) setAttendanceLoading(false);
    }
  };

  fetchAttendance();
  return () => {
    cancelled = true;
  };
}, [selectedStudent]);

// Derived data used by the UI (attendanceBySubject, getProgress, etc.)
const attendanceData = React.useMemo(() => {
  // attendanceRecords already only contains entries for selectedStudent
  return attendanceRecords.map((r) => ({
    date: r.date,
    courseId: r.courseId,
    teacherName: r.teacherName || "",
    status: r.status || "absent",
  }));
}, [attendanceRecords]);

const attendanceBySubject = React.useMemo(() => {
  if (!attendanceData || attendanceData.length === 0) return {};
  return attendanceData.reduce((acc, rec) => {
    const key = rec.courseId || rec.subject || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(rec);
    return acc;
  }, {});
}, [attendanceData]);

const getProgress = (records) => {
  if (!records || records.length === 0) return 0;
  const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((presentCount / records.length) * 100);
};

// Expose getWeekNumber for the UI usage (used when computing weekRecords)
const _getWeekNumber = getWeekNumber


// inside StudentsPage component (above the JSX that uses it)
const toggleExpand = (key) => {
  setExpandedCards((prev) => ({
    ...prev,
    [key]: !prev[key],
  }));
};


  const handleLogout = () => {
    localStorage.removeItem("teacher"); // or "user", depending on your auth
    navigate("/login");
  };

  // ---------------- FETCH PERFORMANCE (FIXED)
  useEffect(() => {
    // we only need to fetch marks when a student is selected
    if (!selectedStudent) {
      setStudentMarksFlattened({});
      return;
    }

    const fetchMarksForStudent = async () => {
      setLoading(true);
      try {
        const database = getDatabase();
        const snapshot = await get(dbRef(database, "ClassMarks"));
        if (!snapshot.exists()) {
          setStudentMarksFlattened({});
          setLoading(false);
          return;
        }

        const data = snapshot.val(); // object where keys are course_* and values are student maps
        const flattened = {};

        const candidates = new Set(
          [
            selectedStudent.studentId,
            selectedStudent.userId,
            selectedStudent.userId ? `student_${selectedStudent.userId}` : null,
          ].filter(Boolean)
        );

        Object.entries(data).forEach(([courseKey, studentsMap]) => {
          if (!studentsMap || typeof studentsMap !== "object") return;

          const foundEntry = Object.entries(studentsMap).find(([studentKey, studentData]) => {
            if (candidates.has(studentKey)) return true;
            if (studentData && typeof studentData === "object") {
              if (studentData.userId && candidates.has(studentData.userId)) return true;
              if (studentData.studentId && candidates.has(studentData.studentId)) return true;
            }
            return false;
          });

          if (foundEntry) {
            const [, studentData] = foundEntry;
            flattened[courseKey] = studentData;
          }
        });

        setStudentMarksFlattened(flattened);
      } catch (err) {
        console.error("Failed to fetch marks:", err);
        setStudentMarksFlattened({});
      } finally {
        setLoading(false);
      }
    };

    fetchMarksForStudent();
  }, [selectedStudent]);

  const statusColor = (status) => (status === "present" ? "#34a853" : status === "absent" ? "#ea4335" : "#fbbc05");

  // ---------------- teacher note ----------------
  useEffect(() => {
    if (!selectedStudent?.userId) return;

    async function fetchTeacherNotes() {
      try {
        const res = await axios.get(
          `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent?.userId}.json`
        );

        if (!res.data) {
          setTeacherNotes([]);
          return;
        }

        const notesArr = Object.entries(res.data).map(([id, note]) => ({
          id,
          ...note,
        }));

        // newest first
        notesArr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setTeacherNotes(notesArr);
      } catch (err) {
        console.error("Failed to fetch teacher notes", err);
        setTeacherNotes([]);
      }
    }

    fetchTeacherNotes();
  }, [selectedStudent]);

  const saveTeacherNote = async () => {
    if (!newTeacherNote.trim() || !teacherInfo || !selectedStudent) return;

    setSavingNote(true);

    const noteData = {
      teacherId: teacherInfo.userId,
      teacherName: teacherInfo.name,
      note: newTeacherNote.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      await axios.post(
        `https://ethiostore-17d9f-default-rtdb.firebaseio.com/StudentNotes/${selectedStudent?.userId}.json`,
        noteData
      );

      setTeacherNotes((prev) => [noteData, ...prev]);
      setNewTeacherNote("");
    } catch (err) {
      console.error("Error saving note", err);
    } finally {
      setSavingNote(false);
    }
  };

  // Scroll chat to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages for the selected student
  useEffect(() => {
    if (!teacherUserId || !selectedStudent) return;

    const chatKey = getChatId(teacherUserId, selectedStudent.userId);
    const messagesRef = dbRef(db, `Chats/${chatKey}/messages`);

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
    });

    return () => unsubscribe();
  }, [teacherUserId, selectedStudent]);

  // Mark messages as seen when chat popup is open and there are unseen messages for this teacher
  useEffect(() => {
    if (!chatOpen || !selectedStudent || !teacherUserId) return;
    if (!messages || messages.length === 0) return;

    const unseen = messages.filter(
      (m) => String(m.receiverId) === String(teacherUserId) && !m.seen
    );
    if (unseen.length === 0) return;

    const chatId = getChatId(teacherUserId, selectedStudent.userId);
    const ts = Date.now();

    const payload = { messages: {}, unread: {} };
    unseen.forEach((m) => {
      // set seen + seenAt on each message
      payload.messages[m.id] = { ...(payload.messages[m.id] || {}), seen: true, seenAt: ts };
    });
    // clear unread for this teacher (remove the key)
    payload.unread[teacherUserId] = null;
    // also mark lastMessage as seen (merge field) so other clients can read it
    payload.lastMessage = { seen: true, seenAt: ts };

    axios
      .patch(`${RTDB_BASE}/Chats/${chatId}.json`, payload)
      .catch((err) => console.error("Failed to mark messages seen:", err));

  }, [chatOpen, messages, selectedStudent, teacherUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!newMessageText.trim() || !selectedStudent) return;

    const senderId = teacherUserId;
    const receiverId = selectedStudent.userId;
    const chatId = getChatId(senderId, receiverId);
    const timeStamp = Date.now();

    const message = {
      senderId,
      receiverId,
      type: "text",
      text: newMessageText,
      seen: false,
      timeStamp,
    };

    await axios.post(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}/messages.json`,
      message
    );

    await axios.patch(
      `https://ethiostore-17d9f-default-rtdb.firebaseio.com/Chats/${chatId}.json`,
      {
        participants: { [senderId]: true, [receiverId]: true },
        lastMessage: { text: newMessageText, senderId, seen: false, timeStamp },
        unread: { [receiverId]: 1 },
      }
    );

    setNewMessageText("");
  };

const [isPortrait, setIsPortrait] = React.useState(
  window.innerWidth < window.innerHeight
);

React.useEffect(() => {
  const handleResize = () => {
    setIsPortrait(window.innerWidth < window.innerHeight);
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);




  useEffect(() => {
    const chatContainer = document.querySelector(".chat-messages");
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [popupMessages]);

  const InfoRow = ({ label, value }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        padding: "12px 14px",
        borderRadius: "14px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
        transition: "all 0.25s ease",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          color: "#64748b",
          fontWeight: "600",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.6px",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: "15px",
          color: "#0f172a",
          fontWeight: "700",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="dashboard-page">
      {/* Top Navbar */}
      <nav className="top-navbar">
        <h2>Gojo Dashboard</h2>
        
        <div className="nav-right">
          {/* Notification Bell & Popup (shows posts and unread messages) */}
          <div className="icon-circle">
            <div
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ cursor: "pointer", position: "relative" }}
            >
              <FaBell size={24} />
              {(notifications.length + totalUnreadMessages) > 0 && (
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
                  {notifications.length + totalUnreadMessages}
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
                {/* Show post notifications */}
                {notifications.length > 0 && notifications.map((post, index) => (
                  <div
                    key={post.id || index}
                    onClick={() => {
                      setNotifications(prev => prev.filter((_, i) => i !== index));
                      setShowNotifications(false);
                      navigate("/dashboard");
                      setTimeout(() => {
                        const postElement = postRefs.current[post.id];
                        if (postElement) {
                          postElement.scrollIntoView({ behavior: "smooth", block: "center" });
                          setHighlightedPostId(post.id);
                          setTimeout(() => setHighlightedPostId(null), 3000);
                        }
                      }, 150);
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
                ))}
                {/* Show unread message notifications */}
                {totalUnreadMessages > 0 && conversations.filter(c => c.unreadForMe > 0).map((conv, idx) => (
                  <div
                    key={conv.chatId || idx}
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/all-chat");
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
                      src={conv.profile || "/default-profile.png"}
                      alt={conv.displayName}
                      style={{
                        width: 35,
                        height: 35,
                        borderRadius: "50%",
                        marginRight: 10,
                      }}
                    />
                    <div>
                      <strong>{conv.displayName}</strong>
                      <p style={{ margin: 0, fontSize: 12, color: '#0b78f6', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* show tick only if the last message was sent by me (teacher) */}
                        {conv.lastMessageSenderId === teacherUserId ? (
                          <span style={{ color: conv.lastMessageSeen ? '#0bda63' : '#cbd5e1' }}>
                            {conv.lastMessageSeen ? '✓✓' : '✓'}
                          </span>
                        ) : null}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                          {conv.lastMessageText || 'New message'}
                        </span>
                        {conv.lastMessageSeenAt && (
                          <span style={{ marginLeft: 6, color: '#64748b', fontSize: 11 }}>
                            {new Date(conv.lastMessageSeenAt).toLocaleTimeString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && totalUnreadMessages === 0 && (
                  <div style={{ padding: 15 }}>No notifications</div>
                )}
              </div>
            )}
          </div>

          {/* Messenger button: navigates to all-chat, badge only */}
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
          <div className="icon-circle" onClick={() => navigate("/settings")}><FaCog /></div>
          <img src={teacher?.profileImage || "/default-profile.png"} />

        </div>
      </nav>

      <div className="google-dashboard">
        {/* Responsive sidebar open/close on resize */}
        {typeof window !== 'undefined' && (
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
          }, [])
        )}
        {/* Responsive Sidebar (like Dashboard.jsx) */}
        {typeof window !== 'undefined' && window.innerWidth <= 600 && !sidebarOpen && (
          <button
            className="sidebar-arrow-btn"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
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
        {typeof window !== 'undefined' && window.innerWidth <= 600 && sidebarOpen && (
          <div
            className="sidebar-overlay visible"
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200 }}
          />
        )}
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
                  borderRadius: 0,
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
                  borderRadius: 0,
                }
          }
        >
                  <style>{`
                    @media (max-width: 600px) {
                      .google-sidebar {
                        left: -220px;
                        transition: left 0.25s cubic-bezier(.4,0,.2,1);
                        border-radius: 0 !important;
                      }
                      .google-sidebar.open {
                        left: 0 !important;
                        z-index: 1202;
                        border-radius: 0 !important;
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

            <Link className="sidebar-btn" to="/students" style={{ backgroundColor: "#4b6cb7", color: "#fff" }}>
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
            <Link className="sidebar-btn" to="/schedule" >
              <FaUsers /> Schedule
            </Link>
            
            <button className="sidebar-btn logout-btn" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>
        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "30px" }}>
           <div
             className="student-list-card-responsive"
             style={{
               width: "300px",
               position: "relative",
               marginLeft: "50px",
               marginRight: isPortrait ? 0 : "50px",
             }}
           >
             <style>{`
               @media (max-width: 600px) {
                 .student-list-card-responsive {
                   margin-left: -25px !important;
                   margin-right: auto !important;
                   width: 90vw !important;
                   max-width: 90vw !important;
                 }
               }
             `}</style>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>My Students</h2>

            {/* Grades */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
              <button onClick={() => setSelectedGrade("All")} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === "All" ? "#4b6cb7" : "#ddd", color: selectedGrade === "All" ? "#fff" : "#000", border: "none" }}>All Grades</button>
              {grades.map(g => (
                <button key={g} onClick={() => setSelectedGrade(g)} style={{ padding: "8px 15px", borderRadius: "8px", background: selectedGrade === g ? "#4b6cb7" : "#ddd", color: selectedGrade === g ? "#fff" : "#000", border: "none" }}>Grade {g}</button>
              ))}
            </div>
            {/* Sections */}
            {selectedGrade !== "All" && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                <button onClick={() => setSelectedSection("All")} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === "All" ? "#4b6cb7" : "#ddd", color: selectedSection === "All" ? "#fff" : "#000", border: "none" }}>All Sections</button>
                {sections.map(sec => (
                  <button key={sec} onClick={() => setSelectedSection(sec)} style={{ padding: "6px 12px", borderRadius: "8px", background: selectedSection === sec ? "#4b6cb7" : "#ddd", color: selectedSection === sec ? "#fff" : "#000", border: "none" }}>Section {sec}</button>
                ))}
              </div>
            )}
            {/* Student list */}
            {loading && <p>Loading students...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {!loading && !error && filteredStudents.length === 0 && <p>No students found.</p>}
            <style>{`
              .student-list-responsive {
                display: flex;
                flex-direction: column;
                margin-top: 30px;
                gap: 12px;
                width: 100%;
                max-width: 100vw;
                margin-left: 0;
                margin-right: 0;
              }
              @media (max-width: 600px) {
                .student-list-responsive {
                  width: 100vw !important;
                  max-width: 100vw !important;
                  margin-left: 0 !important;
                  margin-right: 0 !important;
                  padding: 0 !important;
                  align-items: flex-start !important;
                }
                .student-list-responsive > div {
                  margin-left: 10px !important;
                  padding-left: 10px !important;
                  width: 100vw !important;
                  max-width: 100vw !important;
                  min-width: 100vw !important;
                  box-sizing: border-box !important;
                }
              }
              @media (min-width: 350px) {
                .student-list-responsive {
                  width: 350px;
                  max-width: 70vw;
                }
              }
               @media (max-width: 600px) {
                 .student-list-card-responsive {
                   margin-left: -32px !important;
                   margin-right: auto !important;
                   width: 80vw !important;
                   max-width: 80vw !important;
                 }
               }
                  width: 500px;
                  max-width: 80vw;
                }
              }
              @media (min-width: 1200px) {
                .student-list-responsive {
                  width: 600px;
                  max-width: 700px;
                  margin-left: -100px;
                }
              }
              @media (min-width: 1500px) {
                .student-list-responsive {
                  width: 600px;
                  max-width: 700px;
                  margin-left: -250px;
                }
              }
            `}</style>
            <div className="student-list-responsive">
              {filteredStudents.map((s, index) => (
                <StudentItem
                  key={s.userId || s.id || index}
                  student={s}
                  selected={selectedStudent?.userId === s.userId}
                  onClick={() => setSelectedStudent(s)}
                />
              ))}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          {/* RIGHT SIDEBAR */}
          {/* RIGHT SIDEBAR */}
{/* RIGHT SIDEBAR */}
{selectedStudent && (
  <div
    style={{
      width: isPortrait ? "100%" : "30%",
      height: isPortrait ? "100vh" : "calc(100vh - 60px)",
      position: "fixed",
      right: 0,
      top: isPortrait ? 0 : "60px",
      background: "#fff",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      boxShadow: isPortrait
        ? "0 0 0 rgba(0,0,0,0)"
        : "0 0 15px rgba(0,0,0,0.08)",
      transition: "all 0.35s ease",
    }}
  >

    {/* Close button (top-right) */}
   <button
  onClick={() => setSelectedStudent(null)}
  style={{
    position: "fixed",
    top: 56,
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 12,
    border: "none",
    background: "#ffffff",
    boxShadow: "0 6px 18px rgba(2,6,23,0.15)",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 900,
    zIndex: 2000,
  }}
>
  ×
</button>


    {/* Student Info */}
    <div style={{ textAlign: "center", marginBottom: "20px", paddingTop: 20 }}>
      <div
        style={{
          width: "120px",
          height: "120px",
          margin: "0 auto 15px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "4px solid #4b6cb7",
        }}
      >
        <img
          src={selectedStudent.profileImage}
          alt={selectedStudent.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <h2 style={{ margin: 0, fontSize: "22px" }}>{selectedStudent.name}</h2>
      <p style={{ color: "#555", margin: "5px 0" }}>{selectedStudent.studentId}</p>
      <p style={{ color: "#555", margin: "5px 0" }}>
        <strong>Grade:</strong> {selectedStudent.grade}{selectedStudent.section}
      </p>
      
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", marginBottom: "15px" }}>
      {["details", "attendance", "performance"].map((tab) => (
        <button
          key={tab}
          onClick={() => setStudentTab(tab)}
          style={{
            flex: 1,
            padding: "10px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontWeight: "600",
            color: studentTab === tab ? "#4b6cb7" : "#777",
            borderBottom:
              studentTab === tab ? "3px solid #4b6cb7" : "3px solid transparent",
          }}
        >
          {tab.toUpperCase()}
        </button>
      ))}
    </div>

              {/* Tab Content */}
              <div>
                {/* DETAILS TAB */}
              {/* DETAILS TAB */}
{studentTab === "details" && (
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
      {/* STUDENT DETAILS */}
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
        Student Details
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
          ["Phone", selectedStudentDetails?.phone],
          ["Gender", selectedStudentDetails?.gender],
          ["Email", selectedStudentDetails?.email],
          ["Grade", selectedStudentDetails?.grade],
          ["Section", selectedStudentDetails?.section],
          ["Age", selectedStudentDetails?.age],
          ["Birth Date", selectedStudentDetails?.dob],
          ["Parent Name", selectedStudentDetails?.parentName],
          ["Parent Phone", selectedStudentDetails?.parentPhone],
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

      {/* ================= TEACHER NOTES (UNDER DETAILS) ================= */}
      <div style={{ marginTop: 36 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
            color: "#1e293b",
          }}
        >
          Teacher Comments
        </div>

        {/* NOTE INPUT */}
        <div
          style={{
            background: "#ffffff",
            padding: 18,
            borderRadius: 22,
           
            boxShadow: "0 14px 40px rgba(0,0,0,0.1)",
          }}
        >
          <textarea
            value={newTeacherNote}
            onChange={(e) => setNewTeacherNote(e.target.value)}
            placeholder="Write an important comment about the student..."
            style={{
              width: "100%",
              minHeight: 30,
              border: "none",
              outline: "none",
              resize: "vertical",
              fontSize: 15,
              lineHeight: 1.6,
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              onClick={saveTeacherNote}
              disabled={savingNote}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: "none",
                background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                color: "#fff",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 12px 30px rgba(37,99,235,0.45)",
              }}
            >
              {savingNote ? "Saving..." : "Add Comment"}
            </button>
          </div>
        </div>

        {/* NOTES LIST */}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {teacherNotes.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 18,
                color: "#64748b",
                background: "#ffffff",
                borderRadius: 18,
              }}
            >
              No teacher comments yet
            </div>
          ) : (
            teacherNotes.map((n) => (
              <div key={n.id} style={{ display: "flex", gap: 12 }}>
                {/* Avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#60a5fa,#2563eb)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  {n.teacherName
                    ?.split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "T"}
                </div>

                {/* Note Bubble */}
                <div
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    padding: 14,
                    borderRadius: 18,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#1e293b" }}>
                    {n.teacherName}
                  </div>
                  <div style={{ marginTop: 6 }}>{n.note}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#64748b",
                      textAlign: "right",
                    }}
                  >
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>

 
  </div>
)}

                {/* ATTENDANCE TAB */}
             {/* ================= ATTENDANCE TAB ================= */}
{studentTab === "attendance" && selectedStudent && (
  <div
    style={{
      padding: 30,
      background: "radial-gradient(circle at top,#eef2ff,#f8fafc)",
      borderRadius: 26,
      fontFamily: "Inter, system-ui",
    }}
  >
    {/* ===== VIEW SWITCH ===== */}
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 16,
        marginBottom: 32,
      }}
    >
      {["daily", "weekly", "monthly"].map((v) => (
        <button
          key={v}
          onClick={() => setAttendanceView(v)}
          style={{
            padding: "12px 28px",
            borderRadius: 999,
            border: "none",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: 1,
            cursor: "pointer",
            background:
              attendanceView === v
                ? "linear-gradient(135deg,#4f46e5,#2563eb)"
                : "rgba(255,255,255,.8)",
            color: attendanceView === v ? "#fff" : "#1f2937",
            boxShadow:
              attendanceView === v
                ? "0 5px 5px rgba(79,70,229,.45)"
                : "0 5px 5px rgba(0,0,0,.08)",
            transition: "all .3s ease",
          }}
        >
          {v.toUpperCase()}
        </button>
      ))}
    </div>

    {/* ===== SUBJECT CARDS ===== */}
    {Object.entries(attendanceBySubject)
      .filter(
        ([course]) =>
          attendanceCourseFilter === "All" || course === attendanceCourseFilter
      )
      .map(([course, records]) => {
        const today = new Date().toDateString();
        const weekRecords = records.filter(
          (r) => new Date(r.date).getWeek?.() === new Date().getWeek?.()
        );
        const monthRecords = records.filter(
          (r) => new Date(r.date).getMonth() === new Date().getMonth()
        );

        const displayRecords =
          attendanceView === "daily"
            ? records.filter((r) => new Date(r.date).toDateString() === today)
            : attendanceView === "weekly"
            ? weekRecords
            : monthRecords;

        const progress = getProgress(displayRecords);
        const expandKey = `${attendanceView}-${course}`;

        return (
          <div
            key={course}
            onClick={() => toggleExpand(expandKey)}
            style={{
              cursor: "pointer",
              background:
                "linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.85))",
              backdropFilter: "blur(14px)",
              borderRadius: 26,
              padding: 26,
              marginBottom: 26,
              boxShadow: "0 10px 10px rgba(0,0,0,.12)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at top left,rgba(99,102,241,.15),transparent 60%)",
                pointerEvents: "none",
              }}
            />

            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#1e3a8a",
                  }}
                >
                  📚 {formatSubjectName(course)}
                </h3>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    color: "#64748b",
                  }}
                >
                  👨‍🏫 {records[0]?.teacherName}
                </p>
              </div>

              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 900,
                  background:
                    progress >= 75
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : progress >= 50
                      ? "linear-gradient(135deg,#facc15,#eab308)"
                      : "linear-gradient(135deg,#ef4444,#dc2626)",
                  color: "#fff",
                  boxShadow: "0 10px 25px rgba(0,0,0,.25)",
                }}
              >
                {progress}%
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div
              onClick={() => toggleExpand(expandKey)}
              style={{
                height: 16,
                background: "#e5e7eb",
                borderRadius: 999,
                cursor: "pointer",
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background:
                    progress >= 75
                      ? "linear-gradient(90deg,#22c55e,#16a34a)"
                      : progress >= 50
                      ? "linear-gradient(90deg,#facc15,#eab308)"
                      : "linear-gradient(90deg,#ef4444,#dc2626)",
                  transition: "width .5s cubic-bezier(.4,0,.2,1)",
                }}
              />
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#475569",
                marginBottom: 12,
                letterSpacing: 0.6,
              }}
            >
              CLICK BAR TO VIEW {attendanceView.toUpperCase()} DETAILS
            </div>

            {/* EXPANDED DAYS */}
            {expandedCards[expandKey] && (
              <div
                style={{
                  marginTop: 14,
                  background: "#f1f5f9",
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                {displayRecords.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 8px",
                      borderBottom:
                        i !== displayRecords.length - 1
                          ? "1px solid #e5e7eb"
                          : "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, color: "#1f2937" }}>
                        📅 {new Date(r.date).toDateString()}
                      </span>
                     
                    </div>

                    <span
                      style={{
                        padding: "6px 14px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 900,
                        background:
                          r.status === "present"
                            ? "#dcfce7"
                            : r.status === "late"
                            ? "#fef3c7"
                            : "#fee2e2",
                        color:
                          r.status === "present"
                            ? "#166534"
                            : r.status === "late"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {r.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
  </div>
)}

                  {/* PERFORMANCE TAB */}
             {/* PERFORMANCE TAB */}
                {studentTab === "performance" && (
                  <div style={{ position: "relative", paddingBottom: "70px", background: "#f8fafc" }}>

                    {/* Semester Tabs */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "40px",
                        marginBottom: "25px",
                        borderBottom: "2px solid #e5e7eb",
                        paddingBottom: "8px",
                      }}
                    >
                      {["semester1", "semester2"].map((sem) => {
                        const isActive = activeSemester === sem;
                        return (
                          <button
                            key={sem}
                            onClick={() => setActiveSemester(sem)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "16px",
                              fontWeight: "800",
                              color: isActive ? "#2563eb" : "#64748b",
                              paddingBottom: "10px",
                              position: "relative",
                            }}
                          >
                            {sem === "semester1" ? "Semester 1" : "Semester 2"}
                            {isActive && (
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: "-2px",
                                  left: 0,
                                  width: "100%",
                                  height: "4px",
                                  background: "linear-gradient(135deg,#4b6cb7,#1e40af)",
                                  borderRadius: "6px",
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Marks Cards */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "20px",
                        padding: "20px",
                      }}
                    >
                      {loading ? (
                        <div style={{ textAlign: "center", gridColumn: "1 / -1", padding: "30px" }}>
                          Loading performance...
                        </div>
                      ) : Object.keys(studentMarksFlattened || {}).length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "30px",
                            borderRadius: "18px",
                            background: "#ffffff",
                            color: "#475569",
                            fontSize: "16px",
                            fontWeight: "600",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                            gridColumn: "1 / -1",
                          }}
                        >
                          🚫 No Performance Records
                        </div>
                      ) : (
                        Object.entries(studentMarksFlattened).map(([courseKey, studentCourseData], idx) => {
                          // studentCourseData should be the student's object under a course:
                          // { teacherName: "...", semester1: { assessments: {...} }, semester2: { ... } }
                          const data = studentCourseData?.[activeSemester];
                          if (!data) return null;

                          const assessments = data.assessments || {};
                          const total = Object.values(assessments).reduce(
                            (sum, a) => sum + (a.score || 0),
                            0
                          );
                          const maxTotal = Object.values(assessments).reduce(
                            (sum, a) => sum + (a.max || 0),
                            0
                          );
                          const percentage = maxTotal ? (total / maxTotal) * 100 : 0;

                          const statusClr =
                            percentage >= 75
                              ? "#16a34a"
                              : percentage >= 50
                                ? "#f59e0b"
                                : "#dc2626";

                          // Format course name nicely
                          const courseName = courseKey
                            .replace("course_", "")
                            .replace(/_/g, " ")
                            .toUpperCase();

                          return (
                            <div
                              key={`${courseKey}-${idx}`}
                              style={{
                                padding: "18px",
                                borderRadius: "20px",
                                background: "#ffffff",
                                boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                              }}
                            >
                              {/* Course Name */}
                              <div
                                style={{
                                  fontSize: "16px",
                                  fontWeight: "800",
                                  marginBottom: "14px",
                                  color: "#2563eb",
                                  textAlign: "center",
                                }}
                              >
                                {courseName}
                              </div>

                              {/* Score Circle */}
                              <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                                <div
                                  style={{
                                    width: "90px",
                                    height: "90px",
                                    borderRadius: "50%",
                                    background: `conic-gradient(${statusClr} ${percentage * 3.6}deg, #e5e7eb 0deg)`,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "66px",
                                      height: "66px",
                                      borderRadius: "50%",
                                      background: "#fff",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <strong style={{ color: statusClr }}>{total}</strong>
                                    <span style={{ fontSize: "11px" }}>/ {maxTotal}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Assessment Bars */}
                              {Object.entries(assessments).map(([key, a]) => (
                                <div key={key} style={{ marginBottom: "10px" }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      fontSize: "13px",
                                      fontWeight: "600",
                                    }}
                                  >
                                    <span>{a.name}</span>
                                    <span>
                                      {a.score} / {a.max}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      height: "6px",
                                      borderRadius: "999px",
                                      background: "#e5e7eb",
                                      marginTop: "5px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${(a.score / a.max) * 100}%`,
                                        height: "100%",
                                        background: statusClr,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}

                              {/* Status */}
                              <div
                                style={{
                                  marginTop: "10px",
                                  textAlign: "center",
                                  fontWeight: "700",
                                  color: statusClr,
                                }}
                              >
                                {percentage >= 75
                                  ? "Excellent"
                                  : percentage >= 50
                                    ? "Good"
                                    : "Needs Improvement"}
                              </div>

                              {/* Teacher Name */}
                              <div
                                style={{
                                  marginTop: "6px",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}
                              >
                                👨‍🏫 {studentCourseData.teacherName || data.teacherName || "N/A"}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
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
                    background: "linear-gradient(135deg, #833ab4, #0259fa, #459afc)",
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
              {/* Chat Popup */}
              {chatOpen && selectedStudent && (
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
                    <strong>{selectedStudent.name}</strong>

                    <div style={{ display: "flex", gap: "10px" }}>
                      {/* Expand */}
                      <button
                        onClick={() => {
                          setChatOpen(false); // properly close popup
                          navigate("/all-chat", {
                            state: {
                              user: selectedStudent, // user to auto-select
                              tab: "student", // tab type
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
                        Start chatting with {selectedStudent.name}
                      </p>
                    ) : (
                      messages.map((m) => {
                        const isTeacher = String(m.senderId) === String(teacher?.userId);

                        return (
                          <div key={m.messageId || m.id} style={{ display: "flex", flexDirection: "column", alignItems: isTeacher ? "flex-end" : "flex-start", marginBottom: 10 }}>
                            <div
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
                                cursor: "default",
                                position: "relative",
                              }}
                            >
                              {m.text} {m.edited && <small style={{ fontSize: 10 }}> (edited)</small>}

                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 6, fontSize: 11, color: isTeacher ? "#fff" : "#888" }}>
                                <span style={{ marginRight: 6, fontSize: 11, opacity: 0.9 }}>{formatDateLabel(m.timeStamp)}</span>
                                <span>{formatTime(m.timeStamp)}</span>
                                {isTeacher && !m.deleted && (
                                  <span style={{ display: "flex", gap: 0, alignItems: 'center' }}>
                                    <FaCheck size={12} color={isTeacher ? "#fff" : "#888"} style={{ opacity: 0.85, marginLeft: 6 }} />
                                    {m.seen && <FaCheck size={12} color={isTeacher ? "#f3f7f8" : "#ccc"} style={{ marginLeft: 2, opacity: 0.95 }} />}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                        borderRadius: "25px",
                        border: "1px solid #ccc",
                        outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                    />
                    <button
                      onClick={() => sendMessage()}
                      style={{
                        width: 45,
                        height: 45,
                        borderRadius: "50%",
                        background: "#4facfe",
                        border: "none",
                        color: "#fff",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <FaPaperPlane />
                    </button>
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

export default StudentsPage;