from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import anti_bot, fraud, recommender
from app.ml import anti_bot_model, fraud_model, recommender_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup sequence:
      - Anti-bot (XGBoost) and fraud (Isolation Forest) load synchronously — both < 1s.
      - Recommender (Sentence Transformers) loads in background — 30–60s, non-blocking.
        Returns empty list until ready. Never hangs the service.
    """
    anti_bot_model.load()
    fraud_model.load()
    asyncio.create_task(recommender_model.load_in_background())
    yield
    # Shutdown: nothing to clean up for these models


app = FastAPI(
    title="Auction Platform — AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(anti_bot.router,    prefix="/ai", tags=["Anti-Bot"])
app.include_router(fraud.router,       prefix="/ai", tags=["Fraud"])
app.include_router(recommender.router, prefix="/ai", tags=["Recommender"])


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health():
    """
    Reports readiness of each model.
    Backend polls this before relying on AI calls.
    """
    all_ready = (
        anti_bot_model.ready
        and fraud_model.ready
        and recommender_model.recommender_ready
    )
    return {
        "status": "ready" if all_ready else "loading",
        "models": {
            "antiBot":     anti_bot_model.ready,
            "fraud":       fraud_model.ready,
            "recommender": recommender_model.recommender_ready,
        },
    }
