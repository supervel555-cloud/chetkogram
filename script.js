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

// Элементы настроек
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const notificationsToggle = document.getElementById("notificationsToggle");
const notificationsStatus = document.getElementById("notificationsStatus");
const requestPermissionBtn = document.getElementById("requestPermissionBtn");

// Элементы стикеров
const stickerBtn = document.getElementById("stickerBtn");
const stickerPanel = document.getElementById("stickerPanel");
const closeStickerBtn = document.getElementById("closeStickerBtn");
const stickerGrid = document.getElementById("stickerGrid");

// Контейнер для уведомлений
const notificationContainer = document.getElementById("notificationContainer");

let currentUser = null;
let currentChatId = null;
let chats = [];

// Храним последнее сообщение для каждого чата для отслеживания новых
let lastMessageMap = {};

// Разрешение на уведомления
let notificationPermission = false;
let notificationsEnabled = true; // по умолчанию включены

// Загружаем настройки из localStorage
function loadSettings() {
    const saved = localStorage.getItem("chetkogram_settings");
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            notificationsEnabled = settings.notificationsEnabled !== undefined ? settings.notificationsEnabled : true;
        } catch (e) {}
    }
    notificationsToggle.checked = notificationsEnabled;
    updateNotificationsStatus();
}

// Сохраняем настройки в localStorage
function saveSettings() {
    localStorage.setItem("chetkogram_settings", JSON.stringify({
        notificationsEnabled: notificationsEnabled
    }));
}

// Обновить текст статуса уведомлений
function updateNotificationsStatus() {
    notificationsStatus.textContent = notificationsEnabled ? "Включены" : "Выключены";
}

// Запрос разрешения на уведомления (только по клику)
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

// Показать уведомление (системное или внутреннее)
function showNotification(text) {
    if (!notificationsEnabled) return;

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
        } catch (e) {
            // fallback
        }
    }

    // Внутреннее уведомление
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

// --- Функции чатов и сообщений ---

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

// Удаление чата
async function deleteChat(chatId) {
    if (!confirm("Удалить этот чат?")) return;

    try {
        const response = await fetch(`/api/chats/${chatId}?user_id=${currentUser.id}`, {
            method: "DELETE"
        });
        if (!response.ok) {
            const data = await response.json();
            alert(data.error || "Ошибка удаления чата");
            return;
        }
        if (currentChatId === chatId) {
            currentChatId = null;
        }
        await loadChats();
    } catch (e) {
        alert("Ошибка сети");
    }
}

async function loadChats() {
    if (!currentUser) return;

    const oldChatId = currentChatId;
    const response = await fetch(`/api/chats?user_id=${currentUser.id}`);
    const newChats = await response.json();

    chats = newChats;

    let savedMap = null;
    try {
        const saved = sessionStorage.getItem(`lastMessageMap_${currentUser.id}`);
        if (saved) savedMap = JSON.parse(saved);
    } catch (e) {}

    if (!savedMap) {
        savedMap = {};
        chats.forEach(chat => {
            savedMap[chat.id] = {
                text: chat.last_message || null,
                sender_id: chat.last_sender_id || null
            };
        });
    } else {
        chats.forEach(chat => {
            if (!(chat.id in savedMap)) {
                savedMap[chat.id] = {
                    text: chat.last_message || null,
                    sender_id: chat.last_sender_id || null
                };
            }
        });
    }

    chats.forEach(chat => {
        const oldLast = savedMap[chat.id] || { text: null, sender_id: null };
        const newText = chat.last_message;
        const newSenderId = chat.last_sender_id;

        if (oldLast.text !== newText && newText !== null) {
            if (newSenderId !== currentUser.id && chat.id !== currentChatId) {
                showNotification(`Новое сообщение в чате "${chat.title}"`);
            }
            savedMap[chat.id] = { text: newText, sender_id: newSenderId };
        }
    });

    try {
        sessionStorage.setItem(`lastMessageMap_${currentUser.id}`, JSON.stringify(savedMap));
    } catch (e) {}
    lastMessageMap = savedMap;

    if (chats.length === 0) {
        currentChatId = null;
        chatHeader.innerHTML = "<h3>Чатов нет</h3>";
        messages.innerHTML = "";
        renderChats();
        return;
    }

    if (currentChatId !== null && !chats.some(chat => chat.id === currentChatId)) {
        currentChatId = null;
    }

    if (currentChatId === null) {
        currentChatId = chats[0].id;
    }

    const currentChat = chats.find(chat => chat.id === currentChatId);
    if (currentChat) {
        chatHeader.innerHTML = `<h3>${currentChat.title}</h3>`;
    } else {
        chatHeader.innerHTML = "<h3>Выбери чат</h3>";
    }

    renderChats();
    if (currentChatId) await loadMessages();
}

function renderChats() {
    chatList.innerHTML = "";
    const searchText = searchInput.value.toLowerCase();

    chats.forEach(chat => {
        const chatName = chat.title.toLowerCase();
        if (!chatName.includes(searchText)) return;

        const chatElement = document.createElement("div");
        chatElement.classList.add("chat-item");
        if (chat.id === currentChatId) chatElement.classList.add("active");

        const info = document.createElement("div");
        info.className = "chat-info";

        const titleElement = document.createElement("div");
        titleElement.className = "chat-name";
        titleElement.textContent = chat.title;

        const lastMessageElement = document.createElement("div");
        lastMessageElement.className = "chat-last-message";
        lastMessageElement.textContent = chat.last_message || "Нет сообщений";

        info.appendChild(titleElement);
        info.appendChild(lastMessageElement);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-chat-btn";
        deleteBtn.textContent = "✕";
        deleteBtn.title = "Удалить чат";
        deleteBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        chatElement.appendChild(info);
        chatElement.appendChild(deleteBtn);

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
    chatMessages.forEach(message => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("message-wrapper");
        if (message.sender_type === "me") wrapper.classList.add("me");
        else wrapper.classList.add("other");

        const sender = document.createElement("div");
        sender.classList.add("message-sender");
        sender.textContent = message.sender_type === "me" ? "Вы" : (message.sender_name || "Неизвестный");

        const messageElement = document.createElement("div");
        messageElement.classList.add("message");

        // Проверяем, является ли сообщение стикером (один эмодзи)
        const text = message.text.trim();
        const emojiRegex = /^[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{20E3}\u{0023}\u{002A}\u{0030}-\u{0039}\u{1F1E6}-\u{1F1FF}]+$/u;
        // также учтём простые эмодзи без вариаций
        const isSticker = text.match(emojiRegex) && text.length <= 4; // простой эмодзи или комбинация

        if (isSticker) {
            messageElement.classList.add("sticker");
            messageElement.textContent = text;
        } else {
            if (message.sender_type === "me") messageElement.classList.add("me");
            else messageElement.classList.add("other");
            messageElement.textContent = text;
        }

        wrapper.appendChild(sender);
        wrapper.appendChild(messageElement);
        messages.appendChild(wrapper);
    });
    messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(text) {
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
    currentChatId = savedChatId;
    await loadMessages();
}

async function createChat() {
    const username = newChatUsernameInput.value.trim();
    if (!username) {
        alert("Введи username собеседника");
        return;
    }

    const usersResponse = await fetch("/api/users");
    const users = await usersResponse.json();
    const otherUser = users.find(u => u.username === username);
    if (!otherUser) {
        alert("Пользователь не найден");
        return;
    }
    if (otherUser.id === currentUser.id) {
        alert("Нельзя создать чат с самим собой");
        return;
    }

    const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, other_user_id: otherUser.id })
    });
    const data = await response.json();
    if (!response.ok) {
        alert(data.error || "Ошибка создания чата");
        return;
    }
    newChatUsernameInput.value = "";
    currentChatId = data.id;
    await loadChats();
}

// === Функции для работы с группами ===
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
    if (!name) {
        groupError.textContent = "Введите название группы";
        return;
    }
    if (!membersStr) {
        groupError.textContent = "Введите username участников через запятую";
        return;
    }
    const usernames = membersStr.split(",").map(s => s.trim()).filter(s => s !== "");
    if (usernames.length === 0) {
        groupError.textContent = "Введите хотя бы одного участника";
        return;
    }

    const usersResponse = await fetch("/api/users");
    const allUsers = await usersResponse.json();
    const userMap = {};
    allUsers.forEach(u => userMap[u.username] = u.id);
    const missing = usernames.filter(u => !(u in userMap));
    if (missing.length > 0) {
        groupError.textContent = `Пользователи не найдены: ${missing.join(", ")}`;
        return;
    }

    const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, name, usernames })
    });
    const data = await response.json();
    if (!response.ok) {
        groupError.textContent = data.error || "Ошибка создания группы";
        return;
    }
    hideGroupModal();
    currentChatId = data.id;
    await loadChats();
}

// === Стикеры ===
let stickers = [];

async function loadStickers() {
    try {
        const response = await fetch("/api/stickers");
        if (response.ok) {
            stickers = await response.json();
        } else {
            stickers = [];
        }
    } catch (e) {
        stickers = [];
    }
    renderStickers();
}

function renderStickers() {
    stickerGrid.innerHTML = "";
    stickers.forEach(sticker => {
        const item = document.createElement("div");
        item.className = "sticker-item";
        item.textContent = sticker.emoji;
        item.title = sticker.name || "";
        item.addEventListener("click", function () {
            sendSticker(sticker.emoji);
        });
        stickerGrid.appendChild(item);
    });
}

function sendSticker(emoji) {
    if (!currentChatId || !currentUser) {
        alert("Сначала выберите чат");
        return;
    }
    sendMessage(emoji);
    closeStickerPanel();
}

function openStickerPanel() {
    stickerPanel.classList.remove("hidden");
}

function closeStickerPanel() {
    stickerPanel.classList.add("hidden");
}

// === Настройки ===
function openSettings() {
    settingsModal.classList.remove("hidden");
}

function closeSettings() {
    settingsModal.classList.add("hidden");
}

// === Выход ===
function logout() {
    sessionStorage.removeItem("currentUser");
    if (currentUser) {
        sessionStorage.removeItem(`lastMessageMap_${currentUser.id}`);
    }
    currentUser = null;
    currentChatId = null;
    chats = [];
    lastMessageMap = {};
    chatList.innerHTML = "";
    messages.innerHTML = "";
    chatHeader.innerHTML = "<h3>Выбери чат</h3>";
    showAuthScreen();
}

// --- Обработчики событий ---

showLoginBtn.addEventListener("click", showLoginForm);
showRegisterBtn.addEventListener("click", showRegisterForm);

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    if (!username || !password) {
        authError.textContent = "Введи username и пароль";
        return;
    }
    await login(username, password);
});

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const username = registerUsernameInput.value.trim();
    const displayName = registerDisplayNameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    if (!username || !displayName || !password) {
        authError.textContent = "Заполни username, имя и пароль";
        return;
    }
    await register(username, displayName, password);
});

logoutBtn.addEventListener("click", logout);

createChatBtn.addEventListener("click", createChat);
createGroupBtn.addEventListener("click", showGroupModal);
closeModalBtn.addEventListener("click", hideGroupModal);
cancelGroupBtn.addEventListener("click", hideGroupModal);

window.addEventListener("click", function (event) {
    if (event.target === groupModal) hideGroupModal();
    if (event.target === settingsModal) closeSettings();
    // Закрываем панель стикеров при клике вне её
    if (event.target === stickerPanel) closeStickerPanel();
});

groupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    await createGroup();
});

messageForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (text) {
        await sendMessage(text);
    }
});

searchInput.addEventListener("input", renderChats);

// Кнопка настроек
settingsBtn.addEventListener("click", openSettings);
closeSettingsBtn.addEventListener("click", closeSettings);

// Переключатель уведомлений
notificationsToggle.addEventListener("change", function () {
    notificationsEnabled = this.checked;
    saveSettings();
    updateNotificationsStatus();
});

// Кнопка запроса разрешения
requestPermissionBtn.addEventListener("click", function () {
    requestNotificationPermission();
});

// Стикеры
stickerBtn.addEventListener("click", function () {
    if (stickerPanel.classList.contains("hidden")) {
        openStickerPanel();
    } else {
        closeStickerPanel();
    }
});
closeStickerBtn.addEventListener("click", closeStickerPanel);

// Загрузка стикеров при старте
loadStickers();

// Загрузка настроек
loadSettings();

// --- Запуск приложения ---

async function startApp() {
    const savedUser = getSavedUser();
    if (!savedUser) {
        showAuthScreen();
        return;
    }
    currentUser = savedUser;
    showMessenger();

    try {
        const saved = sessionStorage.getItem(`lastMessageMap_${currentUser.id}`);
        if (saved) lastMessageMap = JSON.parse(saved);
    } catch (e) {}

    await loadChats();

    if ("Notification" in window && Notification.permission === "granted") {
        notificationPermission = true;
    }
}

startApp();

// Периодическая проверка новых сообщений
setInterval(async function () {
    if (currentUser && currentChatId !== null) {
        await loadChats();
    }
}, 3000);