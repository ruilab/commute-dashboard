"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DailyData {
  date: string;
  outbound: number | null;
  returnTrip: number | null;
}

export function DurationChart({ data }: { data: DailyData[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="m" />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--color-border)",
          }}
          formatter={(value) => value != null ? [`${value} min`] : []}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="outbound"
          name="Morning"
          fill="#2563eb"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="returnTrip"
          name="Evening"
          fill="#8b5cf6"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
