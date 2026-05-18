"""
Pydantic schemas for the AI service.

CRITICAL: These must stay in sync with packages/shared-types/src/ai.types.ts.
Any change here requires a matching change in the TypeScript file and vice versa.
Follow the Contract Change Rule in the blueprint (Section 12).
"""

from pydantic import BaseModel, Field


# ─── Anti-Bot ─────────────────────────────────────────────────────────────────

class AntiBotRequest(BaseModel):
    user_id:                  str
    auction_id:               str
    bid_amount:               float
    ip_address:               str
    session_duration_seconds: int
    bids_in_last_minute:      int
    time_to_bid_ms:           int


class AntiBotResponse(BaseModel):
    is_bot:     bool
    confidence: float = Field(ge=0.0, le=1.0)
    reason:     str


# ─── Fraud Detection ──────────────────────────────────────────────────────────

class FraudRequest(BaseModel):
    user_id:            str
    auction_id:         str
    bid_amount:         float
    account_age_days:   int
    total_bids_history: int
    ip_country:         str
    bid_velocity_1h:    int


class FraudResponse(BaseModel):
    flagged: bool
    score:   float = Field(ge=0.0, le=1.0)
    signals: list[str]


# ─── Recommender ──────────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    user_id:         str
    recently_viewed: list[str]   # auction IDs
    bid_history:     list[str]   # auction IDs
    limit:           int = 10


class RecommendItem(BaseModel):
    auction_id: str
    score:      float
    reason:     str   # 'similar_category' | 'trending' | 'collaborative'


class RecommendResponse(BaseModel):
    recommendations: list[RecommendItem]


# ─── Embed (Phase 2) ──────────────────────────────────────────────────────────

class EmbedRequest(BaseModel):
    auction_id:  str
    description: str


class EmbedResponse(BaseModel):
    auction_id: str
    dimensions: int   # always 384 for all-MiniLM-L6-v2
