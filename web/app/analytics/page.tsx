"use client";

import { useEffect, useState } from "react";

import DailyFlowChart from "@/components/DailyFlowChart";
import FiltersBar from "@/components/FiltersBar";
import HourlyFlowChart from "@/components/HourlyFlowChart";
import MonthlyComparisonChart from "@/components/MonthlyComparisonChart";
import VehicleTypeBreakdown from "@/components/VehicleTypeBreakdown";
import {
  getCities,
  getDaily,
  getHourly,
  getMonthly,
} from "@/lib/api";
import type { City, TimeseriesPoint } from "@/lib/types";

export default function AnalyticsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [hourly, setHourly] = useState<TimeseriesPoint[]>([]);
  const [daily, setDaily] = useState<TimeseriesPoint[]>([]);
  const [monthly, setMonthly] = useState<TimeseriesPoint[]>([]);
  const [f, setF] = useState<{ days: number; cityId?: number }>({ days: 30 });

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    getHourly(Math.min(14, f.days), f.cityId).then(setHourly).catch(() => {});
    getDaily(Math.min(60, f.days), f.cityId).then(setDaily).catch(() => {});
    getMonthly(12, f.cityId).then(setMonthly).catch(() => {});
  }, [f.days, f.cityId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-ink-muted mt-1">
            Detalhamento temporal: hora, dia, mês. Identifique padrões,
            sazonalidades e turnos críticos.
          </p>
        </div>
        <FiltersBar cities={cities} onChange={setF} />
      </header>

      <HourlyFlowChart data={hourly} height={320} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <DailyFlowChart data={daily} />
        </div>
        <VehicleTypeBreakdown data={daily} />
      </div>

      <MonthlyComparisonChart data={monthly} />
    </div>
  );
}
