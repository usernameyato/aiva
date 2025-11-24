# core/tts_client.py
import requests
from io import BytesIO
from scipy.io.wavfile import read
import sounddevice as sd

TTS_URL = "http://127.0.0.1:8000/tts"

def synthesize_via_service(text: str, speaker: str = "baya", sample_rate: int = 48000) -> bytes:
    """
    Шлём POST-запрос в микросервис и возвращаем WAV-байты.
    """
    payload = {
        "text": text,
        "speaker": speaker,
        "sample_rate": sample_rate
    }
    resp = requests.post(TTS_URL, json=payload)
    resp.raise_for_status()
    return resp.content

def play_bytes(wav_bytes: bytes):
    """
    Воспроизводим WAV-байты через sounddevice.
    """
    buf = BytesIO(wav_bytes)
    sr, audio = read(buf)
    sd.play(audio, sr)
    sd.wait()
