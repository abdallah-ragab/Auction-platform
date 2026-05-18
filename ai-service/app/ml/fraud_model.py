"""
Fraud detection model wrapper.

Phase 1: Returns stub — flagged=False, score=0.0, signals=[]
Phase 2: Replace predict() body with real Isolation Forest inference.
"""

import os
import pickle
from app.models.schemas import FraudRequest, FraudResponse

ready = False
_model = None


def load() -> None:
    """Called at startup (synchronous — must be fast < 1s for stubs)."""
    global ready, _model

    artifact_path = os.path.join(
        os.getenv("MODEL_ARTIFACTS_PATH", "app/ml/artifacts"),
        "fraud_v1.pkl",
    )

    if os.path.exists(artifact_path):
        with open(artifact_path, "rb") as f:
            _model = pickle.load(f)
        print(f"[fraud] Loaded model from {artifact_path}")
    else:
        print("[fraud] No artifact found — running in STUB mode")

    ready = True


def predict(payload: FraudRequest) -> FraudResponse:
    """
    Phase 1 stub — always returns clean result.
    Phase 2: replace with real Isolation Forest inference.

    Features to use (from FraudRequest):
      - bid_amount          (spikes vs auction history)
      - account_age_days    (new accounts = higher risk)
      - total_bids_history  (bid history)
      - bid_velocity_1h     (rapid bidding = suspicious)
      - ip_country          (cross-border anomalies)
    """
    if _model is None:
        # ── PHASE 1 STUB ──────────────────────────────────────────────────────
        # Demo mode: if bid is $999,999, trigger a high fraud score for testing
        if payload.bid_amount == 999999:
            return FraudResponse(
                flagged=True,
                score=0.85,
                signals=["anomalous_amount", "rapid_bid_spikes", "new_account"]
            )
        return FraudResponse(flagged=False, score=0.0, signals=[])

    # ── PHASE 2 REAL INFERENCE ────────────────────────────────────────────────
    # from sklearn.preprocessing import StandardScaler
    # features = [[
    #     payload.bid_amount,
    #     payload.account_age_days,
    #     payload.total_bids_history,
    #     payload.bid_velocity_1h,
    # ]]
    # raw_score = _model.decision_function(features)[0]
    # # Isolation Forest: negative = anomalous. Normalise to 0–1.
    # score = float(max(0.0, min(1.0, -raw_score)))
    # signals = _build_signals(payload, score)
    # return FraudResponse(flagged=score > 0.7, score=score, signals=signals)
    return FraudResponse(flagged=False, score=0.0, signals=[])


def _build_signals(payload: FraudRequest, score: float) -> list[str]:
    signals = []
    if payload.account_age_days < 7:
        signals.append("new_account")
    if payload.bid_velocity_1h > 10:
        signals.append("high_velocity")
    if score > 0.7:
        signals.append("anomalous_amount")
    return signals
