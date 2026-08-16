"use client";

import { useState, useEffect } from "react";

export function useKeyboardVisible(): { isKeyboardVisible: boolean } {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      setIsKeyboardVisible(viewport.height < window.innerHeight * 0.75);
    };
    viewport.addEventListener("resize", onResize);
    return () => viewport.removeEventListener("resize", onResize);
  }, []);

  return { isKeyboardVisible };
}
