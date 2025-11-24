import requests
from io import BytesIO
from scipy.io.wavfile import read, write
import sounddevice as sd
from nltk.tokenize import sent_tokenize
import numpy as np
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import re
import shutil

# URL вашего локального микросервиса TTS
TTS_URL = "http://127.0.0.1:8000/tts"

# Параметры чувствительного удаления тишины
MIN_SILENCE_LEN_MS = 20       # минимальная длина тишины для детекции (мс)
SILENCE_THRESH_OFFSET = 10    # offset от уровня dBFS сегмента для порога

# Фонема → визема
PHONEME_TO_VISEME = {
    "а":"viseme_aa","о":"viseme_oh","у":"viseme_uu","ы":"viseme_ih",
    "э":"viseme_eh","и":"viseme_iy","е":"viseme_ey","ё":"viseme_oh",
    "ю":"viseme_uw","я":"viseme_aa","л":"viseme_l","р":"viseme_r",
    "й":"viseme_y","м":"viseme_m","н":"viseme_n","п":"viseme_pp",
    "б":"viseme_pp","т":"viseme_t","д":"viseme_t","к":"viseme_k",
    "г":"viseme_k","ф":"viseme_fv","в":"viseme_fv","с":"viseme_s",
    "з":"viseme_s","ш":"viseme_sh","ж":"viseme_sh","х":"viseme_k",
    "ц":"viseme_s","ч":"viseme_ch","щ":"viseme_ch",
    "ь":"mouthOpen","ъ":"mouthOpen"," ":"mouthOpen",",":"mouthOpen",".":"mouthOpen"
}

def map_phoneme_to_viseme(ph):
    return PHONEME_TO_VISEME.get(ph.lower(), "mouthOpen")


def get_phonemes(word):
    try:
        from phonemizer import phonemize
        backend = "espeak-ng" if shutil.which("espeak-ng") else "espeak"
        phones = phonemize(
            word, language='ru', backend=backend, strip=True, preserve_punctuation=False
        ).split()
        if phones:
            return phones
    except Exception:
        pass
    return list(re.sub(r"[^\wа-яёА-ЯЁ]", "", word))


def synthesize_sentence(sentence: str, speaker: str = "baya", sample_rate: int = 48000) -> bytes:
    """
    Отправляем предложение в сервис, обрезаем тишину с высокой чувствительностью и возвращаем WAV-байты.
    """
    payload = {"text": sentence, "speaker": speaker, "sample_rate": sample_rate}
    resp = requests.post(TTS_URL, json=payload)
    resp.raise_for_status()
    wav_bytes = resp.content
    # триминг тишины
    segment = AudioSegment.from_file(BytesIO(wav_bytes), format="wav")
    silence_thresh = segment.dBFS - SILENCE_THRESH_OFFSET
    nonsilent = detect_nonsilent(
        segment,
        min_silence_len=MIN_SILENCE_LEN_MS,
        silence_thresh=silence_thresh
    )
    if nonsilent:
        start, end = nonsilent[0][0], nonsilent[-1][1]
        segment = segment[start:end]
    # экспортим обрезанный сегмент обратно в байты WAV
    buf = BytesIO()
    segment.export(buf, format="wav")
    return buf.getvalue()


def synthesize_full_audio(text: str, speaker: str = "baya", sample_rate: int = 48000) -> dict:
    """
    Сегментируем текст, синтезируем каждое предложение с тримингом, конкатенируем
    и возвращаем аудио и сегментацию по фонемам.
    """
    sentences = [s for s in sent_tokenize(text) if s.strip()]
    pcm_parts, durations = [], []
    for sent in sentences:
        wav_bytes = synthesize_sentence(sent, speaker, sample_rate)
        buf = BytesIO(wav_bytes)
        sr, audio = read(buf)
        pcm_parts.append(audio)
        durations.append(len(AudioSegment.from_file(BytesIO(wav_bytes), format="wav")) / 1000.0)
    if not pcm_parts:
        return {"audio": b"", "segments": []}
    full_pcm = np.concatenate(pcm_parts, axis=0)
    out_buf = BytesIO()
    write(out_buf, sample_rate, full_pcm)
    full_bytes = out_buf.getvalue()
    # формирование сегментов по равномерному шагу фонем
    words = re.findall(r"[\wа-яёА-ЯЁ']+", text)
    phoneme_seq = []
    for w in words:
        phoneme_seq.extend(get_phonemes(w))
    total_s = sum(durations)
    count = len(phoneme_seq) or 1
    step = total_s / count
    segments = []
    for idx, ph in enumerate(phoneme_seq):
        b = round(idx * step, 3)
        e = round((idx + 1) * step, 3)
        segments.append({
            "phoneme": ph,
            "viseme": map_phoneme_to_viseme(ph),
            "begin": b,
            "end": e
        })
    return {"audio": full_bytes, "segments": segments}


def play_audio_bytes(wav_bytes: bytes):
    buf = BytesIO(wav_bytes)
    sr, audio = read(buf)
    sd.play(audio, sr)
    sd.wait()
