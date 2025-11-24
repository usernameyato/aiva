from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import torch
from io import BytesIO
from scipy.io.wavfile import write
import uvicorn

app = FastAPI()

class TTSRequest(BaseModel):
    text: str
    speaker: str = "baya"
    sample_rate: int = 48000

# 1) Раз и навсегда загружаем и прогреваем модель
wrapper = torch.package.PackageImporter("silero_models/v4_ru.pt") \
            .load_pickle("tts_models", "model")

print("→ Warm-up микросервиса TTS…")
_ = wrapper.apply_tts(
    text="Привет, я готова озвучивать!",
    speaker="baya",
    sample_rate=48000
)
print("→ TTS ready!")

@app.post("/tts")
async def tts(req: TTSRequest):
    try:
        audio = wrapper.apply_tts(
            text=req.text,
            speaker=req.speaker,
            sample_rate=req.sample_rate
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    buf = BytesIO()
    write(buf, req.sample_rate, audio.cpu().numpy())
    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
