import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { 
  EncryptedPrescriptionRecord, 
  EncryptedCategoryRecord
} from '../types';

interface TherapieSafeDB extends DBSchema {
  prescriptions: {
    key: string;
    value: EncryptedPrescriptionRecord;
  };
  categories: {
    key: string;
    value: EncryptedCategoryRecord;
  };
  patientCache: {
    key: string;
    value: any; // Der entschlüsselte Payload
  };
  system_backups: {
    key: string;
    value: any; // Verschlüsselte Backup Payloads
  };
}

const DB_NAME = 'therapie-safe-db';
const DB_VERSION = 5; // Bump version for system_backups

let dbPromise: Promise<IDBPDatabase<TherapieSafeDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TherapieSafeDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('prescriptions', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
          }
        }
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains('accessKeys' as any)) {
            db.deleteObjectStore('accessKeys' as any);
          }
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('patientCache')) {
            db.createObjectStore('patientCache');
          }
        }
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains('system_backups')) {
            db.createObjectStore('system_backups');
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function savePrescription(record: EncryptedPrescriptionRecord): Promise<void> {
  const db = await getDB();
  await db.put('prescriptions', record);
}

export async function getPrescriptions(): Promise<EncryptedPrescriptionRecord[]> {
  const db = await getDB();
  return db.getAll('prescriptions');
}

export async function deletePrescription(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('prescriptions', id);
}

export async function saveCategory(record: EncryptedCategoryRecord): Promise<void> {
  const db = await getDB();
  await db.put('categories', record);
}

export async function getCategories(): Promise<EncryptedCategoryRecord[]> {
  const db = await getDB();
  return db.getAll('categories');
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('categories', id);
}

export async function clearDatabase(): Promise<void> {
  const db = await getDB();
  await db.clear('categories');
  await db.clear('prescriptions');
}

export async function savePatientCache(payload: any): Promise<void> {
  const db = await getDB();
  await db.put('patientCache', payload, 'current');
}

export async function getPatientCache(): Promise<any | undefined> {
  const db = await getDB();
  return db.get('patientCache', 'current');
}

export async function clearPatientCache(): Promise<void> {
  const db = await getDB();
  await db.delete('patientCache', 'current');
}

export async function saveAutoBackup(payload: any): Promise<void> {
  const db = await getDB();
  await db.put('system_backups', payload, 'last_stable_backup');
}

export async function getLastStableBackup(): Promise<any | undefined> {
  const db = await getDB();
  return db.get('system_backups', 'last_stable_backup');
}
