import requests
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ← new: request model for the name
class NameRequest(BaseModel):
    results: Dict[str, Any]

# ← changed: now a POST endpoint taking JSON {"name": "..."}
@app.post("/mistral_chat")
def mistral_chat(req: NameRequest):
    try:
        prompt = (
    "Interpret the following clustering results in one short sentence per metric. "
    "Don't restate the number — explain what it means. Be concise, critical, and focus on what the values imply about clustering quality and generate about 8 or 10 lines:\n\n"
    f"{json.dumps(req.results, indent=2)}"
)



     
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": "Bearer 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",
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "mistralai/mistral-7b-instruct:free",
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        resp = response.json()
        answer = resp["choices"][0]["message"]["content"]
        return {"status": response.status_code, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))