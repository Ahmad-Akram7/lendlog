import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { addPaymentToRecord, calculatePeopleStats, calculateSummary, createLoanRecord, deletePaymentFromRecord, parseRecordDate, round2, sanitizeRestoredRecords, settleRecordsForPerson, toggleSettlementRecord } from '@/lib/records';
import type {
  AppSettings,
  FilterType,
  MonthlyData,
  Payment,
  PersonStats,
  Record,
  SortType,
  Summary,
} from '@/types';

const RECORDS_KEY = 'lendlog_records';
const SETTINGS_KEY = 'lendlog_settings';
const ONBOARDING_KEY = 'lendlog_onboarding_completed';

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface StorageContextType {
  records: Record[];
  settings: AppSettings;
  loading: boolean;
  createRecord: (
    name: string,
    amount: number,
    type: 'lent' | 'borrowed',
    note: string,
    date: string,
    dueDate: string,
  ) => Promise<void>;
  updateRecord: (id: string, data: Partial<Record>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  markSettled: (id: string) => Promise<void>;
  settleAllFor: (name: string) => Promise<void>;
  deleteAllFor: (name: string) => Promise<void>;
  renamePerson: (oldName: string, newName: string) => Promise<void>;
  addPayment: (
    recordId: string,
    amount: number,
    note: string,
    date: string,
  ) => Promise<void>;
  deletePayment: (recordId: string, paymentId: string) => Promise<void>;
  getFilteredRecords: (
    filter: FilterType,
    search: string,
    sort: SortType,
    person?: string,
  ) => Record[];
  getPeople: () => PersonStats[];
  getSummary: () => Summary;
  getMonthlyData: () => MonthlyData[];
  saveSettings: (s: Partial<AppSettings>) => Promise<void>;
  clearAllRecords: () => Promise<void>;
  restoreData: (
    records: Record[],
    settings: Partial<AppSettings>,
  ) => Promise<void>;
  refresh: () => Promise<void>;
  hasCompletedOnboarding: boolean;
  completeOnboarding: (prefs?: {
    profileName?: string;
    currency?: string;
    theme?: 'system' | 'dark' | 'light';
  }) => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const StorageContext = createContext<StorageContextType | null>(null);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<Record[]>([]);
  const recordsRef = useRef<Record[]>([]);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [settings, setSettings] = useState<AppSettings>({
    currency: 'Rs.',
    theme: 'dark',
    profileName: 'Friend',
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [rRaw, sRaw, oRaw] = await Promise.all([
        AsyncStorage.getItem(RECORDS_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      let loadedRecords: Record[] = [];
      let loadedSettings: AppSettings = {
        currency: 'Rs.',
        theme: 'dark',
        profileName: 'Friend',
      };
      if (rRaw) {
        try {
          loadedRecords = JSON.parse(rRaw) as Record[];
        } catch {
          loadedRecords = [];
        }
        recordsRef.current = loadedRecords;
        setRecords(loadedRecords);
      }
      if (sRaw) {
        try {
          loadedSettings = {
            ...loadedSettings,
            ...(JSON.parse(sRaw) as AppSettings),
          };
        } catch {
          // ignore corrupted settings
        }
        setSettings(loadedSettings);
      }

      // Existing user protection & onboarding detection:
      if (oRaw === 'true' || loadedSettings.hasCompletedOnboarding === true) {
        setHasCompletedOnboarding(true);
      } else if (oRaw === 'false') {
        setHasCompletedOnboarding(false);
      } else {
        // oRaw is null (first run of this update):
        // If user already has records or existing settings, NEVER force onboarding
        const isExistingUser = loadedRecords.length > 0 || sRaw !== null;
        if (isExistingUser) {
          setHasCompletedOnboarding(true);
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        } else {
          // Fresh install
          setHasCompletedOnboarding(false);
        }
      }
    } catch (e) {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update the in-memory source of truth synchronously before awaiting storage.
  // This prevents two rapid mutations from calculating against the same render snapshot.
  const saveRecords = async (nextRecords: Record[]) => {
    recordsRef.current = nextRecords;
    setRecords(nextRecords);
    const snapshot = JSON.stringify(nextRecords);
    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(RECORDS_KEY, snapshot));
    await writeQueueRef.current;
  };

  const createRecord = async (
    name: string,
    amount: number,
    type: 'lent' | 'borrowed',
    note: string,
    date: string,
    dueDate: string,
  ) => {
    const rec = createLoanRecord({ id: genId(), name, amount, type, note, date: date || todayStr(), dueDate, now: new Date().toISOString() });
    await saveRecords([rec, ...recordsRef.current]);
  };

  const updateRecord = async (id: string, data: Partial<Record>) => {
    const now = new Date().toISOString();
    const updated = recordsRef.current.map((r) => {
      if (r.id !== id) return r;
      const nextAmount =
        data.amount !== undefined ? round2(Math.max(0, data.amount)) : r.amount;
      const nextName = data.name !== undefined ? data.name.trim() : r.name;
      const autoSettle = r.paid_amount >= nextAmount && nextAmount > 0;
      return {
        ...r,
        ...data,
        name: nextName,
        amount: nextAmount,
        settled:
          data.settled !== undefined
            ? data.settled
            : autoSettle
              ? true
              : r.settled,
        updated: now,
      };
    });
    await saveRecords(updated);
  };

  const deleteRecord = async (id: string) => {
    await saveRecords(recordsRef.current.filter((r) => r.id !== id));
  };

  const markSettled = async (id: string) => {
    const today = todayStr();
    const now = new Date().toISOString();
    const updated = recordsRef.current.map((r) => r.id === id ? toggleSettlementRecord(r, today, now, genId) : r);
    await saveRecords(updated);
  };

  const toggleSettled = markSettled;

  const settleAllFor = async (name: string) => {
    const today = todayStr();
    const now = new Date().toISOString();
    const updated = settleRecordsForPerson(recordsRef.current, name, today, now, genId);
    await saveRecords(updated);
  };

  const deleteAllFor = async (name: string) => {
    await saveRecords(
      recordsRef.current.filter(
        (r) => r.name.toLowerCase() !== name.toLowerCase(),
      ),
    );
  };

  const renamePerson = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const updated = recordsRef.current.map((r) =>
      r.name.toLowerCase() === oldName.toLowerCase()
        ? { ...r, name: trimmed, updated: now }
        : r,
    );
    await saveRecords(updated);
  };

  const addPayment = async (
    recordId: string,
    amount: number,
    note: string,
    date: string,
  ) => {
    const validAmount = round2(amount);
    if (isNaN(validAmount) || validAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    const now = new Date().toISOString();
    const payment: Payment = {
      id: genId(),
      amount: validAmount,
      date: date || todayStr(),
      note: note ? note.trim() : '',
    };
    const updated = recordsRef.current.map((r) => r.id === recordId ? addPaymentToRecord(r, payment, now) : r);
    await saveRecords(updated);
  };

  const deletePayment = async (recordId: string, paymentId: string) => {
    const now = new Date().toISOString();
    const updated = recordsRef.current.map((r) => r.id === recordId ? deletePaymentFromRecord(r, paymentId, now) : r);
    await saveRecords(updated);
  };

  const getFilteredRecords = (
    filter: FilterType,
    search: string,
    sort: SortType,
    person?: string,
  ): Record[] => {
    let result = [...records];
    if (person)
      result = result.filter(
        (r) => r.name.toLowerCase() === person.toLowerCase(),
      );
    if (search.trim())
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.note.toLowerCase().includes(search.toLowerCase()),
      );
    switch (filter) {
      case 'lent':
        result = result.filter((r) => r.type === 'lent');
        break;
      case 'borrowed':
        result = result.filter((r) => r.type === 'borrowed');
        break;
      case 'pending':
        result = result.filter((r) => !r.settled);
        break;
      case 'settled':
        result = result.filter((r) => r.settled);
        break;
    }
    switch (sort) {
      case 'newest':
        result.sort((a, b) => b.created.localeCompare(a.created));
        break;
      case 'oldest':
        result.sort((a, b) => a.created.localeCompare(b.created));
        break;
      case 'highest':
        result.sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest':
        result.sort((a, b) => a.amount - b.amount);
        break;
    }
    return result;
  };

  const getPeople = (): PersonStats[] => calculatePeopleStats(records);

  const getSummary = (): Summary => calculateSummary(records);

  const getMonthlyData = (): MonthlyData[] => {
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      months.push({ month: label, lent: 0, borrowed: 0 });
    }
    for (const r of records) {
      const rDate = parseRecordDate(r.date);
      if (!rDate) continue;
      const diffMonths =
        (now.getFullYear() - rDate.getFullYear()) * 12 +
        (now.getMonth() - rDate.getMonth());
      if (diffMonths >= 0 && diffMonths <= 5) {
        const idx = 5 - diffMonths;
        if (r.type === 'lent')
          months[idx].lent = round2(months[idx].lent + r.amount);
        else months[idx].borrowed = round2(months[idx].borrowed + r.amount);
      }
    }
    return months;
  };

  const saveSettings = async (s: Partial<AppSettings>) => {
    const updated = { ...settings, ...s };
    setSettings(updated);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  const clearAllRecords = async () => {
    await saveRecords([]);
  };

  const restoreData = async (
    newRecords: Record[],
    newSettings: Partial<AppSettings>,
  ) => {
    if (!Array.isArray(newRecords)) return;
    const today = todayStr();
    const sanitized = sanitizeRestoredRecords(newRecords, { today, now: new Date().toISOString(), genId });
    await saveRecords(sanitized);
    if (newSettings && typeof newSettings === 'object') {
      await saveSettings({ ...newSettings, hasCompletedOnboarding: true });
    } else {
      await saveSettings({ hasCompletedOnboarding: true });
    }
    setHasCompletedOnboarding(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const completeOnboarding = async (prefs?: {
    profileName?: string;
    currency?: string;
    theme?: 'system' | 'dark' | 'light';
  }) => {
    const updated: AppSettings = {
      ...settings,
      ...(prefs?.profileName !== undefined && prefs.profileName.trim()
        ? { profileName: prefs.profileName.trim() }
        : {}),
      ...(prefs?.currency !== undefined && prefs.currency.trim()
        ? { currency: prefs.currency.trim() }
        : {}),
      ...(prefs?.theme ? { theme: prefs.theme } : {}),
      hasCompletedOnboarding: true,
    };
    setSettings(updated);
    setHasCompletedOnboarding(true);
    await Promise.all([
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated)),
      AsyncStorage.setItem(ONBOARDING_KEY, 'true'),
    ]);
  };

  const resetOnboarding = async () => {
    setHasCompletedOnboarding(false);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'false');
  };

  const refresh = loadData;

  return (
    <StorageContext.Provider
      value={{
        records,
        settings,
        loading,
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding,
        createRecord,
        updateRecord,
        deleteRecord,
        markSettled,
        settleAllFor,
        deleteAllFor,
        renamePerson,
        addPayment,
        deletePayment,
        getFilteredRecords,
        getPeople,
        getSummary,
        getMonthlyData,
        saveSettings,
        clearAllRecords,
        restoreData,
        refresh,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used within StorageProvider');
  return ctx;
}
