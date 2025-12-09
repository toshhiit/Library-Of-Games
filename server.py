from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import threading
import telebot
from telebot import types 
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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')

# Если папки dist не существует, используем текущую
if not os.path.exists(DIST_DIR):
    SITE_DIR = BASE_DIR
else:
    SITE_DIR = DIST_DIR

print(f"Server is serving static files from: {SITE_DIR}")

if not BOT_TOKEN:
    print("BOT_TOKEN не найден! Бот не запустится.")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL не найден!")

# ==================== BOT KEYBOARDS & CONSTS ====================
# Пользовательская клавиатура (менюшка снизу)
# ИСПРАВЛЕНИЕ: Сначала создаем объект, потом добавляем кнопки
REPLY_KEYBOARD = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=False)
REPLY_KEYBOARD.add(types.KeyboardButton("🎮 Играть"))
REPLY_KEYBOARD.row(types.KeyboardButton("🏆 Моя Статистика"), types.KeyboardButton("❓ Помощь"))

# ID игр (из constants.ts)
GAME_NAMES = {
    '1': '2048', '2': 'Snake', '3': 'Dino Run', '4': 'Clicker', 
    '5': 'Шашки', '6': 'Сапёр', '7': 'Пасьянс', '8': 'Tetris', '9': 'Paint'
}


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
        sslmode='require'
    )
    return conn

# =============== BOT HANDLERS ===================
bot = telebot.TeleBot(BOT_TOKEN)


# Универсальный генератор ссылки для игры (обновлен для переиспользования)
def handle_games_request(message):
    tg_id = message.from_user.id
    chat_id = message.chat.id
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            row = cursor.fetchone()
            
            if not row:
                bot.send_message(chat_id, "Сначала нажми /start", reply_markup=REPLY_KEYBOARD)
                return

            user_id = row[0]
            
            # Генерация токена
            token = str(uuid.uuid4())
            # Дата окончания срока действия токена
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            
            cursor.execute("""
                INSERT INTO auth_tokens (user_id, token, expires_at)
                VALUES (%s, %s, %s)
            """, (user_id, token, expires_at))
            conn.commit()
            
            link = f"{SITE_URL}/login.html?token={token}"
            
            markup = types.InlineKeyboardMarkup()
            btn = types.InlineKeyboardButton("Играть 🎮", url=link)
            markup.add(btn)
            
            bot.send_message(chat_id, "Твоя ссылка для входа:", reply_markup=markup)
        conn.close()
    except Exception as e:
        print(f"Error in handle_games_request: {e}")
        bot.send_message(chat_id, "Ошибка сервера или базы данных.", reply_markup=REPLY_KEYBOARD)


# Обработчик /start (обновлен для меню)
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
                bot.send_message(message.chat.id, "Добро пожаловать! Аккаунт создан.", reply_markup=REPLY_KEYBOARD)
            else:
                bot.send_message(message.chat.id, "С возвращением! Выбери действие:", reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in start_cmd: {e}")
        bot.send_message(message.chat.id, "Ошибка базы данных.", reply_markup=REPLY_KEYBOARD)

# Обработчик кнопки "🎮 Играть" (объединен с /games)
@bot.message_handler(commands=['games'])
@bot.message_handler(func=lambda message: message.text == "🎮 Играть")
def games_cmd_or_button(message):
    handle_games_request(message)

# Обработчик кнопки "❓ Помощь"
@bot.message_handler(func=lambda message: message.text == "❓ Помощь")
def help_cmd(message):
    text = (
        "🤖 *Как использовать бота:*\n\n"
        "1. Нажми кнопку *🎮 Играть* или введи `/games`.\n"
        "2. Получи ссылку для входа в библиотеку игр.\n"
        "3. Нажми кнопку *🏆 Моя Статистика* или введи `/stats`, чтобы посмотреть свои лучшие результаты.\n"
        "4. Для перезапуска меню введи `/start`."
    )
    bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)


# ==================== СТАТИСТИКА /STATS ====================

@bot.message_handler(commands=['stats'])
@bot.message_handler(func=lambda message: message.text == "🏆 Моя Статистика")
def stats_cmd(message):
    tg_id = message.from_user.id
    # Начальный вызов с page=0
    send_stats_page(message.chat.id, tg_id, 0, message.message_id)

def send_stats_page(chat_id, tg_id, page, message_id=None, is_edit=False):
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # 1. Получаем ID пользователя
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user_row = cursor.fetchone()
            if not user_row:
                bot.send_message(chat_id, "Сначала нажми /start, чтобы зарегистрироваться.", reply_markup=REPLY_KEYBOARD)
                return
            user_id = user_row['id']
            
            # 2. Получаем список всех уникальных игр, в которые играл пользователь, и их лучший счет
            cursor.execute("""
                WITH RankedScores AS (
                    SELECT 
                        game_id, 
                        score, 
                        created_at,
                        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY score DESC, created_at DESC) as rn
                    FROM game_scores 
                    WHERE user_id=%s
                )
                SELECT game_id, score, created_at
                FROM RankedScores
                WHERE rn = 1
                ORDER BY score DESC, game_id
            """, (user_id,))
            best_scores = cursor.fetchall()
            
            if not best_scores:
                bot.send_message(chat_id, "Вы еще не играли ни в одну игру, чтобы посмотреть статистику. Начните игру!", reply_markup=REPLY_KEYBOARD)
                return
            
            # 3. Определяем текущую игру для отображения (постраничная навигация)
            num_games = len(best_scores)
            page = page % num_games # Круговая навигация
            current_score_data = best_scores[page]
            current_game_id = current_score_data['game_id']
            current_game_name = GAME_NAMES.get(current_game_id, f"Игра #{current_game_id}")
            
            # 4. Формируем текст сообщения
            created_at = current_score_data.get('created_at')
            
            # Упрощенная обработка даты, если БД возвращает строку (TEXT)
            date_str = "Н/Д"
            if isinstance(created_at, datetime):
                # Если это datetime объект 
                date_str = created_at.strftime("%d.%m.%Y %H:%M")
            elif isinstance(created_at, str):
                # Если это строка (TEXT) - пробуем распарсить ISO 8601
                try:
                    dt_obj = datetime.fromisoformat(created_at)
                    date_str = dt_obj.strftime("%d.%m.%Y %H:%M")
                except ValueError:
                    date_str = created_at # Выводим сырую строку, если парсинг не удался

            
            text = (
                f"🏆 *Твоя Лучшая Статистика* (Игра {page + 1} из {num_games}):\n\n"
                f"🕹️ *{current_game_name}*\n"
                f"📈 *Лучший Счет*: {current_score_data['score']}\n"
                f"🗓️ *Дата Рекорда*: {date_str}"
            )
                
            # 5. Создаем навигационные кнопки (Inline Keyboard)
            markup = types.InlineKeyboardMarkup(row_width=3)
            prev_page = (page - 1 + num_games) % num_games
            next_page = (page + 1) % num_games
            
            buttons = [
                types.InlineKeyboardButton("⬅️", callback_data=f"stats_{prev_page}_{tg_id}"),
                types.InlineKeyboardButton(f"{page + 1}/{num_games}", callback_data="stats_info"),
                types.InlineKeyboardButton("➡️", callback_data=f"stats_{next_page}_{tg_id}")
            ]
            markup.add(*buttons)

            # 6. Отправка/редактирование сообщения
            if is_edit and message_id:
                bot.edit_message_text(
                    chat_id=chat_id, 
                    message_id=message_id, 
                    text=text, 
                    reply_markup=markup,
                    parse_mode='Markdown'
                )
            else:
                bot.send_message(chat_id, text, reply_markup=markup, parse_mode='Markdown')
                
        conn.close()
    except Exception as e:
        print(f"Error in send_stats_page: {e}")
        bot.send_message(chat_id, "Ошибка при получении статистики.", reply_markup=REPLY_KEYBOARD)


@bot.callback_query_handler(func=lambda call: call.data.startswith('stats_'))
def stats_callback(call):
    if call.data == "stats_info":
        bot.answer_callback_query(call.id, "Это текущая страница статистики. Используйте стрелки для навигации.")
        return
        
    try:
        # data будет в формате "stats_N_TG_ID"
        parts = call.data.split('_')
        page = int(parts[1])
        tg_id_from_data = int(parts[2])
        
        # Проверка, что только тот, кто нажал, может управлять кнопками
        if call.from_user.id != tg_id_from_data:
             bot.answer_callback_query(call.id, "Этой статистикой может управлять только ее владелец.")
             return
             
        # Отправляем новую страницу, редактируя текущее сообщение
        send_stats_page(call.message.chat.id, call.from_user.id, page, call.message.message_id, is_edit=True)
        bot.answer_callback_query(call.id)
    except Exception as e:
        print(f"Error in stats_callback: {e}")
        bot.answer_callback_query(call.id, "Произошла ошибка навигации.")


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

# =============== API (Обновлено) ===============
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
            # Парсинг времени 
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


@app.post("/api/game/score")
def save_score_api():
    """
    Эндпоинт для сохранения игрового счета в БД. Требуется session_id.
    Payload: {session: string, game_id: string, score: number}
    """
    data = request.get_json()
    session_id = data.get("session")
    game_id = data.get("game_id")
    score = data.get("score")
    
    if not session_id or not game_id or score is None:
        return jsonify({"success": False, "error": "Missing data"}), 400

    try:
        score = int(score)
    except ValueError:
        return jsonify({"success": False, "error": "Invalid score format"}), 400
        
    user_id = None
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # 1. Проверяем сессию и получаем user_id
            cursor.execute("SELECT user_id FROM sessions WHERE session_id=%s", (session_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return jsonify({"success": False, "error": "Invalid session"}), 403
            
            user_id = row[0]
            
            # 2. Сохраняем счет
            # Генерируем ISO-строку времени в Python, чтобы записать ее в поле TEXT
            current_time = datetime.now(timezone.utc).isoformat()
            
            cursor.execute("""
                INSERT INTO game_scores (user_id, game_id, score, created_at)
                VALUES (%s, %s, %s, %s)
            """, (user_id, game_id, score, current_time))
            conn.commit()

        conn.close()
        return jsonify({"success": True})
        
    except Exception as e:
        print(f"Save score error: {e}")
        if conn: conn.close()
        return jsonify({"success": False, "error": "Server error"}), 500


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
    if BOT_TOKEN:
        threading.Thread(target=run_bot, daemon=True).start()
    
    # Запускаем сервер
    print(f"Starting Flask on port {PORT}...")
    app.run(host="0.0.0.0", port=PORT)
