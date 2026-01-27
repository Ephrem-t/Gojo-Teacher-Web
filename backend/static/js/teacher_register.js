document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('teacherForm');
    const coursesContainer = document.getElementById('coursesContainer');
    const addCourseBtn = document.getElementById('addCourseBtn');

    // Fetch taken subjects for a given grade & section
    async function fetchTakenSubjects(grade, section) {
        try {
            const res = await fetch(`/teachers/subjects/${grade}/${section}`);
            const data = await res.json();
            return data.takenSubjects || [];
        } catch (err) {
            console.error('Error fetching taken subjects:', err);
            return [];
        }
    }

    // Update subjects options in a row based on grade & section
    async function updateSubjects(row) {
        const grade = row.querySelector('.grade').value;
        const section = row.querySelector('.section').value;
        const subjectSelect = row.querySelector('.subject');

        const takenSubjects = await fetchTakenSubjects(grade, section);

        Array.from(subjectSelect.options).forEach(option => {
            option.disabled = takenSubjects.includes(option.value);
        });

        // Also disable subjects selected in other rows
        const otherRows = Array.from(coursesContainer.querySelectorAll('.course-row')).filter(r => r !== row);
        otherRows.forEach(r => {
            const otherSubject = r.querySelector('.subject').value;
            const opt = Array.from(subjectSelect.options).find(o => o.value === otherSubject);
            if (opt) opt.disabled = true;
        });
    }

    // Attach change event to grade & section selects
    function attachChangeEvents(row) {
        row.querySelector('.grade').addEventListener('change', () => updateSubjects(row));
        row.querySelector('.section').addEventListener('change', () => updateSubjects(row));
        row.querySelector('.subject').addEventListener('change', () => {
            // Update all rows to reflect the new selection
            Array.from(coursesContainer.querySelectorAll('.course-row')).forEach(r => updateSubjects(r));
        });
    }

    // Initialize existing rows
    Array.from(coursesContainer.querySelectorAll('.course-row')).forEach(row => {
        attachChangeEvents(row);
        updateSubjects(row);
    });

    // Add new course row
    addCourseBtn.addEventListener('click', () => {
        const newRow = coursesContainer.firstElementChild.cloneNode(true);
        newRow.querySelectorAll('select').forEach(sel => sel.value = sel.options[0].value);
        coursesContainer.appendChild(newRow);
        attachChangeEvents(newRow);
        updateSubjects(newRow);
    });

    // Remove course row
    window.removeCourse = function(el) {
        if (coursesContainer.children.length > 1) {
            el.parentElement.remove();
            // Update subjects in all remaining rows
            Array.from(coursesContainer.querySelectorAll('.course-row')).forEach(r => updateSubjects(r));
        } else {
            alert("At least one course is required.");
        }
    }

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const name = document.getElementById('name').value;
        const password = document.getElementById('password').value;

        // Collect all courses
        const courseRows = document.querySelectorAll('.course-row');
        const courses = Array.from(courseRows).map(row => ({
            grade: row.querySelector('.grade').value,
            section: row.querySelector('.section').value,
            subject: row.querySelector('.subject').value
        }));

        const data = { username, name, password, courses };

        try {
            const res = await fetch('/register/teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            alert(result.message);

            if (result.success) {
                form.reset();
                // Keep one default row after reset
                const container = document.getElementById('coursesContainer');
                container.innerHTML = container.firstElementChild.outerHTML;
                // Re-attach events
                Array.from(container.querySelectorAll('.course-row')).forEach(row => {
                    attachChangeEvents(row);
                    updateSubjects(row);
                });
            }
        } catch (err) {
            console.error('Error registering teacher:', err);
        }
    });
});

