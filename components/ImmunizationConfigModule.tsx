import React, { useState } from "react";
import { Sliders, Settings, Tag, ArrowRight } from "lucide-react";
import { ImmunizationIncomeOriginsModule } from "./ImmunizationIncomeOriginsModule";
import { ImmunizationProductTypesModule } from "./ImmunizationProductTypesModule";
import { ImmunizationPageHeader } from "./ui/immunization";

interface ImmunizationConfigModuleProps {
  initialSection?: "main" | "origins" | "types";
}

export const ImmunizationConfigModule: React.FC<ImmunizationConfigModuleProps> = ({ initialSection = "main" }) => {
  const [activeSubView, setActiveSubView] = useState<"main" | "origins" | "types">(initialSection);

  if (activeSubView === "origins") {
    return <ImmunizationIncomeOriginsModule onBack={() => setActiveSubView("main")} />;
  }

  if (activeSubView === "types") {
    return <ImmunizationProductTypesModule onBack={() => setActiveSubView("main")} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ImmunizationPageHeader
        title="Configuración"
        description="Parámetros y catálogos auxiliares de inmunizaciones."
        icon={<Settings className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Opción 1: Orígenes de Ingreso */}
        <div
          onClick={() => setActiveSubView("origins")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500/50 hover:shadow-md cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-teal-50 p-3 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-200 shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                Orígenes de Ingreso
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Catálogo maestro de proveedores y orígenes de remesas.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-teal-700">
            <span>Gestionar catálogo</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Opción 2: Tipos de Producto */}
        <div
          onClick={() => setActiveSubView("types")}
          className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500/50 hover:shadow-md cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-teal-50 p-3 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-200 shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                Tipos de Producto
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Clasificación dinámica de biológicos, insumos y accesorios.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-teal-700">
            <span>Gestionar tipos</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* Opción 3: Parámetros Generales */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 opacity-70">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-slate-200/60 p-3 text-slate-500 shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-700">
                Parámetros Generales
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Reglas de alertas, cierres y umbrales de stock.
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-200/60 pt-3 text-xs font-semibold text-slate-400">
            <span>Próximamente</span>
          </div>
        </div>
      </div>
    </div>
  );
};
