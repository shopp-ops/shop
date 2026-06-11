import { request } from "./client";

export type Product = {
  id: string;
  name: string;
  quantity: number;
  price: number | string;
};

export type ProductInput = {
  name: string;
  quantity: number;
  price: number;
};

export const productsApi = {
  list: (token: string) => request<Product[]>("/api/products", {}, token),
  create: (token: string, input: ProductInput) =>
    request<Product>(
      "/api/products",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      token,
    ),
  update: (token: string, id: string, input: ProductInput) =>
    request<Product>(
      `/api/products/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
      token,
    ),
  delete: (token: string, id: string) =>
    request<Product>(`/api/products/${id}`, { method: "DELETE" }, token),
};
