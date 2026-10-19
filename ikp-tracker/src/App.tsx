/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BarChart3,
  Building2,
  Check,
  ClipboardPaste,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGooglePopup,
} from './firebase';
import {
  AccountRole,
  DEFAULT_ACCOUNTS_DIRECTORY,
  DispatchStatus,
  EXPEDITION_DIRECTORY,
  ExpeditionRecord,
  normalizeExpeditionSlug,
  OperatorProfile,
  OutStockUnit,
  ParsedExcelVinRow,
  PortalViewMode,
  sanitizeExpeditionConfigPayload,
  sanitizeOperatorProfilePayload,
  sanitizeOutStockUnitPayload,
  VehicleType,
  WORKSPACE_ID,
} from './types';
import { ExpeditionSectionsView } from './components/ExpeditionSectionsView';
import { BatchInputView } from './components/BatchInputView';
import { RapidVinLookupView } from './components/RapidVinLookupView';
import { SummaryReportDashboardView } from './components/SummaryReportDashboardView';
import { PortalRoleView } from './components/PortalRoleView';
import { ErrorBoundary } from './components/ErrorBoundary';

type ActiveTab = 'expeditions' | 'batch' | 'lookup' | 'report' | 'role';

export function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [units, setUnits] = useState<OutStockUnit[]>([]);
  const [expeditions, setExpeditions] = useState<ExpeditionRecord[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('expeditions');
  const [portalMode, setPortalMode] = useState<PortalViewMode>('OWNER_ALL');
  const [isOwnerSession, setIsOwnerSession] = useState<boolean>(false);
  const [isCredentialUnlocked, setIsCredentialUnlocked] = useState<boolean>(false);
  const [ownerExpeditionFilter, setOwnerExpeditionFilter] = useState<string>('ALL');

  const [preselectedBatchExpedition, setPreselectedBatchExpedition] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Login screen mode: EXPEDITION_ONLY vs OWNER_ALL (both have dedicated Username & Password inputs)
  const [loginTargetMode, setLoginTargetMode] = useState<PortalViewMode>('EXPEDITION_ONLY');
  const [selectedLoginExpeditionId, setSelectedLoginExpeditionId] = useState<string>('');
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Listen to Firebase Auth state and bootstrap OperatorProfile + Default Expeditions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setUnits([]);
        setExpeditions([]);
        setIsCredentialUnlocked(false);
        setAuthReady(true);
        return;
      }

      const profilePath = `operatorProfiles/${currentUser.uid}`;
      try {
        const profileRef = doc(db, 'operatorProfiles', currentUser.uid);
        const snap = await getDoc(profileRef);

        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            uid: data.uid,
            operatorName: data.operatorName,
            expeditionId: data.expeditionId,
            expeditionName: data.expeditionName,
            shiftCode: data.shiftCode,
            createdAt:
              data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt:
              data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
          });
        } else {
          const defaultExp = EXPEDITION_DIRECTORY[0];
          const cleanProfile = sanitizeOperatorProfilePayload({
            uid: currentUser.uid,
            operatorName: currentUser.displayName || 'IKP Operator',
            expeditionId: defaultExp.id,
            expeditionName: defaultExp.name,
            shiftCode: 'IKP',
          });

          await setDoc(profileRef, {
            ...cleanProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setProfile({
            ...cleanProfile,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Bootstrap default expeditions & ensure Owner account (EscoAI / Esc1234) is in Firestore /expeditions
        // Ensure Owner account (EscoAI / Esc1234) is in Firestore /expeditions and purge all default expeditions
        const expCol = collection(db, 'expeditions');
        const expQuery = query(expCol, where('workspaceId', '==', WORKSPACE_ID));
        const expSnap = await getDocs(expQuery);

        const defaultExpeditionIdsToPurge = [
          'selog-sera',
          'dunex-logistics',
          'kamigumi-indo',
          'siba-surya',
          'puninar-jaya',
        ];

        // 1. Purge old default expeditions from Firestore
        for (const docSnap of expSnap.docs) {
          const expData = docSnap.data();
          const docName = String(expData.name || '').toLowerCase();
          if (
            defaultExpeditionIdsToPurge.includes(docSnap.id) ||
            docName.includes('puninar') ||
            docName.includes('dunex') ||
            docName.includes('kamigumi') ||
            docName.includes('siba surya') ||
            docName.includes('serasi logistik sera')
          ) {
            await deleteDoc(doc(db, 'expeditions', docSnap.id));
          }
        }

        // 2. Identify and delete any duplicate docs in Firestore that duplicate canonical accounts
        const canonicalPresets = DEFAULT_ACCOUNTS_DIRECTORY;
        for (const docSnap of expSnap.docs) {
          if (defaultExpeditionIdsToPurge.includes(docSnap.id)) continue;
          const expData = docSnap.data();
          const normName = String(expData.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normCode = String(expData.code || '').toLowerCase().trim();
          const normUser = String(expData.username || '').toLowerCase().trim();

          // If this document is NOT the canonical preset ID, but matches a preset's code, user, or name, delete it!
          const matchingPreset = canonicalPresets.find(
            (p) =>
              p.id !== docSnap.id &&
              (p.code.toLowerCase() === normCode ||
                p.username.toLowerCase() === normUser ||
                p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName)
          );

          if (matchingPreset) {
            await deleteDoc(doc(db, 'expeditions', docSnap.id));
          }
        }

        // Purge any lingering outStockUnits with old default expeditions
        try {
          const unitsCol = collection(db, 'outStockUnits');
          const unitsSnap = await getDocs(
            query(unitsCol, where('workspaceId', '==', WORKSPACE_ID))
          );
          for (const uDoc of unitsSnap.docs) {
            const uData = uDoc.data();
            const uExpId = String(uData.expeditionId || '');
            const uExpName = String(uData.expeditionName || '').toLowerCase();
            if (
              defaultExpeditionIdsToPurge.includes(uExpId) ||
              uExpName.includes('puninar') ||
              uExpName.includes('dunex') ||
              uExpName.includes('kamigumi') ||
              uExpName.includes('siba') ||
              uExpName.includes('serasi logistik sera')
            ) {
              await deleteDoc(doc(db, 'outStockUnits', uDoc.id));
            }
          }
        } catch {
          // Non-fatal if units cleanup query fails
        }

        const ownerDoc = expSnap.docs.find((d) => d.id === 'owner-pdc-ai');
        if (!ownerDoc) {
          const ownerPreset = DEFAULT_ACCOUNTS_DIRECTORY[0];
          const cleanOwner = sanitizeExpeditionConfigPayload({
            expeditionId: ownerPreset.id,
            name: ownerPreset.name,
            code: ownerPreset.code,
            username: 'EscoAI',
            accessPin: 'Esc1234',
            accountRole: 'OWNER',
            createdByUid: currentUser.uid,
          });
          await setDoc(doc(db, 'expeditions', 'owner-pdc-ai'), {
            ...cleanOwner,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const ownerData = ownerDoc.data();
          if (
            (ownerData.username === 'admin' || ownerData.username === 'owner') &&
            ownerData.accessPin === 'pdc123'
          ) {
            await updateDoc(doc(db, 'expeditions', 'owner-pdc-ai'), {
              username: 'EscoAI',
              accessPin: 'Esc1234',
              updatedAt: serverTimestamp(),
            });
          }
        }

        // Ensure all 10 Expedition accounts from image are in Firestore /expeditions
        const presetAccounts = DEFAULT_ACCOUNTS_DIRECTORY.filter(
          (acc) => acc.accountRole === 'EXPEDITION'
        );

        for (const preset of presetAccounts) {
          const docRef = doc(db, 'expeditions', preset.id);
          const existingDoc = expSnap.docs.find((d) => d.id === preset.id);
          if (!existingDoc) {
            const clean = sanitizeExpeditionConfigPayload({
              expeditionId: preset.id,
              name: preset.name,
              code: preset.code,
              username: preset.username,
              accessPin: preset.accessPin,
              accountRole: 'EXPEDITION',
              createdByUid: currentUser.uid,
            });
            await setDoc(docRef, {
              ...clean,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const sData = existingDoc.data();
            if (
              sData.name !== preset.name ||
              sData.code !== preset.code ||
              sData.username !== preset.username ||
              sData.accessPin !== preset.accessPin
            ) {
              await updateDoc(docRef, {
                name: preset.name,
                code: preset.code,
                username: preset.username,
                accessPin: preset.accessPin,
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, profilePath);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to custom Expeditions & Database Accounts in Firestore
  useEffect(() => {
    if (!authReady || !user || !profile) return;

    const expCol = collection(db, 'expeditions');
    const q = query(expCol, where('workspaceId', '==', WORKSPACE_ID));

    const defaultIds = [
      'selog-sera',
      'dunex-logistics',
      'kamigumi-indo',
      'siba-surya',
      'puninar-jaya',
    ];

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawDocs = snapshot.docs.filter((docSnap) => {
          const d = docSnap.data();
          const id = docSnap.id;
          const name = String(d.name || '').toLowerCase();
          if (
            defaultIds.includes(id) ||
            name.includes('puninar') ||
            name.includes('dunex') ||
            name.includes('kamigumi') ||
            name.includes('siba surya') ||
            name.includes('serasi logistik sera')
          ) {
            deleteDoc(doc(db, 'expeditions', id)).catch(() => {});
            return false;
          }
          return true;
        });

        // Deduplicate in real-time (prioritizing canonical presets)
        const seenCodes = new Set<string>();
        const seenUsers = new Set<string>();
        const seenNames = new Set<string>();
        const seenIds = new Set<string>();
        const loaded: ExpeditionRecord[] = [];

        // Sort so that canonical preset IDs come first
        const sorted = [...rawDocs].sort((a, b) => {
          const aIsPreset = DEFAULT_ACCOUNTS_DIRECTORY.some((p) => p.id === a.id);
          const bIsPreset = DEFAULT_ACCOUNTS_DIRECTORY.some((p) => p.id === b.id);
          if (aIsPreset && !bIsPreset) return -1;
          if (!aIsPreset && bIsPreset) return 1;
          return a.id.localeCompare(b.id);
        });

        for (const docSnap of sorted) {
          const d = docSnap.data();
          const normName = String(d.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normCode = String(d.code || '').toLowerCase().trim();
          const normUser = String(d.username || '').toLowerCase().trim();
          const id = d.expeditionId || docSnap.id;

          const isDuplicate =
            seenIds.has(id) ||
            (normCode && seenCodes.has(normCode)) ||
            (normUser && seenUsers.has(normUser)) ||
            (normName && seenNames.has(normName));

          if (isDuplicate) {
            // Delete duplicate doc from Firestore if it's not a preset ID
            if (!DEFAULT_ACCOUNTS_DIRECTORY.some((p) => p.id === docSnap.id)) {
              deleteDoc(doc(db, 'expeditions', docSnap.id)).catch(() => {});
            }
            continue;
          }

          seenIds.add(id);
          if (normCode) seenCodes.add(normCode);
          if (normUser) seenUsers.add(normUser);
          if (normName) seenNames.add(normName);

          loaded.push({
            expeditionId: id,
            name: d.name,
            code: d.code,
            username: d.username,
            accessPin: d.accessPin,
            accountRole: d.accountRole === 'OWNER' ? 'OWNER' : 'EXPEDITION',
            workspaceId: WORKSPACE_ID,
            createdByUid: d.createdByUid,
            createdAt:
              d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(),
            updatedAt:
              d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : new Date(),
          });
        }

        loaded.sort((a, b) => {
          if (a.accountRole !== b.accountRole) {
            return a.accountRole === 'OWNER' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        setExpeditions(loaded);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'expeditions');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, profile]);

  // Listen to OutStockUnits in Firestore
  useEffect(() => {
    if (!authReady || !user || !profile) return;

    setIsLoadingUnits(true);
    const unitsCollectionRef = collection(db, 'outStockUnits');
    const q = query(unitsCollectionRef, where('workspaceId', '==', WORKSPACE_ID));

    const defaultIds = [
      'dunex-logistics',
      'kamigumi-indo',
      'siba-surya',
      'puninar-jaya',
    ];

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: OutStockUnit[] = [];
        for (const docSnap of snapshot.docs) {
          const d = docSnap.data();
          const expId = String(d.expeditionId || '');
          const expName = String(d.expeditionName || '').toLowerCase();

          if (
            defaultIds.includes(expId) ||
            expName.includes('puninar') ||
            expName.includes('dunex') ||
            expName.includes('kamigumi') ||
            expName.includes('siba surya')
          ) {
            // Delete lingering unit with default expedition from Firestore
            deleteDoc(doc(db, 'outStockUnits', docSnap.id)).catch(() => {});
            continue;
          }

          const rawStatus = String(d.status || 'STANDBY');
          const normalizedStatus: DispatchStatus =
            rawStatus === 'OUT_GATE' ? 'OUT_GATE' : 'STANDBY';
          const variant =
            (d.notes && String(d.notes).trim()) ||
            (d.destination && d.destination !== 'PDC-IKP' ? String(d.destination) : '') ||
            '';

          loaded.push({
            id: docSnap.id,
            vin: d.vin,
            vehicleType: (d.vehicleType || 'ELF') as VehicleType,
            variantName: variant,
            expeditionId: expId,
            expeditionName: d.expeditionName,
            status: normalizedStatus,
            workspaceId: WORKSPACE_ID,
            createdByUid: d.createdByUid,
            operatorName: d.operatorName,
            createdAt:
              d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(),
            updatedAt:
              d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : new Date(),
          });
        }

        loaded.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        setUnits(loaded);
        setIsLoadingUnits(false);
      },
      (err) => {
        setIsLoadingUnits(false);
        handleFirestoreError(err, OperationType.LIST, 'outStockUnits');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, profile]);

  // Verify database Username & Password for either Owner Login or Expedition Login
  const verifyAndApplyDatabaseAccount = async (
    targetUser: User,
    rawUsername: string,
    rawPassword: string,
    expectedMode: PortalViewMode,
    chosenExpeditionId?: string
  ): Promise<{ ok: boolean; message: string }> => {
    const cleanUser = rawUsername.trim().toLowerCase();
    const cleanPass = rawPassword.trim();

    let directory = expeditions;
    if (directory.length === 0) {
      const expCol = collection(db, 'expeditions');
      const snap = await getDocs(query(expCol, where('workspaceId', '==', WORKSPACE_ID)));
      directory = snap.docs.map((d) => {
        const data = d.data();
        return {
          expeditionId: data.expeditionId,
          name: data.name,
          code: data.code,
          username: data.username,
          accessPin: data.accessPin,
          accountRole: data.accountRole === 'OWNER' ? 'OWNER' : 'EXPEDITION',
          workspaceId: WORKSPACE_ID,
          createdByUid: data.createdByUid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });
    }

    const fallbackList =
      directory.length > 0
        ? directory
        : DEFAULT_ACCOUNTS_DIRECTORY.map((p) => ({
            expeditionId: p.id,
            name: p.name,
            code: p.code,
            username: p.username,
            accessPin: p.accessPin,
            accountRole: p.accountRole,
            workspaceId: WORKSPACE_ID,
            createdByUid: targetUser.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

    let matched: ExpeditionRecord | undefined;

    if (expectedMode === 'OWNER_ALL') {
      const ownerAccounts = fallbackList.filter((a) => a.accountRole === 'OWNER');
      matched = ownerAccounts.find(
        (acc) =>
          acc.username.toLowerCase() === cleanUser && acc.accessPin === cleanPass
      );
      if (!matched && cleanUser === 'escoai' && cleanPass === 'Esc1234') {
        matched = {
          expeditionId: 'owner-pdc-ai',
          name: 'PDC - AI Owner',
          code: 'OWNER',
          username: 'EscoAI',
          accessPin: 'Esc1234',
          accountRole: 'OWNER',
          workspaceId: WORKSPACE_ID,
          createdByUid: targetUser.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (!matched) {
        return {
          ok: false,
          message: 'Invalid Owner username or password.',
        };
      }
    } else {
      // Expedition Login verification
      const expAccounts = fallbackList.filter((a) => a.accountRole === 'EXPEDITION');
      const selectedExp = expAccounts.find((a) => a.expeditionId === chosenExpeditionId);

      if (
        selectedExp &&
        ((cleanUser && selectedExp.username.toLowerCase() === cleanUser) || !cleanUser) &&
        selectedExp.accessPin === cleanPass
      ) {
        matched = selectedExp;
      } else {
        matched = expAccounts.find(
          (acc) =>
            acc.username.toLowerCase() === cleanUser && acc.accessPin === cleanPass
        );
      }

      if (!matched) {
        const preset = DEFAULT_ACCOUNTS_DIRECTORY.find(
          (acc) =>
            acc.accountRole === 'EXPEDITION' &&
            acc.username.toLowerCase() === cleanUser &&
            acc.accessPin === cleanPass
        );
        if (preset) {
          matched = {
            expeditionId: preset.id,
            name: preset.name,
            code: preset.code,
            username: preset.username,
            accessPin: preset.accessPin,
            accountRole: 'EXPEDITION',
            workspaceId: WORKSPACE_ID,
            createdByUid: targetUser.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      }

      if (!matched && selectedExp && selectedExp.accessPin === cleanPass) {
        matched = selectedExp;
      }

      if (!matched) {
        return {
          ok: false,
          message: 'Invalid Expedition username or password.',
        };
      }
    }

    const profileRef = doc(db, 'operatorProfiles', targetUser.uid);
    const snap = await getDoc(profileRef);

    const targetExpId =
      matched.accountRole === 'OWNER'
        ? profile?.expeditionId || 'owner-pdc-ai'
        : matched.expeditionId;
    const targetExpName =
      matched.accountRole === 'OWNER'
        ? profile?.expeditionName || 'PDC - AI Owner'
        : matched.name;

    const cleanProfile = sanitizeOperatorProfilePayload({
      uid: targetUser.uid,
      operatorName: matched.name,
      expeditionId: targetExpId,
      expeditionName: targetExpName,
      shiftCode: matched.accountRole,
    });

    if (snap.exists()) {
      await updateDoc(profileRef, {
        operatorName: cleanProfile.operatorName,
        expeditionId: cleanProfile.expeditionId,
        expeditionName: cleanProfile.expeditionName,
        shiftCode: cleanProfile.shiftCode,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(profileRef, {
        ...cleanProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    setProfile({
      ...cleanProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (matched.accountRole === 'OWNER') {
      setIsOwnerSession(true);
      setPortalMode('OWNER_ALL');
    } else {
      setIsOwnerSession(false);
      setPortalMode('EXPEDITION_ONLY');
    }

    setIsCredentialUnlocked(true);
    setActiveTab('expeditions');

    return {
      ok: true,
      message:
        matched.accountRole === 'OWNER'
          ? `Signed in as ${matched.name} (Owner All-Activity Mode).`
          : `Signed in to ${matched.name} section.`,
    };
  };

  const handleDatabaseLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSigningIn(true);

    try {
      let activeFirebaseUser = user;
      if (!activeFirebaseUser) {
        const cred = await signInWithGooglePopup();
        activeFirebaseUser = cred.user;
      }

      if (!activeFirebaseUser) {
        setAuthError('Authentication required to connect to PDC - AI database.');
        return;
      }

      const res = await verifyAndApplyDatabaseAccount(
        activeFirebaseUser,
        loginUsername,
        loginPassword,
        loginTargetMode,
        selectedLoginExpeditionId
      );
      if (!res.ok) {
        setAuthError(res.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled or failed.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAddExpedition = async (input: {
    name: string;
    code: string;
    username: string;
    accessPin: string;
    accountRole: AccountRole;
  }) => {
    if (!user) return;
    setIsSavingConfig(true);
    const expId =
      input.accountRole === 'OWNER'
        ? 'owner-pdc-ai'
        : normalizeExpeditionSlug(input.name);
    const path = `expeditions/${expId}`;
    try {
      const clean = sanitizeExpeditionConfigPayload({
        expeditionId: expId,
        name: input.name,
        code: input.code,
        username: input.username,
        accessPin: input.accessPin,
        accountRole: input.accountRole,
        createdByUid: user.uid,
      });
      await setDoc(doc(db, 'expeditions', expId), {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleUpdateExpedition = async (
    expeditionId: string,
    updated: {
      name: string;
      code: string;
      username: string;
      accessPin: string;
      accountRole: AccountRole;
    }
  ) => {
    if (!user) return;
    setIsSavingConfig(true);
    const path = `expeditions/${expeditionId}`;
    try {
      const clean = sanitizeExpeditionConfigPayload({
        expeditionId,
        ...updated,
        createdByUid: user.uid,
      });
      await updateDoc(doc(db, 'expeditions', expeditionId), {
        name: clean.name,
        code: clean.code,
        username: clean.username,
        accessPin: clean.accessPin,
        accountRole: clean.accountRole,
        updatedAt: serverTimestamp(),
      });

      // Sync renamed expeditionName across matching outStockUnits
      const matchingUnits = units.filter((u) => u.expeditionId === expeditionId);
      if (matchingUnits.length > 0) {
        const batch = writeBatch(db);
        for (const u of matchingUnits) {
          batch.update(doc(db, 'outStockUnits', u.id), {
            expeditionName: clean.name,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      if (profile && profile.expeditionId === expeditionId) {
        await updateDoc(doc(db, 'operatorProfiles', user.uid), {
          expeditionName: clean.name,
          updatedAt: serverTimestamp(),
        });
        setProfile({
          ...profile,
          expeditionName: clean.name,
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRenameExpeditionSectionOnly = async (
    expeditionId: string,
    newName: string
  ) => {
    if (!user) return;
    const existingExp = expeditions.find((e) => e.expeditionId === expeditionId);
    if (existingExp) {
      await handleUpdateExpedition(expeditionId, {
        name: newName,
        code: existingExp.code,
        username: existingExp.username,
        accessPin: existingExp.accessPin,
        accountRole: existingExp.accountRole,
      });
    } else {
      await handleAddExpedition({
        name: newName,
        code: newName.slice(0, 5).toUpperCase(),
        username: expeditionId.slice(0, 20),
        accessPin: '1234',
        accountRole: 'EXPEDITION',
      });
    }
  };

  const handleDeleteExpedition = async (expeditionId: string) => {
    if (!user) return;
    setIsSavingConfig(true);
    const path = `expeditions/${expeditionId}`;
    try {
      await deleteDoc(doc(db, 'expeditions', expeditionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveBatch = async (
    rows: ParsedExcelVinRow[],
    expedition: { id: string; name: string }
  ) => {
    if (!user || !profile) return;
    setIsSubmittingBatch(true);

    try {
      // Ensure custom expedition exists in /expeditions database collection
      const existsInDb = expeditions.some((e) => e.expeditionId === expedition.id);
      if (!existsInDb) {
        const cleanExp = sanitizeExpeditionConfigPayload({
          expeditionId: expedition.id,
          name: expedition.name,
          code: expedition.name.replace(/^PT\.?\s*/i, '').slice(0, 5).toUpperCase() || 'EXP',
          username: expedition.id.replace(/[^a-z0-9]/g, '').slice(0, 20) || 'expedition',
          accessPin: '1234',
          accountRole: 'EXPEDITION',
          createdByUid: user.uid,
        });
        await setDoc(doc(db, 'expeditions', cleanExp.expeditionId), {
          ...cleanExp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      const chunkSize = 400;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const row of slice) {
          const unitDocRef = doc(collection(db, 'outStockUnits'));
          const cleanUnit = sanitizeOutStockUnitPayload({
            vin: row.vin,
            vehicleType: row.vehicleType,
            variantName: row.materialUnit,
            expeditionId: expedition.id,
            expeditionName: expedition.name,
            status: 'STANDBY',
            createdByUid: user.uid,
            operatorName: profile.operatorName,
          });

          batch.set(unitDocRef, {
            ...cleanUnit,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
      }

      setActiveTab('expeditions');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'outStockUnits');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleSeedSampleUnits = async () => {
    // No-op: all default sample expeditions and variants removed per user request
    setIsSeeding(false);
  };

  // Real-time update of Timestamp OUT (updatedAt) when status changes to Out Gate
  const handleAdvanceStatus = async (unit: OutStockUnit, nextStatus: DispatchStatus) => {
    const path = `outStockUnits/${unit.id}`;
    try {
      await updateDoc(doc(db, 'outStockUnits', unit.id), {
        status: nextStatus,
        notes: unit.variantName,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteUnit = async (unit: OutStockUnit) => {
    const path = `outStockUnits/${unit.id}`;
    try {
      await deleteDoc(doc(db, 'outStockUnits', unit.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const expeditionDropdownOptions = React.useMemo(() => {
    const list: ExpeditionRecord[] = [];
    const seenCodes = new Set<string>();
    const seenUsers = new Set<string>();
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    const checkAndAdd = (exp: ExpeditionRecord) => {
      const normCode = (exp.code || '').toLowerCase().trim();
      const normUser = (exp.username || '').toLowerCase().trim();
      const normName = (exp.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        seenIds.has(exp.expeditionId) ||
        (normCode && seenCodes.has(normCode)) ||
        (normUser && seenUsers.has(normUser)) ||
        (normName && seenNames.has(normName))
      ) {
        return;
      }

      seenIds.add(exp.expeditionId);
      if (normCode) seenCodes.add(normCode);
      if (normUser) seenUsers.add(normUser);
      if (normName) seenNames.add(normName);
      list.push(exp);
    };

    // 1. Prioritize active database expeditions
    for (const exp of expeditions) {
      if (
        exp.accountRole === 'EXPEDITION' &&
        exp.expeditionId !== 'puninar-jaya' &&
        !exp.name.toLowerCase().includes('puninar')
      ) {
        checkAndAdd(exp);
      }
    }

    // 2. Add fallback presets if not in Firestore
    for (const def of DEFAULT_ACCOUNTS_DIRECTORY) {
      if (def.accountRole === 'EXPEDITION') {
        checkAndAdd({
          expeditionId: def.id,
          name: def.name,
          code: def.code,
          username: def.username,
          accessPin: def.accessPin,
          accountRole: def.accountRole,
          workspaceId: WORKSPACE_ID,
          createdByUid: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditions]);

  const loginDirectory = React.useMemo(() => {
    const list: ExpeditionRecord[] = [];
    const seenCodes = new Set<string>();
    const seenUsers = new Set<string>();
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    const checkAndAdd = (exp: ExpeditionRecord) => {
      const normCode = (exp.code || '').toLowerCase().trim();
      const normUser = (exp.username || '').toLowerCase().trim();
      const normName = (exp.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      if (
        seenIds.has(exp.expeditionId) ||
        (normCode && seenCodes.has(normCode)) ||
        (normUser && seenUsers.has(normUser)) ||
        (normName && seenNames.has(normName))
      ) {
        return;
      }

      seenIds.add(exp.expeditionId);
      if (normCode) seenCodes.add(normCode);
      if (normUser) seenUsers.add(normUser);
      if (normName) seenNames.add(normName);
      list.push(exp);
    };

    for (const exp of expeditions) {
      checkAndAdd(exp);
    }
    for (const def of DEFAULT_ACCOUNTS_DIRECTORY) {
      checkAndAdd({
        expeditionId: def.id,
        name: def.name,
        code: def.code,
        username: def.username,
        accessPin: def.accessPin,
        accountRole: def.accountRole,
        workspaceId: WORKSPACE_ID,
        createdByUid: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return list;
  }, [expeditions]);

  const selectedLoginExpedition = selectedLoginExpeditionId
    ? expeditionDropdownOptions.find(
        (exp) => exp.expeditionId === selectedLoginExpeditionId
      )
    : undefined;

  const databaseExpeditions = React.useMemo(() => {
    const map = new Map<string, string>();
    const seenNames = new Set<string>();

    for (const exp of expeditions) {
      if (
        exp.accountRole === 'EXPEDITION' &&
        exp.expeditionId !== 'puninar-jaya' &&
        !exp.name.toLowerCase().includes('puninar')
      ) {
        const norm = exp.name.toLowerCase().trim();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          map.set(exp.expeditionId, exp.name);
        }
      }
    }
    for (const u of units) {
      if (
        u.expeditionId &&
        u.expeditionId !== 'owner-pdc-ai' &&
        u.expeditionId !== 'puninar-jaya' &&
        !u.expeditionName.toLowerCase().includes('puninar')
      ) {
        const norm = u.expeditionName.toLowerCase().trim();
        if (!seenNames.has(norm) && !map.has(u.expeditionId)) {
          seenNames.add(norm);
          map.set(u.expeditionId, u.expeditionName);
        }
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [expeditions, units]);

  const isAuthenticatedWorkspace = Boolean(user && profile && isCredentialUnlocked);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20 md:pb-12">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('expeditions');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 hover:text-red-600 transition-colors whitespace-nowrap shrink-0"
        >
          IKP Tracker
        </a>

        {/* Zone 2: Navigation links (Expedition & Login hidden when logged in as Expedition) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#expeditions"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('expeditions');
            }}
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'expeditions' ? 'text-slate-900 font-semibold underline' : ''
            }`}
          >
            Activity
          </a>
          <a
            href="#batch-input"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('batch');
            }}
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'batch' ? 'text-slate-900 font-semibold underline' : ''
            }`}
          >
            Input VIN
          </a>
          <a
            href="#vin-lookup"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('lookup');
            }}
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'lookup' ? 'text-slate-900 font-semibold underline' : ''
            }`}
          >
            Search VIN
          </a>
          <a
            href="#summary-report"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('report');
            }}
            className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'report' ? 'text-slate-900 font-semibold underline' : ''
            }`}
          >
            Summary Report
          </a>
          {isOwnerSession && (
            <a
              href="#portal-role"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('role');
              }}
              className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'role' ? 'text-slate-900 font-semibold underline' : ''
              }`}
            >
              Expedition & Login
            </a>
          )}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {isAuthenticatedWorkspace ? (
            <button
              type="button"
              onClick={() => setActiveTab('batch')}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              + Input VIN
            </button>
          ) : (
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap hidden lg:inline">
              Stay connected with PDC - AI
            </span>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 md:pt-7">
        {!authReady ? (
          <div className="space-y-4 py-10">
            <div className="h-24 bg-slate-200/70 rounded-2xl animate-pulse" />
            <div className="h-48 bg-slate-200/70 rounded-2xl animate-pulse" />
          </div>
        ) : !isAuthenticatedWorkspace ? (
          /* Database Custom User & Password Login for Expedition and Owner */
          <div className="max-w-xl mx-auto py-2 sm:py-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              {/* Header: Clean Title without logo or picture */}
              <div className="pb-4 border-b border-slate-100">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                  IKP Tracker
                </h1>
                <p className="text-xs font-semibold text-red-600 mt-0.5">PDC AI - IKP Activity</p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {authError}
                </div>
              )}

              {/* Mode Switcher: Expedition Login vs Owner Login (Both with Username & Password) */}
              <form
                onSubmit={handleDatabaseLoginSubmit}
                className="space-y-4 pt-3 border-t border-slate-100"
              >
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTargetMode('EXPEDITION_ONLY');
                      setSelectedLoginExpeditionId('');
                      setLoginUsername('');
                      setLoginPassword('');
                      setAuthError(null);
                    }}
                    className={`flex-1 min-h-[42px] px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                      loginTargetMode === 'EXPEDITION_ONLY'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Expedition Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginTargetMode('OWNER_ALL');
                      setLoginUsername('EscoAI');
                      setLoginPassword('');
                      setAuthError(null);
                    }}
                    className={`flex-1 min-h-[42px] px-3 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                      loginTargetMode === 'OWNER_ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Owner Login (All Activity)
                  </button>
                </div>

                {loginTargetMode === 'EXPEDITION_ONLY' && (
                  <div className="space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-red-600" />
                        <span>Select Expedition Account</span>
                      </span>
                      {selectedLoginExpedition && (
                        <span className="text-[11px] font-mono text-slate-500 font-normal">
                          Code: <strong className="text-slate-800">{selectedLoginExpedition.code}</strong>
                        </span>
                      )}
                    </label>
                    {expeditionDropdownOptions.length > 0 ? (
                      <select
                        value={selectedLoginExpeditionId}
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          setSelectedLoginExpeditionId(chosenId);
                          const matchedExp = expeditionDropdownOptions.find(
                            (exp) => exp.expeditionId === chosenId
                          );
                          if (matchedExp) {
                            setLoginUsername(matchedExp.username);
                          } else {
                            setLoginUsername('');
                          }
                          setLoginPassword('');
                          setAuthError(null);
                        }}
                        className="w-full min-h-[46px] px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 shadow-2xs"
                      >
                        <option value="">-- Choose Expedition Account --</option>
                        {expeditionDropdownOptions.map((exp) => (
                          <option key={exp.expeditionId} value={exp.expeditionId}>
                            {exp.name} ({exp.code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium leading-relaxed">
                        No custom expeditions added yet. Switch to <strong>Owner Login</strong> to configure expeditions in <strong>Expedition &amp; Login</strong>.
                      </div>
                    )}
                  </div>
                )}

                {loginTargetMode === 'OWNER_ALL' && expeditionDropdownOptions.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-red-600" />
                      <span>Filter Expedition View (Optional)</span>
                    </label>
                    <select
                      value={ownerExpeditionFilter}
                      onChange={(e) => setOwnerExpeditionFilter(e.target.value)}
                      className="w-full min-h-[46px] px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                    >
                      <option value="ALL">All Expeditions (All Activity - Default)</option>
                      {expeditionDropdownOptions.map((exp) => (
                        <option key={exp.expeditionId} value={exp.expeditionId}>
                          {exp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>
                        {loginTargetMode === 'OWNER_ALL'
                          ? 'Owner Username'
                          : 'Expedition Username'}
                      </span>
                      {loginTargetMode === 'EXPEDITION_ONLY' && selectedLoginExpedition && (
                        <span className="text-[11px] text-emerald-700 font-semibold font-mono">
                          @{selectedLoginExpedition.username}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder={
                        loginTargetMode === 'OWNER_ALL'
                          ? 'Enter Owner username'
                          : 'Enter Expedition username'
                      }
                      autoComplete="username"
                      required
                      className="w-full min-h-[46px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {loginTargetMode === 'OWNER_ALL'
                        ? 'Owner Password'
                        : 'Expedition Password'}
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={
                        loginTargetMode === 'OWNER_ALL'
                          ? 'Enter Owner password'
                          : 'Enter Expedition password'
                      }
                      autoComplete="current-password"
                      required
                      className="w-full min-h-[46px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full min-h-[50px] px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loginTargetMode === 'OWNER_ALL' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {isSigningIn
                    ? 'Signing In...'
                    : loginTargetMode === 'OWNER_ALL'
                      ? 'Log In to Owner Version (See All Activity)'
                      : `Log In to ${selectedLoginExpedition?.name || 'Expedition'} Section`}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Authenticated Workspace */
          <div className="space-y-5">
            {/* Compact Top Workspace Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-900">
                  IKP Tracker
                </div>
                <div className="text-xs text-slate-500">
                  Stay connected with PDC - AI ·{' '}
                  <strong className="text-slate-800">
                    {isOwnerSession
                      ? ownerExpeditionFilter === 'ALL'
                        ? 'Owner Version (All Activity)'
                        : `Owner (Filtered: ${
                            databaseExpeditions.find((e) => e.id === ownerExpeditionFilter)?.name ||
                            ownerExpeditionFilter
                          })`
                      : profile?.expeditionName}
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isOwnerSession && (
                  <>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-600 pl-2 pr-0.5 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-red-600" />
                        <span className="hidden sm:inline">Filter Expedition:</span>
                      </span>
                      <select
                        value={ownerExpeditionFilter}
                        onChange={(e) => setOwnerExpeditionFilter(e.target.value)}
                        className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-red-600"
                      >
                        <option value="ALL">All Expeditions (All Activity)</option>
                        {databaseExpeditions.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.name}
                          </option>
                        ))}
                      </select>
                      {ownerExpeditionFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setOwnerExpeditionFilter('ALL')}
                          title="Reset to All Expeditions"
                          className="min-h-[34px] px-2 py-0.5 text-xs font-bold text-red-600 bg-white border border-slate-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Show All
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('role')}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5 text-red-600" />
                      Expedition & Login
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsCredentialUnlocked(false);
                    setLoginUsername('');
                    setLoginPassword('');
                    setOwnerExpeditionFilter('ALL');
                    setActiveTab('expeditions');
                  }}
                  aria-label="Log out"
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 border border-slate-200 rounded-xl transition-colors inline-flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            </div>

            {/* Active Screen */}
            {isLoadingUnits && units.length === 0 ? (
              <div className="space-y-4 py-8">
                <div className="h-20 bg-slate-200/70 rounded-2xl animate-pulse" />
                <div className="h-56 bg-slate-200/70 rounded-2xl animate-pulse" />
              </div>
            ) : activeTab === 'batch' && profile ? (
              <BatchInputView
                portalMode={portalMode}
                activeExpeditionId={profile.expeditionId}
                activeExpeditionName={profile.expeditionName}
                expeditions={expeditions}
                preselectedExpedition={preselectedBatchExpedition}
                onSaveBatch={handleSaveBatch}
                isSubmitting={isSubmittingBatch}
              />
            ) : activeTab === 'lookup' && profile ? (
              <RapidVinLookupView
                units={units}
                portalMode={portalMode}
                activeExpeditionId={profile.expeditionId}
                activeExpeditionName={profile.expeditionName}
                isOwnerEligible={isOwnerSession && portalMode === 'OWNER_ALL'}
                expeditions={expeditions}
                ownerExpeditionFilter={ownerExpeditionFilter}
                onOwnerExpeditionFilterChange={setOwnerExpeditionFilter}
                onAdvanceStatus={handleAdvanceStatus}
              />
            ) : activeTab === 'report' && profile ? (
              <SummaryReportDashboardView
                units={units}
                expeditions={expeditions}
                portalMode={portalMode}
                activeExpeditionId={profile.expeditionId}
                activeExpeditionName={profile.expeditionName}
                isOwnerEligible={isOwnerSession && portalMode === 'OWNER_ALL'}
                ownerExpeditionFilter={ownerExpeditionFilter}
                onOwnerExpeditionFilterChange={setOwnerExpeditionFilter}
                onAdvanceStatus={handleAdvanceStatus}
                onNavigateToBatch={() => setActiveTab('batch')}
              />
            ) : activeTab === 'role' && isOwnerSession && profile ? (
              <PortalRoleView
                profile={profile}
                portalMode={portalMode}
                isOwnerSession={isOwnerSession}
                expeditions={loginDirectory}
                onChangePortalMode={(mode) => {
                  setPortalMode(mode);
                  setActiveTab('expeditions');
                }}
                onAddExpedition={handleAddExpedition}
                onUpdateExpedition={handleUpdateExpedition}
                onDeleteExpedition={handleDeleteExpedition}
                isSaving={isSavingConfig}
              />
            ) : (
              profile && (
                <ExpeditionSectionsView
                  units={units}
                  expeditions={expeditions}
                  portalMode={portalMode}
                  activeExpeditionId={profile.expeditionId}
                  activeExpeditionName={profile.expeditionName}
                  isOwnerEligible={isOwnerSession && portalMode === 'OWNER_ALL'}
                  ownerExpeditionFilter={ownerExpeditionFilter}
                  onOwnerExpeditionFilterChange={setOwnerExpeditionFilter}
                  onAdvanceStatus={handleAdvanceStatus}
                  onDeleteUnit={handleDeleteUnit}
                  onOpenBatchForExpedition={(exp) => {
                    setPreselectedBatchExpedition(exp);
                    setActiveTab('batch');
                  }}
                  onRenameExpeditionSection={handleRenameExpeditionSectionOnly}
                  onDeleteExpeditionSection={handleDeleteExpedition}
                  onOpenManageExpeditions={() => setActiveTab('role')}
                  onSeedSampleUnits={handleSeedSampleUnits}
                  isSeeding={isSeeding}
                  onOpenRapidSearch={() => setActiveTab('lookup')}
                  onOpenSummaryReport={() => setActiveTab('report')}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar (Expedition & Login hidden when logged in as Expedition) */}
      {isAuthenticatedWorkspace && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid ${
            isOwnerSession ? 'grid-cols-5' : 'grid-cols-4'
          } items-center h-16 px-2`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('expeditions')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
              activeTab === 'expeditions' ? 'text-red-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Activity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
              activeTab === 'batch' ? 'text-red-600 font-bold' : 'text-slate-500'
            }`}
          >
            <ClipboardPaste className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Input VIN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lookup')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
              activeTab === 'lookup' ? 'text-red-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Search VIN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
              activeTab === 'report' ? 'text-red-600 font-bold' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Report</span>
          </button>

          {isOwnerSession && (
            <button
              type="button"
              onClick={() => setActiveTab('role')}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors ${
                activeTab === 'role' ? 'text-red-600 font-bold' : 'text-slate-500'
              }`}
            >
              <UserCheck className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">
                Expedition
              </span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
