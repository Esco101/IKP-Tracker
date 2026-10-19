import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Search,
  TrendingUp,
  Truck,
  RotateCcw,
} from 'lucide-react';
import {
  DispatchStatus,
  EXPEDITION_DIRECTORY,
  ExpeditionRecord,
  OutStockUnit,
  PortalViewMode,
  VehicleType,
  VEHICLE_TYPES,
} from '../types';

interface SummaryReportDashboardViewProps {
  units: OutStockUnit[];
  expeditions: ExpeditionRecord[];
  portalMode: PortalViewMode;
  activeExpeditionId: string;
  activeExpeditionName: string;
  isOwnerEligible: boolean;
  ownerExpeditionFilter?: string;
  onOwnerExpeditionFilterChange?: (expId: string) => void;
  onAdvanceStatus?: (unit: OutStockUnit, nextStatus: DispatchStatus) => Promise<void>;
  onNavigateToBatch?: () => void;
}

type ReportPeriodMode = 'daily' | 'monthly';

export const SummaryReportDashboardView: React.FC<SummaryReportDashboardViewProps> = ({
  units,
  expeditions,
  portalMode,
  activeExpeditionId,
  activeExpeditionName,
  isOwnerEligible,
  ownerExpeditionFilter,
  onOwnerExpeditionFilterChange,
}) => {
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('daily');

  // Format today as YYYY-MM-DD in local time
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [selectedMonthYear, setSelectedMonthYear] = useState<{
    year: number;
    month: number; // 0-indexed (0 = Jan, 11 = Dec)
  }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [localExpeditionFilter, setLocalExpeditionFilter] = useState<string>(
    ownerExpeditionFilter || 'ALL'
  );

  const [statusFilter, setStatusFilter] = useState<'ALL' | DispatchStatus>('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Synchronize owner filter if provided from parent
  const effectiveExpeditionFilter = useMemo(() => {
    if (portalMode === 'EXPEDITION_ONLY') {
      return activeExpeditionId;
    }
    return ownerExpeditionFilter !== undefined ? ownerExpeditionFilter : localExpeditionFilter;
  }, [portalMode, activeExpeditionId, ownerExpeditionFilter, localExpeditionFilter]);

  const handleExpeditionFilterChange = (expId: string) => {
    setLocalExpeditionFilter(expId);
    if (onOwnerExpeditionFilterChange) {
      onOwnerExpeditionFilterChange(expId);
    }
  };

  // Compile list of known valid expeditions (excluding any Puninar legacy)
  const availableExpeditions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exp of EXPEDITION_DIRECTORY) {
      if (exp.id !== 'puninar-jaya' && !exp.name.toLowerCase().includes('puninar')) {
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

  // Filter units according to Period (Daily vs Monthly) & Expedition Scope
  const scopedUnits = useMemo(() => {
    return units.filter((u) => {
      // Exclude legacy deleted expedition
      if (u.expeditionId === 'puninar-jaya' || u.expeditionName.toLowerCase().includes('puninar')) {
        return false;
      }

      // Expedition Scope filter
      if (portalMode === 'EXPEDITION_ONLY') {
        if (u.expeditionId !== activeExpeditionId) return false;
      } else if (effectiveExpeditionFilter !== 'ALL') {
        if (u.expeditionId !== effectiveExpeditionFilter) return false;
      }

      // Relevant date check:
      // A unit belongs to a day/month if either its updatedAt (dispatch event) or createdAt occurred in that period
      const unitDate = u.updatedAt || u.createdAt;
      if (!unitDate) return false;

      if (periodMode === 'daily') {
        const uYear = unitDate.getFullYear();
        const uMonth = String(unitDate.getMonth() + 1).padStart(2, '0');
        const uDay = String(unitDate.getDate()).padStart(2, '0');
        const uDateStr = `${uYear}-${uMonth}-${uDay}`;
        return uDateStr === selectedDate;
      } else {
        // Monthly filter
        return (
          unitDate.getFullYear() === selectedMonthYear.year &&
          unitDate.getMonth() === selectedMonthYear.month
        );
      }
    });
  }, [
    units,
    portalMode,
    activeExpeditionId,
    effectiveExpeditionFilter,
    periodMode,
    selectedDate,
    selectedMonthYear,
  ]);

  // Overall KPIs for the period
  const totalUnitsCount = scopedUnits.length;
  const outGateUnits = scopedUnits.filter((u) => u.status === 'OUT_GATE');
  const standbyUnits = scopedUnits.filter((u) => u.status === 'STANDBY');
  const outGateCount = outGateUnits.length;
  const standbyCount = standbyUnits.length;
  const completionRate =
    totalUnitsCount > 0 ? Math.round((outGateCount / totalUnitsCount) * 100) : 0;

  // Breakdown by Expedition
  const expeditionBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        outGate: number;
        standby: number;
        total: number;
      }
    >();

    // Initialize with available expeditions if owner view and ALL is selected, or just the filtered one
    const targetExpeditions =
      effectiveExpeditionFilter === 'ALL'
        ? availableExpeditions
        : availableExpeditions.filter((e) => e.id === effectiveExpeditionFilter);

    for (const exp of targetExpeditions) {
      map.set(exp.id, {
        id: exp.id,
        name: exp.name,
        outGate: 0,
        standby: 0,
        total: 0,
      });
    }

    for (const unit of scopedUnits) {
      let entry = map.get(unit.expeditionId);
      if (!entry) {
        entry = {
          id: unit.expeditionId,
          name: unit.expeditionName,
          outGate: 0,
          standby: 0,
          total: 0,
        };
        map.set(unit.expeditionId, entry);
      }
      entry.total += 1;
      if (unit.status === 'OUT_GATE') {
        entry.outGate += 1;
      } else {
        entry.standby += 1;
      }
    }

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [availableExpeditions, effectiveExpeditionFilter, scopedUnits]);

  // Breakdown by Vehicle Type
  const vehicleTypeBreakdown = useMemo(() => {
    const map: Record<VehicleType, { count: number; outGate: number; standby: number }> = {
      TRAGA: { count: 0, outGate: 0, standby: 0 },
      ELF: { count: 0, outGate: 0, standby: 0 },
      GIGA: { count: 0, outGate: 0, standby: 0 },
      'D-MAX': { count: 0, outGate: 0, standby: 0 },
      'MU-X': { count: 0, outGate: 0, standby: 0 },
    };

    for (const unit of scopedUnits) {
      const type = (unit.vehicleType || 'ELF') as VehicleType;
      if (map[type]) {
        map[type].count += 1;
        if (unit.status === 'OUT_GATE') {
          map[type].outGate += 1;
        } else {
          map[type].standby += 1;
        }
      }
    }

    return VEHICLE_TYPES.map((type) => {
      const stats = map[type];
      const percentage = totalUnitsCount > 0 ? Math.round((stats.count / totalUnitsCount) * 100) : 0;
      return {
        type,
        count: stats.count,
        outGate: stats.outGate,
        standby: stats.standby,
        percentage,
      };
    });
  }, [scopedUnits, totalUnitsCount]);

  // Monthly Day-by-Day Breakdown (1..daysInMonth)
  const monthlyDailyTrend = useMemo(() => {
    if (periodMode !== 'monthly') return [];

    const { year, month } = selectedMonthYear;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: Array<{
      day: number;
      dateStr: string;
      dayOfWeek: string;
      outGate: number;
      standby: number;
      total: number;
      completionRate: number;
    }> = [];

    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = dayFormatter.format(d);

      let dayOutGate = 0;
      let dayStandby = 0;

      for (const u of scopedUnits) {
        const uDate = u.updatedAt || u.createdAt;
        if (uDate && uDate.getDate() === day) {
          if (u.status === 'OUT_GATE') {
            dayOutGate += 1;
          } else {
            dayStandby += 1;
          }
        }
      }

      const total = dayOutGate + dayStandby;
      result.push({
        day,
        dateStr,
        dayOfWeek,
        outGate: dayOutGate,
        standby: dayStandby,
        total,
        completionRate: total > 0 ? Math.round((dayOutGate / total) * 100) : 0,
      });
    }

    return result;
  }, [periodMode, selectedMonthYear, scopedUnits]);

  // Daily Hourly Distribution (for Daily Report)
  const dailyHourlyTrend = useMemo(() => {
    if (periodMode !== 'daily') return [];

    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${String(i).padStart(2, '0')}:00`,
      outGate: 0,
      standby: 0,
      total: 0,
    }));

    for (const u of scopedUnits) {
      const uDate = u.updatedAt || u.createdAt;
      if (uDate) {
        const h = uDate.getHours();
        if (hours[h]) {
          hours[h].total += 1;
          if (u.status === 'OUT_GATE') {
            hours[h].outGate += 1;
          } else {
            hours[h].standby += 1;
          }
        }
      }
    }

    // Return active daylight window (e.g. 06:00 to 20:00) or hours with data
    return hours.filter((h) => (h.hour >= 6 && h.hour <= 20) || h.total > 0);
  }, [periodMode, scopedUnits]);

  // Filtered unit manifest table for granular inspection
  const filteredManifestUnits = useMemo(() => {
    return scopedUnits.filter((u) => {
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (vehicleTypeFilter !== 'ALL' && u.vehicleType !== vehicleTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vinMatch = u.vin.toLowerCase().includes(q);
        const variantMatch = u.variantName.toLowerCase().includes(q);
        const expMatch = u.expeditionName.toLowerCase().includes(q);
        const opMatch = (u.operatorName || '').toLowerCase().includes(q);
        if (!vinMatch && !variantMatch && !expMatch && !opMatch) return false;
      }

      return true;
    });
  }, [scopedUnits, statusFilter, vehicleTypeFilter, searchQuery]);

  // Excel Export Handler (.xlsx format with XLSX library)
  const handleExportExcel = () => {
    setIsExporting(true);
    setExportSuccessMessage(null);

    try {
      const wb = XLSX.utils.book_new();
      const scopeLabel =
        effectiveExpeditionFilter === 'ALL'
          ? 'All Expeditions'
          : availableExpeditions.find((e) => e.id === effectiveExpeditionFilter)?.name ||
            effectiveExpeditionFilter;

      const generatedTimestamp = new Date().toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });

      if (periodMode === 'daily') {
        // --- SHEET 1: DAILY SUMMARY DASHBOARD ---
        const summaryAoa: any[][] = [
          ['IKP TRACKER - PDC AI YARD ACTIVITY'],
          ['DAILY SUMMARY REPORT & DISPATCH AUDIT'],
          [],
          ['Report Type', 'Daily Activity Summary'],
          ['Report Date', selectedDate],
          ['Expedition Scope', scopeLabel],
          ['Generated At', generatedTimestamp],
          ['Total Units', totalUnitsCount],
          ['Out Gate (Completed)', outGateCount],
          ['Standby (In Yard)', standbyCount],
          ['Completion Rate', `${completionRate}%`],
          [],
          ['=== EXPEDITION PERFORMANCE SUMMARY ==='],
          ['No', 'Expedition Name', 'Standby Units', 'Out Gate Units', 'Total Units', 'Completion Rate'],
        ];

        expeditionBreakdown.forEach((exp, idx) => {
          const rate = exp.total > 0 ? `${Math.round((exp.outGate / exp.total) * 100)}%` : '0%';
          summaryAoa.push([idx + 1, exp.name, exp.standby, exp.outGate, exp.total, rate]);
        });

        summaryAoa.push([]);
        summaryAoa.push(['=== VEHICLE TYPE DISTRIBUTION ===']);
        summaryAoa.push(['Vehicle Type', 'Standby', 'Out Gate', 'Total Units', 'Share %']);
        vehicleTypeBreakdown.forEach((vt) => {
          summaryAoa.push([vt.type, vt.standby, vt.outGate, vt.count, `${vt.percentage}%`]);
        });

        summaryAoa.push([]);
        summaryAoa.push(['=== HOURLY ACTIVITY TIMELINE ===']);
        summaryAoa.push(['Time Window', 'Standby', 'Out Gate', 'Total Dispatched']);
        dailyHourlyTrend.forEach((h) => {
          summaryAoa.push([h.label, h.standby, h.outGate, h.total]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
        wsSummary['!cols'] = [
          { wch: 6 },
          { wch: 36 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
          { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Daily Summary');

        // --- SHEET 2: DETAILED UNIT MANIFEST ---
        const manifestAoa: any[][] = [
          ['No', 'VIN', 'Variant / Material Unit', 'Vehicle Type', 'Expedition Name', 'Status', 'Timestamp In', 'Timestamp Out', 'Operator'],
        ];

        scopedUnits.forEach((u, idx) => {
          const timeIn = u.createdAt
            ? u.createdAt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
            : '-';
          const timeOut =
            u.status === 'OUT_GATE' && u.updatedAt
              ? u.updatedAt.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
              : '-';

          manifestAoa.push([
            idx + 1,
            u.vin,
            u.variantName || '-',
            u.vehicleType || 'ELF',
            u.expeditionName,
            u.status,
            timeIn,
            timeOut,
            u.operatorName || 'PDC Operator',
          ]);
        });

        const wsManifest = XLSX.utils.aoa_to_sheet(manifestAoa);
        wsManifest['!cols'] = [
          { wch: 6 },
          { wch: 22 },
          { wch: 28 },
          { wch: 14 },
          { wch: 32 },
          { wch: 14 },
          { wch: 18 },
          { wch: 18 },
          { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, wsManifest, 'Unit Manifest');

        const fileName = `IKP_Daily_Report_${selectedDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
        setExportSuccessMessage(`Daily report exported: ${fileName}`);
      } else {
        // --- SHEET 1: MONTHLY SUMMARY DASHBOARD ---
        const monthName = new Date(
          selectedMonthYear.year,
          selectedMonthYear.month,
          1
        ).toLocaleString('en-US', { month: 'long', year: 'numeric' });

        const summaryAoa: any[][] = [
          ['IKP TRACKER - PDC AI YARD ACTIVITY'],
          ['MONTHLY SUMMARY REPORT & DISPATCH AUDIT'],
          [],
          ['Report Type', 'Monthly Activity Summary'],
          ['Month & Year', monthName],
          ['Expedition Scope', scopeLabel],
          ['Generated At', generatedTimestamp],
          ['Total Monthly Volume', totalUnitsCount],
          ['Total Out Gate (Completed)', outGateCount],
          ['Total Standby (Waiting)', standbyCount],
          ['Monthly Completion Rate', `${completionRate}%`],
          [],
          ['=== EXPEDITION PERFORMANCE SUMMARY ==='],
          ['No', 'Expedition Name', 'Standby Units', 'Out Gate Units', 'Total Units', 'Completion Rate'],
        ];

        expeditionBreakdown.forEach((exp, idx) => {
          const rate = exp.total > 0 ? `${Math.round((exp.outGate / exp.total) * 100)}%` : '0%';
          summaryAoa.push([idx + 1, exp.name, exp.standby, exp.outGate, exp.total, rate]);
        });

        summaryAoa.push([]);
        summaryAoa.push(['=== VEHICLE TYPE BREAKDOWN ===']);
        summaryAoa.push(['Vehicle Type', 'Standby', 'Out Gate', 'Total Units', 'Share %']);
        vehicleTypeBreakdown.forEach((vt) => {
          summaryAoa.push([vt.type, vt.standby, vt.outGate, vt.count, `${vt.percentage}%`]);
        });

        summaryAoa.push([]);
        summaryAoa.push(['=== DAY-BY-DAY DAILY AUDIT LOG ===']);
        summaryAoa.push(['Date', 'Day', 'Standby Units', 'Out Gate Units', 'Total Units', 'Completion Rate']);
        monthlyDailyTrend.forEach((row) => {
          summaryAoa.push([
            row.dateStr,
            row.dayOfWeek,
            row.standby,
            row.outGate,
            row.total,
            `${row.completionRate}%`,
          ]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
        wsSummary['!cols'] = [
          { wch: 14 },
          { wch: 34 },
          { wch: 16 },
          { wch: 16 },
          { wch: 16 },
          { wch: 18 },
        ];
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

        // --- SHEET 2: COMPLETE MONTHLY MANIFEST ---
        const manifestAoa: any[][] = [
          ['No', 'Date', 'Time', 'VIN', 'Variant / Material Unit', 'Vehicle Type', 'Expedition Name', 'Status', 'Operator'],
        ];

        scopedUnits.forEach((u, idx) => {
          const uDate = u.updatedAt || u.createdAt;
          const dateStr = uDate ? uDate.toLocaleDateString('en-GB') : '-';
          const timeStr = uDate ? uDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-';

          manifestAoa.push([
            idx + 1,
            dateStr,
            timeStr,
            u.vin,
            u.variantName || '-',
            u.vehicleType || 'ELF',
            u.expeditionName,
            u.status,
            u.operatorName || 'PDC Operator',
          ]);
        });

        const wsManifest = XLSX.utils.aoa_to_sheet(manifestAoa);
        wsManifest['!cols'] = [
          { wch: 6 },
          { wch: 14 },
          { wch: 10 },
          { wch: 22 },
          { wch: 28 },
          { wch: 14 },
          { wch: 32 },
          { wch: 14 },
          { wch: 20 },
        ];
        XLSX.utils.book_append_sheet(wb, wsManifest, 'Monthly Manifest');

        const fileName = `IKP_Monthly_Report_${selectedMonthYear.year}_${String(
          selectedMonthYear.month + 1
        ).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        setExportSuccessMessage(`Monthly report exported: ${fileName}`);
      }
    } catch (err) {
      console.error('Failed to export Excel report:', err);
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setExportSuccessMessage(null);
      }, 5000);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    setSelectedMonthYear((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setSelectedMonthYear((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleSetToday = () => {
    setSelectedDate(todayStr);
  };

  const formattedMonthLabel = useMemo(() => {
    return new Date(selectedMonthYear.year, selectedMonthYear.month, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [selectedMonthYear]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-red-50 text-red-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Summary Report Dashboard
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Real-time Daily &amp; Monthly yard metrics with Excel export
                </p>
              </div>
            </div>
          </div>

          {/* Excel Export Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Generating Excel...'
                  : `Export ${periodMode === 'daily' ? 'Daily' : 'Monthly'} Report (.xlsx)`}
              </span>
              <Download className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

        {exportSuccessMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {exportSuccessMessage}
            </span>
            <span className="text-[11px] text-emerald-600">Saved to Downloads</span>
          </div>
        )}

        {/* Filters & Mode Selection Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Mode Switch: Daily vs Monthly */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Report Frequency
            </label>
            <div className="flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPeriodMode('daily')}
                className={`flex-1 min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  periodMode === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-red-600" />
                <span>Daily Report</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('monthly')}
                className={`flex-1 min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  periodMode === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-red-600" />
                <span>Monthly Report</span>
              </button>
            </div>
          </div>

          {/* Date Picker (if Daily) or Month Picker (if Monthly) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>{periodMode === 'daily' ? 'Select Date' : 'Select Month & Year'}</span>
              {periodMode === 'daily' && (
                <button
                  type="button"
                  onClick={handleSetToday}
                  className="text-[11px] text-red-600 hover:underline font-semibold"
                >
                  Today
                </button>
              )}
            </label>

            {periodMode === 'daily' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="min-h-[42px] px-2.5 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 text-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-center flex items-center justify-center">
                  {formattedMonthLabel}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="min-h-[42px] px-2.5 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 text-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Expedition Scope Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-red-600" />
              <span>Expedition Scope</span>
            </label>
            {portalMode === 'OWNER_ALL' && isOwnerEligible ? (
              <select
                value={effectiveExpeditionFilter}
                onChange={(e) => handleExpeditionFilterChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              >
                <option value="ALL">All Expeditions ({availableExpeditions.length})</option>
                {availableExpeditions.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-h-[42px] px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{activeExpeditionName}</span>
                <span className="text-[10px] text-slate-500 font-mono">Assigned</span>
              </div>
            )}
          </div>

          {/* Vehicle Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Vehicle Model
            </label>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              <option value="ALL">All Models (TRAGA, ELF, GIGA, D-MAX, MU-X)</option>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Period Badge */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Active Scope:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold font-mono text-[11px]">
              {periodMode === 'daily' ? formattedSelectedDate : formattedMonthLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
              {effectiveExpeditionFilter === 'ALL'
                ? 'All Expeditions'
                : availableExpeditions.find((e) => e.id === effectiveExpeditionFilter)?.name ||
                  effectiveExpeditionFilter}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {scopedUnits.length} total units recorded in this period
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Units */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Handled</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {totalUnitsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Units in scope</span>
          </div>
        </div>

        {/* Card 2: Out Gate Completed */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold">Out Gate (Completed)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
            {outGateCount}
          </div>
          <div className="mt-2 w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="text-[11px] text-emerald-800 font-semibold mt-1">
            {completionRate}% completion rate
          </div>
        </div>

        {/* Card 3: Standby Waiting */}
        <div className="bg-white border border-amber-100 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold">Standby (In Yard)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
            {standbyCount}
          </div>
          <div className="text-[11px] text-amber-800 font-semibold mt-1">
            {totalUnitsCount > 0 ? Math.round((standbyCount / totalUnitsCount) * 100) : 0}% waiting in yard
          </div>
        </div>

        {/* Card 4: Expedition Activity / Daily Average */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">
              {periodMode === 'daily' ? 'Active Expeditions' : 'Daily Average'}
            </span>
            <TrendingUp className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {periodMode === 'daily'
              ? expeditionBreakdown.filter((e) => e.total > 0).length
              : (
                  totalUnitsCount /
                  Math.max(1, new Date(selectedMonthYear.year, selectedMonthYear.month + 1, 0).getDate())
                ).toFixed(1)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {periodMode === 'daily'
              ? `of ${availableExpeditions.length} expeditions active`
              : 'units dispatched per day'}
          </div>
        </div>
      </div>

      {/* Breakdown by Vehicle Model */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-red-600" />
          <span>Vehicle Model Distribution ({periodMode === 'daily' ? 'Daily' : 'Monthly'})</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {vehicleTypeBreakdown.map((vt) => (
            <div
              key={vt.type}
              className={`p-3.5 rounded-2xl border transition-all ${
                vehicleTypeFilter === vt.type
                  ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>{vt.type}</span>
                <span className="text-[11px] font-mono text-slate-500">{vt.percentage}%</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1.5">{vt.count}</div>
              <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                <span className="text-emerald-700 font-semibold">{vt.outGate} Out</span>
                <span className="text-amber-700 font-semibold">{vt.standby} Std</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Breakdown Section: Expedition Performance Table & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expedition Performance Table (2 Columns on large screen) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-600" />
              <span>Expedition Dispatch Performance</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {expeditionBreakdown.length} Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Expedition</th>
                  <th className="py-2.5 px-2 text-center">Standby</th>
                  <th className="py-2.5 px-2 text-center">Out Gate</th>
                  <th className="py-2.5 px-2 text-center">Total</th>
                  <th className="py-2.5 px-3">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expeditionBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No expedition activity recorded for this period.
                    </td>
                  </tr>
                ) : (
                  expeditionBreakdown.map((exp) => {
                    const rate = exp.total > 0 ? Math.round((exp.outGate / exp.total) * 100) : 0;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {exp.name}
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-amber-700">
                          {exp.standby}
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-emerald-700">
                          {exp.outGate}
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-slate-900">
                          {exp.total}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden min-w-[60px]">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-700 w-8 text-right">
                              {rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Audit Trend: Hourly (for Daily) or Day-by-Day Top Days (for Monthly) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-600" />
            <span>
              {periodMode === 'daily' ? 'Hourly Activity Log' : 'Daily Volume Log'}
            </span>
          </h2>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {periodMode === 'daily' ? (
              dailyHourlyTrend.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No unit dispatches logged today.
                </div>
              ) : (
                dailyHourlyTrend.map((h) => (
                  <div
                    key={h.hour}
                    className="p-2.5 rounded-xl bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-bold text-slate-700">{h.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-amber-700 font-semibold">
                        {h.standby} std
                      </span>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        {h.outGate} out
                      </span>
                      <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                        {h.total}
                      </span>
                    </div>
                  </div>
                ))
              )
            ) : monthlyDailyTrend.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No activity logged this month.
              </div>
            ) : (
              monthlyDailyTrend.map((d) => (
                <div
                  key={d.day}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    d.total > 0
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50/50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      Day {String(d.day).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {d.dayOfWeek}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      {d.outGate} Out
                    </span>
                    <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
                      {d.total} units
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Granular Unit Manifest Table for the Period */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Period Unit Manifest ({filteredManifestUnits.length} Units)
            </h2>
            <p className="text-xs text-slate-500">
              Individual VIN records dispatched or queued during this period
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({scopedUnits.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OUT_GATE')}
                className={`min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  statusFilter === 'OUT_GATE'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Out Gate ({outGateCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('STANDBY')}
                className={`min-h-[32px] px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                  statusFilter === 'STANDBY'
                    ? 'bg-white text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Standby ({standbyCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search VIN or Variant..."
                className="w-full min-h-[36px] pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">VIN</th>
                <th className="py-2.5 px-3">Variant Unit</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Expedition</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Timestamp Out</th>
                <th className="py-2.5 px-3">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredManifestUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No matching units found in this period.
                  </td>
                </tr>
              ) : (
                filteredManifestUnits.map((u, idx) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      {u.vin}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {u.variantName || '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold font-mono text-[10px]">
                        {u.vehicleType || 'ELF'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {u.expeditionName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.status === 'OUT_GATE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {u.status === 'OUT_GATE' ? 'OUT GATE' : 'STANDBY'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {u.status === 'OUT_GATE' && u.updatedAt
                        ? u.updatedAt.toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {u.operatorName || 'PDC Operator'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
