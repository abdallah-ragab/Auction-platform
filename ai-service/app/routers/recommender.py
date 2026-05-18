from fastapi import APIRouter
from app.models.schemas import RecommendRequest, RecommendResponse
from app.ml import recommender_model

router = APIRouter()


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(payload: RecommendRequest) -> RecommendResponse:
    """
    Personalised recommendation endpoint.
    Returns empty list until Sentence Transformer finishes loading (30–60s).
    NEVER hangs — the ready flag check is the guard.

    Backend caches results in Redis with 15min TTL per user.
    """
    if not recommender_model.recommender_ready:
        return RecommendResponse(recommendations=[])

    return recommender_model.predict(payload)
