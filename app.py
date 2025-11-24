
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Response
from core.dialogue import create_new_thread, add_message_to_thread, run_thread, get_thread_messages, format_conversation
# from core.audio import synthesize_full_audio
from core.audio_v2 import synthesize_full_audio
import uuid
from threading import Thread
import time
import traceback
from credits import SECRET_KEY

app = Flask(__name__)
app.secret_key = SECRET_KEY

# Глобальное хранилище фоновых задач
tasks = {}

@app.route("/", methods=["GET"])
def index():
    if "thread_id" not in session:
        session["thread_id"] = None
        session["conversation"] = []
    return render_template("index.html", conversation=session.get("conversation", []))

@app.route("/send_message", methods=["POST"])
def send_message():
    data = request.json
    user_message = data.get("message")
    if not user_message:
        return jsonify({"error": "Пустое сообщение"}), 400

    try:
        # 1) Засекаем время AI
        ai_start = time.time()
        if session.get("thread_id") is None:
            thread = create_new_thread(user_message)
            session["thread_id"] = thread.id
        else:
            add_message_to_thread(session["thread_id"], user_message)
        run_thread(session["thread_id"])
        messages = get_thread_messages(session["thread_id"])
        session["conversation"] = format_conversation(messages)

        latest_response = next((msg["content"] for msg in session["conversation"] if msg["role"] == "assistant"), "")
        print(latest_response)

        ai_duration = time.time() - ai_start
        app.logger.info(f"AI response generation took {ai_duration:.2f}s")

        # 2) Запускаем фоновый синтез
        task_id = str(uuid.uuid4())
        # инициализируем segments пустым списком
        tasks[task_id] = {"status":"pending", "audio":None, "segments":[]}
        Thread(target=generate_audio_background, args=(task_id, latest_response)).start()

        # 3) сразу возвращаем и task_id, и ai_time, и segments (пока пустые)
        return jsonify({
            "response": latest_response,
            "task_id":  task_id,
            "ai_time":  f"{ai_duration:.2f}",
            "segments": tasks[task_id]["segments"]
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# def generate_audio_background(task_id, text):
#     try:
#         audio = synthesize_full_audio(text)
#         tasks[task_id] = {"status": "ready", "audio": audio}
#     except Exception as e:
#         tasks[task_id] = {"status": "error", "audio": None}

def generate_audio_background(task_id, text):
    """Фоновый синтез: генерим audio и segments, логируем время, сохраняем в tasks."""
    try:
        audio_start = time.time()
        result = synthesize_full_audio(text)
        audio_duration = time.time() - audio_start
        app.logger.info(f"Audio generation for task {task_id} took {audio_duration:.2f}s")

        # обновляем запись в tasks
        tasks[task_id]["audio"]    = result["audio"]
        tasks[task_id]["segments"] = result["segments"]
        tasks[task_id]["status"]   = "ready"

    except Exception as e:
        app.logger.error(f"Audio generation error for task {task_id}: {e}")
        tasks[task_id]["status"]   = "error"
        tasks[task_id]["audio"]    = None
        tasks[task_id]["segments"] = []

@app.route("/get_segments", methods=["GET"])
def get_segments():
    task_id = request.args.get("task_id")
    task = tasks.get(task_id)
    if not task:
        return jsonify({"status": "not_found"}), 404
    if task["status"] == "pending":
        return jsonify({"status": "processing"}), 202
    if task["status"] == "error":
        return jsonify({"status": "error"}), 500
    # готово
    return jsonify({
        "status":   "ready",
        "segments": task.get("segments", [])
    })



@app.route("/get_audio")
def get_audio():
    task_id = request.args.get("task_id")
    task = tasks.get(task_id)
    if not task:
        return jsonify({"status": "not_found"}), 404
    if task["status"] == "pending":
        return jsonify({"status": "processing"}), 202
    if task["status"] == "error":
        return jsonify({"status": "error"}), 500
    return Response(task["audio"], mimetype="audio/wav")

@app.route("/reset")
def reset():
    session.pop("thread_id", None)
    session.pop("conversation", None)
    return redirect(url_for("index"))

@app.route("/clear_audio", methods=["POST"])
def clear_audio():
    task_id = request.args.get("task_id")
    if task_id in tasks:
        del tasks[task_id]
        return jsonify({"status": "cleared"})
    return jsonify({"status": "not_found"}), 404


if __name__ == "__main__":
    app.run(debug=True)
