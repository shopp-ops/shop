"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { productsApi, type Product } from "@/lib/api/products";
import type { PaginationMeta, PaginationQueryDto } from "@/lib/api/pagination";

const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_PAGINATION_META: PaginationMeta = {
  totalItems: 0,
  itemCount: 0,
  itemsPerPage: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  currentPage: 1,
};

function formatPrice(price: Product["price"]) {
  const numericPrice = typeof price === "string" ? Number(price) : price;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(numericPrice) ? numericPrice : 0);
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState<PaginationQueryDto>({
    search: "",
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>(
    DEFAULT_PAGINATION_META,
  );

  const fetchProducts = useCallback(
    async (currentQuery: PaginationQueryDto) => {
      return productsApi.list(undefined, currentQuery);
    },
    [],
  );

  const paginationSummary = useMemo(() => {
    if (paginationMeta.totalItems === 0) {
      return "Showing 0 of 0 products";
    }

    const start =
      (paginationMeta.currentPage - 1) * paginationMeta.itemsPerPage + 1;
    const end = start + paginationMeta.itemCount - 1;

    return `Showing ${start}-${end} of ${paginationMeta.totalItems} products`;
  }, [paginationMeta]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setQuery((current) => ({
      ...current,
      search: searchInput.trim(),
      page: 1,
    }));
  }

  function handleSearchClear() {
    setSearchInput("");
    setQuery((current) => ({
      ...current,
      search: "",
      page: 1,
    }));
  }

  function handlePageChange(nextPage: number) {
    setQuery((current) => ({
      ...current,
      page: nextPage,
    }));
  }

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchProducts(query);

        if (ignore) return;

        setProducts(response.data);
        setPaginationMeta(response.meta);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load products",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, [query, fetchProducts]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Products
        </h1>
        <p className="text-muted-foreground">
          Browse available products and add them to your cart.
        </p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={handleSearchSubmit}
      >
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search products by name"
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSearchClear}
            disabled={!searchInput && !query.search}
          >
            Clear
          </Button>
        </div>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border bg-card px-4 py-10 text-center text-muted-foreground">
          {query.search
            ? `No products found for "${query.search}".`
            : "No products found."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const isOutOfStock = product.quantity === 0;

            return (
              <Card key={product.id} className="h-full justify-between border">
                <CardHeader>
                  <div className="space-y-1">
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription>ID: {product.id}</CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div>
                    <p className="text-2xl font-semibold">
                      {formatPrice(product.price)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isOutOfStock
                        ? "Out of stock"
                        : `${product.quantity} item${product.quantity === 1 ? "" : "s"} available`}
                    </p>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isOutOfStock}
                  >
                    <ShoppingCart />
                    Add to cart
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{paginationSummary}</p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange((query.page ?? 1) - 1)}
            disabled={loading || (query.page ?? 1) <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {paginationMeta.currentPage} of {paginationMeta.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange((query.page ?? 1) + 1)}
            disabled={
              loading ||
              (query.page ?? 1) >= Math.max(paginationMeta.totalPages, 1)
            }
          >
            Next
          </Button>
        </div>
      </div>
    </main>
  );
}
