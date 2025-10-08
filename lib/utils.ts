import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null, currency: string = "EUR") {
  if (value == null) return "Custom";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPriceWithInterval(value: number | null, interval: "monthly" | "annual", currency: string) {
  if (value == null) return "Let's talk";
  const amount = formatCurrency(value, currency);
  return interval === "annual" ? `${amount}/yr` : `${amount}/mo`;
}

export function isMotionDisabled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getCurrentYear() {
  return new Date().getFullYear();
}
