"use client";

import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ordersApi, type Order } from "@/lib/api/orders";
import { useAuth } from "@/lib/auth-context";

function formatEth(value: number | string) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `${Number.isFinite(n) ? n.toFixed(6).replace(/\.?0+$/, "") : "0"} ETH`;
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

  useEffect(() => {
    if (!token) return;
    let ignore = false;

    async function loadOrders() {
      try {
        setLoading(true);
        setError(null);
        const data = await ordersApi.list(token!);
        if (!ignore) setOrders(data);
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
  }, [token]);

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
                        {item.productName} × {item.quantity}
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
      </div>
    </section>
  );
}
