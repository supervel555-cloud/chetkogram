import os
from datetime import datetime, timedelta

from flask import Flask, request, jsonify, send_from_directory
import psycopg
from psycopg.rows import dict_row
from psycopg.errors import UniqueViolation
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash


BASE_DIR = Path(__file__).resolve().parent

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/chetkogram"
)

app = Flask(__name__, static_folder=str(BASE_DIR))
app.json.ensure_ascii = False


def get_connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def update_user_activity(user_id):
    """Обновляет время последней активности пользователя"""
    if not user_id:
        return
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = %s",
                (user_id,)
            )
            conn.commit()


def init_db():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    color TEXT DEFAULT '#000000',
                    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chats (
                    id SERIAL PRIMARY KEY,
                    title TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS chat_members (
                    id SERIAL PRIMARY KEY,
                    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE (chat_id, user_id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stickers (
                    id SERIAL PRIMARY KEY,
                    emoji TEXT NOT NULL UNIQUE,
                    name TEXT
                )
            """)

            cursor.execute("ALTER TABLE chats ADD COLUMN IF NOT EXISTS title TEXT")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#000000'")
            cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            conn.commit()


def create_direct_chat(cursor, user1_id, user2_id):
    cursor.execute("INSERT INTO chats DEFAULT VALUES RETURNING id")
    chat = cursor.fetchone()
    chat_id = chat["id"]

    cursor.execute(
        "INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s)",
        (chat_id, user1_id)
    )
    cursor.execute(
        "INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s)",
        (chat_id, user2_id)
    )
    return chat_id


def create_group_chat(cursor, title, user_ids):
    cursor.execute(
        "INSERT INTO chats (title) VALUES (%s) RETURNING id",
        (title,)
    )
    chat = cursor.fetchone()
    chat_id = chat["id"]

    for uid in user_ids:
        cursor.execute(
            "INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s)",
            (chat_id, uid)
        )
    return chat_id


def seed_stickers(cursor):
    cursor.execute("SELECT COUNT(*) AS count FROM stickers")
    count = cursor.fetchone()["count"]
    if count > 0:
        return

    stickers = [
        ("😀", "Улыбка"),
        ("😂", "Смех"),
        ("😍", "Влюблённость"),
        ("🤔", "Задумчивость"),
        ("😎", "Круто"),
        ("🔥", "Огонь"),
        ("🎉", "Праздник"),
        ("❤️", "Любовь"),
        ("👍", "Одобрение"),
        ("👋", "Привет"),
        ("🤗", "Объятие"),
        ("😊", "Радость"),
    ]
    cursor.executemany(
        "INSERT INTO stickers (emoji, name) VALUES (%s, %s)",
        stickers
    )


def seed_db():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS count FROM users")
            users_count = cursor.fetchone()["count"]

            if users_count > 0:
                seed_stickers(cursor)
                conn.commit()
                return

            users = [
                ("kirill", "Кирилл", generate_password_hash("1234"), "#ff6b6b"),
                ("velimir", "Велимир", generate_password_hash("1234"), "#4ecdc4"),
                ("boris", "Борис", generate_password_hash("1234"), "#ffe66d"),
                ("dima", "Дима", generate_password_hash("1234"), "#a8e6cf"),
                ("alina", "Алина", generate_password_hash("1234"), "#ff9ff3"),
                ("work", "Рабочий чат", generate_password_hash("1234"), "#54a0ff"),
                ("study", "Учебный чат", generate_password_hash("1234"), "#5f27cd"),
                ("python", "Python", generate_password_hash("1234"), "#ff9f43")
            ]

            cursor.executemany(
                "INSERT INTO users (username, display_name, password_hash, color) VALUES (%s, %s, %s, %s)",
                users
            )

            kirill_id = 1
            velimir_id = 2
            boris_id = 3
            dima_id = 4
            alina_id = 5
            work_id = 6
            study_id = 7
            python_id = 8

            chat_1 = create_direct_chat(cursor, kirill_id, velimir_id)
            chat_2 = create_direct_chat(cursor, kirill_id, boris_id)
            chat_3 = create_direct_chat(cursor, velimir_id, boris_id)
            chat_4 = create_direct_chat(cursor, kirill_id, dima_id)
            chat_5 = create_direct_chat(cursor, kirill_id, alina_id)
            chat_6 = create_direct_chat(cursor, kirill_id, work_id)
            chat_7 = create_direct_chat(cursor, velimir_id, study_id)
            chat_8 = create_direct_chat(cursor, velimir_id, python_id)

            group_chat_id = create_group_chat(
                cursor,
                "Команда",
                [kirill_id, velimir_id, boris_id]
            )

            messages = [
                (chat_1, velimir_id, "Привет, Кирилл"),
                (chat_1, kirill_id, "Привет, Велимир"),
                (chat_1, velimir_id, "Сегодня продолжаем мессенджер?"),

                (chat_2, boris_id, "Кирилл, привет"),
                (chat_2, kirill_id, "Привет, Борис"),

                (chat_3, boris_id, "Велимир, привет"),
                (chat_3, velimir_id, "Привет"),

                (chat_4, dima_id, "Привет"),
                (chat_4, kirill_id, "Привет, как дела?"),
                (chat_4, dima_id, "Нормально, ты где?"),
                (chat_4, kirill_id, "Сейчас дома"),

                (chat_5, alina_id, "Скинь файл позже"),
                (chat_5, kirill_id, "Хорошо, скину вечером"),

                (chat_6, work_id, "Созвон в 18:00"),
                (chat_6, kirill_id, "Ок, буду"),

                (chat_7, study_id, "Сегодня продолжаем мессенджер"),
                (chat_7, velimir_id, "Хорошо"),

                (chat_8, python_id, "Повтори функции и списки"),
                (chat_8, velimir_id, "Окей"),

                (group_chat_id, kirill_id, "Всем привет!"),
                (group_chat_id, velimir_id, "Привет!"),
                (group_chat_id, boris_id, "Здравствуйте!")
            ]

            cursor.executemany(
                "INSERT INTO messages (chat_id, sender_id, text) VALUES (%s, %s, %s)",
                messages
            )

            seed_stickers(cursor)
            conn.commit()


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/style.css")
def style_css():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def script_js():
    return send_from_directory(BASE_DIR, "script.js")


@app.route("/api/users", methods=["GET"])
def get_users():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, username, display_name, color,
                       (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) < 30) AS online
                FROM users
                ORDER BY id
            """)
            users = cursor.fetchall()
    return jsonify(users)


@app.route("/api/online_count", methods=["GET"])
def get_online_count():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) AS online_count
                FROM users
                WHERE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_activity)) < 30
            """)
            result = cursor.fetchone()
    return jsonify({"online_count": result["online_count"]})


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    username = data.get("username", "").strip()
    display_name = data.get("display_name", "").strip()
    password = data.get("password", "").strip()

    if username == "":
        return jsonify({"error": "username is required"}), 400
    if display_name == "":
        return jsonify({"error": "display_name is required"}), 400
    if password == "":
        return jsonify({"error": "password is required"}), 400

    password_hash = generate_password_hash(password)
    default_color = "#000000"

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (username, display_name, password_hash, color, last_activity)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    RETURNING id, username, display_name, color
                    """,
                    (username, display_name, password_hash, default_color)
                )
                user = cursor.fetchone()
                conn.commit()
    except UniqueViolation:
        return jsonify({"error": "username already exists"}), 400

    return jsonify(user), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if username == "":
        return jsonify({"error": "username is required"}), 400
    if password == "":
        return jsonify({"error": "password is required"}), 400

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, username, display_name, password_hash, color
                FROM users
                WHERE username = %s
            """, (username,))
            user = cursor.fetchone()

    if user is None:
        return jsonify({"error": "user not found"}), 404

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Wrong password"}), 401

    # Обновляем активность
    update_user_activity(user["id"])

    return jsonify({
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "color": user["color"]
    })


@app.route("/api/stickers", methods=["GET"])
def get_stickers():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, emoji, name FROM stickers ORDER BY id")
            stickers = cursor.fetchall()
    return jsonify(stickers)


@app.route("/api/chats", methods=["GET"])
def get_chats():
    user_id = request.args.get("user_id", type=int)

    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

    # Обновляем активность пользователя
    update_user_activity(user_id)

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    chats.id,
                    CASE
                        WHEN chats.title IS NOT NULL THEN chats.title
                        ELSE (
                            SELECT string_agg(users.display_name, ', ')
                            FROM chat_members AS members2
                            JOIN users ON users.id = members2.user_id
                            WHERE members2.chat_id = chats.id
                              AND members2.user_id != %s
                        )
                    END AS title,
                    (
                        SELECT text
                        FROM messages
                        WHERE messages.chat_id = chats.id
                        ORDER BY messages.id DESC
                        LIMIT 1
                    ) AS last_message,
                    (
                        SELECT sender_id
                        FROM messages
                        WHERE messages.chat_id = chats.id
                        ORDER BY messages.id DESC
                        LIMIT 1
                    ) AS last_sender_id,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', u.id,
                                'display_name', u.display_name,
                                'online', EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - u.last_activity)) < 30
                            )
                        )
                        FROM chat_members cm
                        JOIN users u ON u.id = cm.user_id
                        WHERE cm.chat_id = chats.id
                          AND cm.user_id != %s
                    ) AS members
                FROM chats
                JOIN chat_members ON chat_members.chat_id = chats.id
                WHERE chat_members.user_id = %s
                GROUP BY chats.id
                ORDER BY chats.id
            """, (user_id, user_id, user_id))

            chats = cursor.fetchall()

            # Преобразуем members из JSON в список
            for chat in chats:
                if chat["members"]:
                    chat["members"] = chat["members"]
                else:
                    chat["members"] = []

    return jsonify(chats)


@app.route("/api/chats", methods=["POST"])
def create_chat():
    data = request.get_json()

    name = data.get("name", "").strip()
    usernames = data.get("usernames", [])
    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

    # Обновляем активность
    update_user_activity(user_id)

    if name and usernames:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id, username FROM users WHERE username = ANY(%s)",
                    (usernames,)
                )
                found_users = cursor.fetchall()
                found_usernames = {u["username"] for u in found_users}
                missing = set(usernames) - found_usernames
                if missing:
                    return jsonify({"error": f"Users not found: {', '.join(missing)}"}), 400

                all_ids = {u["id"] for u in found_users}
                all_ids.add(user_id)

                if len(all_ids) < 2:
                    return jsonify({"error": "Group must have at least 2 members"}), 400

                chat_id = create_group_chat(cursor, name, list(all_ids))
                conn.commit()

        return jsonify({"id": chat_id}), 201

    other_user_id = data.get("other_user_id")
    if other_user_id is None:
        return jsonify({"error": "other_user_id is required for direct chat"}), 400

    if user_id == other_user_id:
        return jsonify({"error": "cannot create chat with yourself"}), 400

    with get_connection() as conn:
        with conn.cursor() as cursor:
            chat_id = create_direct_chat(cursor, user_id, other_user_id)
            conn.commit()

    return jsonify({"id": chat_id}), 201


@app.route("/api/chats/<int:chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    user_id = request.args.get("user_id", type=int)
    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s",
                (chat_id, user_id)
            )
            if cursor.fetchone() is None:
                return jsonify({"error": "You are not a member of this chat"}), 403

            cursor.execute("DELETE FROM chats WHERE id = %s", (chat_id,))
            conn.commit()

    return jsonify({"message": "Chat deleted"}), 200


@app.route("/api/messages", methods=["GET"])
def get_messages():
    chat_id = request.args.get("chat_id", type=int)
    user_id = request.args.get("user_id", type=int)

    if chat_id is None:
        return jsonify({"error": "chat_id is required"}), 400
    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

    # Обновляем активность
    update_user_activity(user_id)

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    messages.id,
                    messages.chat_id,
                    messages.sender_id,
                    users.display_name AS sender_name,
                    users.color AS sender_color,
                    messages.text,
                    messages.created_at,
                    CASE
                        WHEN messages.sender_id = %s THEN 'me'
                        ELSE 'other'
                    END AS sender_type
                FROM messages
                JOIN users ON users.id = messages.sender_id
                WHERE messages.chat_id = %s
                ORDER BY messages.id
            """, (user_id, chat_id))
            messages = cursor.fetchall()

    return jsonify(messages)


@app.route("/api/messages", methods=["POST"])
def create_message():
    data = request.get_json()

    chat_id = data.get("chat_id")
    user_id = data.get("user_id")
    text = data.get("text", "").strip()

    if chat_id is None:
        return jsonify({"error": "chat_id is required"}), 400
    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400
    if text == "":
        return jsonify({"error": "text is required"}), 400

    # Обновляем активность
    update_user_activity(user_id)

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO messages (chat_id, sender_id, text)
                VALUES (%s, %s, %s)
                RETURNING id, chat_id, sender_id, text, created_at
                """,
                (chat_id, user_id, text)
            )
            message = cursor.fetchone()
            conn.commit()

    return jsonify(message), 201


@app.route("/api/user/color", methods=["PUT"])
def update_user_color():
    data = request.get_json()
    user_id = data.get("user_id")
    color = data.get("color", "").strip()

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if not color:
        return jsonify({"error": "color is required"}), 400

    if not color.startswith("#") or len(color) != 7:
        return jsonify({"error": "Invalid color format (use #RRGGBB)"}), 400

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET color = %s WHERE id = %s RETURNING id, username, display_name, color",
                (color, user_id)
            )
            updated_user = cursor.fetchone()
            conn.commit()

    if not updated_user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(updated_user), 200


init_db()
seed_db()

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)