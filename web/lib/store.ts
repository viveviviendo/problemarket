import { create } from "zustand";

type Filters = {
  search: string;
  category: string;
  status: string;
  min: number;
  max: number;
  sort: string;
  set: (filter: Partial<Omit<Filters, "set">>) => void;
};

export const useFilterStore = create<Filters>((set) => ({
  search: "",
  category: "All",
  status: "Open",
  min: 1,
  max: 100,
  sort: "recent",
  set: (filter) => set(filter)
}));
