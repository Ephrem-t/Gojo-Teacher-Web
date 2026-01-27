document.addEventListener('DOMContentLoaded', async function() {
    const teacherId = localStorage.getItem('teacherId');

    if (!teacherId) {
        window.location.href = '/';
        return;
    }

    const coursesContainer = document.getElementById('coursesContainer');
    const logoutBtn = document.getElementById('logoutBtn');

    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('teacherId');
        window.location.href = '/';
    });

    // Fetch teacher courses
    let courses = [];
    try {
        const res = await fetch(`/api/teacher/${teacherId}/courses`);
        courses = await res.json();
    } catch (err) {
        console.error('Error fetching courses:', err);
        coursesContainer.innerHTML = '<p>Failed to load courses.</p>';
        return;
    }

    if (!courses.courses || courses.courses.length === 0) {
        coursesContainer.innerHTML = '<p>No courses assigned yet.</p>';
        return;
    }

    // Display courses
    courses.courses.forEach(course => {
        const courseDiv = document.createElement('div');
        courseDiv.classList.add('course-block');

        courseDiv.innerHTML = `
            <h4>${course.subject} - Grade ${course.grade} Section ${course.section}</h4>
            <table class="students-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Username</th>
                        <th>20%</th>
                        <th>30%</th>
                        <th>50%</th>
                        <th>Total</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="tbody-${course.grade}-${course.section}"></tbody>
            </table>
        `;
        coursesContainer.appendChild(courseDiv);

        loadStudents(course);
    });

    async function loadStudents(course) {
        const tbody = document.getElementById(`tbody-${course.grade}-${course.section}`);
        tbody.innerHTML = '<tr><td colspan="7">Loading students...</td></tr>';

        try {
            const courseId = `course_${course.subject.toLowerCase()}_${course.grade}${course.section.toUpperCase()}`;
            const res = await fetch(`/api/course/${courseId}/students`);
            const data = await res.json();

            if (!data.students || data.students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">No students found for this course.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            data.students.forEach(student => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.username}</td>
                    <td><input type="number" min="0" max="20" value="${student.marks.mark20 > 0 ? student.marks.mark20 : ''}" data-mark="mark20" data-student="${student.studentId}"></td>
                    <td><input type="number" min="0" max="30" value="${student.marks.mark30 > 0 ? student.marks.mark30 : ''}" data-mark="mark30" data-student="${student.studentId}"></td>
                    <td><input type="number" min="0" max="50" value="${student.marks.mark50 > 0 ? student.marks.mark50 : ''}" data-mark="mark50" data-student="${student.studentId}"></td>
                    <td class="total">${calculateTotal(student.marks)}</td>
                    <td><button class="save-student-btn" data-student="${student.studentId}" data-course="${courseId}">Save</button></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading students:', err);
            tbody.innerHTML = '<tr><td colspan="7">Failed to load students.</td></tr>';
        }
    }

    function calculateTotal(marks) {
        const m20 = Number(marks.mark20 || 0);
        const m30 = Number(marks.mark30 || 0);
        const m50 = Number(marks.mark50 || 0);
        return m20 + m30 + m50;
    }

    // Update total live as marks are entered
    coursesContainer.addEventListener('input', function(e) {
        if (e.target.tagName.toLowerCase() !== 'input') return;
        const tr = e.target.closest('tr');
        if (!tr) return;

        const marks = {
            mark20: Number(tr.querySelector('[data-mark="mark20"]').value || 0),
            mark30: Number(tr.querySelector('[data-mark="mark30"]').value || 0),
            mark50: Number(tr.querySelector('[data-mark="mark50"]').value || 0)
        };

        tr.querySelector('.total').textContent = calculateTotal(marks);
    });

    // Save individual student marks
    coursesContainer.addEventListener('click', async function(e) {
        if (!e.target.classList.contains('save-student-btn')) return;

        const studentId = e.target.dataset.student;
        const courseId = e.target.dataset.course;
        const tr = e.target.closest('tr');

        const marks = {
            mark20: Number(tr.querySelector('[data-mark="mark20"]').value || 0),
            mark30: Number(tr.querySelector('[data-mark="mark30"]').value || 0),
            mark50: Number(tr.querySelector('[data-mark="mark50"]').value || 0)
        };

        try {
            const res = await fetch(`/api/course/${courseId}/update-marks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ studentId, marks }] })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Marks saved for ${tr.querySelector('td').textContent}!`);
                tr.querySelector('.total').textContent = calculateTotal(marks);
            } else {
                alert('Failed to save marks.');
            }
        } catch (err) {
            console.error('Error saving marks:', err);
            alert('Error saving marks.');
        }
    });
});
