"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
};

type CartStore = {
  items: CartItem[];
  addItem: (productId: string, productName: string, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId, productName, quantity) => {
        if (quantity <= 0) return;

        set((state) => {
          const existingItem = state.items.find(
            (item) => item.productId === productId,
          );

          if (!existingItem) {
            return {
              items: [
                ...state.items,
                {
                  productId,
                  productName,
                  quantity,
                },
              ],
            };
          }

          return {
            items: state.items.map((item) =>
              item.productId === productId
                ? {
                    ...item,
                    productName,
                    quantity: item.quantity + quantity,
                  }
                : item,
            ),
          };
        });
      },
      updateQuantity: (productId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.productId !== productId),
            };
          }

          return {
            items: state.items.map((item) =>
              item.productId === productId ? { ...item, quantity } : item,
            ),
          };
        });
      },
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "shopping-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
