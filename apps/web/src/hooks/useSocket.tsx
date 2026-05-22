import { useEffect } from 'react'
import { useSocketStore } from '@/store/socketStore'
import { useQueryClient } from '@tanstack/react-query'
import type { Bid } from '@/api/auctions'
import toast from 'react-hot-toast'
import { NotificationToast } from '@/components/notifications/NotificationToast'
import { useAuthStore } from '@/store/authStore'

type BidNewPayload = {
  bid: { id: string; amount: number; bidderId: string; timestamp: string }
  newHighestBid: number
  timeExtended: boolean
}

type AuctionEndedPayload = {
  auctionId: string
  winnerId: string
  finalPrice: number
}

export function useAuctionSocket(auctionId: string) {
  const { socket, connect, connected } = useSocketStore()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    connect()
  }, [connect])

  useEffect(() => {
    if (!socket || !auctionId) return

    const joinRoom = () => {
      socket.emit('join:auction', auctionId)
    }

    if (socket.connected) {
      joinRoom()
    } else {
      socket.once('connect', joinRoom)
    }

    function onBidNew(payload: BidNewPayload) {

      queryClient.setQueryData(['auction', auctionId], (old: any) => {
        if (!old) return old
        return { ...old, currentPrice: payload.newHighestBid }
      })

      queryClient.setQueryData(['auction-bids', auctionId], (old: any) => {
        if (!old) return old
        const newBid: Bid = {
          id: payload.bid.id,
          userId: payload.bid.bidderId,
          auctionId,
          amount: payload.bid.amount,
          createdAt: payload.bid.timestamp,
        }
        const alreadyExists = old.bids.some((b: Bid) => b.id === newBid.id)
        if (alreadyExists) return old
        return {
          ...old,
          bids: [newBid, ...old.bids],
          total: old.total + 1,
        }
      })

      if (payload.timeExtended) {
        toast.custom((t) => (
          <NotificationToast
            t={t}
            title="Auction Extended"
            message="⏱ Auction extended by 2 minutes — snipe detected!"
            type="warning"
          />
        ), { duration: 5000 })
      }

      if (payload.bid.bidderId !== user?.id) {
        toast.custom((t) => (
          <NotificationToast
            t={t}
            title="New bid placed"
            message={`$${payload.newHighestBid.toLocaleString()}`}
            type="info"
          />
        ), { duration: 3000 })
      }
    }

    function onAuctionEnded(payload: AuctionEndedPayload) {
      queryClient.setQueryData(['auction', auctionId], (old: any) => {
        if (!old) return old
        return { ...old, status: 'ENDED', winnerId: payload.winnerId }
      })
      if (payload.winnerId === user?.id) {
        toast.custom((t) => (
          <NotificationToast
            t={t}
            title="You won!"
            message={`🎉 Final price: $${payload.finalPrice.toLocaleString()}`}
            type="success"
          />
        ), { duration: 8000 })
      } else {
        toast.custom((t) => (
          <NotificationToast
            t={t}
            title="Auction ended"
            message={`Final price: $${payload.finalPrice.toLocaleString()}`}
            type="info"
          />
        ), { duration: 5000 })
      }
    }

    function onAuctionExtended(payload: { auctionId: string; newEndsAt: string }) {
      queryClient.setQueryData(['auction', auctionId], (old: any) => {
        if (!old) return old
        return { ...old, endsAt: payload.newEndsAt }
      })
    }

    socket.on('bid:new', onBidNew)
    socket.on('auction:ended', onAuctionEnded)
    socket.on('auction:extended', onAuctionExtended)

    return () => {
      socket.emit('leave:auction', auctionId)
      socket.off('bid:new', onBidNew)
      socket.off('auction:ended', onAuctionEnded)
      socket.off('auction:extended', onAuctionExtended)
      socket.off('connect', joinRoom)
    }
  }, [socket, auctionId, queryClient, user?.id, connected])
}
