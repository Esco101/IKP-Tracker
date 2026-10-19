import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  DispatchStatus,
  EXPEDITION_DIRECTORY,
  ExpeditionRecord,
  OutStockUnit,
  PortalViewMode,
} from '../types';

interface RapidVinLookupViewProps {
  units: OutStockUnit[];
  portalMode: PortalViewMode;
  activeExpeditionId: string;
  activeExpeditionName: string;
  isOwnerEligible: boolean;
  expeditions?: ExpeditionRecord[];
  ownerExpeditionFilter?: string;
  onOwnerExpeditionFilterChange?: (expId: string) => void;
  onAdvanceStatus: (unit: OutStockUnit, nextStatus: DispatchStatus) => Promise<void>;
}

export const RapidVinLookupView: React.FC<RapidVinLookupViewProps> = ({
  units,
  portalMode,
  activeExpeditionId,
  activeExpeditionName,
  isOwnerEligible,
  expeditions = [],
  ownerExpeditionFilter,
  onOwnerExpeditionFilterChange,
  onAdvanceStatus,
}) => {
  const [queryText, setQueryText] = useState<string>('');
  const [internalExpeditionFilter, setInternalExpeditionFilter] = useState<string>('ALL');
  const [variantFilter, setVariantFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | 'ALL'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeExpFilter =
    ownerExpeditionFilter !== undefined ? ownerExpeditionFilter : internalExpeditionFilter;

  const handleExpFilterChange = (id: string) => {
    setInternalExpeditionFilter(id);
    if (onOwnerExpeditionFilterChange) {
      onOwnerExpeditionFilterChange(id);
    }
  };

  const databaseExpeditions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exp of EXPEDITION_DIRECTORY) {
      if (
        exp.id !== 'puninar-jaya' &&
        !exp.name.toLowerCase().includes('puninar')
      ) {
        map.set(exp.id, exp.name);
      }
    }
    for (const exp of expeditions) {
      if (
        exp.accountRole === 'EXPEDITION' &&
        exp.expeditionId !== 'puninar-jaya' &&
        !exp.name.toLowerCase().includes('puninar')
      ) {
        map.set(exp.expeditionId, exp.name);
      }
    }
    for (const u of units) {
      if (
        u.expeditionId &&
        u.expeditionId !== 'owner-pdc-ai' &&
        u.expeditionId !== 'puninar-jaya' &&
        !u.expeditionName.toLowerCase().includes('puninar')
      ) {
        if (!map.has(u.expeditionId)) {
          map.set(u.expeditionId, u.expeditionName);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditions, units]);

  const scopedUnits = useMemo(() => {
    const clean = units.filter(
      (u) =>
        u.expeditionId !== 'puninar-jaya' &&
        !u.expeditionName.toLowerCase().includes('puninar')
    );
    if (portalMode === 'EXPEDITION_ONLY') {
      return clean.filter((u) => u.expeditionId === activeExpeditionId);
    }
    if (portalMode === 'OWNER_ALL' && activeExpFilter !== 'ALL') {
      return clean.filter((u) => u.expeditionId === activeExpFilter);
    }
    return clean;
  }, [units, portalMode, activeExpeditionId, activeExpFilter]);

  const filteredUnits = useMemo(() => {
    const q = queryText.trim().toUpperCase();
    return scopedUnits.filter((unit) => {
      if (
        variantFilter !== 'ALL' &&
        unit.variantName.toUpperCase() !== variantFilter.toUpperCase()
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && unit.status !== statusFilter) return false;
      if (!q) return true;

      return (
        unit.vin.toUpperCase().includes(q) ||
        unit.variantName.toUpperCase().includes(q)
      );
    });
  }, [scopedUnits, queryText, variantFilter, statusFilter]);

  const handleCopyVin = async (unit: OutStockUnit) => {
    try {
      await navigator.clipboard.writeText(unit.vin);
      setCopiedId(unit.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore if clipboard blocked
    }
  };

  const handleStatusTap = async (unit: OutStockUnit, nextStatus: DispatchStatus) => {
    setBusyId(unit.id);
    try {
      await onAdvanceStatus(unit, nextStatus);
    } finally {
      setBusyId(null);
    }
  };

  const renderHighlightedVin = (vin: string, rawQuery: string) => {
    const q = rawQuery.trim().toUpperCase();
    if (!q) return <span>{vin}</span>;
    const index = vin.toUpperCase().indexOf(q);
    if (index === -1) return <span>{vin}</span>;

    const before = vin.slice(0, index);
    const match = vin.slice(index, index + q.length);
    const after = vin.slice(index + q.length);

    return (
      <span>
        {before}
        <mark className="bg-amber-200 text-slate-950 rounded-xs px-0.5 font-bold">{match}</mark>
        {after}
      </span>
    );
  };

  const formatRealTimeOut = (date: Date) => {
    return `${date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} · ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Rapid VIN Lookup
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {portalMode === 'OWNER_ALL'
              ? 'Searching All Expedition Sections'
              : `Searching ${activeExpeditionName}`}
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Results: <strong className="text-slate-900">{filteredUnits.length}</strong> /{' '}
          {scopedUnits.length}
        </div>
      </div>

      {/* Search Bar & Variant Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search by VIN or Variant Unit..."
            autoFocus
            className="w-full min-h-[50px] pl-12 pr-12 py-3 text-sm sm:text-base font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          {queryText && (
            <button
              type="button"
              onClick={() => {
                setQueryText('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
              className="min-h-[44px] min-w-[44px] absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center text-slate-400 hover:text-slate-800 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setVariantFilter('ALL')}
                className="min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs whitespace-nowrap shrink-0"
              >
                All Variants
              </button>
            </div>

            {portalMode === 'OWNER_ALL' && databaseExpeditions.length > 0 && (
              <select
                value={activeExpFilter}
                onChange={(e) => handleExpFilterChange(e.target.value)}
                aria-label="Filter by Expedition"
                className="min-h-[36px] px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="ALL">All Expeditions (Database)</option>
                {databaseExpeditions.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'ALL', label: 'All Units' },
                { id: 'STANDBY', label: 'Waiting Out' },
                { id: 'OUT_GATE', label: 'Out Gate' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results List */}
      {filteredUnits.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-1">
          <p className="text-sm font-bold text-slate-900">No Matching VIN Found</p>
          <p className="text-xs text-slate-500">
            Try typing the last 4 to 6 digits of the VIN number.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
          {filteredUnits.map((unit) => {
            const isBusy = busyId === unit.id;
            const isOutGate = unit.status === 'OUT_GATE';

            return (
              <div
                key={unit.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-xs text-red-600">
                      {unit.variantName}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="font-mono font-bold text-base sm:text-lg text-slate-900 tabular-nums">
                      {renderHighlightedVin(unit.vin, queryText)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyVin(unit)}
                      className="min-h-[32px] px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center gap-1"
                    >
                      {copiedId === unit.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
                    <span>
                      Expedition: <strong className="text-slate-900">{unit.expeditionName}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {isOutGate ? (
                        <strong className="text-emerald-700">
                          OUT: {formatRealTimeOut(unit.updatedAt)}
                        </strong>
                      ) : (
                        <span className="text-slate-400">Waiting Out Gate</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* 1-Tap Out Gate Action */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isOutGate ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusTap(unit, 'OUT_GATE')}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isBusy ? 'Updating OUT...' : 'Tap to Out Gate'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Out Gate
                      </span>
                      {isOwnerEligible && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleStatusTap(unit, 'STANDBY')}
                          className="min-h-[42px] px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
