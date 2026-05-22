"""
Recommender model wrapper.

Sentence Transformers loads slowly (30–60s). It MUST NOT block startup.
Pattern: background task sets recommender_ready = True when done.
Router checks this flag before calling predict() — never hangs.

Phase 1: Returns empty recommendations.
Phase 2: Real cosine similarity against pgvector embeddings.
"""

import asyncio
from app.models.schemas import RecommendRequest, RecommendResponse, RecommendItem
from app.config import settings

recommender_ready = False
_model = None


async def load_in_background() -> None:
    """
    Called via asyncio.create_task() in lifespan — never blocks startup.
    The /health endpoint reports recommender_ready so you can monitor load progress.
    """
    global recommender_ready, _model

    try:
        model_name = settings.SENTENCE_TRANSFORMER_MODEL
        print(f"[recommender] Loading {model_name} in background...")

        # Run the slow import in a thread so the event loop stays free
        loop = asyncio.get_event_loop()
        _model = await loop.run_in_executor(None, _load_model, model_name)

        recommender_ready = True
        print(f"[recommender] ✅ Ready — model: {model_name}")
    except Exception as e:
        print(f"[recommender] ❌ Failed to load model: {e}")
        # recommender_ready stays False — router returns empty list safely


def _load_model(model_name: str):
    """Blocking load — must run in executor."""
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name)


def predict(payload: RecommendRequest) -> RecommendResponse:
    """
    Phase 1: Returns empty list.
    Phase 2: Replace with pgvector cosine similarity query.

    The router checks recommender_ready before calling this.
    If not ready, it returns empty directly — this function is never called cold.
    """
    if _model is None:
        return RecommendResponse(recommendations=[])

    # ── PHASE 2 REAL INFERENCE ────────────────────────────────────────────────
    # 1. Build user profile vector from recently_viewed + bid_history embeddings
    # 2. Query pgvector: SELECT id, title, embedding <=> $userVector AS score
    #    FROM auctions WHERE status = 'ACTIVE' ORDER BY score LIMIT $limit
    # 3. Return ranked RecommendItem list
    return RecommendResponse(recommendations=[])
