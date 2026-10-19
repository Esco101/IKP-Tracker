import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  EXPEDITION_DIRECTORY,
  ExpeditionRecord,
  ParsedExcelVinRow,
  PortalViewMode,
  SAMPLE_EXCEL_CLIPBOARD,
  VehicleType,
  detectVehicleType,
  normalizeExpeditionSlug,
  parseExcelVinPaste,
} from '../types';

interface BatchInputViewProps {
  portalMode: PortalViewMode;
  activeExpeditionId: string;
  activeExpeditionName: string;
  expeditions: ExpeditionRecord[];
  preselectedExpedition?: { id: string; name: string } | null;
  onSaveBatch: (
    rows: ParsedExcelVinRow[],
    expedition: { id: string; name: string }
  ) => Promise<void>;
  isSubmitting: boolean;
}

export const BatchInputView: React.FC<BatchInputViewProps> = ({
  portalMode,
  activeExpeditionId,
  activeExpeditionName,
  expeditions,
  preselectedExpedition,
  onSaveBatch,
  isSubmitting,
}) => {
  const expeditionChoices = useMemo(() => {
    const onlyExp = expeditions
      .filter((e) => e.accountRole === 'EXPEDITION')
      .filter(
        (e) =>
          e.expeditionId !== 'puninar-jaya' &&
          !e.name.toLowerCase().includes('puninar')
      );
    if (onlyExp.length > 0) {
      return onlyExp.map((e) => ({ id: e.expeditionId, name: e.name }));
    }
    return EXPEDITION_DIRECTORY.filter(
      (e) =>
        e.id !== 'puninar-jaya' && !e.name.toLowerCase().includes('puninar')
    ).map((e) => ({ id: e.id, name: e.name }));
  }, [expeditions]);

  const initialExpId =
    portalMode === 'EXPEDITION_ONLY'
      ? activeExpeditionId
      : preselectedExpedition?.id ||
        activeExpeditionId ||
        expeditionChoices[0]?.id ||
        '';
  const initialExpName =
    portalMode === 'EXPEDITION_ONLY'
      ? activeExpeditionName
      : preselectedExpedition?.name ||
        activeExpeditionName ||
        expeditionChoices[0]?.name ||
        '';

  const [selectedExpMode, setSelectedExpMode] = useState<'PRESET' | 'CUSTOM'>(() =>
    expeditionChoices.length > 0 && expeditionChoices.some((e) => e.id === initialExpId)
      ? 'PRESET'
      : 'CUSTOM'
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    const match = expeditionChoices.find((e) => e.id === initialExpId);
    return match ? match.id : expeditionChoices[0]?.id || '';
  });
  const [customExpName, setCustomExpName] = useState<string>(
    expeditionChoices.some((e) => e.id === initialExpId) ? '' : initialExpName
  );

  const [rawExcelText, setRawExcelText] = useState<string>('');
  const [rowOverrides, setRowOverrides] = useState<
    Record<number, { materialUnit?: string; vehicleType?: VehicleType }>
  >({});
  const [removedRowNumbers, setRemovedRowNumbers] = useState<Set<number>>(new Set());
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const effectiveExpedition = useMemo(() => {
    if (portalMode === 'EXPEDITION_ONLY') {
      return { id: activeExpeditionId, name: activeExpeditionName };
    }
    if (selectedExpMode === 'CUSTOM' && customExpName.trim()) {
      return {
        id: normalizeExpeditionSlug(customExpName),
        name: customExpName.trim(),
      };
    }
    const found =
      expeditionChoices.find((e) => e.id === selectedPresetId) ||
      expeditionChoices[0];
    if (found) {
      return { id: found.id, name: found.name };
    }
    return {
      id: normalizeExpeditionSlug(customExpName.trim() || 'custom-expedition'),
      name: customExpName.trim() || 'Custom Expedition',
    };
  }, [
    portalMode,
    activeExpeditionId,
    activeExpeditionName,
    selectedExpMode,
    customExpName,
    selectedPresetId,
    expeditionChoices,
  ]);

  const parsedRows = useMemo(() => {
    const base = parseExcelVinPaste(rawExcelText);
    return base
      .filter((row) => !removedRowNumbers.has(row.rowNumber))
      .map((row) => {
        const override = rowOverrides[row.rowNumber];
        const finalMaterial = override?.materialUnit ?? row.materialUnit;
        return {
          ...row,
          materialUnit: finalMaterial,
        };
      });
  }, [rawExcelText, removedRowNumbers, rowOverrides]);

  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);

  const handleLoadSampleExcel = () => {
    setRawExcelText(SAMPLE_EXCEL_CLIPBOARD);
    setRowOverrides({});
    setRemovedRowNumbers(new Set());
    setFeedbackBanner(null);
  };

  const handleClearPaste = () => {
    setRawExcelText('');
    setRowOverrides({});
    setRemovedRowNumbers(new Set());
    setFeedbackBanner(null);
  };

  const handleRemoveRow = (rowNumber: number) => {
    setRemovedRowNumbers((prev) => {
      const next = new Set(prev);
      next.add(rowNumber);
      return next;
    });
  };

  const handleOverrideRowMaterial = (rowNumber: number, newMaterial: string) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowNumber]: {
        materialUnit: newMaterial,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    if (validRows.length === 0) {
      setFeedbackBanner({
        type: 'error',
        message: 'Please paste at least one valid VIN and Variant Unit from Excel.',
      });
      return;
    }

    try {
      await onSaveBatch(validRows, effectiveExpedition);
      setRawExcelText('');
      setRowOverrides({});
      setRemovedRowNumbers(new Set());
      setFeedbackBanner({
        type: 'success',
        message: `Saved ${validRows.length} unit(s) to ${effectiveExpedition.name}. Tap "Out Gate" on mobile when units move out to record the real-time OUT timestamp.`,
      });
    } catch (err) {
      setFeedbackBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to save units.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Paste Multiple VIN & Variant Unit (Excel)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Only requires <strong>VIN</strong> and <strong>Variant Unit</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadSampleExcel}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          <FileSpreadsheet className="w-4 h-4 text-red-600" />
          Load Sample Excel (VIN + Variant Unit)
        </button>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}
        >
          {feedbackBanner.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium">{feedbackBanner.message}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Expedition & Default Variant Unit */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
          {/* 1. Expedition Name */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              1. Expedition Name
            </label>
            {portalMode === 'EXPEDITION_ONLY' ? (
              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{activeExpeditionName}</div>
                  <div className="text-xs text-slate-500">Active Expedition</div>
                </div>
                <Truck className="w-5 h-5 text-slate-600 shrink-0" />
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedExpMode('PRESET')}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      selectedExpMode === 'PRESET'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Select Expedition
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedExpMode('CUSTOM')}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      selectedExpMode === 'CUSTOM'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    New Custom Expedition
                  </button>
                </div>

                {selectedExpMode === 'PRESET' ? (
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-semibold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    {expeditionChoices.map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customExpName}
                    onChange={(e) => setCustomExpName(e.target.value)}
                    placeholder="Enter new Expedition Name..."
                    maxLength={100}
                    required={selectedExpMode === 'CUSTOM'}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right: Excel Paste Box (Only VIN & Variant Unit) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              2. Paste VIN & Variant Unit from Excel
            </label>
            {rawExcelText.trim().length > 0 && (
              <button
                type="button"
                onClick={handleClearPaste}
                className="min-h-[36px] px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-2">
            <textarea
              rows={6}
              value={rawExcelText}
              onChange={(e) => {
                setRawExcelText(e.target.value);
                setRemovedRowNumbers(new Set());
              }}
              placeholder={`Paste 2 columns from Excel (VIN and Variant Unit):\nMHCNKR55E00308911\tVariant A\nMHCFVR34E00105520\tVariant B\nMHCPHR54E00204101\tVariant C`}
              className="w-full p-3.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Valid Units:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {validRows.length}
                </strong>
              </span>
              <span>Expedition: {effectiveExpedition.name}</span>
            </div>
          </div>

          {parsedRows.length > 0 ? (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">VIN</th>
                      <th className="py-2.5 px-3">Variant Unit</th>
                      <th className="py-2.5 px-3 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={row.rowNumber}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50'}
                      >
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900 tabular-nums">
                            {row.vin || '(Empty)'}
                          </div>
                          {!row.isValid && (
                            <div className="text-red-600 text-[11px]">{row.validationMessage}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.materialUnit}
                            onChange={(e) =>
                              handleOverrideRowMaterial(row.rowNumber, e.target.value)
                            }
                            maxLength={80}
                            className="min-h-[34px] w-32 sm:w-40 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowNumber)}
                            aria-label="Remove row"
                            className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || validRows.length === 0}
                className="w-full min-h-[50px] px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isSubmitting
                  ? 'Saving Units...'
                  : `Save ${validRows.length} Unit${validRows.length === 1 ? '' : 's'} to ${effectiveExpedition.name}`}
              </button>
            </div>
          ) : (
            <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center space-y-2 bg-slate-50/50">
              <ClipboardPaste className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-600">
                Copy <strong>VIN</strong> and <strong>Variant Unit</strong> from Excel and paste above.
              </p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
