"""
Anti-bot model wrapper.

Phase 1: Returns stub — is_bot=False, confidence=0.0, reason='stub'
Phase 2: Replace predict() body with real XGBoost inference.

DO NOT change the function signatures — the router imports them.
"""

import os
import pickle
from app.models.schemas import AntiBotRequest, AntiBotResponse

ready = False
_model = None


def load() -> None:
    """Called at startup (synchronous — must be fast < 1s for stubs)."""
    global ready, _model

    artifact_path = os.path.join(
        os.getenv("MODEL_ARTIFACTS_PATH", "app/ml/artifacts"),
        "anti_bot_v1.pkl",
    )

    if os.path.exists(artifact_path):
        with open(artifact_path, "rb") as f:
            _model = pickle.load(f)
        print(f"[anti-bot] Loaded model from {artifact_path}")
    else:
        # Phase 1: no artifact yet — stub mode
        print("[anti-bot] No artifact found — running in STUB mode")

    ready = True


def predict(payload: AntiBotRequest) -> AntiBotResponse:
    """
    Phase 1 stub — always returns clean result.
    Phase 2: replace this block with real XGBoost inference.

    Features to use (from AntiBotRequest):
      - time_to_bid_ms          (bots: < 300ms)
      - bids_in_last_minute     (bots: > 10)
      - session_duration_seconds (bots: very short)
      - ip_address              (bots: fixed IPs)
    """
    if _model is None:
        # ── PHASE 1 STUB ──────────────────────────────────────────────────────
        return AntiBotResponse(is_bot=False, confidence=0.0, reason="stub")

    # ── PHASE 2 REAL INFERENCE ────────────────────────────────────────────────
    # features = [
    #     payload.time_to_bid_ms,
    #     payload.bids_in_last_minute,
    #     payload.session_duration_seconds,
    # ]
    # confidence = float(_model.predict_proba([features])[0][1])
    # is_bot = confidence > 0.7
    # return AntiBotResponse(
    #     is_bot=is_bot,
    #     confidence=confidence,
    #     reason="xgboost_classifier",
    # )
    return AntiBotResponse(is_bot=False, confidence=0.0, reason="stub")
