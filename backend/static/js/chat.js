document.addEventListener('DOMContentLoaded', function () {
    const coursesContainer = document.getElementById('coursesContainer');
    const floatingChat = document.getElementById('floatingChat');
    const chatStudentName = document.getElementById('chatStudentName');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const closeFloatingChat = document.getElementById('closeFloatingChat');

    let currentStudentId = null;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Add chat buttons to each student row
    function addChatButtons() {
        const rows = coursesContainer.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            if (tr.querySelector('.chat-btn')) return;

            const chatBtn = document.createElement('button');
            chatBtn.textContent = '💬';
            chatBtn.classList.add('chat-btn');
            chatBtn.style.marginLeft = '5px';
            chatBtn.addEventListener('click', () => openChat(tr));

            const lastTd = tr.querySelector('td:last-child');
            lastTd.appendChild(chatBtn);
        });
    }

    // Open chat box
    function openChat(tr) {
        const studentName = tr.querySelector('td:first-child').textContent;
        currentStudentId = tr.querySelector('[data-student]').dataset.student;

        chatStudentName.textContent = `Chat with ${studentName}`;
        chatMessages.innerHTML = '';
        floatingChat.classList.remove('hidden');
        floatingChat.classList.remove('minimized');

        loadMessages(currentStudentId);
    }

    // Close chat box
    closeFloatingChat.addEventListener('click', () => {
        floatingChat.classList.add('hidden');
        currentStudentId = null;
    });

    // Minimize/restore chat by clicking header
    chatStudentName.parentElement.addEventListener('dblclick', () => {
        floatingChat.classList.toggle('minimized');
    });

    // Send message
    sendChatBtn.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (!text || !currentStudentId) return;

        appendMessage('You', text);
        chatInput.value = '';

        // TODO: send message to backend/Firestore
    });

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-message');
        msgDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function loadMessages(studentId) {
        // TODO: fetch previous messages
    }

    // Drag functionality
    const header = floatingChat.querySelector('.chat-header');
    header.addEventListener('mousedown', e => {
        if (floatingChat.classList.contains('minimized')) return;
        isDragging = true;
        dragOffsetX = e.clientX - floatingChat.offsetLeft;
        dragOffsetY = e.clientY - floatingChat.offsetTop;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging) return;
        floatingChat.style.left = `${e.clientX - dragOffsetX}px`;
        floatingChat.style.top = `${e.clientY - dragOffsetY}px`;
        floatingChat.style.bottom = 'auto';
        floatingChat.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.userSelect = 'auto';
    });

    // Observe dynamically added students
    const observer = new MutationObserver(addChatButtons);
    observer.observe(coursesContainer, { childList: true, subtree: true });
});
