"use client";

import { useEffect, useState } from "react";

import AlertsPanel from "@/components/AlertsPanel";
import PageHeader from "@/components/PageHeader";
import SegmentedControl from "@/components/SegmentedControl";
import { getAlerts } from "@/lib/api";
import type { Alert } from "@/lib/types";

type Scope = "open" | "all";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [scope, setScope] = useState<Scope>("open");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    getAlerts(scope === "open")
      .then(setAlerts)
      .catch((e: any) =>
        setErr(
          `Não foi possível carregar os alertas: ${
            e?.message ?? "a API não respondeu"
          }. Recarregue a página.`
        )
      );
  }, [scope]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Alertas"
        description="Pedestre na pista, veículo parado e variação de fluxo fora do padrão, detectados no vídeo."
        actions={
          <SegmentedControl
            label="Alertas exibidos"
            options={[
              { value: "open", label: "Abertos" },
              { value: "all", label: "Todos" },
            ]}
            value={scope}
            onChange={setScope}
          />
        }
      />

      {err && (
        <p role="alert" className="alert-error">
          {err}
        </p>
      )}

      <AlertsPanel alerts={alerts} />
    </div>
  );
}
