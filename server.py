@app.post("/api/game/score")
def save_score_api():
    data = request.get_json()
    session_id = data.get("session")
    game_id = data.get("game_id")
    score = data.get("score")
    
    if not session_id or not game_id or score is None: 
        return jsonify({"success": False}), 400
    
    new_unlocked = [] 

    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # 1. Находим юзера по сессии
            cursor.execute("SELECT u.id, u.tg_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.session_id=%s", (session_id,))
            user_row = cursor.fetchone()
            
            if user_row:
                user_id, tg_id = user_row
                
                # 2. Сохраняем рекорд игры
                # created_at тоже можно писать как текст, если в той таблице тоже проблемы, 
                # но обычно там TIMESTAMP работает. Если нет - используйте .isoformat()
                cursor.execute("INSERT INTO game_scores (user_id, game_id, score, created_at) VALUES (%s, %s, %s, %s)", 
                              (user_id, game_id, int(score), datetime.now(timezone.utc).isoformat()))
                
                # 3. ПРОВЕРКА АЧИВОК
                # Получаем уже открытые ачивки этого юзера
                cursor.execute("SELECT achievement_id FROM user_achievements WHERE user_id=%s", (user_id,))
                existing_ids = {row[0] for row in cursor.fetchall()}
                
                for rule in ACHIEVEMENTS_RULES:
                    # Проверяем условия: та ли игра, побит ли рекорд, нет ли уже такой ачивки
                    if rule["game_id"] == str(game_id) and int(score) >= rule["score"] and rule["id"] not in existing_ids:
                        
                        # Текущая дата как СТРОКА
                        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

                        # Добавляем в БД (теперь передаем 3 параметра: user_id, achievement_id, unlocked_at)
                        cursor.execute("""
                            INSERT INTO user_achievements (user_id, achievement_id, unlocked_at) 
                            VALUES (%s, %s, %s)
                        """, (user_id, rule["id"], date_str))
                        
                        existing_ids.add(rule["id"])
                        new_unlocked.append(rule)
                        
                        # Отправляем сообщение в Телеграм
                        if tg_id:
                            try:
                                msg = f"🎉 <b>Новое достижение!</b>\n\n🏆 <b>{rule['name']}</b>\n📝 {rule['desc']}"
                                bot.send_message(tg_id, msg, parse_mode="HTML")
                            except Exception as e:
                                print(f"Failed to send TG msg: {e}")

                conn.commit()
        conn.close()
        return jsonify({"success": True, "new_achievements": new_unlocked})
    except Exception as e:
        print(f"Save Score Error: {e}")
        return jsonify({"success": False}), 500
