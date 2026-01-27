document.getElementById("parentForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const formData = new FormData();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!name || !phone || !username || !password) {
        alert("Please fill all parent details");
        return;
    }

    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("username", username);
    formData.append("password", password);

    const studentInputs = document.querySelectorAll(".studentId");
    const relationshipInputs = document.querySelectorAll(".relationship");

    const seenStudents = new Set();

    for (let i = 0; i < studentInputs.length; i++) {
        const studentId = studentInputs[i].value.trim();
        const relationship = relationshipInputs[i].value;

        if (!studentId || !relationship) {
            alert("Please fill all student fields");
            return;
        }

        if (seenStudents.has(studentId)) {
            alert("Duplicate Student ID detected");
            return;
        }

        seenStudents.add(studentId);

        formData.append("studentId", studentId);
        formData.append("relationship", relationship);
    }

    const profile = document.getElementById("profile").files[0];
    if (profile) formData.append("profile", profile);

    fetch("/register/parent", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .then(res => {
            alert(res.message);
            if (res.success) {
                document.getElementById("parentForm").reset();
                document.getElementById("childrenContainer").innerHTML = `
                    <div class="child-row">
                        <label>Student ID</label>
                        <input type="text" name="studentId" class="studentId" required>

                        <label>Relationship</label>
                        <select name="relationship" class="relationship" required>
                            <option value="">Select</option>
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Guardian">Guardian</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                `;
            }
        })
        .catch(err => {
            console.error(err);
            alert("Registration failed. Try again.");
        });
});

// Add dynamic student input
document.getElementById("addStudent").addEventListener("click", function () {
    const container = document.getElementById("childrenContainer");

    const row = document.createElement("div");
    row.className = "child-row";

    row.innerHTML = `
        <label>Student ID</label>
        <input type="text" name="studentId" class="studentId" required>

        <label>Relationship</label>
        <select name="relationship" class="relationship" required>
            <option value="">Select</option>
            <option value="Father">Father</option>
            <option value="Mother">Mother</option>
            <option value="Guardian">Guardian</option>
            <option value="Other">Other</option>
        </select>
    `;

    container.appendChild(row);
});
