// src/lib/api/orders.ts
import { apiClient } from './client';
import type { Order, CartItem } from '@/types';

export interface PendingOrderDetail {
  orderId: string;
  status: string;
  snapToken: string | null;
  totalAmount: number;
  subtotal: number;
  serviceFee: number;
  tax: number;
  grandTotal: number;
  items: { title: string; slug: string; licenseType: string; price: number }[];
}

export const ordersApi = {
  getOrder: async (orderId: string): Promise<PendingOrderDetail> => {
    const { data } = await apiClient.get(`/orders/${orderId}`);
    return data;
  },

  create: async (items: CartItem[]) => {
    const { data } = await apiClient.post('/orders', {
      items: items.map((i) => ({
        audioAssetId: i.sound.id,
        licenseType: i.licenseType,
      })),
    });
    return data as {
      orderId: string;
      totalAmount: number;
      snapToken: string;
      items: { title: string; price: number; licenseType: string }[];
    };
  },

  verifyPayment: async (orderId: string) => {
    const { data } = await apiClient.post('/orders/verify-payment', { orderId });
    return data as { activated: boolean };
  },

  getMyOrders: async (): Promise<Order[]> => {
    const { data } = await apiClient.get('/orders/me');
    return data;
  },

  cancelOrder: async (orderId: string) => {
    const { data } = await apiClient.patch(`/orders/${orderId}/cancel`);
    return data as { cancelled: boolean };
  },

  getSnapToken: async (orderId: string) => {
    const { data } = await apiClient.get(`/orders/${orderId}/snap-token`);
    return data as { snapToken: string };
  },

  getInvoice: async (orderId: string) => {
    const { data } = await apiClient.get(`/orders/${orderId}/invoice`);
    return data;
  },

  downloadInvoicePdf: async (orderId: string, invoiceNumber: string) => {
    const { data } = await apiClient.get(`/orders/${orderId}/invoice/pdf`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
