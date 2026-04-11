"use client";

import { useState } from "react";

export interface DailySpend {
  date: string; // "YYYY-MM-DD"
  amount: number; // absolute value (expense only)
}

interface Tooltip {
  clientX: number;
  clientY: number;
  date: string;
  amount: number;
}

const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT_LABEL_W = 28;
const TOP_LABEL_H = 20;

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DAY_LABELS: { index: number; label: string }[] = [
  { index: 1, label: "Lu" },
  { index: 3, label: "Mi" },
  { index: 5, label: "Vi" },
  { index: 0, label: "Do" },
];

function colorForAmount(amount: number, max: number): string {
  if (amount === 0) return "#f0edff";
  const t = Math.min(amount / max, 1);
  // violet gradient: #f0edff → #7c3aed
  const r = Math.round(240 - t * (240 - 124));
  const g = Math.round(237 - t * (237 - 58));
  const b = Math.round(255 - t * (255 - 237));
  return `rgb(${r},${g},${b})`;
}

function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function formatCLPFull(amount: number): string {
  return `$${Math.abs(amount).toLocaleString("es-CL")}`;
}

export function SpendingHeatmap({
  data,
  year,
  today,
}: {
  data: DailySpend[];
  year: number;
  today: string; // "YYYY-MM-DD"
}) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const spendMap = new Map<string, number>();
  for (const d of data) spendMap.set(d.date, d.amount);

  const maxSpend = Math.max(...data.map((d) => d.amount), 1);

  const todayMonth = parseInt(today.split("-")[1], 10); // 1-indexed current month

  // Build week columns: Jan 1 of `year` to end of todayMonth
  const janFirst = new Date(Date.UTC(year, 0, 1));
  const startDow = janFirst.getUTCDay(); // 0=Sun…6=Sat, need Mon=0
  // Offset so Monday = 0
  const startOffset = (startDow + 6) % 7; // days to pad before Jan 1

  const endDate = new Date(Date.UTC(year, todayMonth, 0)); // last day of todayMonth
  // Total days from Jan 1 to end of current month
  const msPerDay = 86400000;
  const dayCount = Math.floor((endDate.getTime() - janFirst.getTime()) / msPerDay) + 1;
  const totalCells = startOffset + dayCount;
  const numWeeks = Math.ceil(totalCells / 7);

  // Build month label positions (column index of month start)
  const monthCols: { month: number; col: number }[] = [];
  for (let m = 1; m <= todayMonth; m++) {
    const d = new Date(Date.UTC(year, m - 1, 1));
    const dayIdx = Math.floor((d.getTime() - janFirst.getTime()) / msPerDay);
    const col = Math.floor((startOffset + dayIdx) / 7);
    monthCols.push({ month: m, col });
  }

  const svgWidth = LEFT_LABEL_W + numWeeks * STEP;
  const svgHeight = TOP_LABEL_H + 7 * STEP;

  // Legend swatches
  const SWATCHES = 5;
  const legendColors = Array.from({ length: SWATCHES }, (_, i) => {
    const t = i / (SWATCHES - 1);
    return colorForAmount(t * maxSpend, maxSpend);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: "block", minWidth: svgWidth }}
        >
          {/* Day labels */}
          {DAY_LABELS.map(({ index, label }) => (
            <text
              key={label}
              x={LEFT_LABEL_W - 6}
              y={TOP_LABEL_H + index * STEP + CELL / 2 + 4}
              textAnchor="end"
              fontSize={9}
              fill="#9ca3af"
              fontFamily="var(--font-dm-sans, sans-serif)"
            >
              {label}
            </text>
          ))}

          {/* Month labels */}
          {monthCols.map(({ month, col }, i) => {
            const nextCol = monthCols[i + 1]?.col ?? numWeeks;
            if (nextCol - col < 2) return null;
            return (
              <text
                key={month}
                x={LEFT_LABEL_W + col * STEP}
                y={TOP_LABEL_H - 6}
                fontSize={9}
                fill="#9ca3af"
                fontFamily="var(--font-dm-sans, sans-serif)"
              >
                {MONTH_NAMES[month - 1]}
              </text>
            );
          })}

          {/* Cells */}
          {Array.from({ length: numWeeks }, (_, week) =>
            Array.from({ length: 7 }, (_, dow) => {
              const cellIndex = week * 7 + dow;
              const dayIndex = cellIndex - startOffset;
              if (dayIndex < 0 || dayIndex >= dayCount) return null;

              const date = new Date(Date.UTC(year, 0, 1 + dayIndex));
              const dateStr = date.toISOString().slice(0, 10);
              const spend = spendMap.get(dateStr) ?? 0;
              const isToday = dateStr === today;
              const color = colorForAmount(spend, maxSpend);

              const cx = LEFT_LABEL_W + week * STEP;
              const cy = TOP_LABEL_H + dow * STEP;

              return (
                <g key={dateStr}>
                  <rect
                    x={cx}
                    y={cy}
                    width={CELL}
                    height={CELL}
                    rx={3}
                    fill={color}
                    stroke={isToday ? "#6366f1" : "none"}
                    strokeWidth={isToday ? 2 : 0}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      setTooltip({
                        clientX: e.clientX,
                        clientY: e.clientY,
                        date: dateStr,
                        amount: spend,
                      });
                    }}
                    onMouseMove={(e) => {
                      setTooltip((prev) =>
                        prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev
                      );
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </g>
              );
            })
          )}
        </svg>

      </div>

      {/* Tooltip — fixed so it escapes overflow:hidden */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-[10px] bg-gray-900 px-3 py-2 text-white shadow-xl"
          style={{
            left: tooltip.clientX + 14,
            top: tooltip.clientY - 48,
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          <div className="font-medium">{formatDateLabel(tooltip.date)}</div>
          <div className="text-gray-300">
            {tooltip.amount === 0 ? "Sin gastos" : formatCLPFull(tooltip.amount)}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[10px] text-gray-400">Menos</span>
        {legendColors.map((color, i) => (
          <div
            key={i}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              background: color,
              flexShrink: 0,
            }}
          />
        ))}
        <span className="text-[10px] text-gray-400">Más</span>
      </div>
    </div>
  );
}
