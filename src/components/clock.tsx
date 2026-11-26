"use client";

import { useState, useSyncExternalStore } from "react";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

/**
 * Relógio ao vivo. Usa a hora do SERVIDOR (corrigida pela diferença para o
 * relógio do aparelho), porque é a hora do servidor que fica registrada.
 */
export function Clock({ serverTime }: { serverTime: number }) {
  // diferença entre o servidor e este aparelho, calculada uma vez
  const [offset] = useState(() => serverTime - Date.now());
  const seconds = useSyncExternalStore(
    subscribe,
    () => Math.floor((Date.now() + offset) / 1000),
    () => 0,
  );
  return (
    <div
      className="text-5xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-6xl"
      aria-live="off"
    >
      {seconds ? fmt.format(new Date(seconds * 1000)) : "--:--:--"}
    </div>
  );
}
