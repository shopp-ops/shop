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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { productsApi, type Product } from "@/lib/api/products";
import type { PaginationMeta, PaginationQueryDto } from "@/lib/api/pagination";
import { useCartStore } from "@/lib/cart-store";

const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_PAGINATION_META: PaginationMeta = {
  totalItems: 0,
  itemCount: 0,
  itemsPerPage: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  currentPage: 1,
};

function formatPrice(value: Product["price"]) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
    : "$0.00";
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
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState("1");
  const [cartError, setCartError] = useState<string | null>(null);

  const cartItems = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);

  const fetchProducts = useCallback(
    async (currentQuery: PaginationQueryDto) => {
      return productsApi.list(undefined, currentQuery);
    },
    [],
  );

  const cartQuantityByProduct = useMemo(
    () =>
      new Map(
        cartItems.map((item) => [item.productId, item.quantity] as const),
      ),
    [cartItems],
  );

  const selectedProductAvailableQuantity = useMemo(() => {
    if (!selectedProduct) return 0;

    return Math.max(
      selectedProduct.quantity -
        (cartQuantityByProduct.get(selectedProduct.id) ?? 0),
      0,
    );
  }, [selectedProduct, cartQuantityByProduct]);

  const paginationSummary = useMemo(() => {
    if (paginationMeta.totalItems === 0) {
      return "Showing 0 of 0 products";
    }

    const start =
      (paginationMeta.currentPage - 1) * paginationMeta.itemsPerPage + 1;
    const end = start + paginationMeta.itemCount - 1;

    return `Showing ${start}-${end} of ${paginationMeta.totalItems} products`;
  }, [paginationMeta]);

  function getAvailableQuantity(product: Product) {
    return Math.max(
      product.quantity - (cartQuantityByProduct.get(product.id) ?? 0),
      0,
    );
  }

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

  function openCartDialog(product: Product) {
    setSelectedProduct(product);
    setSelectedQuantity("1");
    setCartError(null);
    setCartDialogOpen(true);
  }

  function handleCartDialogOpenChange(open: boolean) {
    setCartDialogOpen(open);

    if (!open) {
      setSelectedProduct(null);
      setSelectedQuantity("1");
      setCartError(null);
    }
  }

  function handleAddToCart() {
    if (!selectedProduct) return;

    const quantity = Number.parseInt(selectedQuantity, 10);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setCartError("Quantity must be at least 1.");
      return;
    }

    if (quantity > selectedProductAvailableQuantity) {
      setCartError(
        `You can add up to ${selectedProductAvailableQuantity} item${selectedProductAvailableQuantity === 1 ? "" : "s"}.`,
      );
      return;
    }

    addItem(selectedProduct.id, selectedProduct.name, quantity);
    handleCartDialogOpenChange(false);
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

      <Dialog open={cartDialogOpen} onOpenChange={handleCartDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProduct
                ? `Add ${selectedProduct.name} to cart`
                : "Add to cart"}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct
                ? `Choose quantity. You can add up to ${selectedProductAvailableQuantity} item${selectedProductAvailableQuantity === 1 ? "" : "s"}.`
                : "Choose quantity for this product."}
            </DialogDescription>
          </DialogHeader>

          {cartError ? (
            <Alert variant="destructive">
              <AlertDescription>{cartError}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor="cart-quantity">Quantity</FieldLabel>
            <Input
              id="cart-quantity"
              type="number"
              min={1}
              max={selectedProductAvailableQuantity}
              value={selectedQuantity}
              onChange={(event) => {
                setSelectedQuantity(event.target.value);
                setCartError(null);
              }}
              disabled={selectedProductAvailableQuantity === 0}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCartDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddToCart}
              disabled={selectedProductAvailableQuantity === 0}
            >
              <ShoppingCart />
              Add to cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            const quantityInCart = cartQuantityByProduct.get(product.id) ?? 0;
            const availableQuantity = getAvailableQuantity(product);
            const isOutOfStock = availableQuantity === 0;

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
                        : `${availableQuantity} item${availableQuantity === 1 ? "" : "s"} available`}
                    </p>
                    {quantityInCart > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {quantityInCart} item{quantityInCart === 1 ? "" : "s"}{" "}
                        in cart
                      </p>
                    ) : null}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isOutOfStock}
                    onClick={() => openCartDialog(product)}
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
