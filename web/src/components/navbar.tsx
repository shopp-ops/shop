"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, Package, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useCartStore } from "@/lib/cart-store";
import { useState, useEffect } from "react";
import { request } from "@/lib/api/client";

export function Navbar() {
  const { user, logout, loading } = useAuth();
  const [shopName, setShopName] = useState("SHOP");

  const router = useRouter();
  const pathname = usePathname();
  const cartItems = useCartStore((state) => state.items);

  const isAdmin = Boolean(user);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    request<{ shopName: string }>("/api/config")
      .then((config) => setShopName(config.shopName))
      .catch((err) => console.error(err));
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (loading || pathname === "/login") {
    return null;
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href={isAdmin ? "/admin" : "/products"}
          className="text-sm font-semibold tracking-tight"
        >
          {shopName}
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin">
                  <Package />
                  Products
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/orders">
                  <ClipboardList />
                  Orders
                </Link>
              </Button>

              {user ? (
                <span className="hidden text-sm text-muted-foreground md:inline">
                  {user.role}
                </span>
              ) : null}

              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/products">
                  <Package />
                  Products
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/cart">
                  <ShoppingCart />
                  Cart
                  <Badge className="ml-1 min-w-5 px-1.5">{cartItemCount}</Badge>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
