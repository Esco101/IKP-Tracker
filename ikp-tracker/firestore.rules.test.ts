/**
 * Firestore Security Rules Verification Specification (Dirty Dozen Test Suite)
 * Verifies that all 12 adversarial payloads described in security_spec.md
 * are rejected with PERMISSION_DENIED by firestore.rules.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Unit Create',
    operation: 'create',
    path: '/outStockUnits/unit_spoof_1',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E00100001',
      vehicleType: 'ELF',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Surabaya Branch',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: 'Gate 1 verified',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_B', // Spoofed UID
      operatorName: 'Operator A',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/outStockUnits/unit_shadow_2',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E00100002',
      vehicleType: 'TRAGA',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Semarang Branch',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: '',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_A',
      operatorName: 'Operator A',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
      isAdmin: true, // Ghost field rejected by hasOnly()
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof',
    operation: 'list',
    path: '/outStockUnits',
    auth: { uid: 'attacker_1', email: 'escoriyanto@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Invalid Vehicle Type Enum',
    operation: 'create',
    path: '/outStockUnits/unit_enum_4',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E00100004',
      vehicleType: 'INVALID_TRUCK',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Bandung',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: '',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_A',
      operatorName: 'Operator A',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'VIN Format Poisoning',
    operation: 'create',
    path: '/outStockUnits/unit_vin_5',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'invalid_vin_with_lowercase!',
      vehicleType: 'GIGA',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Jakarta',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: '',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_A',
      operatorName: 'Operator A',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/outStockUnits/unit_time_6',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E00100006',
      vehicleType: 'D-MAX',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Balikpapan',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: '',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_A',
      operatorName: 'Operator A',
      createdAt: '2020-01-01T00:00:00Z', // Forged timestamp
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Unit Create Without OperatorProfile',
    operation: 'create',
    path: '/outStockUnits/unit_orphan_7',
    auth: { uid: 'user_without_profile', email: 'new@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E00100007',
      vehicleType: 'MU-X',
      expeditionId: 'puninar-jaya',
      expeditionName: 'PT. Puninar Jaya',
      destination: 'Medan',
      truckPlate: 'B 9012 UEA',
      driverName: 'Budi Santoso',
      status: 'OUT_GATE',
      notes: '',
      workspaceId: 'isuzu-yard-01',
      createdByUid: 'user_without_profile',
      operatorName: 'Ghost User',
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal State Mutation After DELIVERED',
    operation: 'update',
    path: '/outStockUnits/unit_delivered_8',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      status: 'IN_TRANSIT',
      notes: 'Attempting to revert delivered vehicle',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable VIN Mutation on Update',
    operation: 'update',
    path: '/outStockUnits/unit_immutable_9',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      vin: 'MHCNKR55E99999999',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Whitelisted Update Field',
    operation: 'update',
    path: '/outStockUnits/unit_poison_10',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    payload: {
      status: 'IN_TRANSIT',
      notes: 9999999, // Invalid non-string type
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-Tenant Unauthorized Get',
    operation: 'get',
    path: '/outStockUnits/unit_owned_by_B',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Operator Profile Enumeration Attack',
    operation: 'list',
    path: '/operatorProfiles',
    auth: { uid: 'user_A', email: 'opA@expedition.co.id', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
