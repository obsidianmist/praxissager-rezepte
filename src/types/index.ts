export interface CategoryPayload {
  id: string;
  parentId: string | null;
  name: string;
}

export interface EncryptedCategoryRecord {
  id: string;
  encryptedData: ArrayBuffer; // AES-GCM encrypted CategoryPayload using Master Key
  iv: Uint8Array;
}

export interface PrescriptionPayload {
  title: string;
  categoryId: string;
  markdownContent: string;
}

export interface EncryptedPrescriptionRecord {
  id: string;
  createdAt: number;
  encryptedData: ArrayBuffer; // AES-GCM encrypted PrescriptionPayload using Master Key
  iv: Uint8Array;
  
  // Stored as separate ArrayBuffers to avoid massive JSON strings
  encryptedPdf?: ArrayBuffer;
  pdfIv?: Uint8Array;
  pdfType?: string;
  
  encryptedImage?: ArrayBuffer;
  imageIv?: Uint8Array;
  imageType?: string;
}

export interface PatientExportPayload {
  version: number;
  expirationDate: number;
  categories: {
    id: string;
    name: string;
  }[];
  prescriptions: {
    id: string;
    title: string;
    categoryId: string;
    markdownContent: string;
    pdfBase64?: string;
    pdfType?: string;
    imageBase64?: string;
    imageType?: string;
  }[];
}
