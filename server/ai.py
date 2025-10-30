import os
from typing import List

from openai import OpenAI


def _client(token: str) -> OpenAI:
    if not token:
        raise RuntimeError("HF_TOKEN is not configured")
    return OpenAI(base_url="https://router.huggingface.co/v1", api_key=token)


def ai_chat(model: str, history: List[dict], message: str, token: str | None = None) -> str:
    if token is None:
        token = os.getenv("HF_TOKEN", "")
    try:
        client = _client(token)
    except RuntimeError:
        return "AI ไม่พร้อม ลองใหม่อีกทีนะ 🤖"

    messages = [
        {"role": "system", "content": "You are iHydro AI assistant that gives short, friendly Thai responses."},
        *history,
        {"role": "user", "content": message},
    ]
    try:
        completion = client.chat.completions.create(model=model, messages=messages)
        return completion.choices[0].message.content
    except Exception:
        return "AI ไม่พร้อม ลองใหม่อีกทีนะ 🤖"
