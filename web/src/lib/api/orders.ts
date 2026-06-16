import { request } from "./client";
import type { PaginatedResponse } from "./pagination";

export type ShippingAddress = {
  street: string;
  city: string;
  country: string;
  zip: string;
};

export type CreateOrderInput = {
  customerName: string;
  shippingAddress: ShippingAddress;
  walletAddress: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type CreateOrderResult = {
  orderId: string;
  totalAmount: string;
  shopWalletAddress: string;
};

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
};

export type Order = {
  id: string;
  status: "pending" | "confirmed" | "failed";
  customerName: string;
  shippingAddress: ShippingAddress;
  walletAddress: string;
  totalAmount: string;
  txHash: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export const ordersApi = {
  create: (input: CreateOrderInput) =>
    request<CreateOrderResult>("/api/orders", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  verifyPayment: (orderId: string, txHash: string) =>
    request<Order>(`/api/orders/${orderId}/verify-payment`, {
      method: "POST",
      body: JSON.stringify({ txHash }),
    }),
  list: (token: string, page = 1, limit = 20) =>
    request<PaginatedResponse<Order>>(
      `/api/orders?page=${page}&limit=${limit}`,
      {},
      token,
    ),
};
