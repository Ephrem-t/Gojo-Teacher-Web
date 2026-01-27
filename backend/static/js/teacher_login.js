document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const messageEl = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!username || !password) {
            messageEl.textContent = 'Please enter both username and password.';
            messageEl.style.color = 'red';
            return;
        }

        try {
            const res = await fetch('/login/teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success && data.teacherId) {
                // Store the correct teacherId (Teachers table key) for dashboard
                localStorage.setItem('teacherId', data.teacherId);
                window.location.href = '/teacher/dashboard';
            } else {
                messageEl.textContent = data.message || 'Login failed.';
                messageEl.style.color = 'red';
            }
        } catch (err) {
            console.error('Login error:', err);
            messageEl.textContent = 'An error occurred. Please try again.';
            messageEl.style.color = 'red';
        }
    });
});
