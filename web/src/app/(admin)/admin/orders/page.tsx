"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ordersApi, type Order } from "@/lib/api/orders";
import type { PaginationMeta } from "@/lib/api/pagination";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_META: PaginationMeta = {
  totalItems: 0,
  itemCount: 0,
  itemsPerPage: DEFAULT_PAGE_SIZE,
  totalPages: 1,
  currentPage: 1,
};

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

const STATUS_VARIANT: Record<
  Order["status"],
  "default" | "secondary" | "destructive"
> = {
  pending: "secondary",
  confirmed: "default",
  failed: "destructive",
};

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);

  useEffect(() => {
    if (!token) return;
    let ignore = false;

    async function loadOrders() {
      try {
        setLoading(true);
        setError(null);
        const response = await ordersApi.list(token!, page, limit);
        if (!ignore) {
          setOrders(response.data);
          setMeta(response.meta);
        }
      } catch (err) {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load orders",
          );
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadOrders();
    return () => {
      ignore = true;
    };
  }, [token, page, limit]);

  const paginationSummary =
    meta.totalItems === 0
      ? "Showing 0 of 0 orders"
      : `Showing ${(meta.currentPage - 1) * meta.itemsPerPage + 1}–${(meta.currentPage - 1) * meta.itemsPerPage + meta.itemCount} of ${meta.totalItems} orders`;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Orders
        </h1>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="w-32">Total</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-44">Date</TableHead>
              <TableHead className="w-48">Order ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.shippingAddress.city},{" "}
                      {order.shippingAddress.country}
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.items.map((item) => (
                      <div key={item.id} className="text-sm">
                        {item.productName} × {item.quantity}{" "}
                        <span className="text-muted-foreground">
                          ({formatPrice(item.unitPrice)} each)
                        </span>
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>{formatEth(order.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.id}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{paginationSummary}</p>
          <div className="flex flex-col gap-3 self-end sm:flex-row sm:items-center sm:self-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Items per page
              </span>
              <Select
                value={String(limit)}
                onValueChange={(val) => {
                  setLimit(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-22">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={loading || page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {meta.currentPage} of {Math.max(meta.totalPages, 1)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || page >= Math.max(meta.totalPages, 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
