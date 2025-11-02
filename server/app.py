from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import os, json, time, requests

# ===== CONFIG =====
HF_TOKEN = os.getenv("HF_TOKEN")  # ใช้ setx HF_TOKEN "your_token" ตั้งค่าไว้ก่อน
HF_MODEL = "MiniMaxAI/MiniMax-M2:novita"

def create_app():
    app = Flask(__name__)
    CORS(app)

    # 🧠 เก็บค่าล่าสุดจาก Arduino
    latest_data = {
        "temperature": 0,
        "humidity": 0,
        "tds": 0,
        "ph": 0,
        "water_temp": 0
    }

    # ===== ROUTES =====
    @app.route("/")
    def home():
        return "✅ Flask Server is running"

    # ===== Arduino อัปโหลดข้อมูลมา =====
    @app.route("/api/upload", methods=["POST"])
    def upload_data():
        nonlocal latest_data
        data = request.get_json()
        if not data:
            return jsonify({"error": "no data"}), 400
        latest_data.update(data)
        print("📥 Arduino Data:", latest_data)
        return jsonify({"status": "ok"})

    # ===== ส่งข้อมูลล่าสุดให้ React แบบ Real-time (SSE) =====
    @app.route("/api/stream")
    def stream_data():
        def generate():
            last_sent = {}
            while True:
                if latest_data != last_sent:
                    yield f"data: {json.dumps(latest_data)}\n\n"
                    last_sent = latest_data.copy()
                time.sleep(1)
        return Response(generate(), mimetype="text/event-stream")

    # ===== AI Chat (ใช้ Hugging Face inference API) =====
    @app.route("/api/chat", methods=["POST"])
    def chat_ai():
        try:
            data = request.get_json()
            message = data.get("message", "")
            print("💬 AI request:", message)

            if not HF_TOKEN:
                return jsonify({"response": "❌ HF_TOKEN is not set"}), 500

            url = f"https://api-inference.huggingface.co/models/{HF_MODEL}"
            headers = {
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json"
            }

            payload = {
                "inputs": message,
                "parameters": {"max_new_tokens": 200, "temperature": 0.7}
            }

            for attempt in range(3):
                response = requests.post(url, headers=headers, json=payload, timeout=90)
                print(f"📡 Attempt {attempt+1} → Status: {response.status_code}")

                # ✅ สำเร็จ
                if response.status_code == 200:
                    try:
                        result = response.json()
                        if isinstance(result, list) and len(result) > 0:
                            reply = result[0].get("generated_text", "").strip()
                        else:
                            reply = json.dumps(result)
                        print("🤖 Reply →", reply)
                        return jsonify({"response": reply})
                    except Exception as parse_err:
                        print("⚠️ Parse error:", parse_err)
                        print("Response text:", response.text)
                        return jsonify({"response": "⚠️ Error parsing response"}), 500

                # 🔄 กำลังโหลดโมเดล
                elif response.status_code == 503:
                    print("⏳ Model loading... waiting 10s")
                    time.sleep(10)
                else:
                    print("📡 Raw response:", response.text[:400])

            return jsonify({"response": "🤖 โมเดลไม่ตอบกลับ หรือชื่อโมเดลผิด"}), 500

        except Exception as e:
            print("❌ Chat error:", e)
            return jsonify({"response": f"เกิดข้อผิดพลาด: {e}"}), 500

    return app


# ===== MAIN =====
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)
