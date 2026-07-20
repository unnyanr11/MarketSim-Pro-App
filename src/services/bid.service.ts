/**
 * Bid Service
 * Ported from MarketSim-Pro web — @/ alias replaced with relative imports.
 * Table: public.bids
 */

import { supabase } from '../supabase/client';

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Bid {
  id: string;
  demandId: string;
  bidderId: string;
  /** Discount percentage offered (0–100). Stored in DB `price` column. */
  discountPercentage?: number | null;
  quantity?: number | null;
  message?: string | null;
  status: BidStatus;
  createdAt: string;
  updatedAt: string;
  bidderName?: string;
  bidderAvatar?: string;
  bidderCompany?: string;
}

const mapRow = (r: any): Bid => ({
  id: r.id,
  demandId: r.demand_id,
  bidderId: r.bidder_id,
  discountPercentage: r.price ?? null,
  quantity: r.quantity ?? null,
  message: r.message ?? null,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  bidderName: r.UserProfile?.display_name ?? 'Anonymous',
  bidderAvatar: r.UserProfile?.avatar_url ?? null,
  bidderCompany: r.UserProfile?.company_name ?? null,
});

async function notifyBidder(
  bidderId: string,
  type: 'bid_accepted' | 'bid_rejected',
  bidId: string,
  demandId: string,
  discountPercentage?: number | null,
): Promise<void> {
  const isAccepted = type === 'bid_accepted';
  const discountLabel = discountPercentage != null ? ` (${discountPercentage}% off)` : '';
  const title = isAccepted ? '\uD83C\uDF89 Your bid was accepted!' : 'Your bid was not accepted';
  const message = isAccepted
    ? `Your bid${discountLabel} was accepted by the demand owner. Check the demand for next steps.`
    : `Your bid${discountLabel} was not selected this time. Keep an eye out for other opportunities.`;
  await supabase.from('notifications').insert({
    recipient_id: bidderId,
    type,
    title,
    message,
    metadata: { bid_id: bidId, demand_id: demandId, discount_percentage: discountPercentage },
    is_read: false,
  });
}

export const bidService = {
  async placeBid(payload: {
    demandId: string;
    discountPercentage?: number;
    quantity?: number;
    message?: string;
  }): Promise<Bid> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: demand, error: demandErr } = await supabase
      .from('demands')
      .select('status, bidding_closed, expiry_at')
      .eq('id', payload.demandId)
      .single();

    if (demandErr || !demand) throw new Error('This demand could not be found or is not accessible.');
    if (demand.status !== 'open') throw new Error('This demand is no longer accepting bids.');
    if (demand.bidding_closed) throw new Error('Bidding has been closed — a bid has already been finalised.');
    if (demand.expiry_at && new Date(demand.expiry_at) <= new Date()) throw new Error('This demand has expired.');

    const { data: existing } = await supabase
      .from('bids')
      .select('id')
      .eq('demand_id', payload.demandId)
      .eq('bidder_id', user.id)
      .maybeSingle();
    if (existing) throw new Error('You have already placed a bid on this demand.');

    const { data, error } = await supabase
      .from('bids')
      .insert({
        demand_id: payload.demandId,
        bidder_id: user.id,
        price: payload.discountPercentage ?? null,
        quantity: payload.quantity ?? null,
        message: payload.message ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('You have already placed a bid on this demand.');
      throw new Error(error.message);
    }
    return mapRow(data);
  },

  async getBidsForDemand(demandId: string): Promise<Bid[]> {
    const { data, error } = await supabase
      .from('bids')
      .select('*, UserProfile:bidder_id(display_name, company_name, avatar_url)')
      .eq('demand_id', demandId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async getMyBids(): Promise<Bid[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('bids')
      .select('*, UserProfile:bidder_id(display_name, company_name, avatar_url)')
      .eq('bidder_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRow);
  },

  async hasUserBid(demandId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('bids')
      .select('id')
      .eq('demand_id', demandId)
      .eq('bidder_id', user.id)
      .maybeSingle();
    return !!data;
  },

  async acceptBid(bidId: string, demandId: string): Promise<void> {
    const { data: winBid, error: fetchErr } = await supabase
      .from('bids').select('bidder_id, price').eq('id', bidId).single();
    if (fetchErr) throw new Error(fetchErr.message);

    const { error: e1 } = await supabase
      .from('bids').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', bidId);
    if (e1) throw new Error(e1.message);

    const { data: rejected } = await supabase
      .from('bids')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('demand_id', demandId).neq('id', bidId).eq('status', 'pending')
      .select('id, bidder_id, price');

    const { error: lockErr } = await supabase
      .from('demands').update({ bidding_closed: true, updated_at: new Date().toISOString() }).eq('id', demandId);
    if (lockErr) throw new Error(lockErr.message);

    await notifyBidder(winBid.bidder_id, 'bid_accepted', bidId, demandId, winBid.price);
    if (rejected && rejected.length > 0) {
      await Promise.all(rejected.map((r: any) => notifyBidder(r.bidder_id, 'bid_rejected', r.id, demandId, r.price)));
    }
  },

  async rejectBid(bidId: string): Promise<void> {
    const { data: bid } = await supabase
      .from('bids').select('bidder_id, demand_id, price').eq('id', bidId).single();
    const { error } = await supabase
      .from('bids').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', bidId);
    if (error) throw new Error(error.message);
    if (bid) await notifyBidder(bid.bidder_id, 'bid_rejected', bidId, bid.demand_id, bid.price);
  },

  async withdrawBid(bidId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { error } = await supabase
      .from('bids')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', bidId).eq('bidder_id', user.id);
    if (error) throw new Error(error.message);
  },

  subscribeToBids(demandId: string, onUpdate: (bids: Bid[]) => void): () => void {
    const channel = supabase
      .channel(`bids:${demandId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bids',
        filter: `demand_id=eq.${demandId}`,
      }, async () => {
        const bids = await bidService.getBidsForDemand(demandId);
        onUpdate(bids);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};

export default bidService;
