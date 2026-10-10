import React, { useState, useEffect } from 'react';
import { 
  X, BarChart2, TrendingUp, AlertTriangle, CheckCircle, 
  DollarSign, RefreshCw, Filter, PieChart, ShieldAlert, Clock
} from 'lucide-react';

interface ParetoItem {
  categoria: string;
  cantidad: number;
  porcentaje?: number;
  porcentaje_acumulado?: number;
  monto_ars?: number;
  monto_usd?: number;
}

interface AnaliticaCausasData {
  pareto_casos: ParetoItem[];
  total_casos_categorizados: number;
  pareto_presupuestos: ParetoItem[];
  total_presupuestos_categorizados: number;
}

interface ModalAnaliticaCausasQuirurgicasProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIA_LABELS: Record<string, { label: string; color: string }> = {
  economico: { label: 'Económico / Costo Arancel', color: 'bg-rose-500' },
  tiempos_personales: { label: 'Tiempos / Compromisos Personales', color: 'bg-amber-500' },
  miedo_dudas: { label: 'Miedo / Dudas Asistenciales', color: 'bg-indigo-500' },
  eligio_otro_centro: { label: 'Eligió Otra Clínica / Centro', color: 'bg-purple-500' },
  medico_no_indica: { label: 'Criterio Clínico / No Indica Aún', color: 'bg-blue-500' },
  otros: { label: 'Otras Causas / Sin Especificar', color: 'bg-slate-400' }
};

export const ModalAnaliticaCausasQuirurgicas: React.FC<ModalAnaliticaCausasQuirurgicasProps> = ({
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AnaliticaCausasData | null>(null);
  const [tabActiva, setTabActiva] = useState<'casos' | 'presupuestos'>('casos');
  const [error, setError] = useState<string | null>(null);

  const fetchAnalitica = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline-quirurgico/analitica-causas');
      if (!res.ok) throw new Error('Error al consultar analítica de Pareto');
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Respuesta inválida del servidor');
      }
    } catch (err: any) {
      console.error('Error cargando analítica de causas:', err);
      setError(err.message || 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalitica();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const items = tabActiva === 'casos' 
    ? (data?.pareto_casos || []) 
    : (data?.pareto_presupuestos || []);
    
  const total = tabActiva === 'casos' 
    ? (data?.total_casos_categorizados || 0) 
    : (data?.total_presupuestos_categorizados || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Análisis de Causas Raíz y Pareto Quirúrgico
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Regla 80/20
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Identificación de principales objeciones y motivos de demora en casos quirúrgicos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalitica}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs de Selección */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-100 bg-white">
          <button
            onClick={() => setTabActiva('casos')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              tabActiva === 'casos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Causas en Expedientes Quirúrgicos ({data?.total_casos_categorizados || 0})
          </button>
          <button
            onClick={() => setTabActiva('presupuestos')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
              tabActiva === 'presupuestos'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Objeciones de Presupuestos ({data?.total_presupuestos_categorizados || 0})
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-sm font-medium">Calculando frecuencias y distribución acumulada...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700">Sin datos de causas tipificadas</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Aún no se han registrado motivos de demora o desistimiento en los casos o presupuestos de esta categoría.
              </p>
            </div>
          ) : (
            <>
              {/* Resumen Superior */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Total Registros Analizados
                  </span>
                  <span className="text-2xl font-black text-slate-800">{total}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">Casos o presupuestos clasificados</span>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">
                    Causa Crítica #1 (Principio Pareto)
                  </span>
                  <span className="text-xl font-black text-amber-900 truncate block">
                    {CATEGORIA_LABELS[items[0]?.categoria]?.label || items[0]?.categoria || 'N/A'}
                  </span>
                  <span className="text-[11px] text-amber-700 block mt-1">
                    Concentra el <strong>{items[0]?.porcentaje || 0}%</strong> de las demoras
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block mb-1">
                    Umbral 80% Acumulado
                  </span>
                  <span className="text-xl font-black text-indigo-900">
                    {items.filter(i => (i.porcentaje_acumulado || 0) <= 85).length || 1} Causa(s)
                  </span>
                  <span className="text-[11px] text-indigo-700 block mt-1">
                    Resolver estas causas soluciona el 80% del estancamiento
                  </span>
                </div>
              </div>

              {/* Diagrama de Barras Visuales de Pareto */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Distribución de Causas y Porcentaje Acumulado</span>
                  <span className="text-[11px] text-slate-400 font-normal">Ordenado por impacto descendente</span>
                </h3>

                <div className="space-y-3.5">
                  {items.map((item, idx) => {
                    const meta = CATEGORIA_LABELS[item.categoria] || {
                      label: item.categoria,
                      color: 'bg-slate-400'
                    };
                    const es80 = (item.porcentaje_acumulado || 0) <= 80;

                    return (
                      <div key={item.categoria} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800">{meta.label}</span>
                            {es80 && (
                              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">
                                Vital 80%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-slate-600 font-mono text-[11px]">
                            <span>{item.cantidad} casos ({item.porcentaje}%)</span>
                            <span className="text-slate-400 font-semibold">Acum: {item.porcentaje_acumulado}%</span>
                          </div>
                        </div>

                        {/* Barra de Progreso Doble */}
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
                          <div
                            className={`h-full ${meta.color} transition-all duration-500 rounded-full`}
                            style={{ width: `${item.porcentaje || 0}%` }}
                          />
                        </div>

                        {/* Detalle Monetario si es presupuesto */}
                        {tabActiva === 'presupuestos' && (item.monto_ars || item.monto_usd) && (
                          <div className="text-[11px] text-slate-500 flex gap-4 pl-7 font-mono">
                            {Boolean(item.monto_ars) && (
                              <span>Monto en riesgo: ARS ${Number(item.monto_ars).toLocaleString('es-AR')}</span>
                            )}
                            {Boolean(item.monto_usd) && (
                              <span>Monto USD: ${Number(item.monto_usd).toLocaleString('en-US')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Datos calculados en tiempo real desde Supabase</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors text-xs"
          >
            Cerrar Análisis
          </button>
        </div>

      </div>
    </div>
  );
};
