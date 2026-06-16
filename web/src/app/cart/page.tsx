"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { productsApi, type Product } from "@/lib/api/products";
import { useCartStore } from "@/lib/cart-store";

function formatPrice(value: number | string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
    : "$0.00";
}

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const [productsById, setProductsById] = useState<
    Record<string, Product | null>
  >({});
  const [productErrorsById, setProductErrorsById] = useState<
    Record<string, string | null>
  >({});
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>(
    {},
  );
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    let ignore = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const results = await Promise.all(
          items.map(async (item) => {
            try {
              const product = await productsApi.get(item.productId);
              return {
                productId: item.productId,
                product,
                error: null,
              };
            } catch (err) {
              return {
                productId: item.productId,
                product: null,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to load product details",
              };
            }
          }),
        );

        if (ignore) return;

        setProductsById(
          Object.fromEntries(
            results.map((result) => [result.productId, result.product]),
          ),
        );
        setProductErrorsById(
          Object.fromEntries(
            results.map((result) => [result.productId, result.error]),
          ),
        );

        if (results.some((result) => result.error)) {
          setError("Some cart items could not be refreshed.");
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
  }, [items]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productsById[item.productId];
      const numericPrice =
        typeof product?.price === "string"
          ? Number(product.price)
          : product?.price;

      if (!Number.isFinite(numericPrice)) {
        return sum;
      }

      return sum + Number(numericPrice) * item.quantity;
    }, 0);
  }, [items, productsById]);

  function handleQuantityInputChange(productId: string, value: string) {
    setQuantityInputs((current) => ({
      ...current,
      [productId]: value,
    }));
    setItemErrors((current) => ({
      ...current,
      [productId]: "",
    }));
  }

  function handleUpdateItem(productId: string) {
    const product = productsById[productId];
    const productError = productErrorsById[productId];
    const nextQuantity = Number.parseInt(quantityInputs[productId] ?? "", 10);

    if (!product || productError) {
      setItemErrors((current) => ({
        ...current,
        [productId]: "Unable to validate stock for this item right now.",
      }));
      return;
    }

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      setItemErrors((current) => ({
        ...current,
        [productId]: "Quantity must be at least 1.",
      }));
      return;
    }

    if (nextQuantity > product.quantity) {
      setItemErrors((current) => ({
        ...current,
        [productId]: `Only ${product.quantity} item${product.quantity === 1 ? "" : "s"} available.`,
      }));
      return;
    }

    updateQuantity(productId, nextQuantity);
    setItemErrors((current) => ({
      ...current,
      [productId]: "",
    }));
  }

  function handleRemoveItem(productId: string) {
    removeItem(productId);
    setItemErrors((current) => ({
      ...current,
      [productId]: "",
    }));
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Cart
          </h1>
          <p className="text-muted-foreground">
            Your shopping cart is currently empty.
          </p>
        </div>

        <Card className="border">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <ShoppingCart className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">No items in cart</p>
              <p className="text-sm text-muted-foreground">
                Browse products and add items to see them here.
              </p>
            </div>
            <Button asChild>
              <Link href="/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Cart
        </h1>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="space-y-4">
          {items.map((item) => {
            const product = productsById[item.productId];
            const productError = productErrorsById[item.productId];
            const stock = product?.quantity ?? 0;
            const stockExceeded = Boolean(product) && item.quantity > stock;
            const unitPrice =
              typeof product?.price === "string"
                ? Number(product.price)
                : product?.price;
            const lineTotal = Number.isFinite(unitPrice)
              ? Number(unitPrice) * item.quantity
              : null;

            return (
              <Card key={item.productId} className="border">
                <CardHeader>
                  <CardTitle>{item.productName}</CardTitle>
                  <CardDescription>
                    Product ID: {item.productId}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Unit price</p>
                      <p className="font-medium">
                        {product ? formatPrice(product.price) : "Unavailable"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">In cart</p>
                      <p className="font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available stock</p>
                      <p className="font-medium">
                        {product ? stock : "Unavailable"}
                      </p>
                    </div>
                  </div>

                  {loading && !product && !productError ? (
                    <p className="text-sm text-muted-foreground">
                      Refreshing product details...
                    </p>
                  ) : null}

                  {productError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{productError}</AlertDescription>
                    </Alert>
                  ) : null}

                  {stockExceeded ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Only {stock} item{stock === 1 ? "" : "s"} currently
                        available. Please reduce the quantity or remove this
                        item.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {itemErrors[item.productId] ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {itemErrors[item.productId]}
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <Field>
                    <FieldLabel htmlFor={`quantity-${item.productId}`}>
                      Quantity
                    </FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={`quantity-${item.productId}`}
                        type="number"
                        min={1}
                        max={product?.quantity}
                        value={
                          quantityInputs[item.productId] ??
                          String(item.quantity)
                        }
                        onChange={(event) =>
                          handleQuantityInputChange(
                            item.productId,
                            event.target.value,
                          )
                        }
                        disabled={!product || product.quantity === 0}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleUpdateItem(item.productId)}
                        disabled={!product || product.quantity === 0}
                      >
                        Update quantity
                      </Button>
                    </div>
                  </Field>
                </CardContent>

                <CardFooter className="justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Line total</p>
                    <p className="font-medium">
                      {lineTotal === null
                        ? "Unavailable"
                        : formatPrice(lineTotal)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleRemoveItem(item.productId)}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <Card className="border lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
            <CardDescription>
              Overview of items currently in your cart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium">{items.length}</span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatPrice(totalPrice)}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
