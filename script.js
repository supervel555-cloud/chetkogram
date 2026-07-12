const authScreen = document.getElementById("authScreen");
const app = document.getElementById("app");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginUsernameInput = document.getElementById("loginUsernameInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");

const registerUsernameInput = document.getElementById("registerUsernameInput");
const registerDisplayNameInput = document.getElementById("registerDisplayNameInput");
const registerPasswordInput = document.getElementById("registerPasswordInput");

const authError = document.getElementById("authError");

const currentUserName = document.getElementById("currentUserName");
const logoutBtn = document.getElementById("logoutBtn");

const newChatUsernameInput = document.getElementById("newChatUsernameInput");
const createChatBtn = document.getElementById("createChatBtn");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const messageForm = document.getElementById("messageForm");
const searchInput = document.getElementById("searchInput");
const chatHeader = document.getElementById("chatHeader");
const chatList = document.getElementById("chatList");

// Элементы модального окна группы
const groupModal = document.getElementById("groupModal");
const createGroupBtn = document.getElementById("createGroupBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelGroupBtn = document.getElementById("cancelGroupBtn");
const groupForm = document.getElementById("groupForm");
const groupNameInput = document.getElementById("groupNameInput");
const groupMembersInput = document.getElementById("groupMembersInput");
const groupError = document.getElementById("groupError");

// Контейнер для уведомлений
const notificationContainer = document.getElementById("notificationContainer");

// Элементы настроек
const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");
const notificationsToggle = document.getElementById("notificationsToggle");
const requestNotificationBtn = document.getElementById("requestNotificationBtn");

let currentUser = null;
let currentChatId = null;
let chats = [];

// Храним последнее сообщение для каждого чата для отслеживания новых
let lastMessageMap = {};

// Разрешение на уведомления (системное)
let notificationPermission = false;
// Включены ли уведомления (пользовательский переключатель)
let notificationsEnabled = true;
let isFirstLoad = true; // флаг для первого запуска

// Загружаем настройки из localStorage
function loadSettings() {
    const saved = localStorage.getItem("chekcogram_settings");
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            notificationsEnabled = settings.notificationsEnabled !== undefined ? settings.notificationsEnabled : true;
        } catch (e) {}
    }
    notificationsToggle.checked = notificationsEnabled;
}

// Сохраняем настройки в localStorage
function saveSettings() {
    const settings = {
        notificationsEnabled: notificationsEnabled
    };
    localStorage.setItem("chekcogram_settings", JSON.stringify(settings));
}

// Запрос разрешения на уведомления (по клику)
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("Ваш браузер не поддерживает уведомления");
        return;
    }
    if (Notification.permission === "granted") {
        notificationPermission = true;
        alert("Уведомления уже разрешены");
        return;
    }
    if (Notification.permission === "denied") {
        alert("Уведомления запрещены. Пожалуйста, разрешите их в настройках браузера.");
        return;
    }
    Notification.requestPermission().then(function(permission) {
        if (permission === "granted") {
            notificationPermission = true;
            alert("Уведомления включены!");
        } else {
            alert("Разрешение не получено");
        }
    });
}

// Показать уведомление (системное или внутреннее), если включены
function showNotification(text) {
    if (!notificationsEnabled) {
        return; // пользователь выключил уведомления
    }
    // Если есть системные уведомления и разрешение получено
    if (notificationPermission && "Notification" in window) {
        try {
            const notification = new Notification("📨 Chetkogram", {
                body: text,
                icon: ""
            });
            setTimeout(function() {
                notification.close();
            }, 3000);
            return;
        } catch (e) {}
    }

    // Внутреннее уведомление (запасной вариант)
    const notification = document.createElement("div");
    notification.className = "notification";

    const content = document.createElement("div");
    content.className = "notification-content";
    content.innerHTML = `<strong>📨 Chetkogram</strong> ${text}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "notification-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", function () {
        notification.remove();
    });

    notification.appendChild(content);
    notification.appendChild(closeBtn);
    notificationContainer.appendChild(notification);

    setTimeout(function () {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Переключение меню настроек
settingsBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    settingsMenu.classList.toggle("hidden");
});

// Закрытие меню при клике вне его
document.addEventListener("click", function(e) {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
        settingsMenu.classList.add("hidden");
    }
});

// Обработчик переключателя уведомлений
notificationsToggle.addEventListener("change", function() {
    notificationsEnabled = this.checked;
    saveSettings();
});

// Кнопка запроса разрешения
requestNotificationBtn.addEventListener("click", function() {
    requestNotificationPermission();
});


function showLoginForm() {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    showLoginBtn.classList.add("active");
    showRegisterBtn.classList.remove("active");
    authError.textContent = "";
}

function showRegisterForm() {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    showRegisterBtn.classList.add("active");
    showLoginBtn.classList.remove("active");
    authError.textContent = "";
}

function saveCurrentUser(user) {
    currentUser = user;
    sessionStorage.setItem("currentUser", JSON.stringify(user));
}

function getSavedUser() {
    const savedUser = sessionStorage.getItem("currentUser");
    return savedUser ? JSON.parse(savedUser) : null;
}

function showMessenger() {
    authScreen.classList.add("hidden");
    app.classList.remove("hidden");
    currentUserName.textContent = currentUser.display_name;
}

function showAuthScreen() {
    app.classList.add("hidden");
    authScreen.classList.remove("hidden");
}

async function login(username, password) {
    const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) {
        authError.textContent = data.error || "Ошибка входа";
        return;
    }
    saveCurrentUser(data);
    showMessenger();
    await loadChats();
}

async function register(username, displayName, password) {
    const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, display_name: displayName, password })
    });
    const data = await response.json();
    if (!response.ok) {
        authError.textContent = data.error || "Ошибка регистрации";
        return;
    }
    saveCurrentUser(data);
    showMessenger();
    await loadChats();
}

async function loadChats() {
    if (!currentUser) return;
    const oldChatId = currentChatId;
    const response = await fetch(`/api/chats?user_id=${currentUser.id}`);
    const newChats = await response.json();
    const oldChats = chats;
    chats = newChats;

    if (isFirstLoad) {
        chats.forEach(chat => {
            lastMessageMap[chat.id] = chat.last_message || null;
        });
        isFirstLoad = false;
    } else {
        chats.forEach(chat => {
            const oldLast = lastMessageMap[chat.id] || null;
            const newLast = chat.last_message;
            if (oldLast !== newLast && newLast !== null) {
                if (chat.id !== currentChatId) {
                    showNotification(`Новое сообщение в чате "${chat.title}"`);
                }
                lastMessageMap[chat.id] = newLast;
            }
        });
    }

    if (chats.length === 0) {
        currentChatId = null;
        chatHeader.innerHTML = "<h3>Чатов нет</h3>";
        messages.innerHTML = "";
        renderChats();
        return;
    }

    const oldChatStillExists = chats.some(chat => chat.id === oldChatId);
    currentChatId = oldChatStillExists ? oldChatId : chats[0].id;
    const currentChat = chats.find(chat => chat.id === currentChatId);
    chatHeader.innerHTML = `<h3>${currentChat.title}</h3>`;
    renderChats();
    await loadMessages();
}

function renderChats() {
    chatList.innerHTML = "";
    const searchText = searchInput.value.toLowerCase();
    chats.forEach(chat => {
        if (!chat.title.toLowerCase().includes(searchText)) return;
        const chatElement = document.createElement("div");
        chatElement.classList.add("chat-item");
        if (chat.id === currentChatId) chatElement.classList.add("active");
        const titleElement = document.createElement("div");
        titleElement.classList.add("chat-name");
        titleElement.textContent = chat.title;
        const lastMessageElement = document.createElement("div");
        lastMessageElement.classList.add("chat-last-message");
        lastMessageElement.textContent = chat.last_message || "Нет сообщений";
        chatElement.appendChild(titleElement);
        chatElement.appendChild(lastMessageElement);
        chatElement.addEventListener("click", async function () {
            currentChatId = chat.id;
            chatHeader.innerHTML = `<h3>${chat.title}</h3>`;
            renderChats();
            await loadMessages();
        });
        chatList.appendChild(chatElement);
    });
}

async function loadMessages() {
    if (!currentChatId || !currentUser) return;
    const response = await fetch(`/api/messages?chat_id=${currentChatId}&user_id=${currentUser.id}`);
    const chatMessages = await response.json();
    renderMessages(chatMessages);
}

function renderMessages(chatMessages) {
    messages.innerHTML = "";
    chatMessages.forEach(msg => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("message-wrapper", msg.sender_type === "me" ? "me" : "other");
        const sender = document.createElement("div");
        sender.classList.add("message-sender");
        sender.textContent = msg.sender_type === "me" ? "Вы" : (msg.sender_name || "Неизвестный");
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", msg.sender_type === "me" ? "me" : "other");
        messageElement.textContent = msg.text;
        wrapper.appendChild(sender);
        wrapper.appendChild(messageElement);
        messages.appendChild(wrapper);
    });
    messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatId || !currentUser) return;
    const savedChatId = currentChatId;
    await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: savedChatId, user_id: currentUser.id, text })
    });
    messageInput.value = "";
    currentChatId = savedChatId;
    await loadChats();
    await loadMessages();
}

async function createChat() {
    const username = newChatUsernameInput.value.trim();
    if (!username) { alert("Введи username собеседника"); return; }
    const usersResponse = await fetch("/api/users");
    const users = await usersResponse.json();
    const otherUser = users.find(u => u.username === username);
    if (!otherUser) { alert("Пользователь не найден"); return; }
    if (otherUser.id === currentUser.id) { alert("Нельзя создать чат с самим собой"); return; }
    const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, other_user_id: otherUser.id })
    });
    const data = await response.json();
    if (!response.ok) { alert(data.error || "Ошибка создания чата"); return; }
    newChatUsernameInput.value = "";
    currentChatId = data.id;
    await loadChats();
}

function showGroupModal() {
    groupModal.classList.remove("hidden");
    groupNameInput.value = "";
    groupMembersInput.value = "";
    groupError.textContent = "";
}

function hideGroupModal() {
    groupModal.classList.add("hidden");
}

async function createGroup() {
    const name = groupNameInput.value.trim();
    const membersStr = groupMembersInput.value.trim();
    if (!name) { groupError.textContent = "Введите название группы"; return; }
    if (!membersStr) { groupError.textContent = "Введите username участников через запятую"; return; }
    const usernames = membersStr.split(",").map(s => s.trim()).filter(s => s);
    if (usernames.length === 0) { groupError.textContent = "Введите хотя бы одного участника"; return; }
    const usersResponse = await fetch("/api/users");
    const allUsers = await usersResponse.json();
    const userMap = {};
    allUsers.forEach(u => userMap[u.username] = u.id);
    const missing = usernames.filter(u => !(u in userMap));
    if (missing.length) { groupError.textContent = `Пользователи не найдены: ${missing.join(", ")}`; return; }
    const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, name, usernames })
    });
    const data = await response.json();
    if (!response.ok) { groupError.textContent = data.error || "Ошибка создания группы"; return; }
    hideGroupModal();
    currentChatId = data.id;
    await loadChats();
}

function logout() {
    sessionStorage.removeItem("currentUser");
    currentUser = null;
    currentChatId = null;
    chats = [];
    lastMessageMap = {};
    isFirstLoad = true;
    chatList.innerHTML = "";
    messages.innerHTML = "";
    chatHeader.innerHTML = "<h3>Выбери чат</h3>";
    showAuthScreen();
}

// Обработчики событий
showLoginBtn.addEventListener("click", showLoginForm);
showRegisterBtn.addEventListener("click", showRegisterForm);

loginForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    if (!username || !password) { authError.textContent = "Введи username и пароль"; return; }
    await login(username, password);
});

registerForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const username = registerUsernameInput.value.trim();
    const displayName = registerDisplayNameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    if (!username || !displayName || !password) { authError.textContent = "Заполни все поля"; return; }
    await register(username, displayName, password);
});

logoutBtn.addEventListener("click", logout);
createChatBtn.addEventListener("click", createChat);
createGroupBtn.addEventListener("click", showGroupModal);
closeModalBtn.addEventListener("click", hideGroupModal);
cancelGroupBtn.addEventListener("click", hideGroupModal);
window.addEventListener("click", function(e) { if (e.target === groupModal) hideGroupModal(); });
groupForm.addEventListener("submit", async function(e) { e.preventDefault(); await createGroup(); });
messageForm.addEventListener("submit", async function(e) { e.preventDefault(); await sendMessage(); });
searchInput.addEventListener("input", renderChats);

async function startApp() {
    loadSettings(); // загружаем настройки
    const savedUser = getSavedUser();
    if (!savedUser) { showAuthScreen(); return; }
    currentUser = savedUser;
    showMessenger();
    await loadChats();
    // Проверяем, есть ли уже разрешение
    if ("Notification" in window && Notification.permission === "granted") {
        notificationPermission = true;
    }
}

startApp();

setInterval(async function() {
    if (currentUser && currentChatId !== null) {
        await loadChats();
    }
}, 3000);