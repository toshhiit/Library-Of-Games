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

# Загружаем переменные окружения
BOT_TOKEN = os.getenv("BOT_TOKEN")
SITE_URL = os.getenv("SITE_URL")
DATABASE_URL = os.getenv("DATABASE_URL")
PORT = int(os.environ.get("PORT", 8080))

# Настройка путей для статики
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')

if not os.path.exists(DIST_DIR):
    SITE_DIR = BASE_DIR
else:
    SITE_DIR = DIST_DIR

print(f"Server is serving static files from: {SITE_DIR}")

if not BOT_TOKEN:
    print("WARNING: BOT_TOKEN не найден! Бот не запустится.")
if not DATABASE_URL:
    print("WARNING: DATABASE_URL не найден!")

# ==================== CONFIGURATION ====================

ACHIEVEMENTS_RULES = [
    {"id": "2048_novice", "game_id": "1", "score": 1000, "name": "Новичок 2048", "desc": "Набрал 1000 очков в 2048"},
    {"id": "2048_pro", "game_id": "1", "score": 5000, "name": "Профи 2048", "desc": "Набрал 5000 очков в 2048"},
    {"id": "snake_eater", "game_id": "2", "score": 10, "name": "Сытый удав", "desc": "Съел 10 яблок в Змейке"},
    {"id": "dino_runner", "game_id": "3", "score": 500, "name": "Марафонец", "desc": "Пробежал 500м в Дино"},
    {"id": "clicker_fast", "game_id": "4", "score": 200, "name": "Быстрые пальцы", "desc": "200 кликов за минуту"},
]

# Обновленная клавиатура с кнопкой достижений
REPLY_KEYBOARD = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
REPLY_KEYBOARD.add(types.KeyboardButton("🎮 Играть"))
REPLY_KEYBOARD.add(types.KeyboardButton("👤 Профиль"), types.KeyboardButton("🏅 Достижения"))
REPLY_KEYBOARD.add(types.KeyboardButton("🏆 Моя Статистика"), types.KeyboardButton("❓ Помощь"))

GAME_NAMES = {
    '1': '2048', '2': 'Snake', '3': 'Dino Run', '4': 'Clicker', 
    '5': 'Шашки', '6': 'Сапёр', '7': 'Пасьянс', '8': 'Tetris', '9': 'Paint'
}

# =============== DB HELPER ===============
def get_db_connection():
    if not DATABASE_URL:
        return None
    try:
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
    except Exception as e:
        print(f"DB Connection Error: {e}")
        return None

# Функция инициализации таблиц
def init_db():
    try:
        conn = get_db_connection()
        if not conn:
            print("Could not connect to DB for init.")
            return
        
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    tg_id BIGINT UNIQUE NOT NULL,
                    username TEXT
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stats (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    xp INTEGER DEFAULT 0,
                    coins INTEGER DEFAULT 1000,
                    level INTEGER DEFAULT 1,
                    CONSTRAINT unique_user_stats UNIQUE (user_id)
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS game_scores (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    game_id TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_achievements (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    achievement_id TEXT NOT NULL,
                    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, achievement_id)
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TIMESTAMP NOT NULL
                );
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    session_id TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            print("Database initialized successfully.")
        conn.close()
    except Exception as e:
        print(f"Error initializing DB: {e}")

init_db()

# =============== BOT HANDLERS ===================
bot = telebot.TeleBot(BOT_TOKEN)

def run_bot():
    print("Telegram Bot started polling...")
    try:
        bot.infinity_polling()
    except Exception as e:
        print(f"Bot polling error: {e}")

@bot.message_handler(commands=['clear'])
def clear_db_cmd(message):
    try:
        conn = get_db_connection()
        if conn:
            with conn.cursor() as cursor:
                cursor.execute("TRUNCATE TABLE game_scores, user_achievements, auth_tokens, sessions, stats, users RESTART IDENTITY CASCADE;")
                conn.commit()
            conn.close()
            bot.reply_to(message, "🗑️ База данных полностью очищена (все пользователи и прогресс удалены).")
        else:
            bot.reply_to(message, "Ошибка подключения к БД.")
    except Exception as e:
        bot.reply_to(message, f"Ошибка при очистке: {e}")

def handle_games_request(message):
    tg_id = message.from_user.id
    chat_id = message.chat.id
    
    try:
        conn = get_db_connection()
        if not conn:
            bot.send_message(chat_id, "Ошибка подключения к базе данных.")
            return

        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            row = cursor.fetchone()
            
            if not row:
                bot.send_message(chat_id, "Сначала нажми /start", reply_markup=REPLY_KEYBOARD)
                return

            user_id = row[0]
            token = str(uuid.uuid4())
            expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
            
            cursor.execute("INSERT INTO auth_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)", (user_id, token, expires_at))
            conn.commit()
            
            link = f"{SITE_URL}/login.html?token={token}"
            
            markup = types.InlineKeyboardMarkup()
            btn = types.InlineKeyboardButton("Играть 🎮", url=link)
            markup.add(btn)
            
            bot.send_message(chat_id, "Твоя ссылка для входа (действует 10 минут):", reply_markup=markup)
        conn.close()
    except Exception as e:
        print(f"Error in handle_games_request: {e}")
        bot.send_message(chat_id, "Ошибка сервера.", reply_markup=REPLY_KEYBOARD)

@bot.message_handler(commands=['start'])
def start_cmd(message):
    tg_id = message.from_user.id
    username = message.from_user.username or "Player"
    
    try:
        conn = get_db_connection()
        if not conn: return

        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user = cursor.fetchone()

            if not user:
                cursor.execute("INSERT INTO users (tg_id, username) VALUES (%s, %s) RETURNING id", (tg_id, username))
                new_user_id = cursor.fetchone()[0]
                cursor.execute("INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1)", (new_user_id,))
                conn.commit()
                bot.send_message(message.chat.id, "Добро пожаловать! Вам начислено 1000 монет 💰", reply_markup=REPLY_KEYBOARD)
            else:
                user_id = user[0]
                cursor.execute("SELECT id FROM stats WHERE user_id=%s", (user_id,))
                if not cursor.fetchone():
                     cursor.execute("INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1)", (user_id,))
                     conn.commit()
                bot.send_message(message.chat.id, "С возвращением! Выбери действие:", reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in start_cmd: {e}")

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
        if not conn: return

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT u.username, s.coins, s.xp, s.level 
                FROM users u
                LEFT JOIN stats s ON u.id = s.user_id
                WHERE u.tg_id = %s
            """, (tg_id,))
            user_data = cursor.fetchone()
            
            if user_data:
                text = (
                    f"👤 *Твой Профиль*\n\n"
                    f"🆔 *Имя*: {user_data.get('username', 'Игрок')}\n"
                    f"📊 *Уровень*: {user_data.get('level', 1)}\n"
                    f"⭐ *Опыт (XP)*: {user_data.get('xp', 0)}\n"
                    f"💰 *Монеты*: {user_data.get('coins', 1000)}"
                )
                bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)
            else:
                bot.send_message(message.chat.id, "Профиль не найден. Нажми /start", reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in profile_cmd: {e}")

@bot.message_handler(func=lambda message: message.text == "🏅 Достижения")
def achievements_cmd(message):
    tg_id = message.from_user.id
    try:
        conn = get_db_connection()
        if not conn: return

        with conn.cursor() as cursor:
            # Получаем ID пользователя
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            row = cursor.fetchone()
            if not row:
                bot.send_message(message.chat.id, "Сначала нажми /start")
                conn.close()
                return
            
            user_id = row[0]
            
            # Получаем уже открытые достижения
            cursor.execute("SELECT achievement_id FROM user_achievements WHERE user_id=%s", (user_id,))
            unlocked_ids = {r[0] for r in cursor.fetchall()}
            
            response_text = "🏅 *Ваши достижения:*\n\n"
            
            for rule in ACHIEVEMENTS_RULES:
                status = "✅" if rule['id'] in unlocked_ids else "🔒"
                response_text += f"{status} *{rule['name']}*\n_{rule['desc']}_\n\n"
            
            bot.send_message(message.chat.id, response_text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)
        conn.close()
    except Exception as e:
        print(f"Error in achievements_cmd: {e}")

@bot.message_handler(commands=['stats'])
@bot.message_handler(func=lambda message: message.text == "🏆 Моя Статистика")
def stats_cmd(message):
    send_stats_page(message.chat.id, message.from_user.id, 0, message.message_id)

def send_stats_page(chat_id, tg_id, page, message_id=None, is_edit=False):
    try:
        conn = get_db_connection()
        if not conn: return
        
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE tg_id=%s", (tg_id,))
            user_row = cursor.fetchone()
            if not user_row: 
                conn.close()
                return
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
                conn.close()
                return
            
            num_games = len(best_scores)
            page = page % num_games
            current = best_scores[page]
            game_name = GAME_NAMES.get(current['game_id'], f"Игра #{current['game_id']}")
            
            created_at = current.get('created_at')
            date_str = str(created_at) if created_at else "Н/Д"

            text = f"🏆 *Рекорды* ({page+1}/{num_games}):\n\n🕹️ *{game_name}*\n📈 *Счет*: {current['score']}\n"
            
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

@bot.message_handler(func=lambda message: message.text == "❓ Помощь")
def help_cmd(message):
    text = "🤖 *Помощь:*\nИграй в мини-игры, копи монеты и открывай достижения!\nНажми '🎮 Играть' чтобы начать."
    bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=REPLY_KEYBOARD)


# =============== FLASK APP ===============
app = Flask(__name__, static_folder=SITE_DIR, static_url_path='')
CORS(app)

@app.route('/')
def index(): 
    return send_from_directory(SITE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(SITE_DIR, path)): 
        return send_from_directory(SITE_DIR, path)
    return send_from_directory(SITE_DIR, 'index.html')

@app.post("/api/auth/verify")
def verify():
    data = request.get_json()
    token = data.get("token")
    if not token: return jsonify({"success": False})

    try:
        conn = get_db_connection()
        if not conn: return jsonify({"success": False, "error": "DB Error"})

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
            
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) > expires_at:
                conn.close()
                return jsonify({"success": False, "error": "Expired"})

            session_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO sessions (user_id, session_id) VALUES (%s, %s)", (user_id, session_id))
            cursor.execute("DELETE FROM auth_tokens WHERE token=%s", (token,))
            conn.commit()
        conn.close()
        return jsonify({"success": True, "username": username, "session": session_id})
    except Exception as e:
        print(f"Auth verify error: {e}")
        return jsonify({"success": False})

@app.get("/api/user")
def get_user_info():
    session_id = request.args.get("session")
    if not session_id: return jsonify({"success": False})

    try:
        conn = get_db_connection()
        if not conn: return jsonify({"success": False})

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Получаем данные пользователя
            cursor.execute("""
                SELECT u.id as user_id, u.username, u.tg_id, s.coins, s.xp 
                FROM sessions ses
                JOIN users u ON u.id = ses.user_id
                LEFT JOIN stats s ON s.user_id = u.id
                WHERE ses.session_id=%s
            """, (session_id,))
            user_data = cursor.fetchone()

            if user_data:
                # --- ПОЛУЧАЕМ АВАТАРКУ ИЗ TELEGRAM ---
                avatar_url = None
                tg_id = user_data.get('tg_id')
                if tg_id:
                    try:
                        # Запрашиваем фото у Telegram API
                        photos = bot.get_user_profile_photos(tg_id, limit=1)
                        if photos.total_count > 0:
                            # Берем самую маленькую версию для скорости (или [-1] для качества)
                            file_id = photos.photos[0][0].file_id 
                            file_info = bot.get_file(file_id)
                            # Генерируем прямую ссылку на файл
                            avatar_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
                    except Exception as e:
                        print(f"Failed to fetch avatar: {e}")

                # Подтягиваем достижения
                cursor.execute("SELECT achievement_id FROM user_achievements WHERE user_id=%s", (user_data['user_id'],))
                achievements = [row['achievement_id'] for row in cursor.fetchall()]
                
                # Создаем статы если их нет (защита от сбоев)
                if user_data.get('coins') is None:
                    cursor.execute("INSERT INTO stats (user_id, xp, coins, level) VALUES (%s, 0, 1000, 1) ON CONFLICT (user_id) DO NOTHING", (user_data['user_id'],))
                    conn.commit()
                    user_data['coins'] = 1000
                    user_data['xp'] = 0

                user_data['achievements'] = achievements
                user_data['avatar_url'] = avatar_url # Добавляем ссылку в ответ

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
    
    if not session_id or not game_id or score is None: 
        return jsonify({"success": False}), 400
    
    new_unlocked = [] 
    score_val = int(score)

    try:
        conn = get_db_connection()
        if not conn: return jsonify({"success": False, "error": "DB Error"}), 500

        with conn.cursor() as cursor:
            cursor.execute("SELECT u.id, u.tg_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.session_id=%s", (session_id,))
            user_row = cursor.fetchone()
            
            if user_row:
                user_id, tg_id = user_row
                now_str = datetime.now(timezone.utc).isoformat()
                
                # 1. Сохраняем рекорд
                cursor.execute("INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (%s, %s, %s, %s)", 
                              (user_id, game_id, score_val, now_str))
                
                # 2. МГНОВЕННОЕ НАЧИСЛЕНИЕ МОНЕТ И ОПЫТА
                # 10% очков в монеты, 50% в опыт
                earned_coins = max(1, int(score_val * 0.1))
                earned_xp = max(1, int(score_val * 0.5))
                
                cursor.execute("""
                    UPDATE stats 
                    SET coins = coins + %s, xp = xp + %s 
                    WHERE user_id = %s
                """, (earned_coins, earned_xp, user_id))
                
                # 3. Проверка достижений
                cursor.execute("SELECT achievement_id FROM user_achievements WHERE user_id=%s", (user_id,))
                existing_ids = {row[0] for row in cursor.fetchall()}
                
                for rule in ACHIEVEMENTS_RULES:
                    if rule["game_id"] == str(game_id) and score_val >= rule["score"] and rule["id"] not in existing_ids:
                        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                        cursor.execute("INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (%s, %s, %s)", 
                                      (user_id, rule["id"], date_str))
                        existing_ids.add(rule["id"])
                        new_unlocked.append(rule)
                        
                        if tg_id:
                            try:
                                msg = f"🎉 <b>Новое достижение!</b>\n\n🏆 <b>{rule['name']}</b>\n📝 {rule['desc']}"
                                bot.send_message(tg_id, msg, parse_mode="HTML")
                            except: pass

                conn.commit()
        conn.close()
        return jsonify({"success": True, "new_achievements": new_unlocked, "earned_coins": earned_coins, "earned_xp": earned_xp})
    except Exception as e:
        print(f"Save Score Error: {e}")
        return jsonify({"success": False}), 500

if __name__ == "__main__":
    if BOT_TOKEN: 
        threading.Thread(target=run_bot, daemon=True).start()
    app.run(host="0.0.0.0", port=PORT)
