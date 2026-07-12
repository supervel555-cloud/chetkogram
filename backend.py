import os

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


def init_db():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    display_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL
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

            cursor.execute("ALTER TABLE chats ADD COLUMN IF NOT EXISTS title TEXT")
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


def seed_db():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS count FROM users")
            users_count = cursor.fetchone()["count"]

            if users_count > 0:
                return

            users = [
                ("kirill", "Кирилл", generate_password_hash("1234")),
                ("velimir", "Велимир", generate_password_hash("1234")),
                ("boris", "Борис", generate_password_hash("1234")),
                ("dima", "Дима", generate_password_hash("1234")),
                ("alina", "Алина", generate_password_hash("1234")),
                ("work", "Рабочий чат", generate_password_hash("1234")),
                ("study", "Учебный чат", generate_password_hash("1234")),
                ("python", "Python", generate_password_hash("1234"))
            ]

            cursor.executemany(
                "INSERT INTO users (username, display_name, password_hash) VALUES (%s, %s, %s)",
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
                SELECT id, username, display_name
                FROM users
                ORDER BY id
            """)
            users = cursor.fetchall()
    return jsonify(users)


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

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO users (username, display_name, password_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id, username, display_name
                    """,
                    (username, display_name, password_hash)
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
                SELECT id, username, display_name, password_hash
                FROM users
                WHERE username = %s
            """, (username,))
            user = cursor.fetchone()

    if user is None:
        return jsonify({"error": "user not found"}), 404

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Wrong password"}), 401

    return jsonify({
        "id": user["id"],
        "username": user["username"],
        "display_name": user["display_name"]
    })


@app.route("/api/chats", methods=["GET"])
def get_chats():
    user_id = request.args.get("user_id", type=int)

    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

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
                    ) AS last_sender_id
                FROM chats
                JOIN chat_members ON chat_members.chat_id = chats.id
                WHERE chat_members.user_id = %s
                ORDER BY chats.id
            """, (user_id, user_id))

            chats = cursor.fetchall()

    return jsonify(chats)


@app.route("/api/chats", methods=["POST"])
def create_chat():
    data = request.get_json()

    name = data.get("name", "").strip()
    usernames = data.get("usernames", [])
    user_id = data.get("user_id")

    if user_id is None:
        return jsonify({"error": "user_id is required"}), 400

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
            # Проверяем, что пользователь является участником чата
            cursor.execute(
                "SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s",
                (chat_id, user_id)
            )
            if cursor.fetchone() is None:
                return jsonify({"error": "You are not a member of this chat"}), 403

            # Удаляем чат (каскадно удалятся все сообщения и записи участников)
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

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    messages.id,
                    messages.chat_id,
                    messages.sender_id,
                    users.display_name AS sender_name,
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


init_db()
seed_db()

if __name__ == "__main__":
    app.run(debug=True)