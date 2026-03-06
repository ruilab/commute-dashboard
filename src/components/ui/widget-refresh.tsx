"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WidgetAutoRefresh({ intervalSec = 300 }: { intervalSec?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [intervalSec, router]);

  return null;
}
