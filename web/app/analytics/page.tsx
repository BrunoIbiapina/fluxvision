"use client";

import { useEffect, useState } from "react";

import DailyFlowChart from "@/components/DailyFlowChart";
import FiltersBar, { type PeriodFilter } from "@/components/FiltersBar";
import HourlyFlowChart from "@/components/HourlyFlowChart";
import MonthlyComparisonChart from "@/components/MonthlyComparisonChart";
import PageHeader from "@/components/PageHeader";
import VehicleTypeBreakdown from "@/components/VehicleTypeBreakdown";
import { getCities, getDaily, getHourly, getMonthly } from "@/lib/api";
import type { City, TimeseriesPoint } from "@/lib/types";

export default function AnalyticsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [hourly, setHourly] = useState<TimeseriesPoint[]>([]);
  const [daily, setDaily] = useState<TimeseriesPoint[]>([]);
  const [monthly, setMonthly] = useState<TimeseriesPoint[]>([]);
  const [f, setF] = useState<PeriodFilter>({ days: 30 });

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    getHourly(Math.min(14, f.days), f.cityId).then(setHourly).catch(() => {});
    getDaily(f.days, f.cityId).then(setDaily).catch(() => {});
    getMonthly(12, f.cityId).then(setMonthly).catch(() => {});
  }, [f.days, f.cityId]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Séries"
        description="A mesma contagem vista por hora, por dia e por mês."
        actions={<FiltersBar cities={cities} value={f} onChange={setF} />}
      />

      <HourlyFlowChart data={hourly} />

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyFlowChart data={daily} />
        </div>
        <VehicleTypeBreakdown data={daily} />
      </div>

      <MonthlyComparisonChart data={monthly} />
    </div>
  );
}
