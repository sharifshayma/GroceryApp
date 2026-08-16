export type HomeItem = {
  id: string; name: string; nameHe: string | null; emoji: string;
  defaultUnit: string; notes: string | null; categoryId: string | null; photoUrl: string | null;
  tags: { notes: string | null; tag: { id: string; name: string; color: string; type: "recipe" | "store" | "custom" } }[];
};
export type HomeCategory = { id: string; name: string; nameHe: string | null; emoji: string };
export type HomeTag = { id: string; name: string; color: string; type: "recipe" | "store" | "custom" };
export type OpenList = { id: string; name: string; status: "draft" | "active"; items: { listItemId: string; itemId: string }[] };
export type StockRow = { itemId: string; quantity: number; unit: string; lowThreshold: number };
