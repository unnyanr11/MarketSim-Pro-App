/**
 * Demand service (Supabase-backed)
 * Ported from MarketSim-Pro web — @/ alias replaced with relative imports.
 */

import { supabase } from '../supabase/client';

export interface DemandData {
  demandId: string;
  userId: string;
  userCompanyName?: string;
  type: 'buy' | 'sell';
  productName: string;
  productCategory?: string;
  quantity: number;
  qualityStars: number;
  priceType?: 'market-discount' | 'negotiable';
  discountPercentage?: number;
  deadline?: string | null;
  isUrgent?: boolean;
  estimatedDeliveryDays?: number;
  status?: 'open' | 'active' | 'paused' | 'closed';
  isPublic?: boolean;
  biddingClosed?: boolean;
  isRecurring?: boolean;
  recurringSettings?: any;
  region?: string | null;
  expiresAt?: string | null;
  tags?: string[];
  searchKeywords?: string[];
  isGoodDeal?: boolean;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  messagesCount?: number;
  completedDeals?: number;
  interestedUsers?: string[];
  bookmarkedBy?: string[];
  price?: number | null;
}

export interface DemandFilters {
  type?: 'buy' | 'sell';
  region?: string;
  productName?: string;
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  productCategory?: string[];
  isUrgent?: boolean;
  isGoodDeal?: boolean;
  status?: string[];
  priceMin?: number;
  priceMax?: number;
  qualityMin?: number;
  bookmarkedBy?: string;
}

export interface DemandSortOptions {
  field: 'createdAt' | 'updatedAt' | 'quantity';
  direction: 'asc' | 'desc';
}

interface DbDemandRow {
  id: string;
  user_id: string;
  type: 'buy' | 'sell';
  title?: string | null;
  product: string;
  quantity: number;
  region?: string | null;
  notes?: string | null;
  status?: string | null;
  bidding_closed?: boolean | null;
  price?: number | null;
  expiry_at?: string | null;
  created_at: string;
  updated_at: string;
}

function parseMeta(notes?: string | null): Record<string, any> {
  if (!notes) return {};
  try {
    const maybe = JSON.parse(notes);
    return typeof maybe === 'object' && maybe !== null ? maybe : {};
  } catch { return {}; }
}

function serializeMeta(meta: Record<string, any>): string {
  try { return JSON.stringify(meta); } catch { return '{}'; }
}

function mapDbToApp(row: DbDemandRow): DemandData {
  const meta = parseMeta(row.notes);
  return {
    demandId: row.id,
    userId: row.user_id,
    userCompanyName: meta.userCompanyName ?? '',
    type: row.type,
    productName: row.product,
    productCategory: meta.productCategory ?? '',
    quantity: Number(row.quantity) || 0,
    qualityStars: meta.qualityStars ?? 0,
    priceType: meta.priceType ?? 'negotiable',
    discountPercentage: typeof meta.discountPercentage === 'number' ? meta.discountPercentage : undefined,
    deadline: meta.deadline ?? null,
    isUrgent: !!meta.isUrgent,
    estimatedDeliveryDays: typeof meta.estimatedDeliveryDays === 'number' ? meta.estimatedDeliveryDays : undefined,
    status: (row.status as DemandData['status']) ?? (meta.status as DemandData['status']) ?? 'open',
    isPublic: meta.isPublic ?? true,
    biddingClosed: row.bidding_closed === true,
    isRecurring: !!meta.isRecurring,
    recurringSettings: meta.recurringSettings,
    region: row.region ?? meta.region ?? null,
    expiresAt: row.expiry_at ?? meta.expiresAt ?? null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    searchKeywords: Array.isArray(meta.searchKeywords) ? meta.searchKeywords : [],
    isGoodDeal: !!meta.isGoodDeal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewCount: Number(meta.viewCount) || 0,
    messagesCount: Number(meta.messagesCount) || 0,
    completedDeals: Number(meta.completedDeals) || 0,
    interestedUsers: Array.isArray(meta.interestedUsers) ? meta.interestedUsers : [],
    bookmarkedBy: Array.isArray(meta.bookmarkedBy) ? meta.bookmarkedBy : [],
    price: row.price ?? null,
  };
}

function applyExpiryFilter(query: any): any {
  return query.or('expiry_at.is.null,expiry_at.gt.' + new Date().toISOString());
}

function applyFilters(query: any, filters: DemandFilters): { query: any; needsQualityFilter: boolean } {
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.region) query = query.eq('region', filters.region);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.productName) query = query.ilike('product', `%${filters.productName}%`);
  if (filters.search) {
    const term = filters.search;
    query = query.or(`product.ilike.%${term}%,title.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  if (filters.status && filters.status.length > 0) query = query.in('status', filters.status);
  if (filters.isUrgent === true) query = query.or('notes.ilike.%"isUrgent":true%,notes.ilike.%"isUrgent": true%');
  if (filters.isGoodDeal === true) query = query.or('notes.ilike.%"isGoodDeal":true%,notes.ilike.%"isGoodDeal": true%');
  if (filters.productCategory && filters.productCategory.length > 0) {
    query = query.or(filters.productCategory.map((c: string) => `notes.ilike.%${c}%`).join(','));
  }
  if (typeof filters.priceMin === 'number') query = query.gte('price', filters.priceMin);
  if (typeof filters.priceMax === 'number') query = query.lte('price', filters.priceMax);
  if (filters.bookmarkedBy) {
    const escapedId = filters.bookmarkedBy.replace(/[\\"]/g, '\\$&');
    query = query.ilike('notes', `%"${escapedId}"%`);
  }
  const needsQualityFilter = typeof filters.qualityMin === 'number' && filters.qualityMin > 0;
  return { query, needsQualityFilter };
}

function applySort(query: any, sort: DemandSortOptions) {
  const colMap: Record<DemandSortOptions['field'], string> = { createdAt: 'created_at', updatedAt: 'updated_at', quantity: 'quantity' };
  return query.order(colMap[sort.field] ?? 'created_at', { ascending: sort.direction === 'asc' });
}

export const demandService = {
  async createDemand(payload: Partial<DemandData>): Promise<string> {
    const meta: Record<string, any> = {
      userCompanyName: payload.userCompanyName ?? '',
      productCategory: payload.productCategory ?? '',
      qualityStars: payload.qualityStars ?? 0,
      priceType: payload.priceType ?? 'negotiable',
      discountPercentage: payload.discountPercentage,
      deadline: payload.deadline ?? null,
      isUrgent: !!payload.isUrgent,
      estimatedDeliveryDays: payload.estimatedDeliveryDays,
      status: payload.status ?? 'open',
      isPublic: payload.isPublic ?? true,
      isRecurring: !!payload.isRecurring,
      recurringSettings: payload.recurringSettings,
      expiresAt: payload.expiresAt ?? null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      searchKeywords: Array.isArray(payload.searchKeywords) ? payload.searchKeywords : [],
      isGoodDeal: !!payload.isGoodDeal,
      viewCount: payload.viewCount ?? 0,
      messagesCount: payload.messagesCount ?? 0,
      completedDeals: payload.completedDeals ?? 0,
      interestedUsers: Array.isArray(payload.interestedUsers) ? payload.interestedUsers : [],
      bookmarkedBy: Array.isArray(payload.bookmarkedBy) ? payload.bookmarkedBy : [],
    };
    const insert: Record<string, any> = {
      user_id: payload.userId!,
      type: payload.type!,
      title: payload.productName ?? null,
      product: payload.productName!,
      quantity: payload.quantity ?? 0,
      region: payload.region ?? null,
      status: 'open',
      bidding_closed: false,
      notes: serializeMeta(meta),
      expiry_at: payload.expiresAt ?? null,
    };
    const { data, error } = await supabase.from('demands').insert(insert).select('*').single();
    if (error) throw new Error(error.message);
    return data.id as string;
  },

  async updateDemand(demandId: string, updates: Partial<DemandData>, _userId?: string): Promise<void> {
    const { data: row, error: getErr } = await supabase.from('demands').select('*').eq('id', demandId).single();
    if (getErr) throw new Error(getErr.message);
    const current = row as DbDemandRow;
    const meta = parseMeta(current.notes);
    const mergedMeta = {
      userCompanyName: updates.userCompanyName ?? meta.userCompanyName ?? '',
      productCategory: updates.productCategory ?? meta.productCategory ?? '',
      qualityStars: updates.qualityStars ?? meta.qualityStars ?? 0,
      priceType: updates.priceType ?? meta.priceType ?? 'negotiable',
      discountPercentage: typeof updates.discountPercentage === 'number' ? updates.discountPercentage : meta.discountPercentage,
      deadline: updates.deadline ?? meta.deadline ?? null,
      isUrgent: typeof updates.isUrgent === 'boolean' ? updates.isUrgent : (meta.isUrgent ?? false),
      estimatedDeliveryDays: typeof updates.estimatedDeliveryDays === 'number' ? updates.estimatedDeliveryDays : meta.estimatedDeliveryDays,
      status: updates.status ?? current.status ?? meta.status ?? 'open',
      isPublic: typeof updates.isPublic === 'boolean' ? updates.isPublic : (meta.isPublic ?? true),
      isRecurring: typeof updates.isRecurring === 'boolean' ? updates.isRecurring : (meta.isRecurring ?? false),
      recurringSettings: updates.recurringSettings ?? meta.recurringSettings,
      expiresAt: updates.expiresAt ?? meta.expiresAt ?? null,
      tags: Array.isArray(updates.tags) ? updates.tags : (Array.isArray(meta.tags) ? meta.tags : []),
      searchKeywords: Array.isArray(updates.searchKeywords) ? updates.searchKeywords : (Array.isArray(meta.searchKeywords) ? meta.searchKeywords : []),
      isGoodDeal: typeof updates.isGoodDeal === 'boolean' ? updates.isGoodDeal : (meta.isGoodDeal ?? false),
      viewCount: typeof updates.viewCount === 'number' ? updates.viewCount : (meta.viewCount ?? 0),
      messagesCount: typeof updates.messagesCount === 'number' ? updates.messagesCount : (meta.messagesCount ?? 0),
      completedDeals: typeof updates.completedDeals === 'number' ? updates.completedDeals : (meta.completedDeals ?? 0),
      interestedUsers: Array.isArray(updates.interestedUsers) ? updates.interestedUsers : (Array.isArray(meta.interestedUsers) ? meta.interestedUsers : []),
      bookmarkedBy: Array.isArray(updates.bookmarkedBy) ? updates.bookmarkedBy : (Array.isArray(meta.bookmarkedBy) ? meta.bookmarkedBy : []),
    };
    const patch: Record<string, any> = {
      type: updates.type ?? current.type,
      product: updates.productName ?? current.product,
      title: updates.productName ?? current.title,
      quantity: typeof updates.quantity === 'number' ? updates.quantity : current.quantity,
      region: updates.region ?? current.region,
      ...(updates.status ? { status: updates.status } : {}),
      notes: serializeMeta(mergedMeta),
      updated_at: new Date().toISOString(),
      ...(updates.expiresAt !== undefined ? { expiry_at: updates.expiresAt } : {}),
    };
    const { error } = await supabase.from('demands').update(patch).eq('id', demandId);
    if (error) throw new Error(error.message);
  },

  async deleteDemand(demandId: string, userId?: string): Promise<void> {
    if (!demandId) throw new Error('demandId is required');
    if (!userId) throw new Error('userId is required');
    const { error, count } = await supabase.from('demands').delete({ count: 'exact' }).eq('id', demandId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    if (count === 0) throw new Error('Delete failed: demand not found or insufficient permissions.');
  },

  async getDemand(demandId: string, _viewerId?: string): Promise<DemandData | null> {
    const { data, error } = await supabase.from('demands').select('*').eq('id', demandId).single();
    if (error) {
      if ((error as any).code === 'PGRST116') return null;
      throw new Error(error.message);
    }
    return data ? mapDbToApp(data as DbDemandRow) : null;
  },

  async getDemands(
    filters: DemandFilters = {},
    sort: DemandSortOptions = { field: 'createdAt', direction: 'desc' },
    limitCount = 20
  ): Promise<{ demands: DemandData[]; hasMore: boolean }> {
    let query = supabase.from('demands').select('*');
    query = applyExpiryFilter(query);
    const { query: filteredQuery, needsQualityFilter } = applyFilters(query, filters);
    query = filteredQuery;
    query = applySort(query, sort);
    if (typeof filters.offset === 'number') {
      query = query.range(filters.offset, filters.offset + limitCount - 1);
    } else {
      query = query.limit(limitCount);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data as DbDemandRow[]) || [];
    const filtered = rows.filter((row) => {
      const meta = parseMeta(row.notes);
      if (filters.bookmarkedBy) {
        if (!Array.isArray(meta.bookmarkedBy) || !meta.bookmarkedBy.includes(filters.bookmarkedBy)) return false;
      }
      if (needsQualityFilter && typeof filters.qualityMin === 'number') {
        if ((Number(meta.qualityStars) || 0) < filters.qualityMin) return false;
      }
      return true;
    });
    return { demands: filtered.map(mapDbToApp), hasMore: rows.length === limitCount };
  },

  async getBookmarkedDemands(userId: string, sort: DemandSortOptions = { field: 'updatedAt', direction: 'desc' }): Promise<DemandData[]> {
    const { demands } = await demandService.getDemands({ bookmarkedBy: userId, limit: 100 }, sort, 100);
    return demands;
  },

  subscribeToDemands(
    filters: DemandFilters = {},
    sort: DemandSortOptions = { field: 'createdAt', direction: 'desc' },
    limitCount = 20,
    callback: (demands: DemandData[]) => void
  ): () => void {
    const channel = supabase.channel('public:demands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demands' }, async () => {
        try { const { demands } = await demandService.getDemands(filters, sort, limitCount); callback(demands); } catch { }
      }).subscribe();
    demandService.getDemands(filters, sort, limitCount).then(({ demands }) => callback(demands)).catch(() => {});
    return () => { supabase.removeChannel(channel); };
  },

  subscribeDemands(
    onChange: (event: { type: 'INSERT' | 'UPDATE' | 'DELETE'; new?: DemandData | null; old?: DemandData | null }) => void
  ): () => void {
    const channel = supabase.channel('public:demands:raw')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demands' }, async (payload) => {
        const evt = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const newRow = payload.new as DbDemandRow | undefined;
        const oldRow = payload.old as DbDemandRow | undefined;
        onChange({ type: evt, new: newRow ? mapDbToApp(newRow) : null, old: oldRow ? mapDbToApp(oldRow) : null });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  },

  async toggleBookmark(demandId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('demands').select('*').eq('id', demandId).single();
    if (error) throw new Error(error.message);
    const meta = parseMeta((data as DbDemandRow).notes);
    const list: string[] = Array.isArray(meta.bookmarkedBy) ? meta.bookmarkedBy : [];
    const idx = list.indexOf(userId);
    let bookmarked = false;
    if (idx >= 0) { list.splice(idx, 1); } else { list.push(userId); bookmarked = true; }
    meta.bookmarkedBy = list;
    const { error: upErr } = await supabase.from('demands').update({ notes: serializeMeta(meta), updated_at: new Date().toISOString() }).eq('id', demandId);
    if (upErr) throw new Error(upErr.message);
    return bookmarked;
  },

  async toggleInterest(demandId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('demands').select('*').eq('id', demandId).single();
    if (error) throw new Error(error.message);
    const meta = parseMeta((data as DbDemandRow).notes);
    const list: string[] = Array.isArray(meta.interestedUsers) ? meta.interestedUsers : [];
    const idx = list.indexOf(userId);
    let interested = false;
    if (idx >= 0) { list.splice(idx, 1); } else { list.push(userId); interested = true; }
    meta.interestedUsers = list;
    const { error: upErr } = await supabase.from('demands').update({ notes: serializeMeta(meta), updated_at: new Date().toISOString() }).eq('id', demandId);
    if (upErr) throw new Error(upErr.message);
    return interested;
  },

  async bumpDemand(demandId: string, _userId?: string): Promise<void> {
    const { error } = await supabase.from('demands').update({ updated_at: new Date().toISOString() }).eq('id', demandId);
    if (error) throw new Error(error.message);
  },
};

export default demandService;
