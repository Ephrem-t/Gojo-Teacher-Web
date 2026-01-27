document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("studentForm");
  const resultDiv = document.getElementById("result");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    resultDiv.innerHTML = "";

    const name = document.getElementById("name").value.trim();
    const password = document.getElementById("password").value;
    const grade = document.getElementById("grade").value;
    const section = document.getElementById("section").value;
    const email = (document.getElementById("email").value || "").trim();
    const phone = (document.getElementById("phone").value || "").trim();
    const dob = document.getElementById("dob").value || "";
    const gender = document.getElementById("gender").value || "";

    // Basic client-side checks
    if (!name || !password || !grade || !section) {
      alert("Please fill required fields.");
      return;
    }

    if (email) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email)) {
        alert("Please enter a valid email address or leave it empty.");
        return;
      }
    }

    const formData = new FormData();
    // Note: username omitted on purpose; server will set username = studentId
    formData.append("name", name);
    formData.append("password", password);
    formData.append("grade", grade);
    formData.append("section", section);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("dob", dob);
    formData.append("gender", gender);

    const fileInput = document.getElementById("profileImage");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      formData.append("profile", fileInput.files[0]);
    }

    try {
      const res = await fetch("/register/student", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        form.reset();
        // show assigned studentId to user
        const sid = data.studentId || "";
        resultDiv.innerHTML = `<div class="success">
          <strong>Registration successful.</strong><br>
          Assigned studentId (also used as username): <code>${sid}</code>
          <br>Please save this ID for login.
        </div>`;
      } else {
        alert(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      alert("Server error. Check console for details.");
    }
  });
});