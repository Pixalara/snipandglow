'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardChartsProps {
  dailyAppointments: { label: string; count: number }[];
  peakHours: { hour: number; label: string; count: number }[];
}

export function DashboardCharts({ dailyAppointments, peakHours }: DashboardChartsProps) {
  const maxHourCount = Math.max(...peakHours.map((h) => h.count), 1);

  if (dailyAppointments.length === 0 && peakHours.every((h) => h.count === 0)) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Peak Hours Heatmap */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Peak Hours (Last 7 Days)</h3>
        {peakHours.every((h) => h.count === 0) ? (
          <div className="flex h-[160px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No appointment data yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {peakHours.map((slot) => {
                const intensity = slot.count / maxHourCount;
                const bg = intensity === 0
                  ? 'bg-muted'
                  : intensity < 0.25
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : intensity < 0.5
                      ? 'bg-blue-200 dark:bg-blue-800/40'
                      : intensity < 0.75
                        ? 'bg-blue-400 dark:bg-blue-700/60'
                        : 'bg-blue-600 dark:bg-blue-500';
                const textColor = intensity >= 0.75 ? 'text-white' : 'text-foreground';

                return (
                  <div
                    key={slot.hour}
                    className={`flex flex-col items-center justify-center rounded-lg p-1.5 sm:p-2 ${bg} transition-colors`}
                    title={`${slot.label}: ${slot.count} appointments`}
                  >
                    <span className={`text-[10px] sm:text-xs font-medium ${textColor}`}>{slot.label}</span>
                    <span className={`text-xs sm:text-sm font-bold ${textColor}`}>{slot.count}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-0.5">
                <div className="size-3 rounded-sm bg-muted" />
                <div className="size-3 rounded-sm bg-blue-100 dark:bg-blue-900/30" />
                <div className="size-3 rounded-sm bg-blue-200 dark:bg-blue-800/40" />
                <div className="size-3 rounded-sm bg-blue-400 dark:bg-blue-700/60" />
                <div className="size-3 rounded-sm bg-blue-600 dark:bg-blue-500" />
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </div>

      {/* Appointments by Day */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Appointments (Last 7 Days)</h3>
        {dailyAppointments.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No appointment data yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyAppointments} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <Tooltip content={<AppointmentsTooltip />} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
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
