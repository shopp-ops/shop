import { request } from "./client";

export type ShopConfig = {
  shopWalletAddress: string;
};

export const configApi = {
  get: () => request<ShopConfig>("/api/config"),
};
