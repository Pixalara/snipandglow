'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DashboardChartsProps {
  dailyAppointments: { label: string; count: number }[];
  peakHours: { hour: number; label: string; count: number }[];
}

export function DashboardCharts({ dailyAppointments, peakHours }: DashboardChartsProps) {
  if (dailyAppointments.length === 0 && peakHours.every((h) => h.count === 0)) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Peak Hours — Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Peak Hours (Last 7 Days)</h3>
        {peakHours.every((h) => h.count === 0) ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No appointment data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={peakHours} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} className="text-muted-foreground" interval={1} />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip content={<PeakHoursTooltip />} cursor={false} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {peakHours.map((entry, index) => {
                  const max = Math.max(...peakHours.map((h) => h.count), 1);
                  const intensity = entry.count / max;
                  const fill = intensity === 0
                    ? '#e2e8f0'
                    : intensity < 0.4
                      ? '#93c5fd'
                      : intensity < 0.7
                        ? '#3b82f6'
                        : '#1d4ed8';
                  return <Cell key={index} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Appointments by Day */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Appointments (Last 7 Days)</h3>
        {dailyAppointments.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No appointment data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyAppointments} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip content={<AppointmentsTooltip />} cursor={false} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function PeakHoursTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value} appointments</p>
    </div>
  );
}

function AppointmentsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{payload[0].value} appointments</p>
    </div>
  );
}
