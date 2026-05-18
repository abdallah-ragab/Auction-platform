import { apiClient } from "./client";
import type { Bid } from "./auctions";

export type PlaceBidRequest = {
	auctionId: string;
	amount: number;
};

export type PlaceBidResponse = {
	bid: Bid;
	newHighestBid: number;
};

export type BidError = {
	error:
		| "bot_detected"
		| "fraud_flagged"
		| "outbid"
		| "auction_ended"
		| "captcha_required"
		| "self_bidding"
		| "account_banned";
	message: string;
	currentPrice?: number;
	score?: number;
	signals?: string[];
	confidence?: number;
};

export async function placeBid(
	data: PlaceBidRequest,
): Promise<PlaceBidResponse> {
	const res = await apiClient.post<PlaceBidResponse>("/bids", data);
	return res.data;
}

export async function getMyBids(
	page = 1,
	limit = 20,
	auctionId?: string,
): Promise<{ bids: Bid[]; total: number }> {
	const res = await apiClient.get("/bids/my", { params: { page, limit, auctionId } });
	return res.data;
}
