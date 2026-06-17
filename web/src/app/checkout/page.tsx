"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { parseEther } from "viem";
import {
  useAccount,
  useConnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { configApi } from "@/lib/api/config";
import { ordersApi } from "@/lib/api/orders";
import { productsApi, type Product } from "@/lib/api/products";
import { useCartStore } from "@/lib/cart-store";

type Step = "info" | "wallet" | "payment" | "success";

function formatEth(value: number | string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `${Number.isFinite(n) ? n.toFixed(6).replace(/\.?0+$/, "") : "0"} ETH`;
}

function formatPrice(value: number | string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
    : "$0.00";
}

const infoSchema = z.object({
  customerName: z.string().trim().min(1, "Name is required"),
  street: z.string().trim().min(1, "Street is required"),
  city: z.string().trim().min(1, "City is required"),
  country: z.string().trim().min(1, "Country is required"),
  zip: z.string().trim().min(1, "ZIP is required"),
});

type InfoFormValues = z.output<typeof infoSchema>;
type InfoFormInput = z.input<typeof infoSchema>;

export default function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  const [step, setStep] = useState<Step>("info");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState<string | null>(null);
  const [shopWalletAddress, setShopWalletAddress] = useState<string | null>(
    null,
  );
  const [pendingFormValues, setPendingFormValues] =
    useState<InfoFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productsById, setProductsById] = useState<
    Record<string, Product | null>
  >({});

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
    error: sendError,
    reset: resetSendTx,
  } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const verifyCalledRef = useRef(false);
  // Refs keep latest values accessible in the unmount cleanup without re-registering the effect
  const orderIdRef = useRef<string | null>(null);
  const stepRef = useRef<Step>("info");

  const form = useForm<InfoFormInput, unknown, InfoFormValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      customerName: "",
      street: "",
      city: "",
      country: "",
      zip: "",
    },
  });

  // Sync refs so unmount cleanup always sees the latest values
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Best-effort cancel on navigate-away — cron job handles sudden tab closes
  useEffect(() => {
    return () => {
      if (orderIdRef.current && stepRef.current !== "success") {
        void ordersApi.cancel(orderIdRef.current);
      }
    };
  }, []);

  // Fetch product prices to show estimated total
  useEffect(() => {
    if (items.length === 0) return;
    let ignore = false;

    void Promise.all(
      items.map((item) =>
        productsApi.get(item.productId).then(
          (product) => ({ productId: item.productId, product }),
          () => ({ productId: item.productId, product: null }),
        ),
      ),
    ).then((results) => {
      if (ignore) return;
      setProductsById(
        Object.fromEntries(results.map((r) => [r.productId, r.product])),
      );
    });

    return () => {
      ignore = true;
    };
  }, [items]);

  // Fetch shop wallet address for display before order is created
  useEffect(() => {
    void configApi
      .get()
      .then((cfg) => setShopWalletAddress(cfg.shopWalletAddress))
      .catch(() => {});
  }, []);

  // When wallet connects during WALLET step: create the order then advance to PAYMENT.
  // Handles the case where the user submitted INFO without a wallet connected —
  // form values are stored in pendingFormValues and used here.
  useEffect(() => {
    if (
      step !== "wallet" ||
      !isConnected ||
      !address ||
      !pendingFormValues ||
      submitting
    )
      return;

    void (async () => {
      try {
        setSubmitting(true);
        setError(null);
        const result = await ordersApi.create({
          customerName: pendingFormValues.customerName,
          shippingAddress: {
            street: pendingFormValues.street,
            city: pendingFormValues.city,
            country: pendingFormValues.country,
            zip: pendingFormValues.zip,
          },
          walletAddress: address,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
        setOrderId(result.orderId);
        setTotalAmount(result.totalAmount);
        setShopWalletAddress(result.shopWalletAddress);
        setPendingFormValues(null);
        setStep("payment");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create order",
        );
        setStep("info");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [step, isConnected, address, pendingFormValues, submitting, items]);

  // Verify payment after on-chain confirmation.
  // Uses a ref guard so this runs exactly once per txHash — prevents re-triggering
  // after setVerifying(false) in the finally block flips the state back.
  useEffect(() => {
    if (!isConfirmed || !txHash || !orderId || verifyCalledRef.current) return;
    verifyCalledRef.current = true;

    void (async () => {
      try {
        setVerifying(true);
        setError(null);
        await ordersApi.verifyPayment(orderId, txHash);
        clearCart();
        setStep("success");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Payment verification failed",
        );
        verifyCalledRef.current = false;
      } finally {
        setVerifying(false);
      }
    })();
  }, [isConfirmed, txHash, orderId, clearCart]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productsById[item.productId];
      const price = product ? Number(product.price) : null;
      if (price === null || !Number.isFinite(price)) return sum;
      return sum + price * item.quantity;
    }, 0);
  }, [items, productsById]);

  async function onInfoSubmit(values: InfoFormValues) {
    // Wallet not connected — store form values and go connect first.
    // The wallet useEffect above will create the order after connection.
    if (!address) {
      setPendingFormValues(values);
      setStep("wallet");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await ordersApi.create({
        customerName: values.customerName,
        shippingAddress: {
          street: values.street,
          city: values.city,
          country: values.country,
          zip: values.zip,
        },
        walletAddress: address,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      setOrderId(result.orderId);
      setTotalAmount(result.totalAmount);
      setShopWalletAddress(result.shopWalletAddress);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendPayment() {
    if (!shopWalletAddress || !totalAmount) return;
    setError(null);
    resetSendTx();
    sendTransaction({
      to: shopWalletAddress as `0x${string}`,
      value: parseEther(totalAmount),
    });
  }

  if (items.length === 0 && step !== "success") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Checkout
        </h1>
        <Card className="border">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="font-medium">Your cart is empty.</p>
            <Button asChild>
              <Link href="/products">Browse products</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Checkout
      </h1>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* INFO STEP */}
      {step === "info" && (
        <Card className="border">
          <CardHeader>
            <CardTitle>Shipping information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">Order summary</p>
              {items.map((item) => {
                const product = productsById[item.productId];
                const lineTotal =
                  product !== undefined && product !== null
                    ? Number(product.price) * item.quantity
                    : null;
                return (
                  <div key={item.productId} className="flex justify-between">
                    <span>
                      {item.productName} × {item.quantity}
                    </span>
                    <span>
                      {lineTotal !== null ? formatPrice(lineTotal) : "..."}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Estimated total</span>
                <span>{formatPrice(estimatedTotal)}</span>
              </div>
            </div>

            <form
              id="info-form"
              className="space-y-4"
              onSubmit={form.handleSubmit(onInfoSubmit)}
            >
              <Controller
                name="customerName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="customerName">Full name</FieldLabel>
                    <Input
                      {...field}
                      id="customerName"
                      placeholder="Alice Smith"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="street"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="street">Street address</FieldLabel>
                    <Input
                      {...field}
                      id="street"
                      placeholder="1 Main St"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="city"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="city">City</FieldLabel>
                      <Input
                        {...field}
                        id="city"
                        placeholder="Berlin"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="country"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="country">Country</FieldLabel>
                      <Input
                        {...field}
                        id="country"
                        placeholder="DE"
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
              </div>
              <Controller
                name="zip"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="zip">ZIP / Postal code</FieldLabel>
                    <Input
                      {...field}
                      id="zip"
                      placeholder="10115"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="info-form"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Creating order..." : "Continue to payment"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* WALLET STEP */}
      {step === "wallet" && (
        <Card className="border">
          <CardHeader>
            <CardTitle>Connect your wallet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            {submitting ? (
              <p className="text-sm text-muted-foreground">
                Creating order...
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your MetaMask wallet to continue on Sepolia testnet.
                </p>
                <Button
                  type="button"
                  onClick={() => connect({ connector: injected() })}
                  disabled={isConnected}
                >
                  {isConnected ? "Wallet connected" : "Connect MetaMask"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* PAYMENT STEP */}
      {step === "payment" && (
        <Card className="border">
          <CardHeader>
            <CardTitle>Send payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2 rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <div className="text-right">
                  <div className="font-semibold">
                    {totalAmount ? formatEth(totalAmount) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(estimatedTotal)}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient</span>
                <span className="break-all font-mono text-xs">
                  {shopWalletAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your wallet</span>
                <span className="break-all font-mono text-xs">{address}</span>
              </div>
            </div>

            {sendError ? (
              <Alert variant="destructive">
                <AlertDescription>{sendError.message}</AlertDescription>
              </Alert>
            ) : null}

            {isSending ? (
              <p className="text-center text-sm text-muted-foreground">
                Waiting for MetaMask confirmation...
              </p>
            ) : null}

            {txHash && isConfirming ? (
              <p className="text-center text-sm text-muted-foreground">
                Transaction submitted — waiting for on-chain confirmation...
                <br />
                <span className="break-all font-mono text-xs">{txHash}</span>
              </p>
            ) : null}

            {verifying ? (
              <p className="text-center text-sm text-muted-foreground">
                Verifying payment...
              </p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="w-full"
              onClick={handleSendPayment}
              disabled={isSending || isConfirming || verifying}
            >
              {isSending
                ? "Confirm in MetaMask..."
                : isConfirming
                  ? "Waiting for confirmation..."
                  : verifying
                    ? "Verifying..."
                    : `Pay ${totalAmount ? formatEth(totalAmount) : ""} (${formatPrice(estimatedTotal)})`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* SUCCESS STEP */}
      {step === "success" && (
        <Card className="border">
          <CardHeader>
            <CardTitle>Order confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Payment verified. Your order is confirmed.
            </p>
            <div className="space-y-1 rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <div className="text-right">
                  <div>{totalAmount ? formatEth(totalAmount) : "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPrice(estimatedTotal)}
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction</span>
                <span className="break-all font-mono text-xs">{txHash}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/products">Continue shopping</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </main>
  );
}
