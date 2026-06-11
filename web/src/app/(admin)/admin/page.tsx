"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { useAuth } from "@/lib/auth-context";
import {
  productsApi,
  type Product,
  type ProductInput,
} from "@/lib/api/products";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  price: z.coerce.number().positive("Price must be greater than 0"),
});

type FormValues = z.output<typeof schema>;
type FormInput = z.input<typeof schema>;

function formatPrice(price: Product["price"]) {
  const numericPrice = typeof price === "string" ? Number(price) : price;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(numericPrice) ? numericPrice : 0);
}

export default function AdminPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      quantity: 0,
      price: 0,
    },
  });

  function getFormDefaults(product: Product | null): FormInput {
    return {
      name: product?.name ?? "",
      quantity: product?.quantity ?? 0,
      price:
        typeof product?.price === "string"
          ? Number(product.price)
          : (product?.price ?? 0),
    };
  }

  function openDialog(product: Product | null) {
    setEditingProduct(product);
    setRequestError(null);
    form.reset(getFormDefaults(product));
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);

    if (!open) {
      setEditingProduct(null);
      setRequestError(null);
      form.reset(getFormDefaults(null));
    }
  }

  function openDeleteDialog(product: Product) {
    setProductToDelete(product);
    setRequestError(null);
    setDeleteDialogOpen(true);
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open);

    if (!open) {
      setProductToDelete(null);
      setRequestError(null);
    }
  }

  useEffect(() => {
    if (!token) return;

    let ignore = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);
        if (!token) {
          return;
        } else {
          const data = await productsApi.list(token);
          if (!ignore) setProducts(data);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error ? err.message : "Failed to load products",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, [token]);

  async function onSubmit(values: FormValues) {
    if (!token) return;

    const payload: ProductInput = {
      name: values.name.trim(),
      quantity: values.quantity,
      price: values.price,
    };

    try {
      setSaving(true);
      setRequestError(null);

      if (editingProduct) {
        console.log(editingProduct);
        console.log(payload);
        console.log(token);
        await productsApi.update(token, editingProduct.id, payload);
      } else {
        await productsApi.create(token, payload);
      }

      setDialogOpen(false);
      setEditingProduct(null);
      const data = await productsApi.list(token);
      setProducts(data);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "Failed to save product",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!token || !productToDelete) return;

    try {
      setDeleting(true);
      setRequestError(null);
      await productsApi.delete(token, productToDelete.id);
      const data = await productsApi.list(token);
      setProducts(data);
      handleDeleteDialogOpenChange(false);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : "Failed to delete product",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Products
          </h1>
          <p className="text-muted-foreground">
            Admin overview of product name, stock quantity, and price.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => openDialog(null)}
        >
          Add new product
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit product" : "Add product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update the selected product using the same form."
                : "Create a new product with name, quantity, and price."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            {requestError ? (
              <Alert variant="destructive">
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            ) : null}

            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="name"
                    placeholder="Product name"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="quantity"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="quantity">Quantity</FieldLabel>
                    <Input
                      {...field}
                      value={String(field.value ?? "")}
                      id="quantity"
                      type="number"
                      min={0}
                      step="1"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                name="price"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="price">Price ($)</FieldLabel>
                    <Input
                      {...field}
                      value={String(field.value ?? "")}
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingProduct
                    ? "Update product"
                    : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          handleDeleteDialogOpenChange(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              {productToDelete
                ? `Are you sure you want to delete ${productToDelete.name}?`
                : "Are you sure you want to delete this product?"}
            </DialogDescription>
          </DialogHeader>

          {requestError ? (
            <Alert variant="destructive">
              <AlertDescription>{requestError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDeleteDialogOpenChange(false)}
              disabled={deleting}
            >
              No
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteProduct()}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-32">Quantity</TableHead>
              <TableHead className="w-36">Price</TableHead>
              <TableHead className="w-48">ID</TableHead>
              <TableHead className="w-32 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading products...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.quantity}</TableCell>
                  <TableCell>{formatPrice(product.price)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.id}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mr-2"
                      onClick={() => openDialog(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(product)}
                    >
                      Delete
                    </Button>
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
