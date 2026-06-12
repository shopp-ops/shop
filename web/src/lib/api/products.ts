import { request } from "./client";
import type { PaginatedResponse, PaginationQueryDto } from "./pagination";

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

function buildProductsPath(query?: PaginationQueryDto) {
  const params = new URLSearchParams();

  if (query?.search.trim()) {
    params.set("search", query.search.trim());
  }

  if (query?.page) {
    params.set("page", String(query.page));
  }

  if (query?.limit) {
    params.set("limit", String(query.limit));
  }

  const search = params.toString();

  return search ? `/api/products?${search}` : "/api/products";
}

export const productsApi = {
  list: (token: string, query?: PaginationQueryDto) =>
    request<PaginatedResponse<Product>>(buildProductsPath(query), {}, token),
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
