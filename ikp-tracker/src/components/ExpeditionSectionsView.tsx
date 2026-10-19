import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  DispatchStatus,
  EXPEDITION_DIRECTORY,
  ExpeditionRecord,
  OutStockUnit,
  PortalViewMode,
} from '../types';

interface ExpeditionSectionsViewProps {
  units: OutStockUnit[];
  expeditions: ExpeditionRecord[];
  portalMode: PortalViewMode;
  activeExpeditionId: string;
  activeExpeditionName: string;
  isOwnerEligible: boolean;
  ownerExpeditionFilter?: string;
  onOwnerExpeditionFilterChange?: (expId: string) => void;
  onAdvanceStatus: (unit: OutStockUnit, nextStatus: DispatchStatus) => Promise<void>;
  onDeleteUnit: (unit: OutStockUnit) => Promise<void>;
  onOpenBatchForExpedition: (expedition: { id: string; name: string }) => void;
  onRenameExpeditionSection: (expeditionId: string, newName: string) => Promise<void>;
  onDeleteExpeditionSection: (expeditionId: string) => Promise<void>;
  onOpenManageExpeditions: () => void;
  onSeedSampleUnits: () => Promise<void>;
  isSeeding: boolean;
  onOpenRapidSearch: () => void;
  onOpenSummaryReport?: () => void;
}

interface ExpeditionSectionGroup {
  expeditionId: string;
  expeditionName: string;
  units: OutStockUnit[];
  outGateCount: number;
  standbyCount: number;
}

export const ExpeditionSectionsView: React.FC<ExpeditionSectionsViewProps> = ({
  units,
  expeditions,
  portalMode,
  activeExpeditionId,
  activeExpeditionName,
  isOwnerEligible,
  ownerExpeditionFilter,
  onOwnerExpeditionFilterChange,
  onAdvanceStatus,
  onDeleteUnit,
  onOpenBatchForExpedition,
  onRenameExpeditionSection,
  onDeleteExpeditionSection,
  onOpenManageExpeditions,
  onSeedSampleUnits,
  isSeeding,
  onOpenRapidSearch,
  onOpenSummaryReport,
}) => {
  const [internalSectionFilter, setInternalSectionFilter] = useState<string>('ALL');
  const [selectedVariantFilter, setSelectedVariantFilter] = useState<string>('ALL');
  const [busyUnitId, setBusyUnitId] = useState<string | null>(null);
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);
  const [currentNow, setCurrentNow] = useState<Date>(() => new Date());

  const activeExpeditionFilter =
    ownerExpeditionFilter !== undefined ? ownerExpeditionFilter : internalSectionFilter;

  const handleFilterExpeditionChange = (expId: string) => {
    setInternalSectionFilter(expId);
    if (onOwnerExpeditionFilterChange) {
      onOwnerExpeditionFilterChange(expId);
    }
  };

  // Real-time clock for Date, Month, and Year header on every section
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const formattedCurrentDateMonthYear = useMemo(() => {
    return currentNow.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [currentNow]);

  // All expeditions already added in the database (from /expeditions collection + units + presets)
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

  const configuredExpeditions = databaseExpeditions;

  // Build dedicated, separate sections for each expedition (never merged)
  const expeditionSections = useMemo<ExpeditionSectionGroup[]>(() => {
    const map = new Map<string, ExpeditionSectionGroup>();

    if (portalMode === 'EXPEDITION_ONLY') {
      map.set(activeExpeditionId, {
        expeditionId: activeExpeditionId,
        expeditionName: activeExpeditionName,
        units: [],
        outGateCount: 0,
        standbyCount: 0,
      });
    } else {
      for (const exp of configuredExpeditions) {
        map.set(exp.id, {
          expeditionId: exp.id,
          expeditionName: exp.name,
          units: [],
          outGateCount: 0,
          standbyCount: 0,
        });
      }
    }

    for (const unit of units) {
      // Completely exclude Puninar Jaya from activity
      if (
        unit.expeditionId === 'puninar-jaya' ||
        unit.expeditionName.toLowerCase().includes('puninar')
      ) {
        continue;
      }

      if (portalMode === 'EXPEDITION_ONLY' && unit.expeditionId !== activeExpeditionId) {
        continue;
      }
      if (
        selectedVariantFilter !== 'ALL' &&
        unit.variantName.toUpperCase() !== selectedVariantFilter.toUpperCase()
      ) {
        continue;
      }

      let group = map.get(unit.expeditionId);
      if (!group) {
        group = {
          expeditionId: unit.expeditionId,
          expeditionName: unit.expeditionName,
          units: [],
          outGateCount: 0,
          standbyCount: 0,
        };
        map.set(unit.expeditionId, group);
      }

      group.units.push(unit);
      if (unit.status === 'OUT_GATE') {
        group.outGateCount += 1;
      } else {
        group.standbyCount += 1;
      }
    }

    const list = Array.from(map.values()).filter(
      (s) =>
        s.expeditionId !== 'puninar-jaya' &&
        !s.expeditionName.toLowerCase().includes('puninar')
    );
    list.sort((a, b) => {
      if (b.units.length !== a.units.length) return b.units.length - a.units.length;
      return a.expeditionName.localeCompare(b.expeditionName);
    });

    if (portalMode === 'OWNER_ALL' && activeExpeditionFilter !== 'ALL') {
      return list.filter((s) => s.expeditionId === activeExpeditionFilter);
    }
    return list;
  }, [
    units,
    configuredExpeditions,
    portalMode,
    activeExpeditionId,
    activeExpeditionName,
    selectedVariantFilter,
    activeExpeditionFilter,
  ]);

  const totalVisibleUnits = useMemo(
    () => expeditionSections.reduce((acc, s) => acc + s.units.length, 0),
    [expeditionSections]
  );

  const totalOutGateUnits = useMemo(
    () => expeditionSections.reduce((acc, s) => acc + s.outGateCount, 0),
    [expeditionSections]
  );

  const totalWaitingUnits = useMemo(
    () => expeditionSections.reduce((acc, s) => acc + s.standbyCount, 0),
    [expeditionSections]
  );

  const handleExportSectionExcel = (section: ExpeditionSectionGroup) => {
    try {
      const wb = XLSX.utils.book_new();
      const rows = [
        ['No', 'Variant Unit', 'VIN', 'Vehicle Type', 'Expedition Name', 'Status', 'Timestamp In', 'Timestamp Out (Real-Time)', 'Operator'],
        ...section.units.map((u, idx) => [
          idx + 1,
          u.variantName || '-',
          u.vin,
          u.vehicleType || 'ELF',
          u.expeditionName,
          u.status === 'OUT_GATE' ? 'OUT GATE' : 'STANDBY',
          u.createdAt ? u.createdAt.toLocaleString('en-GB') : '-',
          u.status === 'OUT_GATE' && u.updatedAt ? u.updatedAt.toLocaleString('en-GB') : '-',
          u.operatorName || 'PDC Operator',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 22 },
        { wch: 14 },
        { wch: 30 },
        { wch: 14 },
        { wch: 20 },
        { wch: 22 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Dispatch Log');
      XLSX.writeFile(wb, `IKP_${section.expeditionId}_Dispatch_Report.xlsx`);
    } catch (err) {
      console.error('Failed to export section to Excel:', err);
    }
  };


  const handleStatusTap = async (unit: OutStockUnit, targetStatus: DispatchStatus) => {
    setBusyUnitId(unit.id);
    try {
      await onAdvanceStatus(unit, targetStatus);
    } finally {
      setBusyUnitId(null);
    }
  };

  const handleDeleteClick = async (unit: OutStockUnit) => {
    setBusyUnitId(unit.id);
    try {
      await onDeleteUnit(unit);
    } finally {
      setBusyUnitId(null);
    }
  };

  const handleSaveRename = async (expeditionId: string) => {
    if (!renameText.trim()) return;
    setIsSavingRename(true);
    try {
      await onRenameExpeditionSection(expeditionId, renameText.trim());
      setRenamingSectionId(null);
      setRenameText('');
    } finally {
      setIsSavingRename(false);
    }
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
    <div className="space-y-6">
      {/* Compact Top Summary & Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            {portalMode === 'OWNER_ALL'
              ? `IKP Tracker · ${formattedCurrentDateMonthYear}`
              : `${activeExpeditionName} · ${formattedCurrentDateMonthYear}`}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-mono tabular-nums text-slate-700">
            <strong className="text-slate-900 font-sans text-base">
              Total: {totalVisibleUnits} Units
            </strong>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">
              Out Gate: {totalOutGateUnits}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-semibold">
              Waiting: {totalWaitingUnits}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenSummaryReport && (
            <button
              type="button"
              onClick={onOpenSummaryReport}
              className="min-h-[42px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Summary Report &amp; Excel
            </button>
          )}
          {isOwnerEligible && (
            <button
              type="button"
              onClick={onOpenManageExpeditions}
              className="min-h-[42px] px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-red-600" />
              Add / Manage Expeditions
            </button>
          )}
          <button
            type="button"
            onClick={onOpenRapidSearch}
            className="min-h-[42px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4 text-red-600" />
            Rapid VIN Search
          </button>
        </div>
      </div>

      {/* Filter Bar with Dedicated Expedition Filter for Owner Login */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
        {portalMode === 'OWNER_ALL' && (
          <div className="space-y-2.5 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Filter Expedition (Database):
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {configuredExpeditions.length} Added in Database
                </span>
              </div>

              {/* Direct Select Dropdown for Owner */}
              <select
                value={activeExpeditionFilter}
                onChange={(e) => handleFilterExpeditionChange(e.target.value)}
                aria-label="Filter by Expedition"
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="ALL">All Expeditions ({units.length} Units)</option>
                {configuredExpeditions.map((exp) => {
                  const count = units.filter((u) => u.expeditionId === exp.id).length;
                  return (
                    <option key={exp.id} value={exp.id}>
                      {exp.name} ({count} Units)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick 1-Tap Filter Chips for Expeditions Added in Database */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => handleFilterExpeditionChange('ALL')}
                className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeExpeditionFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>All Expeditions</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeExpeditionFilter === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {units.length}
                </span>
              </button>

              {configuredExpeditions.map((exp) => {
                const count = units.filter((u) => u.expeditionId === exp.id).length;
                const isSelected = activeExpeditionFilter === exp.id;
                return (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => handleFilterExpeditionChange(exp.id)}
                    className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-xs font-bold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{exp.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {configuredExpeditions.length === 0 && (
                <div className="text-xs text-slate-500 italic py-1">
                  No custom expeditions added in database yet.
                </div>
              )}
            </div>

            {/* Active Expedition Filter Notice Bar */}
            {activeExpeditionFilter !== 'ALL' && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 text-xs text-red-900">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Active Expedition Filter:</span>
                  <span className="font-semibold underline">
                    {configuredExpeditions.find((e) => e.id === activeExpeditionFilter)?.name ||
                      activeExpeditionFilter}
                  </span>
                  <span className="font-mono text-red-700">
                    ({totalVisibleUnits} Units)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFilterExpeditionChange('ALL')}
                  className="px-2.5 py-1 text-xs font-bold bg-white text-red-700 border border-red-300 rounded-lg hover:bg-red-100 transition-colors shrink-0"
                >
                  Show All Expeditions
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedVariantFilter('ALL')}
              className="min-h-[34px] px-3.5 py-1 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs whitespace-nowrap shrink-0"
            >
              All Variants
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {units.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Layers className="w-9 h-9 text-slate-400 mx-auto" />
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">No IKP Out-Stock Activity Yet</h2>
            <p className="text-xs text-slate-500">
              Stay connected with PDC - AI. Paste VIN & Variant Unit from Excel to start tracking out-stock activity in real time.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                onOpenBatchForExpedition({
                  id: activeExpeditionId,
                  name: activeExpeditionName,
                })
              }
              className="min-h-[44px] px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Paste VIN & Variant Unit
            </button>
          </div>
        </div>
      )}

      {/* Strictly Separated Per-Expedition Sections (Not Merged) */}
      <div className="space-y-6">
        {expeditionSections.map((section) => (
          <section
            key={section.expeditionId}
            aria-label={`Expedition Section ${section.expeditionName}`}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
          >
            {/* Expedition Section Header with Real-Time Date, Month, and Year */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold text-slate-700 font-mono">
                    {formattedCurrentDateMonthYear}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {section.units.length} Total
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                    {section.outGateCount} Out Gate
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-amber-700 font-semibold">
                    {section.standbyCount} Waiting
                  </span>
                </div>

                {renamingSectionId === section.expeditionId ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      maxLength={100}
                      className="min-h-[38px] px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <button
                      type="button"
                      disabled={isSavingRename}
                      onClick={() => handleSaveRename(section.expeditionId)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg"
                    >
                      {isSavingRename ? 'Saving...' : 'Save Name'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingSectionId(null)}
                      className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 bg-white rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                      {section.expeditionName}
                    </h2>
                    {isOwnerEligible && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingSectionId(section.expeditionId);
                            setRenameText(section.expeditionName);
                          }}
                          title="Rename Expedition"
                          className="min-h-[30px] px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        {section.units.length === 0 && (
                          <button
                            type="button"
                            onClick={() => onDeleteExpeditionSection(section.expeditionId)}
                            title="Remove Expedition Section"
                            className="min-h-[30px] px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {section.units.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleExportSectionExcel(section)}
                    className="min-h-[42px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    title={`Export ${section.expeditionName} report format Excel`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Excel (.xlsx)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onOpenBatchForExpedition({
                      id: section.expeditionId,
                      name: section.expeditionName,
                    })
                  }
                  className="min-h-[42px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Input VIN
                </button>
              </div>
            </div>

            {/* Section Rows: Variant Unit, VIN, Expedition Name, Real-Time Timestamp OUT, & Out Gate Button */}
            {section.units.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No units recorded in <strong>{section.expeditionName}</strong> section.
              </div>
            ) : (
              <div>
                {/* Desktop Clean Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-500">
                        <th className="py-3 px-5">Variant Unit</th>
                        <th className="py-3 px-4">VIN</th>
                        <th className="py-3 px-4">Expedition Name</th>
                        <th className="py-3 px-4">Timestamp OUT (Real-Time)</th>
                        <th className="py-3 px-5 text-right">Status Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {section.units.map((unit) => {
                        const isBusy = busyUnitId === unit.id;
                        const isOutGate = unit.status === 'OUT_GATE';

                        return (
                          <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-5">
                              <span className="font-bold text-xs text-slate-900">
                                {unit.variantName}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                              {unit.vin}
                            </td>
                            <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                              {unit.expeditionName}
                            </td>
                            <td className="py-3.5 px-4 text-xs font-mono tabular-nums">
                              {isOutGate ? (
                                <span className="text-emerald-700 font-semibold">
                                  OUT: {formatRealTimeOut(unit.updatedAt)}
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Waiting Out Gate
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                {!isOutGate ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleStatusTap(unit, 'OUT_GATE')}
                                    className="min-h-[38px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Out Gate
                                  </button>
                                ) : (
                                  <div className="inline-flex items-center gap-2">
                                    <span className="min-h-[36px] px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      Out Gate
                                    </span>
                                    {isOwnerEligible && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => handleStatusTap(unit, 'STANDBY')}
                                        title="Reset to Waiting"
                                        className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg inline-flex items-center gap-1"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}

                                {(isOwnerEligible || !isOutGate) && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleDeleteClick(unit)}
                                    aria-label={`Delete ${unit.vin}`}
                                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Phone Web: One-Thumb Out Gate Update Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {section.units.map((unit) => {
                    const isBusy = busyUnitId === unit.id;
                    const isOutGate = unit.status === 'OUT_GATE';

                    return (
                      <div key={unit.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="font-bold text-xs text-red-600">
                              {unit.variantName}
                            </div>
                            <div className="font-mono font-bold text-base text-slate-900 tabular-nums">
                              {unit.vin}
                            </div>
                            <div className="text-xs text-slate-500">
                              <span>{unit.expeditionName}</span>
                            </div>
                          </div>

                          {(isOwnerEligible || !isOutGate) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteClick(unit)}
                              aria-label={`Delete ${unit.vin}`}
                              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Real-Time Timestamp OUT Display */}
                        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {isOutGate ? (
                            <span className="text-emerald-700 font-semibold">
                              OUT: {formatRealTimeOut(unit.updatedAt)}
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Timestamp OUT: Waiting Out Gate
                            </span>
                          )}
                        </div>

                        {/* Large 1-Tap Mobile Action Button */}
                        {!isOutGate ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusTap(unit, 'OUT_GATE')}
                            className="w-full min-h-[46px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {isBusy ? 'Updating Real-Time OUT...' : 'Tap to Out Gate (Update Timestamp OUT)'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-h-[44px] px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Out Gate Confirmed
                            </div>
                            {isOwnerEligible && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusTap(unit, 'STANDBY')}
                                className="min-h-[44px] px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl inline-flex items-center gap-1"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};
