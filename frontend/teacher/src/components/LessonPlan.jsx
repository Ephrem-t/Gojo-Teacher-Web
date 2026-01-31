import React, { useEffect, useState,useRef } from "react";
import axios from "axios";

import { FaHome, FaFileAlt, FaUpload, FaCog, FaSignOutAlt, FaSearch, FaBell, FaUsers, FaClipboardCheck, FaChalkboardTeacher, FaFacebookMessenger, FaPlus, FaTrash, FaSave, FaChevronDown, FaChevronUp, FaChevronLeft, FaChevronRight, FaCalendarAlt, FaCheckCircle, FaClock } from "react-icons/fa";
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
const emptyDay = () => ({ dayName: "", topic: "", method: "", aids: "", assessment: "" });
const [days, setDays] = useState([]); // allow teacher to add days dynamically
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
  const [dailyPlans, setDailyPlans] = useState([]);
  const [submittedKeys, setSubmittedKeys] = useState([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;

  const dayOrder = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  useEffect(() => {
    if (!teacher) return setDailyPlans([]);

    const todayIndex = new Date().getDay();
    const plans = [];

    annualRows.forEach((r, ri) => {
      const weekDays = Array.isArray(r.weekDays) ? r.weekDays : (Array.isArray(r.days) ? r.days : []);
      weekDays.forEach((d, di) => {
        const dayName = (d.dayName || d.name || '').toString().trim();
        const key = `${teacher.userId}::${selectedCourseId || 'nocourse'}::${r.week || ri}::${dayName || di}`;
        const submitted = submittedKeys.includes(key);
        const lname = (dayName || '').toLowerCase();
        const scheduledIndex = lname && dayOrder.hasOwnProperty(lname) ? dayOrder[lname] : null;
        const status = submitted ? 'submitted' : (scheduledIndex !== null && scheduledIndex < todayIndex ? 'missed' : 'pending');
        plans.push({ key, dayName: dayName || `Day ${di+1}`, topic: d.topic || r.topic || '', week: r.week, status, scheduledIndex });
      });
    });

    // show only plans scheduled for today
    const plansForToday = plans.filter(p => p.scheduledIndex === todayIndex);
    setDailyPlans(plansForToday);
  }, [annualRows, selectedCourseId, teacher, submittedKeys]);

  // Fetch previously submitted daily plans from backend
  // fetchSubmissions is callable so we can re-run after a submit to confirm DB write
  const fetchSubmissions = async () => {
    if (!teacher || !teacher.userId || !selectedCourseId) return;
    try {
      const res = await axios.get(`${API_BASE}/lesson-plans/submissions`, {
        params: { teacherId: teacher.userId, courseId: selectedCourseId, academicYear: '2025/26' }
      });
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        const keys = res.data.data.map(s => s.key).filter(Boolean);
        setSubmittedKeys(keys);
        return keys;
      }
    } catch (err) {
      console.warn('Could not fetch submissions from API, will rely on local cache', err?.message || err);
    }
    return [];
  };

  useEffect(() => {
    fetchSubmissions();
  }, [teacher, selectedCourseId]);

  // Ensure submissions are fetched after lesson plan rows load so sidebar can render statuses
  useEffect(() => {
    if (!teacher || !teacher.userId || !selectedCourseId) return;
    if (!annualRows || annualRows.length === 0) return;
    // fetch submissions to populate submittedKeys used by sidebar
    fetchSubmissions().catch(() => {});
  }, [teacher, selectedCourseId, annualRows]);

  // Derive current/selected week plan for the sidebar (moved below normalizeWeekDays)

  const handleSubmitPlan = async (plan) => {
    // plan is object with key and status, week, dayName
    if (!plan) return;
    if (plan.status === 'missed') {
      alert('Cannot submit a lesson for a day that has already passed.');
      return;
    }

    // prevent duplicate submits
    if (submittedKeys.includes(plan.key)) {
      setDailyPlans((prev) => prev.map(p => p.key === plan.key ? { ...p, status: 'submitted' } : p));
      return;
    }

    try {
      const payload = {
        teacherId: teacher.userId,
        courseId: selectedCourseId,
        academicYear: '2025/26',
        week: plan.week,
        dayName: plan.dayName,
        key: plan.key,
        submittedAt: new Date().toISOString(),
      };

      const res = await axios.post(`${API_BASE}/lesson-plans/submit-daily`, payload);
      if (res?.data && res.data.success) {
        // refetch submissions from server to confirm storage
        await fetchSubmissions();
        setDailyPlans((prev) => prev.map(p => p.key === plan.key ? { ...p, status: 'submitted' } : p));
      } else {
        const serverMsg = res?.data?.message || JSON.stringify(res?.data) || 'Submission failed';
        throw new Error(serverMsg);
      }
    } catch (err) {
      console.error('Submit daily plan failed:', err);
      // fallback to local cache so teacher doesn't lose submit state
      try {
        localStorage.setItem(plan.key, 'submitted');
        setSubmittedKeys((prev) => [...prev, plan.key]);
        setDailyPlans((prev) => prev.map(p => p.key === plan.key ? { ...p, status: 'submitted' } : p));
        alert('Unable to reach server; saved locally. Submission marked locally.');
      } catch (e) {
        alert('Failed to submit daily plan. Please try again.');
      }
    }
  };


// Refs for posts (for scrolling/highlighting)
const postRefs = useRef({});
  const teacherUserId = teacher?.userId; // safe access
  const tableContainerRef = useRef(null);

  const scrollTableBy = (direction = 1, amount = 400) => {
    const el = tableContainerRef.current;
    if (!el) return;
    try {
      el.scrollBy({ left: direction * amount, behavior: 'smooth' });
    } catch (e) {
      // fallback
      el.scrollLeft = el.scrollLeft + direction * amount;
    }
  };

  // ---------------- Load Logged-In Teacher ----------------
  useEffect(() => {
    const storedTeacher = JSON.parse(localStorage.getItem("teacher"));
    if (!storedTeacher) {
      navigate("/login");
      return;
    }
    setTeacher(storedTeacher);
  }, []);

  // Fetch saved lesson plans for the selected course once teacher and course are set
  useEffect(() => {
    const fetchLessonPlans = async () => {
      if (!teacher || !teacher.userId || !selectedCourseId) return;
      setIsLoadingPlans(true);
      setAnnualRows([]);
      try {
        const res = await axios.get(`${API_BASE}/lesson-plans/${teacher.userId}`, {
          params: { academicYear: '2025/26', courseId: selectedCourseId }
        });

        if (res.data && res.data.success) {
          const data = res.data.data || {};

          // Try to read annualRows saved under data.annual.annualRows or data.annualRows
          let annualStored = null;
          if (data.annual && Array.isArray(data.annual.annualRows)) annualStored = data.annual.annualRows;
          else if (Array.isArray(data.annualRows)) annualStored = data.annualRows;

          if (Array.isArray(annualStored) && annualStored.length > 0) {
            setAnnualRows(normalizeAnnualRows(annualStored));
            // ensure we fetch submission statuses after loading the plan
            try { await fetchSubmissions(); } catch (e) { /* ignore */ }
          } else {
            // if no annualRows, look for week_x entries and build preview rows
            const built = buildRowsFromData(data);
            if (built.length) setAnnualRows(normalizeAnnualRows(built));
            else setAnnualRows([]);
            // fetch submissions after attempting to build rows
            try { await fetchSubmissions(); } catch (e) { /* ignore */ }
          }
        }
      } catch (err) {
        console.error('Error fetching lesson plans:', err);
        setAnnualRows([]);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchLessonPlans();
  }, [teacher, selectedCourseId]);

  // Fetch courses assigned to this teacher (from Firebase REST API)
  useEffect(() => {
    if (!teacher) return;

    const fetchCourses = async () => {
      try {
        const base = 'https://ethiostore-17d9f-default-rtdb.firebaseio.com';
        const [coursesRes, assignmentsRes, teachersRes] = await Promise.all([
          axios.get(`${base}/Courses.json`),
          axios.get(`${base}/TeacherAssignments.json`),
          axios.get(`${base}/Teachers.json`),
        ]);

        const teacherKeyEntry = Object.entries(teachersRes.data || {}).find(([key, t]) => t.userId === teacher.userId);
        if (!teacherKeyEntry) return;
        const teacherKey = teacherKeyEntry[0];

        const teacherAssignments = Object.values(assignmentsRes.data || {}).filter(a => a.teacherId === teacherKey);

        const teacherCourses = teacherAssignments.map(a => ({ id: a.courseId, ...(coursesRes.data ? coursesRes.data[a.courseId] : {}) }));

        setCourses(teacherCourses);
        if (!selectedCourseId && teacherCourses.length) setSelectedCourseId(teacherCourses[0].id);
      } catch (err) {
        console.error('Error fetching courses for lesson plan:', err);
      }
    };

    fetchCourses();
  }, [teacher]);

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

  const defaultWeekDays = () => ([]);

  const normalizeAnnualRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      month: r.month || "",
      week: r.week || r.weekNumber || "",
      days: r.weekDays || r.days || r.daysList || "",
      topic: r.topic || r.weekTopic || "",
      objective: r.objective || r.goals || "",
      method: r.method || r.methods || "",
      material: r.aids || r.material || r.materials || "",
      assessment: r.assessment || r.assess || "",
    }));
  };

  const normalizeWeekDays = (input) => {
    if (!input) return [];

    // If it's already an array of day objects
    if (Array.isArray(input)) {
      return input.map(d => ({
        dayName: d.dayName || d.name || d.day || d.label || "",
        topic: d.topic || d.subject || d.title || "",
        method: d.method || d.methods || "",
        aids: d.aids || d.material || d.materials || d.aid || "",
        assessment: d.assessment || d.assess || d.evaluation || "",
      }));
    }

    // If stored as an object keyed by day names
    if (typeof input === 'object') {
      return Object.keys(input).map(key => {
        const val = input[key] || {};
        if (typeof val === 'string') {
          return { dayName: key, topic: val, method: '', aids: '', assessment: '' };
        }
        return {
          dayName: val.dayName || val.name || key,
          topic: val.topic || val.subject || '',
          method: val.method || val.methods || '',
          aids: val.aids || val.material || '',
          assessment: val.assessment || val.assess || '',
        };
      });
    }

    return [];
  };

  // Derive current/selected week plan for the sidebar
  const currentWeekIndex = typeof selectedWeek === 'number' ? selectedWeek : (annualRows && annualRows.length ? 0 : null);
  const currentWeekPlan = (currentWeekIndex !== null && annualRows[currentWeekIndex]) ? annualRows[currentWeekIndex] : null;
  const currentWeekDays = currentWeekPlan ? normalizeWeekDays(currentWeekPlan.weekDays || currentWeekPlan.days || []) : [];

  // Monthly grouping: group annualRows by month
  const monthlyGroups = React.useMemo(() => {
    const map = {};
    (annualRows || []).forEach((r) => {
      const m = (r.month || 'Unspecified').toString();
      if (!map[m]) map[m] = [];
      map[m].push(r);
    });
    return map;
  }, [annualRows]);

  const getScheduledIndex = (dayName) => {
    if (!dayName) return null;
    const lname = (dayName || '').toString().toLowerCase();
    return dayOrder.hasOwnProperty(lname) ? dayOrder[lname] : null;
  };

  const buildSubmissionKey = (weekVal, dayName, dayIdx) => {
    return `${teacher?.userId || 'anon'}::${selectedCourseId || 'nocourse'}::${weekVal || currentWeekIndex || 0}::${(dayName || dayIdx)}`;
  };

  const getDayStatus = (day, di) => {
    const todayIndex = new Date().getDay();
    const scheduledIndex = getScheduledIndex(day.dayName || '')
    const key = buildSubmissionKey(currentWeekPlan?.week || currentWeekIndex, day.dayName, di);
    const submitted = submittedKeys.includes(key);
    if (submitted) return { status: 'submitted', key };
    if (scheduledIndex !== null && scheduledIndex < todayIndex) return { status: 'missed', key };
    return { status: 'pending', key };
  };

  // Sidebar summary counts
  const weekStats = React.useMemo(() => {
    const stats = { submitted: 0, missed: 0, pending: 0, total: 0 };
    (currentWeekDays || []).forEach((d, i) => {
      const ds = getDayStatus(d, i);
      stats[ds.status] = (stats[ds.status] || 0) + 1;
      stats.total += 1;
    });
    return stats;
  }, [currentWeekDays, submittedKeys]);

  const todayStats = React.useMemo(() => {
    const stats = { submitted: 0, missed: 0, pending: 0, total: 0 };
    (dailyPlans || []).forEach((p) => {
      const s = p.status || 'pending';
      stats[s] = (stats[s] || 0) + 1;
      stats.total += 1;
    });
    return stats;
  }, [dailyPlans, submittedKeys]);

  const monthlyCount = React.useMemo(() => Object.values(monthlyGroups || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0), [monthlyGroups]);

  const monthlyStats = React.useMemo(() => {
    const map = {};
    Object.entries(monthlyGroups || {}).forEach(([month, rows]) => {
      const stats = { submitted: 0, missed: 0, pending: 0, total: 0, topics: [] };
      (rows || []).forEach((r) => {
        const weekDays = Array.isArray(r.weekDays) ? r.weekDays : Array.isArray(r.days) ? r.days : [];
        const days = normalizeWeekDays(weekDays || []);
        days.forEach((d, di) => {
          const scheduledIndex = getScheduledIndex(d.dayName || '');
          const todayIndex = new Date().getDay();
          const key = buildSubmissionKey(r.week || currentWeekIndex, d.dayName, di);
          const submitted = submittedKeys.includes(key);
          if (submitted) stats.submitted += 1;
          else if (scheduledIndex !== null && scheduledIndex < todayIndex) stats.missed += 1;
          else stats.pending += 1;
          stats.total += 1;
        });
        if (r.topic) stats.topics.push(r.topic);
      });
      map[month] = stats;
    });
    return map;
  }, [monthlyGroups, submittedKeys, annualRows]);

  const renderSidebarContent = () => {
    if (sidebarTab === 'daily') {
      return (
        <div className="space-y-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-semibold">Today's Plan</h3>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#666' }}>Today</div>
              <div style={{ fontWeight: 700 }}>{todayStats.total}</div>
            </div>
          </div>

          {(dailyPlans && dailyPlans.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dailyPlans.map((p, idx) => {
                const status = p.status || 'pending';
                const color = status === 'submitted' ? '#2f855a' : status === 'missed' ? '#c53030' : '#4a5568';
                return (
                  <div key={p.key || idx} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, background: '#fff', boxShadow: '0 4px 10px rgba(11,20,30,0.04)', alignItems: 'center' }}>
                    <div style={{ width: 8, height: 48, borderRadius: 6, background: color }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{p.dayName || `Plan ${idx + 1}`}</div>
                        <div style={{ fontSize: 12, color: '#666' }}>Week: {p.week || '-'}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>{p.topic || 'No topic provided'}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Quick note: {p.note || p.description || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <div style={{ background: color, color: '#fff', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}</div>
                      {status === 'pending' ? (
                        <button onClick={() => handleSubmitPlan(p)} className="btn btn-primary" style={{ padding: '6px 10px', borderRadius: 8 }}>Submit</button>
                      ) : status === 'missed' ? (
                        <button className="btn" disabled style={{ padding: '6px 10px', borderRadius: 8, background: '#c53030', color: '#fff' }}>Missed</button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#666' }}>No plans for today.</div>
          )}
        </div>
      );
    }

    if (sidebarTab === 'weekly') {
      return (
        <div className="sidebar-week-list">
          <h3 className="font-semibold">Week Plan</h3>
          {(currentWeekDays || []).map((d, i) => {
            const ds = getDayStatus(d, i);
            const status = ds.status;
            const statusColor = status === 'submitted' ? '#2f855a' : status === 'missed' ? '#c53030' : '#4a5568';
            const cardBg = status === 'submitted' ? '#d9f8d5' : status === 'missed' ? '#ffe4e4' : '#ffffff';
              return (
              <div key={i} className={`sidebar-week-card ${status}`} style={{ display: 'flex', gap: 22, color: '#333', padding: 12, borderRadius: 10, background: cardBg, alignItems: 'center', boxShadow: '0 6px 14px rgba(11,20,30,0.04)' }}>
                <div style={{ width: 10, height: 46, borderRadius: 6, background: status === 'submitted' ? 'linear-gradient(180deg,#9ae6b4,#2f855a)' : status === 'missed' ? 'linear-gradient(180deg,#feb2b2,#c53030)' : 'linear-gradient(180deg,#e2e8f0,#4a5568)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{d.dayName || `Day ${i+1}`}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{currentWeekPlan?.week ? `Week ${currentWeekPlan.week}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#333', marginTop: 6 }}>{d.topic || currentWeekPlan?.topic || 'No topic set'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ background: statusColor, color: '#fff', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{status === 'submitted' ? 'Submitted' : status === 'missed' ? 'Missed' : 'Pending'}</div>
                  {status === 'pending' && (
                    <button onClick={() => handleSubmitPlan({ key: ds.key, week: currentWeekPlan?.week, dayName: d.dayName, status })} className="btn btn-primary" style={{ padding: '6px 10px', borderRadius: 8 }}>Submit</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // monthly
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">Monthly</h3>
        {Object.keys(monthlyGroups).length === 0 && <div className="text-xs text-gray-500">No monthly data.</div>}
        {Object.entries(monthlyGroups).map(([month, rows]) => {
          const s = monthlyStats[month] || { total: 0, submitted: 0, missed: 0, pending: 0, topics: [] };
          const pct = s.total ? Math.round((s.submitted / s.total) * 100) : 0;
          return (
            <div key={month} style={{ padding: 12, borderRadius: 10, background: '#fff', boxShadow: '0 6px 14px rgba(12,20,30,0.04)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{month}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{rows.length} week(s) • {s.total} day(s)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#666' }}>Completed</div>
                  <div style={{ fontWeight: 700 }}>{pct}%</div>
                </div>
              </div>

              <div style={{ height: 8, background: '#edf2f7', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#67e8f9,#4b6cb7)' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#2f855a' }}>Submitted: <strong>{s.submitted}</strong></div>
                  <div style={{ fontSize: 12, color: '#c53030' }}>Missed: <strong>{s.missed}</strong></div>
                  <div style={{ fontSize: 12, color: '#4a5568' }}>Pending: <strong>{s.pending}</strong></div>
                </div>
              </div>

              {s.topics && s.topics.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Topics this month</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {s.topics.slice(0, 3).map((t, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#333' }}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const buildRowsFromData = (data) => {
    const built = [];
    Object.keys(data).forEach((k) => {
      if (k.startsWith('week_')) {
        const w = data[k] || {};
        built.push({
          month: w.month || '',
          week: w.week || k.replace('week_', ''),
          days: w.days || w.weekDays || [],
          topic: w.weekTopic || w.topic || '',
          objective: w.objective || '',
          method: w.method || '',
          material: w.aids || w.material || '',
          assessment: w.assessment || '',
        });
      }
    });
    return built;
  };

  const addDay = (atIndex = null) => {
    if (atIndex === null) setDays([...days, emptyDay()]);
    else setDays([...days.slice(0, atIndex), emptyDay(), ...days.slice(atIndex)]);
  };

  const removeDay = (index) => {
    setDays(days.filter((_, i) => i !== index));
  };

  const removeAnnualRow = (rowIndex) => {
    const updated = annualRows.filter((_, i) => i !== rowIndex);
    setAnnualRows(updated);

    // update expandedWeeks: remove the deleted index, shift down indices > deleted
    const newExpanded = expandedWeeks
      .filter((i) => i !== rowIndex)
      .map((i) => (i > rowIndex ? i - 1 : i));
    setExpandedWeeks(newExpanded);

    // update selectedWeek if necessary
    if (selectedWeek === rowIndex) setSelectedWeek(null);
    else if (typeof selectedWeek === 'number' && selectedWeek > rowIndex) setSelectedWeek(selectedWeek - 1);
  };

  const handleSaveAnnualPlan = async () => {
    try {
      const payload = {
        teacherId: teacher.userId,
        courseId: selectedCourseId,
        academicYear: "2025/26",
        annualRows,
      };

      const res = await axios.post(`${API_BASE}/lesson-plans/save-annual`, payload);
      console.info('Save annual response:', res?.data || res);
      alert('Annual plan saved successfully!');
    } catch (err) {
      console.error('Save annual error:', err);
      let msg = 'Failed to save annual plan';
      if (err.response) msg += ` — ${err.response.status}: ${JSON.stringify(err.response.data)}`;
      else if (err.request) msg += ' — no response (network/CORS)';
      else if (err.message) msg += ` — ${err.message}`;
      alert(msg);
    }
  };



 

  const headers = [
    "Month",
    "Week",
    "Day",
    "Sub Topic",
    "Method",
    "Materials",
    "Assessment",
    "Week Topic",
    "Week Objective",
  ];

  // Build flattened rows
  const rows = [];
  annualRows.forEach((r) => {
    const weekDays = Array.isArray(r.weekDays)
      ? r.weekDays
      : Array.isArray(r.days)
      ? r.days
      : [];

    if (weekDays.length) {
      weekDays.forEach((d) => {
        rows.push([
          r.month || "",
          r.week || "",
          d.dayName || "",
          d.topic || "",
          d.method || "",
          d.aids || "",
          d.assessment || "",
          r.topic || "",
          r.objective || "",
        ]);
      });
    } else {
      rows.push([
        r.month || "",
        r.week || "",
        "",
        r.topic || "",
        r.method || "",
        r.aids || "",
        r.assessment || "",
        r.topic || "",
        r.objective || "",
      ]);
    }
  });





  const openWeekPlan = (rowIndex) => {
    const row = annualRows[rowIndex] || {};
    setSelectedWeek(rowIndex);
    setWeekTopic(row.topic || "");

    const applyDays = (wd) => {
      setDays(Array.isArray(wd) && wd.length ? wd : defaultWeekDays());
    };

    // If weekDays already present on the row, use them. Otherwise fetch from backend.
    if (row.weekDays && Array.isArray(row.weekDays) && row.weekDays.length) {
      applyDays(row.weekDays);
    } else {
      // try fetching lesson plans for this teacher and extract the specific week
      (async () => {
        try {
          if (!teacher || !teacher.userId) return applyDays([]);
          const res = await axios.get(`${API_BASE}/lesson-plans/${teacher.userId}`, { params: { academicYear: '2025/26', courseId: selectedCourseId } });
          if (res.data && res.data.success) {
            const data = res.data.data || {};
            const weekKey = `week_${row.week || row.weekNumber || row.weekId || rowIndex}`;
            const w = data[weekKey] || (data.annual && Array.isArray(data.annual.week) ? {} : null);
            // prefer direct week entry, else try to find by matching week value
            let weekObj = null;
            if (data[weekKey]) weekObj = data[weekKey];
            else if (data.annual && data.annual.annualRows) {
              // if annual stored as rows, try find
              weekObj = data.annual.annualRows.find(r => String(r.week) === String(row.week));
            }

            if (weekObj) {
              const normalized = normalizeWeekDays(weekObj.days || weekObj.weekDays || weekObj.weekDays || []);
              applyDays(normalized);
              // also update local annualRows with fetched weekDays for future
              const updated = [...annualRows];
              updated[rowIndex] = { ...updated[rowIndex], weekDays: normalized };
              setAnnualRows(updated);
            } else {
              applyDays([]);
            }
          } else {
            applyDays([]);
          }
        } catch (err) {
          console.error('Error fetching week details:', err);
          applyDays([]);
        }
      })();
    }

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

  const mainWidth = sidebarOpen ? '50%' : '75%';

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
              {/* Rigid bottom arrows within lesson-main (do not move when table scrolls) */}
              <button aria-label="scroll-left-fixed" onClick={() => scrollTableBy(-1)} style={{position:'absolute', bottom:12, left:12, zIndex:120, width:44, height:44, borderRadius:22, border:'1px solid #ddd', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.15)'}}><FaChevronLeft /></button>
              <button aria-label="scroll-right-fixed" onClick={() => scrollTableBy(1)} style={{position:'absolute', bottom:12, right:12, zIndex:120, width:44, height:44, borderRadius:22, border:'1px solid #ddd', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.15)'}}><FaChevronRight /></button>

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
        <div className="lesson-main" style={{width: mainWidth, position: 'relative'}}>

  <div className="lesson-card-header">
  <div className="lesson-title">
    <h2>Annual Lesson Plan</h2>
    <p className="muted">Create your course roadmap — add rows, expand weeks and save.</p>
    {selectedCourse ? (
      <div className="course-info">
        <div className="course-name">{selectedCourse.title || selectedCourse.name || selectedCourse.subject || 'Selected Course'}</div>
        <div className="course-meta">
          {selectedCourse.grade && <span className="meta-badge">Grade {selectedCourse.grade}</span>}
          {selectedCourse.section && <span className="meta-badge">Section {selectedCourse.section}</span>}
          {selectedCourse.subject && <span className="meta-badge">{selectedCourse.subject}</span>}
          <span className="meta-badge">Academic Year: 2025/26</span>
        </div>
      </div>
    ) : (
      <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>Please select a course to view its lesson plan.</div>
    )}
  </div>
  <div style={{display:'flex',alignItems:'center',gap:12}}>
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:6}}>
      <label style={{fontSize:18,color:'#1f1818',fontWeight:600}}>Course</label>
      <select
        value={selectedCourseId}
        onChange={(e) => setSelectedCourseId(e.target.value)}
        style={{padding:'6px 10px',borderRadius:6,border:'1px solid #ddd',background:'#fff'}}
      >
        <option value="">-- Select Course --</option>
        {courses.map((c, i) => (
          <option key={c.id || i} value={c.id}>
            {c.title || c.name || c.subject || c.courseName || (`Course ${i+1}`)}
          </option>
        ))}
      </select>
    </div>
 
    <div style={{display:'flex',gap:8}}>
      <button onClick={handleSaveAnnualPlan} className="btn btn-success"><FaSave style={{marginRight:8}} />Save Annual</button>
     
      
    </div>
  </div>
</div>

  <div className="lesson-card" ref={tableContainerRef} style={{marginTop:16, overflowX:'auto'}}>

  {isLoadingPlans ? (
    <div style={{ padding: 24, textAlign: 'center' }}>Loading lesson plan for selected course...</div>
  ) : (
    <>
    

    <table className="lesson-table">
    <thead>
      <tr>
        {["Month", "Week", "Days", "Topic", "Objective", "Method", "Materials", "Assessment"].map((head) => (
          <th key={head}>{head}</th>
        ))}
      </tr>
    </thead>

    <tbody>
      {annualRows.map((row, index) => (
        <React.Fragment key={index}>
          <tr>
            {(() => {
              const fieldsOrder = ['month','week','days','topic','objective','method','material','assessment'];
              return fieldsOrder.map((field) => {
                if (field === 'week') {
                  return (
                    <td key={field} style={{ padding: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          className="input input-full"
                          value={row.week || ''}
                          onChange={(e) => {
                            const updated = [...annualRows];
                            updated[index].week = e.target.value;
                            setAnnualRows(updated);
                          }}
                        />
                        <button
                          onClick={() => toggleExpand(index)}
                          title={expandedWeeks.includes(index) ? 'Hide Days' : 'Add Days'}
                          aria-label={expandedWeeks.includes(index) ? 'Hide Days' : 'Add Days'}
                          className={"btn " + (expandedWeeks.includes(index) ? "btn-ghost" : "btn-primary")}
                          style={{ width: 36, height: 36, borderRadius: 18, padding: 0, display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                        >
                          {expandedWeeks.includes(index) ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                      </div>
                    </td>
                  );
                }

                if (field === 'days') {
                  const d = row.days || [];
                  const display = Array.isArray(d) ? d.map(x => x.dayName || x.name || '').filter(Boolean).join(', ') || `${d.length} day(s)` : String(d || '');
                  return (
                    <td key={field} style={{ padding: 8 }}>
                      <div className="muted-italic">{display}</div>
                    </td>
                  );
                }

                // other fields: use textarea for multi-line fields
                const largeFields = ['topic', 'objective', 'method', 'material', 'assessment', 'aids'];
                if (largeFields.includes(field)) {
                  return (
                    <td key={field} style={{ padding: 8 }}>
                      <textarea
                        className="input textarea-full"
                        rows={3}
                        value={row[field] || ''}
                        onChange={(e) => {
                          const updated = [...annualRows];
                          updated[index][field] = e.target.value;
                          setAnnualRows(updated);
                        }}
                      />
                    </td>
                  );
                }

                return (
                  <td key={field} style={{ padding: 8 }}>
                    <input
                      className="input input-full"
                      value={row[field] || ''}
                      onChange={(e) => {
                        const updated = [...annualRows];
                        updated[index][field] = e.target.value;
                        setAnnualRows(updated);
                      }}
                    />
                  </td>
                );
              });
            })()}
            

            <td style={{ border: "1px solid #000", padding: 5, textAlign: "center" }}>
              <button onClick={() => removeAnnualRow(index)} title="Remove Row" className="btn btn-danger"><FaTrash /></button>
            </td>
          </tr>

          {expandedWeeks.includes(index) && (
            <tr>
              <td colSpan={9} style={{ background: "#fafafa", padding: 12 }}>
                <div className="expand-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Daily Plan for Week {row.week || index}</strong>
                  
                  </div>

                 
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div />
                    <div style={{ flex: 1 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleSaveWeekPlan(index)} className="btn btn-primary">Save Week Plan</button>
                    
                    </div>
                  </div>

                  {days.length === 0 && (
                    <div className="muted" style={{ padding: 12 }}>No days yet. Click "Add Day" to create a day.</div>
                  )}

                  {/* Summary table above days */}
                  {days.length > 0 && (
                    <div style={{ overflowX: 'auto', marginTop: 6 }}>
                      <table className="mini-day-table" style={{ width: '100%', marginBottom: 10 }}>
                        <thead>
                          <tr style={{marginLeft: "220px", gap: "28px"}}>
                            <th>Day</th>
                            <th>Sub Topic</th>
                            <th>Method</th>
                            <th>Material</th>
                            <th>Assessment</th>
                          </tr>
                        </thead>
                       
                      </table>
                    </div>
                  )}

                  {days.map((day, di) => (
                    <div key={di} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        placeholder="Day name (e.g. Monday or Topic Day)"
                        value={days[di]?.dayName || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], dayName: e.target.value };
                          setDays(updated);
                        }}
                        className="input"
                        style={{ width: 140 }}
                      />
                      <input
                        placeholder="Topic"
                        value={days[di]?.topic || ""}
                        onChange={(e) => {
                          const updated = [...days];
                          updated[di] = { ...updated[di], topic: e.target.value };
                          setDays(updated);
                        }}
                        className="input input-full" style={{ width: 240 }}
                      />
                          <textarea
                            placeholder="Method"
                            value={days[di]?.method || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[di] = { ...updated[di], method: e.target.value };
                              setDays(updated);
                            }}
                            className="input small-textarea"
                            rows={2}
                            style={{ width: 240 }}
                          />
                          <textarea
                            placeholder="Aids"
                            value={days[di]?.aids || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[di] = { ...updated[di], aids: e.target.value };
                              setDays(updated);
                            }}
                            className="input small-textarea"
                            rows={2}
                            style={{ width: 240 }}
                          />
                          <textarea
                            placeholder="Assessment"
                            value={days[di]?.assessment || ""}
                            onChange={(e) => {
                              const updated = [...days];
                              updated[di] = { ...updated[di], assessment: e.target.value };
                              setDays(updated);
                            }}
                            className="input small-textarea"
                            rows={2}
                            style={{ width: 240 }}
                          />
                      <button onClick={() => removeDay(di)} title="Remove day" className="btn btn-danger"><FaTrash /></button>
                    
                    </div>
                    
                  ))}
                    <div>
                          <button onClick={() => addDay()} className="btn btn-primary" style={{marginLeft:1108, width: 100}} ><FaPlus style={{marginRight:1}}/>Add Day</button> </div>
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </tbody>
    </table>
      </>
  )}

  {!isLoadingPlans && annualRows.length === 0 && (
    <div style={{ padding: 16, color: '#666' }}>
      No lesson plan found for the selected course. Use "Add Row" to start creating one.
    </div>
  )}

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
    className="btn btn-primary"
    style={{ marginTop: 15 }}
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

    <div style={{ marginBottom: 12 }}>
      <button onClick={() => addDay()} className="btn btn-primary"><FaPlus style={{marginRight:8}}/>Add Day</button>
    </div>

    {days.length === 0 && (
      <div style={{ padding: 12, color: "#666" }}>No days yet. Click "Add Day" to create a day.</div>
    )}

    {days.map((day, index) => (
      <div key={index} style={{ borderBottom: "1px solid #eee", paddingBottom: 10, marginBottom: 10 }}>
        <input
          placeholder="Day name (e.g. Monday)"
          value={day.dayName}
          onChange={(e) => {
            const updated = [...days];
            updated[index].dayName = e.target.value;
            setDays(updated);
          }}
          style={{ marginBottom: 8, width: "100%" }}
        />

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

        <div style={{ marginTop: 8 }}>
          <button onClick={() => removeDay(index)} className="btn btn-danger"><FaTrash /></button>
        </div>
      </div>
    ))}

    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={handleSaveWeekPlan} className="btn btn-primary"><FaSave style={{marginRight:8}}/>Save Week Plan</button>
      
    </div>
  </div>
)}

          

       
          

        </div>

        <div className="right-sidebar" style={{ width: sidebarOpen ? '26%' : 48, padding: sidebarOpen ? 16 : 6, background: '#f7fafc', borderLeft: '1px solid #eee', display:'flex', flexDirection:'column', gap:12, transition: 'width 220ms ease' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {sidebarOpen ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          </div>

          {sidebarOpen && (
            <>
              <div style={{ background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 6px 18px rgba(14,30,37,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ background: '#eef2ff', padding: 8, borderRadius: 8 }}><FaCalendarAlt color="#4b6cb7" /></div>
                    <div>
                      <div style={{ fontWeight: 700 }}>Lesson Overview</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>This Week</div>
                      <div style={{ fontWeight: 700 }}>{weekStats.total}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1, background: '#f0fff4', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#2f855a' }}><FaCheckCircle /></div>
                    <div style={{ fontWeight: 700 }}>{weekStats.submitted}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Submitted</div>
                  </div>
                  <div style={{ flex: 1, background: '#fff7f7', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#c53030' }}><FaClock /></div>
                    <div style={{ fontWeight: 700 }}>{weekStats.missed}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Missed</div>
                  </div>
                  <div style={{ flex: 1, background: '#f7fafc', padding: 8, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#4a5568' }}>•</div>
                    <div style={{ fontWeight: 700 }}>{weekStats.pending}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Pending</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setSidebarTab('daily')} className={"btn " + (sidebarTab === 'daily' ? 'btn-primary' : 'btn-ghost')} style={{ flex: 1, borderRadius: 999 }}>Daily</button>
                <button onClick={() => setSidebarTab('weekly')} className={"btn " + (sidebarTab === 'weekly' ? 'btn-primary' : 'btn-ghost')} style={{ flex: 1, borderRadius: 999 }}>Weekly</button>
                <button onClick={() => setSidebarTab('monthly')} className={"btn " + (sidebarTab === 'monthly' ? 'btn-primary' : 'btn-ghost')} style={{ flex: 1, borderRadius: 999 }}>Monthly</button>
              </div>

              <div style={{ background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 6px 18px rgba(14,30,37,0.04)', overflowY: 'auto', maxHeight: '56vh' }}>
                {renderSidebarContent()}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: '#666' }}>Monthly entries: <strong>{monthlyCount}</strong></div>
                <div>
                  <button className="btn btn-ghost" onClick={() => { setSubmittedKeys([]); fetchSubmissions(); }}>Refresh</button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default TeacherNotesPage;
