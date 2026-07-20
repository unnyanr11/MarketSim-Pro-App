/**
 * Orders Service — Expo/React Native port
 * Thin alias wrapper over demandService so the UI can use "Orders" terminology.
 */

import {
  demandService,
  type DemandData,
  type DemandFilters,
  type DemandSortOptions,
} from './demand.service';

export type OrderData = DemandData;
export type OrderFilters = DemandFilters;
export type OrderSortOptions = DemandSortOptions;

export const ordersService = {
  async createOrder(
    orderData: Omit<
      OrderData,
      | 'demandId'
      | 'createdAt'
      | 'updatedAt'
      | 'viewCount'
      | 'interestedUsers'
      | 'bookmarkedBy'
      | 'messagesCount'
      | 'completedDeals'
    >
  ): Promise<string> {
    return demandService.createDemand(orderData as any);
  },

  async updateOrder(orderId: string, updates: Partial<OrderData>, userId: string): Promise<void> {
    return demandService.updateDemand(orderId, updates, userId);
  },

  async deleteOrder(orderId: string, userId: string): Promise<void> {
    return demandService.deleteDemand(orderId, userId);
  },

  async getOrder(orderId: string, viewerId?: string): Promise<OrderData | null> {
    return demandService.getDemand(orderId, viewerId);
  },

  async getOrders(
    filters: OrderFilters = {},
    sort: OrderSortOptions = { field: 'createdAt', direction: 'desc' },
    limitCount = 20
  ): Promise<{ orders: OrderData[]; hasMore: boolean }> {
    const { demands, hasMore } = await demandService.getDemands(filters, sort, limitCount);
    return { orders: demands, hasMore };
  },

  subscribeToOrders(
    filters: OrderFilters = {},
    sort: OrderSortOptions = { field: 'createdAt', direction: 'desc' },
    limitCount = 20,
    callback: (orders: OrderData[]) => void
  ): () => void {
    return demandService.subscribeToDemands(filters, sort, limitCount, callback);
  },

  async toggleBookmark(orderId: string, userId: string): Promise<boolean> {
    return demandService.toggleBookmark(orderId, userId);
  },

  async toggleInterest(orderId: string, userId: string): Promise<boolean> {
    return demandService.toggleInterest(orderId, userId);
  },

  async bumpOrder(orderId: string, userId: string): Promise<void> {
    return demandService.bumpDemand(orderId, userId);
  },
};

export default ordersService;
