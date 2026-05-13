
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {
        "status": "success",
        "message": "Python API funcionando"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

