import { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Textarea } from '../components/common/Textarea';
import { Card } from '../components/common/Card';
import { 
  getOrCreateMasterKey, encryptWithKey, decryptWithKey,
  getMessageEncoding, getMessageDecoding,
  encryptPayloadWithPassword, decryptPayloadWithPassword
} from '../lib/crypto';
import { 
  savePrescription, saveCategory, getCategories, 
  getPrescriptions, clearDatabase, deleteCategory,
  saveAutoBackup, deletePrescription
} from '../lib/db';
import { generateId, fileToArrayBuffer, arrayBufferToBase64, base64ToArrayBuffer, compressImage } from '../lib/utils';
import type { CategoryPayload, EncryptedPrescriptionRecord } from '../types';
import { ShieldCheck, FolderPlus, FilePlus, Key, Settings, DownloadCloud, UploadCloud, AlertCircle, Database, Edit2, Trash2, LogOut } from 'lucide-react';
import { CategoryTree } from '../components/admin/CategoryTree';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ProtectedPdfViewer } from '../components/common/ProtectedPdfViewer';
import { createBlobUrl } from '../lib/utils';

export function TherapistDashboard() {
  const navigate = useNavigate();
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [categories, setCategories] = useState<CategoryPayload[]>([]);
  const [activeTab, setActiveTab] = useState<'recipe' | 'categories' | 'access' | 'settings' | 'master'>('recipe');

  // Master View State
  const [allDecryptedRecipes, setAllDecryptedRecipes] = useState<{ id: string; title: string; categoryName: string; createdAt: number; markdownContent: string; categoryId: string; hasPdf: boolean }[]>([]);

  // Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  // Load init data
  useEffect(() => {
    async function init() {
      const key = await getOrCreateMasterKey();
      setMasterKey(key);
      await loadCategories(key);
      
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage && estimate.quota) {
          const percentage = estimate.usage / estimate.quota;
          if (percentage > 0.8) {
            alert('Achtung: Der lokale Speicher deines Browsers ist zu über 80% voll! Bitte aufräumen, um Datenverlust zu vermeiden.');
          }
        }
      }
    }
    init();
  }, []);

  const performAutoBackup = async () => {
    try {
      const cats = await getCategories();
      const pres = await getPrescriptions();
      const masterKeyStr = localStorage.getItem('therapie_safe_master_key') || '';
      await saveAutoBackup({
        version: 1,
        timestamp: Date.now(),
        masterKeyStr,
        categories: cats,
        prescriptions: pres
      });
    } catch (e) {
      console.error('Auto-Backup fehlgeschlagen', e);
    }
  };

  async function loadCategories(key: CryptoKey) {
    const dbCats = await getCategories();
    const decrypted: CategoryPayload[] = [];
    for (const c of dbCats) {
      try {
        const buffer = await decryptWithKey(key, c.encryptedData, c.iv);
        decrypted.push(JSON.parse(getMessageDecoding(buffer)));
      } catch (e) {
        console.error("Konnte Kategorie nicht entschlüsseln", e);
      }
    }
    setCategories(decrypted);
    await loadAllRecipes(key, decrypted);
  }

  const loadAllRecipes = async (key: CryptoKey, cats: CategoryPayload[]) => {
    const pres = await getPrescriptions();
    const decrypted = [];
    const catMap = new Map(cats.map(c => [c.id, c.name]));
    for (const p of pres) {
      try {
        const buf = await decryptWithKey(key, p.encryptedData, p.iv);
        const data = JSON.parse(getMessageDecoding(buf));
        decrypted.push({
          id: p.id,
          title: data.title,
          categoryName: catMap.get(data.categoryId) || 'Ohne Kategorie',
          createdAt: p.createdAt,
          markdownContent: data.markdownContent,
          categoryId: data.categoryId,
          hasPdf: !!p.encryptedPdf
        });
      } catch (e) {
        console.error("Konnte Rezept nicht entschlüsseln", e);
      }
    }
    setAllDecryptedRecipes(decrypted.sort((a,b) => b.createdAt - a.createdAt));
  };

  const handlePreviewSavedRecipe = async (id: string) => {
    if (!masterKey) return;
    const allPres = await getPrescriptions();
    const p = allPres.find(x => x.id === id);
    if (!p) return alert("Rezept nicht gefunden");
    if (!p.encryptedPdf || !p.pdfIv || !p.pdfType) return alert("Dieses Rezept enthält kein PDF.");

    try {
      const pdfBuf = await decryptWithKey(masterKey, p.encryptedPdf, p.pdfIv);
      const url = createBlobUrl(pdfBuf, p.pdfType);
      setPreviewPdfUrl(url);
    } catch (e) {
      console.error(e);
      alert("Fehler beim Entschlüsseln des PDFs.");
    }
  };

  const handlePreviewCurrentRecipe = () => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPreviewPdfUrl(url);
    } else {
      alert("Bitte zuerst ein PDF hochladen, um die Vorschau zu sehen.");
    }
  };

  const handleCategoryUpdate = async (newCategories: CategoryPayload[]) => {
    if (!masterKey) return;
    
    console.log("handleCategoryUpdate triggert mit:", newCategories);

    try {
      setCategories(newCategories);
      
      const newIds = new Set(newCategories.map(c => c.id));
      const removedCats = categories.filter(c => !newIds.has(c.id));
      
      console.log("Kategorien zum Löschen:", removedCats);

      // 1. Kategorien aus lokaler DB löschen
      for (const cat of removedCats) {
        await deleteCategory(cat.id);
      }
      
      // 2. Daten-Integrität: Rezepte aktualisieren, falls deren Kategorie gelöscht wurde
      if (removedCats.length > 0) {
        const removedIds = new Set(removedCats.map(c => c.id));
        const allPres = await getPrescriptions();
        let recipesUpdated = false;
        
        for (const p of allPres) {
          try {
            const buf = await decryptWithKey(masterKey, p.encryptedData, p.iv);
            const data = JSON.parse(getMessageDecoding(buf));
            
            if (removedIds.has(data.categoryId)) {
              console.log("Kategorie von Rezept gelöscht, setze auf 'Ohne Kategorie':", data.title);
              data.categoryId = ''; // Set to unsorted
              
              const payload = JSON.stringify(data);
              const { ciphertext, iv } = await encryptWithKey(masterKey, getMessageEncoding(payload) as any);
              
              await savePrescription({
                ...p,
                encryptedData: ciphertext,
                iv: iv
              });
              recipesUpdated = true;
            }
          } catch (e) {
             console.error("Fehler beim Aktualisieren des Rezepts nach Kategorie-Löschung:", e);
          }
        }
        
        // Wenn Rezepte angepasst wurden, lade sie neu
        if (recipesUpdated) {
          await loadAllRecipes(masterKey, newCategories);
        }
      }
      
      // 3. Neue und geänderte Kategorien in DB speichern
      for (const cat of newCategories) {
        const payload = JSON.stringify(cat);
        const encoded = getMessageEncoding(payload);
        const { ciphertext, iv } = await encryptWithKey(masterKey, encoded as any);
        await saveCategory({ id: cat.id, encryptedData: ciphertext, iv });
      }
      
      await performAutoBackup();
      
      // Rezept-Ansicht neu laden, falls sich Kategorie-Namen geändert haben
      await loadAllRecipes(masterKey, newCategories);
      
      console.log("Speichern der Kategorien erfolgreich abgeschlossen.");
    } catch (err) {
      console.error("Kritischer Fehler in handleCategoryUpdate:", err);
    }
  };

  // --- TAB: RECIPE ---
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveRecipe = async () => {
    if (!masterKey || !title || !categoryId) return alert('Titel und Kategorie sind Pflichtfelder.');
    setIsSaving(true);
    try {
      const id = generateId();
      const payload = JSON.stringify({ title, categoryId, markdownContent: markdown });
      const { ciphertext, iv } = await encryptWithKey(masterKey, getMessageEncoding(payload) as any);
      
      const record: EncryptedPrescriptionRecord = { id, createdAt: Date.now(), encryptedData: ciphertext, iv };

      if (pdfFile) {
        const pdfBuffer = await fileToArrayBuffer(pdfFile);
        const { ciphertext: encPdf, iv: pdfIv } = await encryptWithKey(masterKey, pdfBuffer as any);
        record.encryptedPdf = encPdf;
        record.pdfIv = pdfIv;
        record.pdfType = pdfFile.type;
      }

      if (imageFile) {
        const compressedImage = await compressImage(imageFile, 1200, 0.8);
        const imgBuffer = await fileToArrayBuffer(compressedImage);
        const { ciphertext: encImg, iv: imgIv } = await encryptWithKey(masterKey, imgBuffer as any);
        record.encryptedImage = encImg;
        record.imageIv = imgIv;
        record.imageType = compressedImage.type;
      }

      await savePrescription(record);
      setTitle(''); setMarkdown(''); setPdfFile(null); setImageFile(null);
      await performAutoBackup();
      await loadAllRecipes(masterKey, categories);
      alert('Rezept erfolgreich gespeichert.');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Speichern.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRecipe = (recipe: any) => {
    setTitle(recipe.title);
    setCategoryId(recipe.categoryId);
    setMarkdown(recipe.markdownContent);
    setActiveTab('recipe');
  };

  const handleDeleteRecipe = async (id: string) => {
    if (!masterKey || !confirm('Möchtest du dieses Rezept wirklich löschen?')) return;
    await deletePrescription(id);
    await performAutoBackup();
    await loadAllRecipes(masterKey, categories);
  };

  // --- TAB: PATIENT EXPORT ---
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [daysValid, setDaysValid] = useState('7');
  const [patientPassword, setPatientPassword] = useState('');
  const [isExportingPatient, setIsExportingPatient] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleGeneratePatientExport = async () => {
    if (!masterKey || selectedCats.length === 0) return alert('Bitte Kategorien auswählen.');
    if (!patientPassword || patientPassword.length < 4) return alert('Bitte ein sicheres Passwort vergeben (mind. 4 Zeichen).');
    
    setIsExportingPatient(true);
    try {
      const expirationDate = Date.now() + parseInt(daysValid) * 24 * 60 * 60 * 1000;
      
      const allPrescriptions = await getPrescriptions();
      const patientCategories = categories.filter(c => selectedCats.includes(c.id));
      const patientPrescriptions = [];

      for (const p of allPrescriptions) {
        try {
          const buf = await decryptWithKey(masterKey, p.encryptedData, p.iv);
          const data = JSON.parse(getMessageDecoding(buf));
          
          if (selectedCats.includes(data.categoryId)) {
            let imageBase64, pdfBase64;
            if (p.encryptedImage && p.imageIv) {
               const imgBuf = await decryptWithKey(masterKey, p.encryptedImage, p.imageIv);
               imageBase64 = await arrayBufferToBase64(imgBuf);
            }
            if (p.encryptedPdf && p.pdfIv) {
               const pdfBuf = await decryptWithKey(masterKey, p.encryptedPdf, p.pdfIv);
               pdfBase64 = await arrayBufferToBase64(pdfBuf);
            }
            
            patientPrescriptions.push({
              id: p.id,
              categoryId: data.categoryId,
              title: data.title,
              markdownContent: data.markdownContent,
              imageBase64,
              imageType: p.imageType,
              pdfBase64,
              pdfType: p.pdfType
            });
          }
        } catch (e) {
          console.error("Fehler beim Entschlüsseln eines Rezepts", e);
        }
      }

      const payload = JSON.stringify({
        version: 1,
        expirationDate,
        categories: patientCategories,
        prescriptions: patientPrescriptions
      });

      const { ciphertext, iv, salt } = await encryptPayloadWithPassword(payload, patientPassword);
      
      const fileData = JSON.stringify({
        ciphertext: await arrayBufferToBase64(ciphertext),
        iv: await arrayBufferToBase64(iv),
        salt: await arrayBufferToBase64(salt)
      });

      const blob = new Blob([fileData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rezept-paket-${new Date().toISOString().split('T')[0]}.therapie`;
      a.click();
      URL.revokeObjectURL(url);

      const appUrl = new URL(window.location.origin);
      appUrl.pathname = '/patient';
      appUrl.searchParams.set('pwd', patientPassword);
      setGeneratedUrl(appUrl.toString());

      setPatientPassword('');
      alert('Paket erfolgreich exportiert! Sende die .tsafe Datei und das Passwort an den Patienten.');
    } catch (e) {
      console.error(e);
      alert('Fehler beim Generieren des Exports.');
    } finally {
      setIsExportingPatient(false);
    }
  };

  // --- TAB: SETTINGS (BACKUP) ---
  const [backupPassword, setBackupPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleExportBackup = async () => {
    if (!backupPassword || backupPassword.length < 4) return alert("Bitte ein Passwort mit mind. 4 Zeichen wählen.");
    setIsExporting(true);
    try {
      const cats = await getCategories();
      const pres = await getPrescriptions();
      const masterKeyStr = localStorage.getItem('therapie_safe_master_key') || '';

      const backupPayload = {
        version: 1,
        timestamp: Date.now(),
        masterKeyStr,
        categories: await Promise.all(cats.map(async c => ({
          ...c,
          encryptedData: await arrayBufferToBase64(c.encryptedData),
          iv: await arrayBufferToBase64(c.iv)
        }))),
        prescriptions: await Promise.all(pres.map(async p => ({
          ...p,
          encryptedData: await arrayBufferToBase64(p.encryptedData),
          iv: await arrayBufferToBase64(p.iv),
          encryptedPdf: p.encryptedPdf ? await arrayBufferToBase64(p.encryptedPdf) : undefined,
          pdfIv: p.pdfIv ? await arrayBufferToBase64(p.pdfIv) : undefined,
          encryptedImage: p.encryptedImage ? await arrayBufferToBase64(p.encryptedImage) : undefined,
          imageIv: p.imageIv ? await arrayBufferToBase64(p.imageIv) : undefined,
        })))
      };

      const payloadString = JSON.stringify(backupPayload);
      const { ciphertext, iv, salt } = await encryptPayloadWithPassword(payloadString, backupPassword);
      
      const fileData = JSON.stringify({
        ciphertext: await arrayBufferToBase64(ciphertext),
        iv: await arrayBufferToBase64(iv),
        salt: await arrayBufferToBase64(salt)
      });

      const blob = new Blob([fileData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `therapie-safe-backup-${new Date().toISOString().split('T')[0]}.tsb`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupPassword('');
    } catch (e) {
      console.error(e);
      alert("Fehler beim Exportieren.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!importFile || !backupPassword) return alert("Bitte Datei und Passwort angeben.");
    
    if (!window.confirm("ACHTUNG: Die aktuelle Datenbank auf diesem Gerät wird vollständig gelöscht und überschrieben. Möchtest du fortfahren?")) return;

    setIsImporting(true);
    try {
      const fileText = await importFile.text();
      const parsedFile = JSON.parse(fileText);
      
      const ciphertext = await base64ToArrayBuffer(parsedFile.ciphertext);
      const iv = new Uint8Array(await base64ToArrayBuffer(parsedFile.iv));
      const salt = new Uint8Array(await base64ToArrayBuffer(parsedFile.salt));

      const decryptedStr = await decryptPayloadWithPassword(ciphertext, backupPassword, iv, salt);
      const backupPayload = JSON.parse(decryptedStr);

      await clearDatabase();
      localStorage.setItem('therapie_safe_master_key', backupPayload.masterKeyStr);

      for (const c of backupPayload.categories) {
        await saveCategory({
          id: c.id,
          encryptedData: await base64ToArrayBuffer(c.encryptedData),
          iv: new Uint8Array(await base64ToArrayBuffer(c.iv))
        });
      }
      for (const p of backupPayload.prescriptions) {
        await savePrescription({
          id: p.id,
          createdAt: p.createdAt,
          encryptedData: await base64ToArrayBuffer(p.encryptedData),
          iv: new Uint8Array(await base64ToArrayBuffer(p.iv)),
          encryptedPdf: p.encryptedPdf ? await base64ToArrayBuffer(p.encryptedPdf) : undefined,
          pdfIv: p.pdfIv ? new Uint8Array(await base64ToArrayBuffer(p.pdfIv)) : undefined,
          pdfType: p.pdfType,
          encryptedImage: p.encryptedImage ? await base64ToArrayBuffer(p.encryptedImage) : undefined,
          imageIv: p.imageIv ? new Uint8Array(await base64ToArrayBuffer(p.imageIv)) : undefined,
          imageType: p.imageType
        });
      }
      alert("Backup erfolgreich wiederhergestellt!");
      window.location.reload();

    } catch (e) {
      console.error(e);
      alert("Fehler beim Importieren. Falsches Passwort oder beschädigte Datei.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!masterKey) return <div className="p-12 text-center">Initialisiere Krypto-Engine...</div>;

  return (
    <div className="min-h-screen bg-background pt-[320px] pb-12 px-4 relative">
      {previewPdfUrl && (
        <ProtectedPdfViewer 
          pdfUrl={previewPdfUrl} 
          onClose={() => setPreviewPdfUrl(null)} 
          isAdminPreview={true} 
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-text-main flex items-center justify-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Therapie-Safe
          </h1>
          <p className="text-gray-600 dark:text-gray-300">Zentrales CMS für Dokumente & Rezepte</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <Button variant={activeTab === 'recipe' ? 'primary' : 'secondary'} onClick={() => setActiveTab('recipe')}>
            <FilePlus className="w-4 h-4 mr-2" /> Neues Rezept
          </Button>
          <Button variant={activeTab === 'master' ? 'primary' : 'secondary'} onClick={() => setActiveTab('master')}>
            <Database className="w-4 h-4 mr-2" /> Datenbank
          </Button>
          <Button variant={activeTab === 'categories' ? 'primary' : 'secondary'} onClick={() => setActiveTab('categories')}>
            <FolderPlus className="w-4 h-4 mr-2" /> Kategorien
          </Button>
          <Button variant={activeTab === 'access' ? 'primary' : 'secondary'} onClick={() => setActiveTab('access')}>
            <Key className="w-4 h-4 mr-2" /> Patienten-Zugang
          </Button>
          <Button variant={activeTab === 'settings' ? 'primary' : 'secondary'} onClick={() => setActiveTab('settings')}>
            <Settings className="w-4 h-4 mr-2" /> Einstellungen
          </Button>
        </div>

        {activeTab === 'categories' && (
          <Card className="space-y-6">
            <CategoryTree categories={categories} onChange={handleCategoryUpdate} />
          </Card>
        )}

        {activeTab === 'recipe' && (
          <Card className="space-y-6">
            <h2 className="text-xl font-semibold">Neues Rezept erstellen</h2>
            <div className="space-y-4">
              <Input placeholder="Rezept Titel..." value={title} onChange={e => setTitle(e.target.value)} />
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full h-12 rounded-2xl border border-gray-300 dark:border-gray-500 bg-white dark:bg-dark-bg text-text-main dark:text-dark-text px-4 focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Kategorie auswählen...</option>
                {categories.filter(c => !c.parentId).map(main => (
                  <optgroup key={main.id} label={main.name}>
                    <option value={main.id}>{main.name} (Allgemein)</option>
                    {categories.filter(c => c.parentId === main.id).map(sub => (
                      <option key={sub.id} value={sub.id}>{main.name} &gt; {sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <Textarea placeholder="Markdown Inhalt (optional)..." value={markdown} onChange={e => setMarkdown(e.target.value)} />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-dashed border-gray-300 rounded-2xl">
                  <label className="block text-sm font-medium mb-2">PDF Dokument (Optional)</label>
                  <input type="file" accept="application/pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                </div>
                <div className="p-4 border border-dashed border-gray-300 rounded-2xl">
                  <label className="block text-sm font-medium mb-2">Vorschaubild (Optional)</label>
                  <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button onClick={handlePreviewCurrentRecipe} variant="secondary" className="flex-1">
                Vorschau (Patientenansicht)
              </Button>
              <Button onClick={handleSaveRecipe} isLoading={isSaving} className="flex-1">Speichern & Verschlüsseln</Button>
            </div>
          </Card>
        )}

        {activeTab === 'master' && (
          <Card className="space-y-6">
            <h2 className="text-xl font-semibold">Gesamte Rezeptdatenbank</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50/50 text-gray-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Titel</th>
                    <th className="px-6 py-4">Kategorie</th>
                    <th className="px-6 py-4">Erstellt am</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allDecryptedRecipes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Noch keine Rezepte vorhanden.</td>
                    </tr>
                  )}
                  {allDecryptedRecipes.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-main">{r.title}</td>
                      <td className="px-6 py-4 text-gray-600">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {r.categoryName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                          Aktiv
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {r.hasPdf && (
                          <button onClick={() => handlePreviewSavedRecipe(r.id)} className="text-gray-400 hover:text-blue-500 transition-colors mr-2" title="Vorschau (Patientenansicht)">
                            <FilePlus className="w-4 h-4 inline" />
                          </button>
                        )}
                        <button onClick={() => handleEditRecipe(r)} className="text-gray-400 hover:text-primary transition-colors" title="Bearbeiten">
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => handleDeleteRecipe(r.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Löschen">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'access' && (
          <Card className="space-y-6">
            <h2 className="text-xl font-semibold">Rezept-Paket Exportieren</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Wähle die Ordner, die für den Patienten exportiert werden sollen.</p>
            
            <div className="space-y-4 border p-4 rounded-xl max-h-64 overflow-y-auto bg-gray-50/50 dark:bg-gray-800/50 dark:border-gray-700">
              {categories.filter(c => !c.parentId).map(main => {
                const subs = categories.filter(c => c.parentId === main.id);
                const allSelected = selectedCats.includes(main.id) && subs.every(s => selectedCats.includes(s.id));
                const someSelected = selectedCats.includes(main.id) || subs.some(s => selectedCats.includes(s.id));
                
                return (
                  <div key={main.id} className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer font-semibold text-text-main dark:text-dark-text hover:text-primary transition-colors">
                      <input 
                        type="checkbox" 
                        checked={allSelected}
                        ref={(input) => { if (input) input.indeterminate = someSelected && !allSelected; }}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          let newSelected = [...selectedCats];
                          if (checked) {
                            if (!newSelected.includes(main.id)) newSelected.push(main.id);
                            subs.forEach(s => { if (!newSelected.includes(s.id)) newSelected.push(s.id); });
                          } else {
                            newSelected = newSelected.filter(id => id !== main.id && !subs.find(s => s.id === id));
                          }
                          setSelectedCats(newSelected);
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300 accent-[#88A388]"
                      />
                      {main.name}
                    </label>
                    {subs.length > 0 && (
                      <div className="pl-6 ml-2 border-l-2 border-gray-200 dark:border-gray-700 space-y-2 mt-2">
                        {subs.map(sub => (
                          <label key={sub.id} className="flex items-center gap-3 cursor-pointer text-gray-600 dark:text-gray-400 hover:text-primary transition-colors text-sm font-normal">
                            <input 
                              type="checkbox" 
                              checked={selectedCats.includes(sub.id)}
                              onChange={(e) => {
                                let newSelected = [...selectedCats];
                                if (e.target.checked) {
                                  newSelected.push(sub.id);
                                  if (!newSelected.includes(main.id)) newSelected.push(main.id);
                                } else {
                                  newSelected = newSelected.filter(id => id !== sub.id);
                                }
                                setSelectedCats(newSelected);
                              }}
                              className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300 accent-[#88A388]"
                            />
                            {sub.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Gültigkeit der Datei</label>
              <select value={daysValid} onChange={e => setDaysValid(e.target.value)} className="w-full h-12 rounded-2xl border border-gray-300 dark:border-gray-500 bg-white dark:bg-dark-bg text-text-main dark:text-dark-text px-4 focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="1">1 Tag</option>
                <option value="7">7 Tage</option>
                <option value="30">30 Tage</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Passwort für den Patienten</label>
              <Input 
                type="text" 
                placeholder="Passwort (z.B. p8f3k2)" 
                value={patientPassword} 
                onChange={e => setPatientPassword(e.target.value)} 
              />
              <p className="text-xs text-gray-600 dark:text-gray-300">Dieses Passwort benötigt der Patient, um die Datei zu öffnen.</p>
            </div>

            <Button onClick={handleGeneratePatientExport} isLoading={isExportingPatient} className="w-full print:hidden">
              <DownloadCloud className="w-4 h-4 mr-2" />
              Paket herunterladen (.tsafe)
            </Button>

            {generatedUrl && (
              <div className="mt-8 p-6 bg-white dark:bg-dark-bg border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col items-center text-center print:border-none print:mt-0 print:p-0">
                <h3 className="font-semibold text-lg mb-2 print:text-black">Patienten-Zugang</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs print:hidden">
                  Scanne diesen QR-Code mit dem Handy des Patienten oder drucke ihn aus. Das Passwort wird dann automatisch ausgefüllt.
                </p>
                <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                  <QRCodeSVG value={generatedUrl} size={200} />
                </div>
                <p className="text-xs font-mono bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg break-all max-w-full text-gray-600 dark:text-gray-300 print:hidden">
                  {generatedUrl}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mt-4 print:hidden w-full max-w-md">
                  <Button onClick={() => window.print()} variant="secondary" className="flex-1">
                    QR-Code drucken
                  </Button>
                  <Button 
                    variant="primary" 
                    className="flex-1"
                    onClick={() => {
                      const subject = "Deine persönlichen Rezepte & Unterlagen von Praxis Katrin Sager";
                      const body = "Hallo ,\n\nEs freut mich, dir hiermit deine individuellen Rezepte und Therapieunterlagen zukommen zu lassen.\n\nUm deine Unterlagen sicher und verschlüsselt anzusehen, gehe bitte wie folgt vor:\n\n1. Öffne dein Patienten-Portal unter: " + window.location.origin + "/patient\n2. Lade die angehängte Datei im Portal hoch.\n3. Gib das Passwort ein, das wir in der Praxis besprochen haben.\n\nDu kannst die Rezepte dort jederzeit einsehen, als Favoriten markieren oder für deine Unterlagen ausdrucken.\n\nBitte beachte, dass die Unterlagen urheberrechtlich geschützt sind und nur für deine persönliche Therapie bestimmt sind.\n\nIch wünsche dir viel Freude beim Ausprobieren und eine gute Umsetzung!\n\nHerzliche Grüsse,\nKatrin";
                      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 8000);
                    }}
                  >
                    Per E-Mail senden
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EXPORT */}
            <Card className="space-y-6">
              <div className="flex items-center gap-3">
                <DownloadCloud className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold">Backup erstellen</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Sichert alle Kategorien, Rezepte, PDFs und Zugänge in einer passwortgeschützten Datei.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Backup-Passwort</label>
                  <Input 
                    type="password" 
                    placeholder="Sicheres Passwort..." 
                    value={backupPassword} 
                    onChange={e => setBackupPassword(e.target.value)} 
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleExportBackup} 
                  isLoading={isExporting}
                >
                  <DownloadCloud className="w-4 h-4 mr-2" />
                  Als .tsb exportieren
                </Button>
              </div>
            </Card>

            {/* IMPORT */}
            <Card className="space-y-6 border-orange-100 bg-orange-50/30">
              <div className="flex items-center gap-3">
                <UploadCloud className="w-6 h-6 text-orange-500" />
                <h2 className="text-xl font-semibold">Wiederherstellen</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Lade ein Backup hoch, um die Datenbank auf diesem Gerät zu überschreiben.
              </p>
              
              <div className="space-y-4">
                <input 
                  type="file" 
                  accept=".tsb,.json" 
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 cursor-pointer"
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Backup-Passwort</label>
                  <Input 
                    type="password" 
                    placeholder="Passwort eingeben..." 
                    value={backupPassword} 
                    onChange={e => setBackupPassword(e.target.value)} 
                  />
                </div>
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  Achtung: Dies löscht unwiderruflich alle aktuellen lokalen Daten.
                </div>
                <Button 
                  variant="secondary"
                  className="w-full text-orange-600 border-orange-200 hover:bg-orange-50" 
                  onClick={handleImportBackup} 
                  isLoading={isImporting}
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Backup importieren
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm font-medium leading-relaxed">
            Dein E-Mail-Programm wurde geöffnet. Die Datei befindet sich in deinem 'Downloads'-Ordner – ziehe sie einfach als Anhang in die E-Mail.
          </p>
        </div>
      )}
    </div>
  );
}
