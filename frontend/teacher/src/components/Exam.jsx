import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, set, get, child, update } from "firebase/database";
// --- Curriculum creation initial state ---
const initialChapter = { id: "", title: "", contentUrl: "", hasExam: false, order: 1 };

const initialQuestion = {
  question: "",
  options: { A: "", B: "", C: "", D: "" },
  correct: "A",
  points: 1,
  explanation: "",
};

const Exam = () => {
  // Curriculum creation state and handlers (moved inside component)
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [newGrade, setNewGrade] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newChapters, setNewChapters] = useState([{ ...initialChapter }]);
  const [curriculumSaving, setCurriculumSaving] = useState(false);
  const [curriculumSuccess, setCurriculumSuccess] = useState("");
  const [curriculumError, setCurriculumError] = useState("");

  const handleChapterChange = (idx, field, value) => {
    setNewChapters((prev) => {
      const updated = [...prev];
      updated[idx][field] = value;
      return updated;
    });
  };
  const addChapter = () => setNewChapters((prev) => [...prev, { ...initialChapter, order: prev.length + 1 }]);
  const removeChapter = (idx) => {
    if (newChapters.length === 1) return;
    setNewChapters((prev) => prev.filter((_, i) => i !== idx));
  };

  // Exam state and handlers
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalQuestions, setTotalQuestions] = useState(1);
  const [passScore, setPassScore] = useState(1);
  const [published, setPublished] = useState(false);
  const [questions, setQuestions] = useState([{ ...initialQuestion }]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [curriculumOptions, setCurriculumOptions] = useState([]); // grades
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [chapterOptions, setChapterOptions] = useState([]);

  // Fetch grades from Curriculum
  const fetchCurriculum = async () => {
    try {
      const snapshot = await get(ref(db, "Curriculum"));
      const data = snapshot.val() || {};
      setCurriculumOptions(Object.keys(data));
    } catch {
      setCurriculumOptions([]);
    }
  };
  useEffect(() => { fetchCurriculum(); }, []);

  const handleCreateCurriculum = async (e) => {
    e.preventDefault();
    setCurriculumSaving(true);
    setCurriculumSuccess("");
    setCurriculumError("");
    try {
      if (!newGrade || !newSubject) throw new Error("Grade and Subject required");
      const gradeKey = newGrade.startsWith("grade_") ? newGrade : `grade_${newGrade}`;
      const chaptersObj = {};
      newChapters.forEach((ch, i) => {
        if (!ch.id) throw new Error("Each chapter must have an ID");
        chaptersObj[ch.id] = {
          ...ch,
          order: i + 1,
        };
      });
      await update(ref(db, `Curriculum/${gradeKey}/${newSubject}`), {
        subjectName: newSubject,
        totalChapters: newChapters.length,
        chapters: chaptersObj,
      });
      setCurriculumSuccess("Curriculum created/updated successfully!");
      setNewGrade("");
      setNewSubject("");
      setNewChapters([{ ...initialChapter }]);
      await fetchCurriculum(); // Refresh dropdowns after curriculum change
    } catch (err) {
      setCurriculumError(err.message || "Failed to create curriculum");
    } finally {
      setCurriculumSaving(false);
    }
  };

  // Fetch subjects for selected grade
  useEffect(() => {
    if (!grade) { setSubjectOptions([]); setSubject(""); return; }
    async function fetchSubjects() {
      try {
        const snapshot = await get(child(ref(db), `Curriculum/${grade}`));
        const data = snapshot.val() || {};
        setSubjectOptions(Object.keys(data));
      } catch { setSubjectOptions([]); }
    }
    fetchSubjects();
  }, [grade]);

  // Fetch chapters for selected grade+subject
  useEffect(() => {
    if (!grade || !subject) { setChapterOptions([]); setChapterId(""); return; }
    async function fetchChapters() {
      try {
        const snapshot = await get(child(ref(db), `Curriculum/${grade}/${subject}/chapters`));
        const data = snapshot.val() || {};
        const chapters = Object.entries(data).map(([id, val]) => ({ id, title: val.title || id }));
        setChapterOptions(chapters);
      } catch { setChapterOptions([]); }
    }
    fetchChapters();
  }, [grade, subject]);

  const handleQuestionChange = (idx, field, value) => {
    setQuestions((prev) => {
      const updated = [...prev];
      if (field === "options") {
        updated[idx].options = { ...updated[idx].options, ...value };
      } else {
        updated[idx][field] = value;
      }
      return updated;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...initialQuestion }]);
    setTotalQuestions((n) => n + 1);
  };

  const removeQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setTotalQuestions((n) => n - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      if (!grade || !subject || !chapterId) throw new Error("Grade, Subject, and Chapter are required");
      const examKey = `${subject}_${grade}`;
      const questionsObj = {};
      questions.forEach((q, i) => {
        questionsObj[`q_${String(i + 1).padStart(3, "0")}`] = q;
      });
      await set(ref(db, `Exams/${examKey}/${chapterId}`), {
        durationMinutes: Number(durationMinutes),
        totalQuestions: Number(totalQuestions),
        passScore: Number(passScore),
        published,
        questions: questionsObj,
        examId: `${examKey}_${chapterId}`,
      });
      setSuccess("Exam saved successfully!");
    } catch (err) {
      setError(err.message || "Failed to save exam");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        .exam-pro {
          width: 100vw;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background: linear-gradient(120deg, #f8fafc 60%, #e3f0fc 100%);
          border-radius: 0;
          box-shadow: none;
          font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
          animation: fadeInExam 0.7s cubic-bezier(.4,0,.2,1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
        }
        @keyframes fadeInExam {
          from { opacity: 0; transform: translateY(40px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        .exam-section-title {
          font-size: 2.4rem;
          font-weight: 900;
          margin-bottom: 28px;
          color: #0d133d;
          letter-spacing: 0.7px;
          text-shadow: 0 2px 12px #e3e7ed;
        }
        .exam-form-group {
          margin-bottom: 26px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .exam-label {
          font-weight: 700;
          color: #28384a;
          font-size: 1.13rem;
        }
        .exam-input, .exam-select {
          padding: 12px 16px;
          border: 2px solid #b0bec5;
          border-radius: 8px;
          font-size: 1.13rem;
          background: #f4f8fb;
          transition: border 0.2s, box-shadow 0.2s;
        }
        .exam-input:focus, .exam-select:focus {
          border: 2.5px solid #1976d2;
          outline: none;
          box-shadow: 0 0 0 3px #90caf9;
        }
        .exam-button {
          background: linear-gradient(90deg, #1976d2 60%, #42a5f5 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 14px 32px;
          font-size: 1.18rem;
          font-weight: 800;
          cursor: pointer;
          margin-top: 12px;
          box-shadow: 0 3px 14px rgba(25, 118, 210, 0.13);
          transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
        }
        .exam-button:hover:not(:disabled) {
          background: linear-gradient(90deg, #1565c0 60%, #1976d2 100%);
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 7px 24px rgba(25, 118, 210, 0.16);
        }
        .exam-button:disabled {
          background: #b0bec5;
          cursor: not-allowed;
        }
        .exam-success {
          color: #388e3c;
          font-weight: 700;
          margin-top: 14px;
          font-size: 1.13rem;
        }
        .exam-error {
          color: #d32f2f;
          font-weight: 700;
          margin-top: 14px;
          font-size: 1.13rem;
        }
        .exam-question-card {
          border: 2px solid #e3e7ed;
          border-radius: 14px;
          padding: 26px 22px;
          margin-bottom: 28px;
          background: #f9fbfd;
          box-shadow: 0 4px 16px rgba(44,62,80,0.09);
          transition: box-shadow 0.22s, border 0.18s;
          animation: fadeInExam 0.6s cubic-bezier(.4,0,.2,1);
        }
        .exam-question-card:hover {
          box-shadow: 0 10px 32px rgba(44,62,80,0.13);
          border: 2.5px solid #90caf9;
        }
        .exam-question-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 800;
          color: #1976d2;
          margin-bottom: 14px;
          font-size: 1.18rem;
        }
        .exam-options-row {
          display: flex;
          gap: 16px;
          margin-top: 8px;
        }
        .exam-remove-btn {
          color: #d32f2f;
          background: none;
          border: none;
          font-weight: 800;
          cursor: pointer;
          margin-left: 14px;
          font-size: 1.11rem;
          transition: color 0.15s, text-decoration 0.15s;
        }
        .exam-remove-btn:hover {
          color: #b71c1c;
          text-decoration: underline;
        }
      `}</style>
      <div className="exam-pro">
      <h2 className="exam-section-title">Create or Edit Curriculum</h2>
      <button type="button" className="exam-button" onClick={() => setShowCurriculumForm((v) => !v)} style={{ marginBottom: 18 }}>
        {showCurriculumForm ? "Hide Curriculum Form" : "Show Curriculum Form"}
      </button>
      {showCurriculumForm && (
        <form onSubmit={handleCreateCurriculum} style={{ border: "1px solid #bbb", borderRadius: 8, padding: 18, marginBottom: 32 }}>
          <div className="exam-form-group">
            <label className="exam-label">Grade: </label>
            <input className="exam-input" value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="e.g. 7" required />
          </div>
          <div className="exam-form-group">
            <label className="exam-label">Subject: </label>
            <input className="exam-input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. mathematics" required />
          </div>
          <h4>Chapters</h4>
          {newChapters.map((ch, idx) => (
            <div key={idx} className="exam-question-card">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label className="exam-label">ID: </label>
                <input className="exam-input" value={ch.id} onChange={e => handleChapterChange(idx, "id", e.target.value)} placeholder="chapter_01" required style={{ width: 110 }} />
                <label className="exam-label">Title: </label>
                <input className="exam-input" value={ch.title} onChange={e => handleChapterChange(idx, "title", e.target.value)} placeholder="Chapter Title" required style={{ width: 180 }} />
                <label className="exam-label">PDF URL: </label>
                <input className="exam-input" value={ch.contentUrl} onChange={e => handleChapterChange(idx, "contentUrl", e.target.value)} placeholder="PDF URL" style={{ width: 180 }} />
                <label className="exam-label">Has Exam: </label>
                <input type="checkbox" checked={!!ch.hasExam} onChange={e => handleChapterChange(idx, "hasExam", e.target.checked)} />
                <button type="button" className="exam-remove-btn" onClick={() => removeChapter(idx)}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="exam-button" onClick={addChapter} style={{ marginBottom: 12 }}>Add Chapter</button>
          <div>
            <button type="submit" className="exam-button" disabled={curriculumSaving}>{curriculumSaving ? "Saving..." : "Save Curriculum"}</button>
          </div>
          {curriculumSuccess && <div className="exam-success">{curriculumSuccess}</div>}
          {curriculumError && <div className="exam-error">{curriculumError}</div>}
        </form>
      )}

      <h2 className="exam-section-title">Create Exam</h2>
      <form onSubmit={handleSubmit}>
        <div className="exam-form-group">
          <label className="exam-label">Grade: </label>
          <select className="exam-select" value={grade} onChange={e => setGrade(e.target.value)} required>
            <option value="">Select Grade</option>
            {curriculumOptions.map((g) => (
              <option key={g} value={g}>{g.replace('grade_', 'Grade ')}</option>
            ))}
          </select>
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Subject: </label>
          <select className="exam-select" value={subject} onChange={e => setSubject(e.target.value)} required disabled={!grade}>
            <option value="">Select Subject</option>
            {subjectOptions.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Chapter: </label>
          <select className="exam-select" value={chapterId} onChange={e => setChapterId(e.target.value)} required disabled={!subject}>
            <option value="">Select Chapter</option>
            {chapterOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.id})</option>
            ))}
          </select>
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Duration (minutes): </label>
          <input className="exam-input" type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} min={1} required />
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Total Questions: </label>
          <input className="exam-input" type="number" value={totalQuestions} onChange={e => setTotalQuestions(e.target.value)} min={1} required />
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Pass Score: </label>
          <input className="exam-input" type="number" value={passScore} onChange={e => setPassScore(e.target.value)} min={1} required />
        </div>
        <div className="exam-form-group">
          <label className="exam-label">Published: </label>
          <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
        </div>

        <h3 className="exam-section-title" style={{ fontSize: '1.3rem', marginTop: 24 }}>Questions</h3>
        {questions.map((q, idx) => (
          <div key={idx} className="exam-question-card">
            <div className="exam-question-header">
              <span>Question {idx + 1}</span>
              {questions.length > 1 && (
                <button type="button" className="exam-remove-btn" onClick={() => removeQuestion(idx)}>Remove</button>
              )}
            </div>
            <div className="exam-form-group">
              <label className="exam-label">Question: </label>
              <input className="exam-input" value={q.question} onChange={e => handleQuestionChange(idx, "question", e.target.value)} required />
            </div>
            <div className="exam-form-group">
              <label className="exam-label">Options:</label>
              <div className="exam-options-row">
                {Object.keys(q.options).map(opt => (
                  <span key={opt}>
                    {opt}: <input className="exam-input" value={q.options[opt]} onChange={e => handleQuestionChange(idx, "options", { [opt]: e.target.value })} required style={{ width: 80 }} />
                  </span>
                ))}
              </div>
            </div>
            <div className="exam-form-group">
              <label className="exam-label">Correct Option: </label>
              <select className="exam-select" value={q.correct} onChange={e => handleQuestionChange(idx, "correct", e.target.value)}>
                {Object.keys(q.options).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="exam-form-group">
              <label className="exam-label">Points: </label>
              <input className="exam-input" type="number" value={q.points} min={1} onChange={e => handleQuestionChange(idx, "points", e.target.value)} required style={{ width: 60 }} />
            </div>
            <div className="exam-form-group">
              <label className="exam-label">Explanation: </label>
              <input className="exam-input" value={q.explanation} onChange={e => handleQuestionChange(idx, "explanation", e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="exam-button" onClick={addQuestion} style={{ marginBottom: 18 }}>Add Question</button>
        <div>
          <button type="submit" className="exam-button" disabled={saving}>{saving ? "Saving..." : "Save Exam"}</button>
        </div>
        {success && <div className="exam-success">{success}</div>}
        {error && <div className="exam-error">{error}</div>}
      </form>
    </div>

    </>
  );
}

export default Exam;
