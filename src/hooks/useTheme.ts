"use client";

import { useCallback, useEffect, useState } from "react";
import {
  bootTheme,
  resolveTheme,
  subscribeTheme,
  toggleTheme as persistToggle,
  type Theme,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    bootTheme();
    setTheme(resolveTheme());
    return subscribeTheme(() => setTheme(resolveTheme()));
  }, []);

  const toggleTheme = useCallback(() => {
    persistToggle();
    setTheme(resolveTheme());
  }, []);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme,
  };
}
