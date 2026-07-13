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

// Элемент для количества онлайн
const onlineCountElement = document.getElementById("onlineCount");

let currentUser = null;
let currentChatId = null;
let chats = [];

// Храним последнее сообщение для каждого чата для отслеживания новых
let lastMessageMap = {};

// Разрешение на уведомления
let notificationPermission = false;
let notificationsEnabled = true;

// Список стикеров (эмодзи)
let stickerEmojis = [];

// --- Загрузка настроек ---
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

function saveSettings() {
    localStorage.setItem("chetkogram_settings", JSON.stringify({
        notificationsEnabled: notificationsEnabled
    }));
}

function updateNotificationsStatus() {
    notificationsStatus.textContent = notificationsEnabled ? "Включены" : "Выключены";
}

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
        } catch (e) {}
    }

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
    // Начинаем обновлять онлайн
    startOnlineUpdates();
}

function showAuthScreen() {
    app.classList.add("hidden");
    authScreen.classList.remove("hidden");
    // Останавливаем обновление онлайна
    stopOnlineUpdates();
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
        updateChatHeader(currentChat);
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

        // Имя чата и индикатор онлайна
        if (chat.members && chat.members.length === 1) {
            // Личный чат
            const member = chat.members[0];
            titleElement.textContent = member.display_name;
            const indicator = document.createElement("span");
            indicator.className = "online-indicator";
            if (member.online) {
                indicator.classList.add("online");
            }
            titleElement.appendChild(indicator);
        } else {
            // Групповой чат – показываем название и количество онлайн
            titleElement.textContent = chat.title;
            if (chat.members) {
                const onlineCount = chat.members.filter(m => m.online).length;
                if (onlineCount > 0) {
                    const onlineText = document.createElement("span");
                    onlineText.style.fontSize = "12px";
                    onlineText.style.fontWeight = "normal";
                    onlineText.style.color = "#27ae60";
                    onlineText.textContent = ` (${onlineCount} онлайн)`;
                    titleElement.appendChild(onlineText);
                }
            }
        }

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
            updateChatHeader(chat);
            renderChats();
            await loadMessages();
        });

        chatList.appendChild(chatElement);
    });
}

function updateChatHeader(chat) {
    let title = chat.title;
    let statusText = "";
    if (chat.members && chat.members.length === 1) {
        const member = chat.members[0];
        title = member.display_name;
        statusText = member.online ? "🟢 онлайн" : "⚪ офлайн";
    } else if (chat.members) {
        const onlineCount = chat.members.filter(m => m.online).length;
        statusText = `${onlineCount} из ${chat.members.length} онлайн`;
    }
    chatHeader.innerHTML = `<h3>${title} <span style="font-size:14px;font-weight:normal;color:#555;">${statusText}</span></h3>`;
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
        if (message.sender_color) {
            sender.style.color = message.sender_color;
        }

        const messageElement = document.createElement("div");
        const text = message.text.trim();

        const isSticker = stickerEmojis.includes(text);

        if (isSticker) {
            messageElement.classList.add("message", "sticker");
            messageElement.textContent = text;
        } else {
            messageElement.classList.add("message");
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
async function loadStickers() {
    try {
        const response = await fetch("/api/stickers");
        if (response.ok) {
            const stickers = await response.json();
            stickerEmojis = stickers.map(s => s.emoji);
            renderStickers(stickers);
        } else {
            stickerEmojis = [];
        }
    } catch (e) {
        stickerEmojis = [];
    }
}

function renderStickers(stickers) {
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
    // Подставляем текущий цвет, если есть
    if (currentUser && currentUser.color) {
        document.getElementById("nickColorInput").value = currentUser.color;
    }
}

function closeSettings() {
    settingsModal.classList.add("hidden");
}

// === Онлайн ===
let onlineUpdateInterval = null;

async function updateOnlineCount() {
    try {
        const response = await fetch("/api/online_count");
        if (response.ok) {
            const data = await response.json();
            onlineCountElement.textContent = data.online_count;
        }
    } catch (e) {
        // ignore
    }
}

function startOnlineUpdates() {
    if (onlineUpdateInterval) return;
    updateOnlineCount(); // сразу обновляем
    onlineUpdateInterval = setInterval(updateOnlineCount, 5000);
}

function stopOnlineUpdates() {
    if (onlineUpdateInterval) {
        clearInterval(onlineUpdateInterval);
        onlineUpdateInterval = null;
    }
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

// Загрузка стикеров
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