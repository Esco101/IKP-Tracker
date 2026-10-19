import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit3,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  AccountRole,
  ExpeditionRecord,
  OperatorProfile,
  PortalViewMode,
  normalizeExpeditionSlug,
} from '../types';

interface PortalRoleViewProps {
  profile: OperatorProfile;
  portalMode: PortalViewMode;
  isOwnerSession: boolean;
  expeditions: ExpeditionRecord[];
  onChangePortalMode: (mode: PortalViewMode) => void;
  onAddExpedition: (input: {
    name: string;
    code: string;
    username: string;
    accessPin: string;
    accountRole: AccountRole;
  }) => Promise<void>;
  onUpdateExpedition: (
    expeditionId: string,
    updated: {
      name: string;
      code: string;
      username: string;
      accessPin: string;
      accountRole: AccountRole;
    }
  ) => Promise<void>;
  onDeleteExpedition: (expeditionId: string) => Promise<void>;
  isSaving: boolean;
}

export const PortalRoleView: React.FC<PortalRoleViewProps> = ({
  expeditions,
  onAddExpedition,
  onUpdateExpedition,
  onDeleteExpedition,
  isSaving,
}) => {
  const ownerAccount =
    expeditions.find((e) => e.accountRole === 'OWNER') || {
      expeditionId: 'owner-pdc-ai',
      name: 'PDC - AI Owner',
      code: 'OWNER',
      username: 'EscoAI',
      accessPin: 'Esc1234',
      accountRole: 'OWNER' as AccountRole,
    };

  const expeditionAccounts = expeditions
    .filter((e) => e.accountRole === 'EXPEDITION')
    .filter(
      (e) =>
        e.expeditionId !== 'puninar-jaya' &&
        !e.name.toLowerCase().includes('puninar')
    );

  // Dedicated Owner Username & Password state
  const [ownerName, setOwnerName] = useState(ownerAccount.name);
  const [ownerUsername, setOwnerUsername] = useState(ownerAccount.username);
  const [ownerPassword, setOwnerPassword] = useState(ownerAccount.accessPin);

  useEffect(() => {
    setOwnerName(ownerAccount.name);
    setOwnerUsername(ownerAccount.username);
    setOwnerPassword(ownerAccount.accessPin);
  }, [ownerAccount.name, ownerAccount.username, ownerAccount.accessPin]);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Add new expedition state
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Inline edit state for expeditions
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSaveOwnerCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerUsername.trim() || !ownerPassword.trim()) return;
    setFeedback(null);

    try {
      const existsInList = expeditions.some(
        (item) => item.expeditionId === ownerAccount.expeditionId
      );
      if (existsInList) {
        await onUpdateExpedition(ownerAccount.expeditionId, {
          name: ownerName.trim() || 'PDC - AI Owner',
          code: 'OWNER',
          username: ownerUsername.trim(),
          accessPin: ownerPassword.trim(),
          accountRole: 'OWNER',
        });
      } else {
        await onAddExpedition({
          name: ownerName.trim() || 'PDC - AI Owner',
          code: 'OWNER',
          username: ownerUsername.trim(),
          accessPin: ownerPassword.trim(),
          accountRole: 'OWNER',
        });
      }
      setFeedback({
        type: 'success',
        message: `Owner login updated (Username: ${ownerUsername.trim()}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update Owner login.',
      });
    }
  };

  const handleCreateExpedition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim() || !newPassword.trim()) return;
    setFeedback(null);

    try {
      await onAddExpedition({
        name: newName.trim(),
        code:
          newCode.trim().toUpperCase() ||
          normalizeExpeditionSlug(newName).slice(0, 6).toUpperCase(),
        username: newUsername.trim().toLowerCase(),
        accessPin: newPassword.trim(),
        accountRole: 'EXPEDITION',
      });
      setNewName('');
      setNewCode('');
      setNewUsername('');
      setNewPassword('');
      setFeedback({
        type: 'success',
        message: `Added expedition "${newName.trim()}" with username "${newUsername.trim().toLowerCase()}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to add expedition.',
      });
    }
  };

  const startEditing = (item: ExpeditionRecord) => {
    setEditingId(item.expeditionId);
    setEditName(item.name);
    setEditCode(item.code);
    setEditUsername(item.username);
    setEditPassword(item.accessPin);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (expeditionId: string) => {
    if (!editName.trim() || !editUsername.trim() || !editPassword.trim()) return;
    setFeedback(null);
    try {
      await onUpdateExpedition(expeditionId, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase() || 'EXP',
        username: editUsername.trim().toLowerCase(),
        accessPin: editPassword.trim(),
        accountRole: 'EXPEDITION',
      });
      setEditingId(null);
      setFeedback({
        type: 'success',
        message: `Updated expedition "${editName.trim()}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update expedition.',
      });
    }
  };

  const handleConfirmDelete = async (item: ExpeditionRecord) => {
    setFeedback(null);
    try {
      await onDeleteExpedition(item.expeditionId);
      setConfirmDeleteId(null);
      setFeedback({
        type: 'success',
        message: `Removed expedition "${item.name}".`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove expedition.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Owner & Expedition Login Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Owner login username & password, and add, rename, or remove Expedition accounts.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-red-400" />
          <span>Owner Version Active</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-red-50/80 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                feedback.type === 'success' ? 'text-emerald-700' : 'text-red-700'
              }`}
            />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. Dedicated Owner Login Username & Password Configuration */}
        <form
          onSubmit={handleSaveOwnerCredentials}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Owner Login Username & Password
              </h2>
              <p className="text-xs text-slate-500">
                Database credentials for Owner Version (See All Activity)
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Account Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="PDC - AI Owner"
                maxLength={100}
                required
                className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Username
              </label>
              <input
                type="text"
                value={ownerUsername}
                onChange={(e) => setOwnerUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="EscoAI"
                maxLength={64}
                required
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Password
              </label>
              <input
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="Esc1234"
                maxLength={64}
                required
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || !ownerUsername.trim() || !ownerPassword.trim()}
              className="w-full min-h-[46px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Owner Username & Password'}
            </button>
          </div>
        </form>

        {/* 2. Add Custom Expedition Section & Login Account */}
        <form
          onSubmit={handleCreateExpedition}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Add New Expedition & Login Account
              </h2>
              <p className="text-xs text-slate-500">
                Creates a dedicated Expedition section and custom username/password login
              </p>
            </div>
            <Plus className="w-5 h-5 text-red-600 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expedition Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newUsername) {
                    setNewUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/^pt\.?\s*/i, '')
                        .replace(/[^a-z0-9]/g, '')
                        .slice(0, 16)
                    );
                  }
                }}
                placeholder="e.g. PT. Astra Logistics"
                maxLength={100}
                required
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Code
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="ASTRA"
                maxLength={16}
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expedition Login Username
              </label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="e.g. astra"
                maxLength={64}
                required
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expedition Login Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="e.g. 1234"
                maxLength={64}
                required
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving || !newName.trim() || !newUsername.trim() || !newPassword.trim()}
            className="w-full min-h-[46px] px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Expedition & Login Account
          </button>
        </form>
      </div>

      {/* 3. Expedition Accounts Directory (Rename, Edit Username/Password, Remove) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Expedition Accounts ({expeditionAccounts.length})
            </h2>
            <p className="text-xs text-slate-500">
              Rename any expedition section, customize its username/password, or remove it from the database.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {expeditionAccounts.map((item) => {
            const isEditing = editingId === item.expeditionId;
            const isConfirmingDelete = confirmDeleteId === item.expeditionId;

            return (
              <div key={item.expeditionId} className="p-4 sm:p-5">
                {isEditing ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-900">
                      Rename Expedition & Update Login Credentials
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <div className="lg:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Expedition Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={100}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Code
                        </label>
                        <input
                          type="text"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                          maxLength={16}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) =>
                            setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
                          }
                          maxLength={64}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          maxLength={64}
                          className="w-full min-h-[38px] px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveEdit(item.expeditionId)}
                        className="min-h-[36px] px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        <span className="text-xs font-mono text-slate-500">({item.code})</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-600">
                        <span>
                          Username: <strong className="text-slate-900">{item.username}</strong>
                        </span>
                        <span>
                          Password: <strong className="text-slate-900">{item.accessPin}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditing(item)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Rename / Edit Login
                      </button>

                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleConfirmDelete(item)}
                            className="min-h-[38px] px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-xl"
                          >
                            Confirm Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.expeditionId)}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
