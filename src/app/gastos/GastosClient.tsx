"use client";

import { useState, useMemo, useEffect } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { formatCLP } from "@/lib/format";
import { formatMonthLabel } from "@/lib/month-utils";
import { buildGastosBreakdown, type GastoRow } from "@/lib/gastos-breakdown";
import {
  FAMILIAR_SHORT_LABEL,
  type HouseholdFilter,
} from "@/lib/familiar";

const HOUSEHOLD_KEY = "gastos:household";
const OFF_KEY = "gastos:off-categories";

// Single-select lens, short labels (the segmented control, not the long
// dropdown options used on the transactions page).
const HOUSEHOLD_SEGMENTS: { value: HouseholdFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "PERSONAL", label: "Personal" },
  { value: "VINA", label: FAMILIAR_SHORT_LABEL.VINA },
  { value: "MELIPILLA", label: FAMILIAR_SHORT_LABEL.MELIPILLA },
  { value: "ANDESPATH", label: FAMILIAR_SHORT_LABEL.ANDESPATH },
];

const VALID_HOUSEHOLDS = new Set(HOUSEHOLD_SEGMENTS.map((s) => s.value));

interface Props {
  rows: GastoRow[];
  mes: string; // "YYYY-MM" | "todo"
}

export function GastosClient({ rows, mes }: Props) {
  const [householdFilter, setHouseholdFilter] =
    useState<HouseholdFilter>("todos");
  const [offIds, setOffIds] = useState<Set<number>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);

  // Load the persisted view state once, after the SSR default render — reading
  // localStorage during render would mismatch the server HTML. This is the
  // sanctioned "sync React state from an external store on mount" case, hence
  // the scoped disable of the no-setState-in-effect rule.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const h = localStorage.getItem(HOUSEHOLD_KEY);
      if (h && VALID_HOUSEHOLDS.has(h as HouseholdFilter)) {
        setHouseholdFilter(h as HouseholdFilter);
      }
      const raw = localStorage.getItem(OFF_KEY);
      if (raw) {
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids)) {
          setOffIds(new Set(ids.filter((x): x is number => typeof x === "number")));
        }
      }
    } catch {
      /* corrupt storage — fall back to defaults */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist after hydration so we never clobber storage with the SSR defaults.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(HOUSEHOLD_KEY, householdFilter);
    } catch {
      /* ignore */
    }
  }, [householdFilter, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OFF_KEY, JSON.stringify([...offIds]));
    } catch {
      /* ignore */
    }
  }, [offIds, hydrated]);

  const { categories, visibleTotal, usdCount } = useMemo(
    () => buildGastosBreakdown(rows, householdFilter, offIds),
    [rows, householdFilter, offIds],
  );

  function toggle(id: number) {
    setOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const offNames = categories
    .filter((c) => offIds.has(c.id))
    .map((c) => c.name);
  const anyOff = offNames.length > 0;

  const monthLabel =
    mes === "todo"
      ? "en total"
      : `en ${formatMonthLabel(
          Number(mes.slice(0, 4)),
          Number(mes.slice(5, 7)),
        ).toLowerCase()}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Month picker */}
      <div className="bg-[#f9f9f9] rounded-[20px] px-5 py-3 flex items-center">
        <MonthPicker mes={mes} />
      </div>

      {/* Household lens — single-select segmented control */}
      <div className="flex flex-wrap gap-2">
        {HOUSEHOLD_SEGMENTS.map((seg) => {
          const active = householdFilter === seg.value;
          return (
            <button
              key={seg.value}
              type="button"
              onClick={() => setHouseholdFilter(seg.value)}
              className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                active
                  ? "bg-indigo-50 border-violet-300 text-indigo-500"
                  : "bg-white border-indigo-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-400"
              }`}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Headline total — recalculates live as categories toggle */}
      <section className="flex flex-col items-center text-center gap-1.5 pt-2 pb-1">
        <p className="text-sm text-gray-400 tracking-wide uppercase font-medium">
          Gastaste {monthLabel}
        </p>
        <p
          className="text-4xl md:text-5xl font-bold tracking-tight"
          style={{ color: "#333" }}
        >
          {formatCLP(visibleTotal)}
        </p>
        {anyOff && (
          <p className="text-xs text-gray-400">
            {offNames.map((n) => `sin ${n}`).join(" · ")}
          </p>
        )}
        {usdCount > 0 && (
          <p className="text-xs text-gray-400">
            +{usdCount} en USD no incluido{usdCount !== 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* Category list — the hero */}
      <section className="bg-[#f9f9f9] rounded-[20px] p-5 md:p-7">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">
            Por categoría
          </h2>
          {anyOff && (
            <button
              type="button"
              onClick={() => setOffIds(new Set())}
              className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors underline underline-offset-2"
            >
              Todo prendido
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
            <span className="text-3xl">🧾</span>
            <p className="text-sm font-medium">No hay gastos en este período</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {categories.map((c) => {
              const off = offIds.has(c.id);
              const pct =
                !off && visibleTotal > 0 ? (c.total / visibleTotal) * 100 : 0;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 transition-opacity ${
                    off ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: "#ede9fe" }}
                  >
                    {c.emoji}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {c.count} transacci{c.count !== 1 ? "ones" : "ón"}
                      {!off && ` · ${pct.toFixed(0)}%`}
                    </span>
                  </div>

                  <span className="text-sm font-semibold text-gray-800 tabular-nums flex-shrink-0">
                    {formatCLP(c.total)}
                  </span>

                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!off}
                    aria-label={`${off ? "Incluir" : "Quitar"} ${c.name}`}
                    onClick={() => toggle(c.id)}
                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                      off ? "bg-gray-200" : "bg-violet-500"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        off ? "" : "translate-x-4"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
