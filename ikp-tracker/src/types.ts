import blueprint from '../firebase-blueprint.json';

export type VehicleType = 'TRAGA' | 'ELF' | 'GIGA' | 'D-MAX' | 'MU-X';

export type DispatchStatus = 'STANDBY' | 'OUT_GATE';

export type PortalViewMode = 'OWNER_ALL' | 'EXPEDITION_ONLY';

export type AccountRole = 'EXPEDITION' | 'OWNER';

export interface ExpeditionPreset {
  id: string;
  name: string;
  code: string;
  username: string;
  accessPin: string;
  accountRole: AccountRole;
}

export interface ExpeditionRecord {
  expeditionId: string;
  name: string;
  code: string;
  username: string;
  accessPin: string;
  accountRole: AccountRole;
  workspaceId: typeof WORKSPACE_ID;
  createdByUid: string;
  createdAt: Date;
  updatedAt: Date;
}

export const VEHICLE_TYPES: VehicleType[] = ['TRAGA', 'ELF', 'GIGA', 'D-MAX', 'MU-X'];

export const VARIANT_PRESETS: Array<{
  variantName: string;
  vehicleType: VehicleType;
}> = [];

export const DEFAULT_ACCOUNTS_DIRECTORY: ExpeditionPreset[] = [
  {
    id: 'owner-pdc-ai',
    name: 'PDC - AI Owner',
    code: 'OWNER',
    username: 'EscoAI',
    accessPin: 'Esc1234',
    accountRole: 'OWNER',
  },
  {
    id: 'ak',
    name: 'PT. Anugerah Kusuma',
    code: 'AK',
    username: 'ak',
    accessPin: 'ak04',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'ang',
    name: 'PT. Artindo Nusa Graha',
    code: 'ANG',
    username: 'ang',
    accessPin: 'ang09',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'bmu',
    name: 'PT. Bertindo Mitra Utama',
    code: 'BMU',
    username: 'bmu',
    accessPin: 'bmu03',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'delima',
    name: 'PT. Delima Ping Logistra',
    code: 'DELIMA',
    username: 'delima',
    accessPin: 'delima07',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'hsp',
    name: 'PT. Hadidaya Sejahtera Pratama',
    code: 'HSP',
    username: 'hsp',
    accessPin: 'hsp05',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'kline',
    name: 'PT. K Line Mobaru Diamond Indonesia',
    code: 'KLINE',
    username: 'kline',
    accessPin: 'kline06',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'kpl',
    name: 'PT. Karyaputra Lokatirta',
    code: 'KPL',
    username: 'kpl',
    accessPin: 'kpl10',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'parani',
    name: 'PT. Parani Arta Mandiri',
    code: 'PARANI',
    username: 'parani',
    accessPin: 'parani02',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'selog',
    name: 'PT. Serasi Logistik',
    code: 'SELOG',
    username: 'selog',
    accessPin: 'selog01',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'toyofuji',
    name: 'PT. Toyofuji Logistik Indonesia',
    code: 'TOYOFUJI',
    username: 'toyofuji',
    accessPin: 'toyofuji08',
    accountRole: 'EXPEDITION',
  },
];

export const EXPEDITION_DIRECTORY: ExpeditionPreset[] = [
  {
    id: 'ak',
    name: 'PT. Anugerah Kusuma',
    code: 'AK',
    username: 'ak',
    accessPin: 'ak04',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'ang',
    name: 'PT. Artindo Nusa Graha',
    code: 'ANG',
    username: 'ang',
    accessPin: 'ang09',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'bmu',
    name: 'PT. Bertindo Mitra Utama',
    code: 'BMU',
    username: 'bmu',
    accessPin: 'bmu03',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'delima',
    name: 'PT. Delima Ping Logistra',
    code: 'DELIMA',
    username: 'delima',
    accessPin: 'delima07',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'hsp',
    name: 'PT. Hadidaya Sejahtera Pratama',
    code: 'HSP',
    username: 'hsp',
    accessPin: 'hsp05',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'kline',
    name: 'PT. K Line Mobaru Diamond Indonesia',
    code: 'KLINE',
    username: 'kline',
    accessPin: 'kline06',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'kpl',
    name: 'PT. Karyaputra Lokatirta',
    code: 'KPL',
    username: 'kpl',
    accessPin: 'kpl10',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'parani',
    name: 'PT. Parani Arta Mandiri',
    code: 'PARANI',
    username: 'parani',
    accessPin: 'parani02',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'selog',
    name: 'PT. Serasi Logistik',
    code: 'SELOG',
    username: 'selog',
    accessPin: 'selog01',
    accountRole: 'EXPEDITION',
  },
  {
    id: 'toyofuji',
    name: 'PT. Toyofuji Logistik Indonesia',
    code: 'TOYOFUJI',
    username: 'toyofuji',
    accessPin: 'toyofuji08',
    accountRole: 'EXPEDITION',
  },
];

export const WORKSPACE_ID = 'isuzu-yard-01' as const;
export const BOOTSTRAP_OWNER_EMAIL = 'escoriyanto@gmail.com';

export interface OperatorProfile {
  uid: string;
  operatorName: string;
  expeditionId: string;
  expeditionName: string;
  shiftCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutStockUnit {
  id: string;
  vin: string;
  vehicleType: VehicleType;
  variantName: string;
  expeditionId: string;
  expeditionName: string;
  status: DispatchStatus;
  workspaceId: typeof WORKSPACE_ID;
  createdByUid: string;
  operatorName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedExcelVinRow {
  rowNumber: number;
  vin: string;
  materialUnit: string;
  vehicleType: VehicleType;
  isValid: boolean;
  validationMessage?: string;
}

// Verbatim blueprint constraints extracted from firebase-blueprint.json
const unitProps = blueprint.entities.OutStockUnit.properties;
const profileProps = blueprint.entities.OperatorProfile.properties;

export const BLUEPRINT_LIMITS = {
  vin: {
    minLength: unitProps.vin.minLength ?? 5,
    maxLength: unitProps.vin.maxLength ?? 32,
    pattern: new RegExp(unitProps.vin.pattern ?? '^[A-Z0-9\\-]+$'),
  },
  expeditionId: {
    minLength: unitProps.expeditionId.minLength ?? 1,
    maxLength: unitProps.expeditionId.maxLength ?? 64,
    pattern: new RegExp(unitProps.expeditionId.pattern ?? '^[a-zA-Z0-9_\\-]+$'),
  },
  expeditionName: {
    minLength: unitProps.expeditionName.minLength ?? 1,
    maxLength: unitProps.expeditionName.maxLength ?? 100,
  },
  operatorName: {
    minLength: profileProps.operatorName.minLength ?? 1,
    maxLength: profileProps.operatorName.maxLength ?? 80,
  },
  notes: {
    maxLength: unitProps.notes.maxLength ?? 300,
  },
};

export function normalizeExpeditionSlug(name: string): string {
  const preset = DEFAULT_ACCOUNTS_DIRECTORY.find(
    (item) =>
      item.name.toLowerCase() === name.trim().toLowerCase() ||
      item.id.toLowerCase() === name.trim().toLowerCase()
  );
  if (preset) return preset.id;

  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BLUEPRINT_LIMITS.expeditionId.maxLength);

  return cleaned || 'custom-expedition';
}

export function normalizeVin(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.vin.maxLength);
}

export function detectVehicleType(rawToken: string, fallback: VehicleType): VehicleType {
  const upper = rawToken.trim().toUpperCase();
  if (upper.includes('TRAGA') || upper.includes('PHR')) return 'TRAGA';
  if (
    upper.includes('NMR') ||
    upper.includes('NLR') ||
    upper.includes('NKR') ||
    upper.includes('NPS') ||
    upper.includes('ELF')
  )
    return 'ELF';
  if (
    upper.includes('FVM') ||
    upper.includes('FTR') ||
    upper.includes('FVR') ||
    upper.includes('FVZ') ||
    upper.includes('GVR') ||
    upper.includes('GXZ') ||
    upper.includes('GIGA')
  )
    return 'GIGA';
  if (upper.includes('D-MAX') || upper.includes('DMAX') || upper.includes('TFR')) return 'D-MAX';
  if (upper.includes('MU-X') || upper.includes('MUX') || upper.includes('UCS') || upper.includes('UCR'))
    return 'MU-X';
  return fallback;
}

export function validateVinString(vin: string): { valid: boolean; reason?: string } {
  if (vin.length < BLUEPRINT_LIMITS.vin.minLength) {
    return {
      valid: false,
      reason: `Min ${BLUEPRINT_LIMITS.vin.minLength} chars`,
    };
  }
  if (vin.length > BLUEPRINT_LIMITS.vin.maxLength) {
    return {
      valid: false,
      reason: `Max ${BLUEPRINT_LIMITS.vin.maxLength} chars`,
    };
  }
  if (!BLUEPRINT_LIMITS.vin.pattern.test(vin)) {
    return {
      valid: false,
      reason: 'Alphanumeric only',
    };
  }
  return { valid: true };
}

/**
 * Parses Excel clipboard data where user pastes ONLY VIN and Material Unit (Variant Name).
 */
export function parseExcelVinPaste(
  rawText: string,
  defaultMaterialUnit: string = '',
  defaultVehicleType: VehicleType = 'ELF'
): ParsedExcelVinRow[] {
  if (!rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: ParsedExcelVinRow[] = [];
  const seenVins = new Set<string>();
  let rowCounter = 1;

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (
      (upperLine.startsWith('VIN\t') ||
        upperLine.startsWith('NO RANGKA\t') ||
        upperLine.startsWith('MATERIAL\t') ||
        upperLine.startsWith('VARIANT\t') ||
        upperLine === 'VIN') &&
      lines.length > 1
    ) {
      continue;
    }

    if (line.includes('\t')) {
      const cols = line
        .split('\t')
        .map((c) => c.trim())
        .filter(Boolean);

      const col0HasSpace = (cols[0] || '').includes(' ');
      const rawVin = col0HasSpace && cols[1] ? cols[1] : cols[0] || '';
      const rawMaterial = col0HasSpace && cols[1] ? cols[0] : cols[1] || defaultMaterialUnit || '';

      const vin = normalizeVin(rawVin);
      const materialUnit = (rawMaterial || defaultMaterialUnit || '').trim().slice(0, 80);
      const rowType = detectVehicleType(`${materialUnit} ${vin}`, defaultVehicleType);

      const check = validateVinString(vin);
      const isDuplicate = seenVins.has(vin);
      if (check.valid && !isDuplicate) {
        seenVins.add(vin);
      }

      results.push({
        rowNumber: rowCounter++,
        vin,
        materialUnit,
        vehicleType: rowType,
        isValid: check.valid && !isDuplicate,
        validationMessage: isDuplicate ? 'Duplicate VIN' : check.reason,
      });
    } else {
      const tokens = line
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      for (const token of tokens) {
        const vin = normalizeVin(token);
        const materialUnit = (defaultMaterialUnit || '').trim().slice(0, 80);
        const inferredType = detectVehicleType(`${materialUnit} ${vin}`, defaultVehicleType);
        const check = validateVinString(vin);
        const isDuplicate = seenVins.has(vin);
        if (check.valid && !isDuplicate) {
          seenVins.add(vin);
        }

        results.push({
          rowNumber: rowCounter++,
          vin,
          materialUnit,
          vehicleType: inferredType,
          isValid: check.valid && !isDuplicate,
          validationMessage: isDuplicate ? 'Duplicate VIN' : check.reason,
        });
      }
    }
  }

  return results;
}

export function sanitizeOperatorProfilePayload(input: {
  uid: string;
  operatorName: string;
  expeditionId: string;
  expeditionName: string;
  shiftCode?: string;
}) {
  return {
    uid: input.uid.trim().slice(0, 128),
    operatorName: (input.operatorName.trim() || 'IKP Operator').slice(
      0,
      BLUEPRINT_LIMITS.operatorName.maxLength
    ),
    expeditionId: normalizeExpeditionSlug(input.expeditionId || input.expeditionName),
    expeditionName: (input.expeditionName.trim() || 'Expedition').slice(
      0,
      BLUEPRINT_LIMITS.expeditionName.maxLength
    ),
    shiftCode: (input.shiftCode?.trim() || 'IKP').slice(0, 32),
  };
}

export function sanitizeExpeditionConfigPayload(input: {
  expeditionId: string;
  name: string;
  code: string;
  username: string;
  accessPin: string;
  accountRole: AccountRole;
  createdByUid: string;
}) {
  const cleanId = normalizeExpeditionSlug(input.expeditionId || input.name);
  const cleanName = (input.name.trim() || 'Custom Expedition').slice(0, 100);
  const cleanCode = (
    input.code.trim().toUpperCase() || cleanName.slice(0, 5).toUpperCase()
  ).slice(0, 24);
  const cleanUsername = (input.username.trim() || cleanId).slice(0, 64);
  const cleanPin = (input.accessPin.trim() || '1234').slice(0, 64);
  const validRole: AccountRole = input.accountRole === 'OWNER' ? 'OWNER' : 'EXPEDITION';

  return {
    expeditionId: cleanId,
    name: cleanName,
    code: cleanCode,
    username: cleanUsername,
    accessPin: cleanPin,
    accountRole: validRole,
    workspaceId: WORKSPACE_ID,
    createdByUid: input.createdByUid.trim().slice(0, 128),
  };
}

export function sanitizeOutStockUnitPayload(input: {
  vin: string;
  vehicleType?: VehicleType;
  variantName: string;
  expeditionId: string;
  expeditionName: string;
  status: DispatchStatus;
  createdByUid: string;
  operatorName: string;
}) {
  const normalizedVin = normalizeVin(input.vin);
  const validType: VehicleType = input.vehicleType && VEHICLE_TYPES.includes(input.vehicleType)
    ? input.vehicleType
    : 'ELF';
  const validStatus: DispatchStatus =
    input.status === 'OUT_GATE' ? 'OUT_GATE' : 'STANDBY';
  const cleanVariant = (input.variantName || '').trim().slice(
    0,
    BLUEPRINT_LIMITS.notes.maxLength
  );

  return {
    vin: normalizedVin,
    vehicleType: validType,
    expeditionId: normalizeExpeditionSlug(input.expeditionId || input.expeditionName),
    expeditionName: (input.expeditionName.trim() || 'Expedition').slice(
      0,
      BLUEPRINT_LIMITS.expeditionName.maxLength
    ),
    destination: (cleanVariant || 'IKP-OUT').slice(0, 120),
    truckPlate: 'IKP-OUT',
    driverName: 'Expedition Crew',
    status: validStatus,
    notes: cleanVariant,
    workspaceId: WORKSPACE_ID,
    createdByUid: input.createdByUid.trim().slice(0, 128),
    operatorName: (input.operatorName.trim() || 'IKP Operator').slice(
      0,
      BLUEPRINT_LIMITS.operatorName.maxLength
    ),
  };
}

export const SAMPLE_EXCEL_CLIPBOARD = [
  'MHCNKR55E00308911\tVariant Unit A',
  'MHCFVR34E00105520\tVariant Unit B',
].join('\n');
