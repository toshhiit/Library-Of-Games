from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import threading
import telebot
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta

# Загружаем переменные
BOT_TOKEN = os.getenv("BOT_TOKEN")
SITE_URL = os.getenv("SITE_URL")
DATABASE_URL = os.getenv("DATABASE_URL")
PORT = int(os.environ.get("PORT", 8080))

# ВАЖНО: Vite собирает проект в папку 'dist'. Указываем Flask искать файлы там.
# Если папки dist нет (локальный запуск без билда), ищем в текущей.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')

# Если папки dist не существует, используем текущую (для тестов), но лучше сбилдить фронт.
if not os.path.exists(DIST_DIR):
    SITE_DIR = BASE_DIR
else:
    SITE_DIR = DIST_DIR

print(f"Server is serving static files from: {SITE_DIR}")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL не найден!")

# =============== DB HELPER (Правильное подключение) ===============
def get_db_connection():
    """Создает новое соединение для каждого запроса"""
    url = urlparse(DATABASE_URL)
    conn = psycopg2.connect(
        dbname=url.path[1:],
        user=url.username,
        password=url.password,
        host=url.hostname,
        port=url.port,
        sslmode='require' # Railway требует SSL для внешних подключений, для внутренних не повредит
    )
    return conn

# =============== BOT ===============
bot = telebot.TeleBot(BOT_TOKEN)

# =============== COMMANDS ===============
@bot.message_handler(commands=['start'])
def start_cmd(message):
    tg_id = message.from_user.id
    username = message.from_user.username
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Проверяем есть ли юзер
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    "INSERT INTO users (tg_id, username) VALUES (%s, %s) RETURNING id",
                    (tg_id, username)
                )
                new_user_id = cursor.fetchone()[0]
                cursor.execute(
                    "INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1)",
                    (new_user_id,)
                )
                conn.commit()
                bot.send_message(message.chat.id, "Добро пожаловать! Аккаунт создан.")
            else:
                bot.send_message(message.chat.id, "С возвращением!")
        conn.close()
    except Exception as e:
        print(f"Error in start_cmd: {e}")
        bot.send_message(message.chat.id, "Ошибка базы данных.")

@bot.message_handler(commands=['games'])
def games_cmd(message):
    tg_id = message.from_user.id
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            row = cursor.fetchone()
            
            if not row:
                bot.send_message(message.chat.id, "Сначала нажми /start")
                return

            user_id = row[0]
            
            # Генерация токена
            token = str(uuid.uuid4())
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            
            cursor.execute("""
                INSERT INTO auth_tokens (user_id, token, expires_at)
                VALUES (%s, %s, %s)
            """, (user_id, token, expires_at))
            conn.commit()
            
            link = f"{SITE_URL}/login.html?token={token}" # Явно указываем .html если файл так называется в public/dist
            
            markup = telebot.types.InlineKeyboardMarkup()
            btn = telebot.types.InlineKeyboardButton("Играть 🎮", url=link)
            markup.add(btn)
            
            bot.send_message(message.chat.id, "Твоя ссылка для входа:", reply_markup=markup)
        conn.close()
    except Exception as e:
        print(f"Error in games_cmd: {e}")

# =============== FLASK ===============
app = Flask(__name__, static_folder=SITE_DIR, static_url_path='')
CORS(app)

@app.route('/')
def index():
    return send_from_directory(SITE_DIR, 'index.html')

# Если у тебя React Router, нужно, чтобы все пути отдавали index.html
@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(SITE_DIR, path)):
        return send_from_directory(SITE_DIR, path)
    return send_from_directory(SITE_DIR, 'index.html')

# =============== API ===============
@app.post("/api/auth/verify")
def verify():
    data = request.get_json()
    token = data.get("token")
    
    if not token:
        return jsonify({"success": False, "error": "No token"})

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT users.id, users.username, auth_tokens.expires_at
                FROM auth_tokens
                JOIN users ON users.id = auth_tokens.user_id
                WHERE auth_tokens.token=%s
            """, (token,))
            
            row = cursor.fetchone()
            if not row:
                conn.close()
                return jsonify({"success": False, "error": "Invalid token"})

            user_id, username, expires_at_text = row
            # Парсинг времени может зависеть от БД, приведем к строке если надо
            if isinstance(expires_at_text, str):
                expires_at = datetime.fromisoformat(expires_at_text)
            else:
                expires_at = expires_at_text

            # Проверка времени (с учетом таймзон)
            if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
                conn.close()
                return jsonify({"success": False, "error": "Token expired"})

            # Создаем сессию
            session_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO sessions (user_id, session_id) VALUES (%s, %s)",
                (user_id, session_id)
            )
            conn.commit()
            
            # Удаляем использованный токен
            cursor.execute("DELETE FROM auth_tokens WHERE token=%s", (token,))
            conn.commit()
            
        conn.close()
        return jsonify({"success": True, "username": username, "session": session_id})
        
    except Exception as e:
        print(f"Auth error: {e}")
        return jsonify({"success": False, "error": "Server error"})

@app.get("/api/user")
def get_user_info():
    session_id = request.args.get("session")
    if not session_id:
         return jsonify({"success": False})

    try:
        conn = get_db_connection()
        # Используем RealDictCursor чтобы получать данные как словарь (удобнее для JSON)
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT u.username, u.tg_id, s.coins, s.xp 
                FROM sessions ses
                JOIN users u ON u.id = ses.user_id
                LEFT JOIN stats s ON s.user_id = u.id
                WHERE ses.session_id=%s
            """, (session_id,))
            
            user_data = cursor.fetchone()
            
        conn.close()
        
        if user_data:
            return jsonify({"success": True, **user_data})
        return jsonify({"success": False})
        
    except Exception as e:
        print(f"User info error: {e}")
        return jsonify({"success": False})

# =============== RUNNER ===============
def run_bot():
    try:
        bot.remove_webhook()
        print("Bot polling started...")
        bot.infinity_polling()
    except Exception as e:
        print(f"Bot error: {e}")

if __name__ == "__main__":
    # Запускаем бота в фоне
    threading.Thread(target=run_bot, daemon=True).start()
    
    # Запускаем сервер
    print(f"Starting Flask on port {PORT}...")
    # host='0.0.0.0' ОБЯЗАТЕЛЬНО для Railway
    app.run(host="0.0.0.0", port=PORT)
