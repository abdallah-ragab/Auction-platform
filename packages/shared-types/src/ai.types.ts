// ─── AI Service Request / Response Contracts ──────────────────────────────────
// These must match the Pydantic schemas in ai-service/app/models/schemas.py EXACTLY.
// Any change here requires a matching change in the Python file and vice versa.

// ─── Anti-Bot ─────────────────────────────────────────────────────────────────

export interface AntiBotRequest {
  user_id:                  string;
  auction_id:               string;
  bid_amount:               number;
  ip_address:               string;
  session_duration_seconds: number;
  bids_in_last_minute:      number;
  time_to_bid_ms:           number;
}

export interface AntiBotResponse {
  is_bot:     boolean;
  confidence: number;   // 0.0 – 1.0
  reason:     string;
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────

export interface FraudRequest {
  user_id:            string;
  auction_id:         string;
  bid_amount:         number;
  account_age_days:   number;
  total_bids_history: number;
  ip_country:         string;
  bid_velocity_1h:    number;
}

export interface FraudResponse {
  flagged:  boolean;
  score:    number;     // 0.0 – 1.0
  signals:  string[];   // e.g. ['high_velocity', 'new_account', 'service_unavailable']
}

// ─── Recommender ──────────────────────────────────────────────────────────────

export interface RecommendRequest {
  user_id:         string;
  recently_viewed: string[];   // auction IDs
  bid_history:     string[];   // auction IDs
  limit:           number;
}

export interface RecommendItem {
  auction_id: string;
  score:      number;
  reason:     'similar_category' | 'trending' | 'collaborative';
}

export interface RecommendResponse {
  recommendations: RecommendItem[];
}

// ─── Embed (Phase 2) ──────────────────────────────────────────────────────────

export interface EmbedRequest {
  auction_id:  string;
  description: string;
}

export interface EmbedResponse {
  auction_id: string;
  dimensions: number;   // should always be 384 for all-MiniLM-L6-v2
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface AIHealthResponse {
  status: 'ready' | 'loading';
  models: {
    antiBot:     boolean;
    fraud:       boolean;
    recommender: boolean;
  };
}

// ─── Confidence Tiers ─────────────────────────────────────────────────────────
// Source of truth for threshold values. Import this everywhere — never hardcode.

export const AI_THRESHOLDS = {
  BLOCK:     0.7,   // > 0.7 → block (403/402)
  CHALLENGE: 0.4,   // > 0.4 → CAPTCHA / log for review
  CLEAN:     0.0,   // ≤ 0.4 → proceed
} as const;

// ─── Fallback Values ──────────────────────────────────────────────────────────
// Used by callWithFallback when AI service is unavailable.
// Fallbacks MUST allow the bid to proceed — never block on AI failure.

export const AI_FALLBACKS = {
  antiBot: {
    is_bot:     false,
    confidence: 0.0,
    reason:     'service_unavailable',
  } satisfies AntiBotResponse,

  fraud: {
    flagged:  false,
    score:    0.0,
    signals:  ['service_unavailable'],
  } satisfies FraudResponse,

  recommender: {
    recommendations: [],
  } satisfies RecommendResponse,
} as const;
