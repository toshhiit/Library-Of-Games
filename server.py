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
REPLY_KEYBOARD = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=False)
REPLY_KEYBOARD.add(types.KeyboardButton("🎮 Играть"))
REPLY_KEYBOARD.row(types.KeyboardButton("👤 Профиль"), types.KeyboardButton("🏆 Моя Статистика"))
REPLY_KEYBOARD.add(types.KeyboardButton("❓ Помощь"))

GAME_NAMES = {
    '1': '2048', '2': 'Snake', '3': 'Dino Run', '4': 'Clicker', 
    '5': 'Шашки', '6': 'Сапёр', '7': 'Пасьянс', '8': 'Tetris', '9': 'Paint'
}

# =============== DB HELPER ===============
def get_db_connection():
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
            token = str(uuid.uuid4())
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

@bot.message_handler(commands=['start'])
def start_cmd(message):
    tg_id = message.from_user.id
    username = message.from_user.username or "Player"
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user = cursor.fetchone()

            if not user:
                cursor.execute(
                    "INSERT INTO users (tg_id, username) VALUES (%s, %s) RETURNING id",
                    (tg_id, username)
                )
                new_user_id = cursor.fetchone()[0]
                # Создаем статистику с 1000 монетами для новых пользователей
                cursor.execute(
                    "INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1)",
                    (new_user_id,)
                )
                conn.commit()
                bot.send_message(message.chat.id, "Добро пожаловать! Аккаунт создан. Вам начислено 1000 монет 💰", reply_markup=REPLY_KEYBOARD)
            else:
                user_id = user[0]
                cursor.execute("SELECT id FROM stats WHERE user_id=%s", (user_id,))
                if not cursor.fetchone():
                     cursor.execute(
                        "INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1)",
                        (user_id,)
                    )
                     conn.commit()
                
                bot.send_message(message.chat.id, "С возвращением! Выбери действие:", reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in start_cmd: {e}")
        bot.send_message(message.chat.id, "Ошибка базы данных.", reply_markup=REPLY_KEYBOARD)

@bot.message_handler(commands=['games'])
@bot.message_handler(func=lambda message: message.text == "🎮 Играть")
def games_cmd_or_button(message):
    handle_games_request(message)

@bot.message_handler(commands=['profile'])
@bot.message_handler(func=lambda message: message.text == "👤 Профиль")
def profile_cmd(message):
    tg_id = message.from_user.id
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT u.username, s.coins, s.xp, s.level 
                FROM users u
                LEFT JOIN stats s ON u.id = s.user_id
                WHERE u.tg_id = %s
            """, (tg_id,))
            
            user_data = cursor.fetchone()
            
            if user_data:
                coins = user_data['coins'] if user_data['coins'] is not None else 1000
                xp = user_data['xp'] if user_data['xp'] is not None else 0
                level = user_data['level'] if user_data['level'] is not None else 1
                name = user_data['username'] or "Игрок"
                
                text = (
                    f"👤 *Твой Профиль*\n\n"
                    f"🆔 *Имя*: {name}\n"
                    f"📊 *Уровень*: {level}\n"
                    f"⭐ *Опыт (XP)*: {xp}\n"
                    f"💰 *Монеты*: {coins}\n\n"
                    f"💡 _Играй в игры, чтобы заработать больше!_"
                )
                bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)
            else:
                bot.send_message(message.chat.id, "Профиль не найден. Нажми /start", reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in profile_cmd: {e}")
        bot.send_message(message.chat.id, "Ошибка при получении профиля.", reply_markup=REPLY_KEYBOARD)

@bot.message_handler(func=lambda message: message.text == "❓ Помощь")
def help_cmd(message):
    text = "🤖 *Помощь:*\nНажимай кнопки в меню, чтобы играть и смотреть статистику."
    bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)

@bot.message_handler(commands=['stats'])
@bot.message_handler(func=lambda message: message.text == "🏆 Моя Статистика")
def stats_cmd(message):
    send_stats_page(message.chat.id, message.from_user.id, 0, message.message_id)

def send_stats_page(chat_id, tg_id, page, message_id=None, is_edit=False):
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user_row = cursor.fetchone()
            if not user_row: return
            user_id = user_row['id']
            
            cursor.execute("""
                WITH RankedScores AS (
                    SELECT game_id, score, created_at,
                        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY score DESC, created_at DESC) as rn
                    FROM game_scores WHERE user_id=%s
                )
                SELECT game_id, score, created_at FROM RankedScores WHERE rn = 1 ORDER BY score DESC, game_id
            """, (user_id,))
            best_scores = cursor.fetchall()
            
            if not best_scores:
                bot.send_message(chat_id, "Статистики пока нет. Сыграйте в игру!", reply_markup=REPLY_KEYBOARD)
                return
            
            num_games = len(best_scores)
            page = page % num_games
            current = best_scores[page]
            game_name = GAME_NAMES.get(current['game_id'], f"Игра #{current['game_id']}")
            
            created_at = current.get('created_at')
            date_str = "Н/Д"
            if isinstance(created_at, datetime): date_str = created_at.strftime("%d.%m.%Y %H:%M")
            elif isinstance(created_at, str): 
                try: date_str = datetime.fromisoformat(created_at).strftime("%d.%m.%Y %H:%M")
                except: date_str = created_at

            text = f"🏆 *Статистика* ({page+1}/{num_games}):\n\n🕹️ *{game_name}*\n📈 *Рекорд*: {current['score']}\n🗓️ {date_str}"
            
            markup = types.InlineKeyboardMarkup(row_width=3)
            buttons = [
                types.InlineKeyboardButton("⬅️", callback_data=f"stats_{(page-1)%num_games}_{tg_id}"),
                types.InlineKeyboardButton(f"{page+1}/{num_games}", callback_data="stats_info"),
                types.InlineKeyboardButton("➡️", callback_data=f"stats_{(page+1)%num_games}_{tg_id}")
            ]
            markup.add(*buttons)

            if is_edit and message_id:
                bot.edit_message_text(chat_id=chat_id, message_id=message_id, text=text, reply_markup=markup, parse_mode='Markdown')
            else:
                bot.send_message(chat_id, text, reply_markup=markup, parse_mode='Markdown')
        conn.close()
    except Exception as e:
        print(f"Error stats: {e}")

@bot.callback_query_handler(func=lambda call: call.data.startswith('stats_'))
def stats_callback(call):
    if call.data == "stats_info":
        bot.answer_callback_query(call.id)
        return
    try:
        parts = call.data.split('_')
        page = int(parts[1])
        owner_id = int(parts[2])
        if call.from_user.id != owner_id:
             bot.answer_callback_query(call.id, "Это чужая статистика")
             return
        send_stats_page(call.message.chat.id, call.from_user.id, page, call.message.message_id, is_edit=True)
        bot.answer_callback_query(call.id)
    except: pass

# =============== FLASK ===============
app = Flask(__name__, static_folder=SITE_DIR, static_url_path='')
CORS(app)

@app.route('/')
def index(): return send_from_directory(SITE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(SITE_DIR, path)): return send_from_directory(SITE_DIR, path)
    return send_from_directory(SITE_DIR, 'index.html')

@app.post("/api/auth/verify")
def verify():
    data = request.get_json()
    token = data.get("token")
    if not token: return jsonify({"success": False})

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT users.id, users.username, auth_tokens.expires_at
                FROM auth_tokens JOIN users ON users.id = auth_tokens.user_id WHERE auth_tokens.token=%s
            """, (token,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return jsonify({"success": False, "error": "Invalid token"})

            user_id, username, expires_at = row
            if isinstance(expires_at, str): expires_at = datetime.fromisoformat(expires_at)
            
            if datetime.now(timezone.utc) > expires_at.replace(tzinfo=timezone.utc):
                conn.close()
                return jsonify({"success": False, "error": "Expired"})

            session_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO sessions (user_id, session_id) VALUES (%s, %s)", (user_id, session_id))
            cursor.execute("DELETE FROM auth_tokens WHERE token=%s", (token,))
            conn.commit()
        conn.close()
        return jsonify({"success": True, "username": username, "session": session_id})
    except: return jsonify({"success": False})

# --- ИСПРАВЛЕННЫЙ ЭНДПОИНТ ПОЛУЧЕНИЯ ДАННЫХ ---
@app.get("/api/user")
def get_user_info():
    session_id = request.args.get("session")
    if not session_id: return jsonify({"success": False})

    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Получаем данные
            cursor.execute("""
                SELECT u.id as user_id, u.username, u.tg_id, s.coins, s.xp 
                FROM sessions ses
                JOIN users u ON u.id = ses.user_id
                LEFT JOIN stats s ON s.user_id = u.id
                WHERE ses.session_id=%s
            """, (session_id,))
            
            user_data = cursor.fetchone()

            # ЛОГИКА ДЛЯ 1000 МОНЕТ:
            # Если запись пользователя есть, но в stats пусто (coins is None), создаем запись
            if user_data and user_data.get('coins') is None:
                user_id = user_data['user_id']
                # Создаем запись в stats, если её нет
                cursor.execute("""
                    INSERT INTO stats (user_id, xp, coins, level) 
                    VALUES (%s, 0, 1000, 1) 
                    ON CONFLICT (user_id) DO NOTHING
                """, (user_id,))
                conn.commit()
                
                # Обновляем данные для ответа
                user_data['coins'] = 1000
                user_data['xp'] = 0

        conn.close()
        if user_data: return jsonify({"success": True, **user_data})
        return jsonify({"success": False})
    except Exception as e:
        print(f"User API Error: {e}")
        return jsonify({"success": False})

@app.post("/api/game/score")
def save_score_api():
    data = request.get_json()
    session_id = data.get("session")
    game_id = data.get("game_id")
    score = data.get("score")
    if not session_id or not game_id or score is None: return jsonify({"success": False}), 400
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT user_id FROM sessions WHERE session_id=%s", (session_id,))
            row = cursor.fetchone()
            if row:
                cursor.execute("INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (%s, %s, %s, %s)", 
                              (row[0], game_id, int(score), datetime.now(timezone.utc).isoformat()))
                conn.commit()
        conn.close()
        return jsonify({"success": True})
    except: return jsonify({"success": False}), 500

if __name__ == "__main__":
    if BOT_TOKEN: threading.Thread(target=run_bot, daemon=True).start()
    app.run(host="0.0.0.0", port=PORT)
