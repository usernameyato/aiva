import requests
from io import BytesIO
from scipy.io.wavfile import read
import sounddevice as sd

# Отправляем запрос
resp = requests.post(
    "http://127.0.0.1:8000/tts",
    json={
        "text": "Привет! Проверяю работу сервиса.",
        "speaker": "baya",
        "sample_rate": 48000
    }
)
resp.raise_for_status()

# Сохраняем или играем сразу
data = resp.content  # байты WAV
# Вариант A: сохранить
with open("test.wav", "wb") as f:
    f.write(data)
print("✅ Сохранили test.wav")

# Вариант B: проиграть прямо
wav_io = BytesIO(data)
sr, audio = read(wav_io)
sd.play(audio, sr)
sd.wait()
