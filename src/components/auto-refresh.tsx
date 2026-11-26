"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualiza os dados da página a cada X segundos (painel do dia). */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
