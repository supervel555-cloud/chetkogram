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

let currentUser = null;
let currentChatId = null;
let chats = [];

// Храним последнее сообщение для каждого чата для отслеживания новых
let lastMessageMap = {};

// Разрешение на уведомления
let notificationPermission = false;

// Запрос разрешения на уведомления
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        return;
    }
    if (Notification.permission === "granted") {
        notificationPermission = true;
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function(permission) {
            if (permission === "granted") {
                notificationPermission = true;
            }
        });
    }
}

// Показать уведомление (системное или внутреннее)
function showNotification(text) {
    // Если есть системные уведомления и разрешение получено
    if (notificationPermission && "Notification" in window) {
        try {
            const notification = new Notification("📨 Chetkogram", {
                body: text,
                icon: "" // можно добавить иконку, если есть
            });
            // Автоматическое закрытие через 3 секунды
            setTimeout(function() {
                notification.close();
            }, 3000);
            return;
        } catch (e) {
            // Если что-то пошло не так, используем внутреннее уведомление
        }
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

    // Автоматическое исчезновение через 5 секунд
    setTimeout(function () {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}


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

    if (savedUser === null) {
        return null;
    }

    return JSON.parse(savedUser);
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
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            password: password
        })
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
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username: username,
            display_name: displayName,
            password: password
        })
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
    if (currentUser === null) {
        return;
    }

    const oldChatId = currentChatId;

    const response = await fetch(`/api/chats?user_id=${currentUser.id}`);
    const newChats = await response.json();

    // Проверяем, появились ли новые сообщения в чатах
    const oldChats = chats;
    chats = newChats;

    // Для каждого чата проверяем, изменилось ли последнее сообщение
    chats.forEach(chat => {
        const oldLast = lastMessageMap[chat.id] || null;
        const newLast = chat.last_message;
        if (oldLast !== newLast && newLast !== null) {
            // Если чат не текущий, показываем уведомление
            if (chat.id !== currentChatId) {
                showNotification(`Новое сообщение в чате "${chat.title}"`);
            }
            lastMessageMap[chat.id] = newLast;
        }
    });

    if (chats.length === 0) {
        currentChatId = null;
        chatHeader.innerHTML = "<h3>Чатов нет</h3>";
        messages.innerHTML = "";
        renderChats();
        return;
    }

    const oldChatStillExists = chats.some(function (chat) {
        return chat.id === oldChatId;
    });

    if (oldChatStillExists) {
        currentChatId = oldChatId;
    } else {
        currentChatId = chats[0].id;
    }

    const currentChat = chats.find(function (chat) {
        return chat.id === currentChatId;
    });

    chatHeader.innerHTML = `<h3>${currentChat.title}</h3>`;

    renderChats();
    await loadMessages();
}


function renderChats() {
    chatList.innerHTML = "";

    const searchText = searchInput.value.toLowerCase();

    chats.forEach(function (chat) {
        const chatName = chat.title.toLowerCase();

        if (!chatName.includes(searchText)) {
            return;
        }

        const chatElement = document.createElement("div");
        chatElement.classList.add("chat-item");

        if (chat.id === currentChatId) {
            chatElement.classList.add("active");
        }

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
    if (currentChatId === null || currentUser === null) {
        return;
    }

    const response = await fetch(`/api/messages?chat_id=${currentChatId}&user_id=${currentUser.id}`);
    const chatMessages = await response.json();

    renderMessages(chatMessages);
}


function renderMessages(chatMessages) {
    messages.innerHTML = "";

    chatMessages.forEach(function (message) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("message-wrapper");

        if (message.sender_type === "me") {
            wrapper.classList.add("me");
        } else {
            wrapper.classList.add("other");
        }

        // Имя отправителя
        const sender = document.createElement("div");
        sender.classList.add("message-sender");
        if (message.sender_type === "me") {
            sender.textContent = "Вы";
        } else {
            sender.textContent = message.sender_name || "Неизвестный";
        }

        const messageElement = document.createElement("div");
        messageElement.classList.add("message");
        if (message.sender_type === "me") {
            messageElement.classList.add("me");
        } else {
            messageElement.classList.add("other");
        }
        messageElement.textContent = message.text;

        wrapper.appendChild(sender);
        wrapper.appendChild(messageElement);
        messages.appendChild(wrapper);
    });

    messages.scrollTop = messages.scrollHeight;
}


async function sendMessage() {
    const text = messageInput.value.trim();

    if (text === "") {
        return;
    }

    if (currentChatId === null || currentUser === null) {
        return;
    }

    const savedChatId = currentChatId;

    await fetch("/api/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            chat_id: savedChatId,
            user_id: currentUser.id,
            text: text
        })
    });

    messageInput.value = "";

    currentChatId = savedChatId;
    await loadChats();

    currentChatId = savedChatId;
    await loadMessages();
}


async function createChat() {
    const username = newChatUsernameInput.value.trim();

    if (username === "") {
        alert("Введи username собеседника");
        return;
    }

    const usersResponse = await fetch("/api/users");
    const users = await usersResponse.json();

    const otherUser = users.find(function (user) {
        return user.username === username;
    });

    if (otherUser === undefined) {
        alert("Пользователь не найден");
        return;
    }

    if (otherUser.id === currentUser.id) {
        alert("Нельзя создать чат с самим собой");
        return;
    }

    const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: currentUser.id,
            other_user_id: otherUser.id
        })
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

    if (name === "") {
        groupError.textContent = "Введите название группы";
        return;
    }
    if (membersStr === "") {
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
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: currentUser.id,
            name: name,
            usernames: usernames
        })
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


function logout() {
    sessionStorage.removeItem("currentUser");
    currentUser = null;
    currentChatId = null;
    chats = [];
    lastMessageMap = {};

    chatList.innerHTML = "";
    messages.innerHTML = "";
    chatHeader.innerHTML = "<h3>Выбери чат</h3>";

    showAuthScreen();
}


showLoginBtn.addEventListener("click", function () {
    showLoginForm();
});


showRegisterBtn.addEventListener("click", function () {
    showRegisterForm();
});


loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (username === "" || password === "") {
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

    if (username === "" || displayName === "" || password === "") {
        authError.textContent = "Заполни username, имя и пароль";
        return;
    }

    await register(username, displayName, password);
});


logoutBtn.addEventListener("click", function () {
    logout();
});


createChatBtn.addEventListener("click", async function () {
    await createChat();
});


// Обработчики для модального окна группы
createGroupBtn.addEventListener("click", function () {
    showGroupModal();
});

closeModalBtn.addEventListener("click", function () {
    hideGroupModal();
});

cancelGroupBtn.addEventListener("click", function () {
    hideGroupModal();
});

window.addEventListener("click", function (event) {
    if (event.target === groupModal) {
        hideGroupModal();
    }
});

groupForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    await createGroup();
});


messageForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    await sendMessage();
});


searchInput.addEventListener("input", function () {
    renderChats();
});


async function startApp() {
    const savedUser = getSavedUser();

    if (savedUser === null) {
        showAuthScreen();
        return;
    }

    currentUser = savedUser;
    showMessenger();
    await loadChats();

    // Запрос разрешения на уведомления после входа
    requestNotificationPermission();
}


startApp();


setInterval(async function () {
    if (currentUser !== null && currentChatId !== null) {
        await loadChats();
    }
}, 3000);