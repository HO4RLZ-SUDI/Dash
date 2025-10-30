# server.py
import os
import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from openai import OpenAI
import random

# ========== CONFIG ==========
HF_TOKEN = os.getenv("HF_TOKEN", "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")
MODEL = os.getenv("HF_MODEL", "openai/gpt-oss-20b:groq")

app = Flask(__name__)
CORS(app)

# ========== AI CLIENT ==========
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN,
)

chat_memory = []  # เก็บบทสนทนา

def ai_chat(message: str):
    """คุยกับ AI พร้อมจำบทสนทนา"""
    global chat_memory
    chat_memory.append({"role": "user", "content": message})
    if len(chat_memory) > 10:
        chat_memory = chat_memory[-10:]  # เก็บ 10 ข้อความล่าสุด

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are iHydro AI assistant that gives short, friendly Thai responses."},
                *chat_memory,
            ],
        )
        reply = completion.choices[0].message.content
        chat_memory.append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        print("❌ AI API error:", e)
        return "AI ไม่พร้อม ลองใหม่อีกทีนะ 🤖"

# ========== SENSOR DATA ==========
sensor_data = {
    "temperature": 30.2,
    "humidity": 65.5,
    "tds": 950,
    "ph": 6.3,
}

history = []

def generate_sensor_data():
    """สุ่มค่าจำลอง sensor ทุก 10 วินาที"""
    global sensor_data, history
    sensor_data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "temperature": round(random.uniform(25, 35), 1),
        "humidity": round(random.uniform(50, 90), 1),
        "tds": round(random.uniform(700, 1300), 0),
        "ph": round(random.uniform(5.5, 7.5), 2),
    }
    history.append(sensor_data)
    if len(history) > 200:
        history.pop(0)

# ========== API ROUTES ==========

@app.route("/api/sensors")
def get_sensors():
    return jsonify(sensor_data)

@app.route("/api/history")
def get_history():
    return jsonify(history[-50:])

@app.route("/api/summary/<range>")
def get_summary(range):
    """สรุปค่าเฉลี่ย / ต่ำสุด / สูงสุด"""
    if not history:
        return jsonify({"range": range, "count": 0, "stats": {}})
    temps = [d["temperature"] for d in history]
    hums = [d["humidity"] for d in history]
    tdss = [d["tds"] for d in history]
    phs = [d["ph"] for d in history]
    return jsonify({
        "range": range,
        "count": len(history),
        "stats": {
            "temperature": {"min": min(temps), "max": max(temps), "avg": sum(temps)/len(temps)},
            "humidity": {"min": min(hums), "max": max(hums), "avg": sum(hums)/len(hums)},
            "tds": {"min": min(tdss), "max": max(tdss), "avg": sum(tdss)/len(tdss)},
            "ph": {"min": min(phs), "max": max(phs), "avg": sum(phs)/len(phs)},
        }
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True)
    msg = data.get("message", "")
    if not msg:
        return jsonify({"response": "❌ ไม่พบข้อความ"})
    reply = ai_chat(msg)
    return jsonify({"response": reply})

# ========== RUN SERVER ==========
if __name__ == "__main__":
    print("🚀 Starting iHydro AI Server...")
    print(f"🌿 Model: {MODEL}")
    print(f"🔑 Token: {HF_TOKEN[:10]}************")
    print("✅ Server is running on http://0.0.0.0:5000")
    from threading import Thread

    def auto_update():
        while True:
            generate_sensor_data()
            time.sleep(10)

    Thread(target=auto_update, daemon=True).start()
    app.run(host="0.0.0.0", port=5000, debug=True)
