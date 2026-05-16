import { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { savePatientCache, getPatientCache, clearPatientCache } from '../lib/db';
import { decryptPayloadWithPassword } from '../lib/crypto';
import { createBlobUrl, base64ToArrayBuffer } from '../lib/utils';
import { Lock, Unlock, FileText, Image as ImageIcon, Download, UploadCloud, Heart, Search, Smartphone, HelpCircle, Printer } from 'lucide-react';
import type { PatientExportPayload } from '../types';
import ReactMarkdown from 'react-markdown';
import { OnboardingTour } from '../components/patient/OnboardingTour';
import { ProtectedPdfViewer } from '../components/common/ProtectedPdfViewer';
import { motion } from 'framer-motion';

interface DecryptedRecipe {
  id: string;
  title: string;
  categoryName: string;
  markdownContent: string;
  imageBase64?: string;
  imageType?: string;
  pdfBase64?: string;
  pdfType?: string;
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <strong key={i} className="font-bold text-primary">{part}</strong> 
          : part
      )}
    </span>
  );
}

export function PatientPortal() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recipes, setRecipes] = useState<DecryptedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<DecryptedRecipe | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);

  // Search & Favorites State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [expirationDate, setExpirationDate] = useState<number | null>(null);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Tour State
  const [tourKey, setTourKey] = useState(0);

  // Load favorites and URL params
  useEffect(() => {
    const saved = localStorage.getItem('patient_favorites');
    if (saved) {
      try { setFavorites(JSON.parse(saved)); } catch (e) {}
    }
    
    // Auto-fill password from URL
    const params = new URLSearchParams(window.location.search);
    const pwdParam = params.get('pwd');
    if (pwdParam) {
      setPassword(pwdParam);
    }
  }, []);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check for cached session on mount
  useEffect(() => {
    async function checkCache() {
      try {
        const cachedPayload = await getPatientCache() as PatientExportPayload;
        if (cachedPayload) {
          if (cachedPayload.expirationDate > Date.now()) {
            await loadPayloadIntoState(cachedPayload);
          } else {
            await clearPatientCache();
            setError('Dein Zugang ist abgelaufen. Bitte fordere eine neue Datei an.');
          }
        }
      } catch (e) {
        console.error("Cache Fehler:", e);
      } finally {
        setIsLoading(false);
      }
    }
    checkCache();
  }, []);

  const loadPayloadIntoState = async (payload: PatientExportPayload) => {
    const validRecipes: DecryptedRecipe[] = [];
    
    // Map category IDs to names
    const catMap = new Map<string, string>();
    payload.categories.forEach(c => catMap.set(c.id, c.name));

    for (const p of payload.prescriptions) {
      validRecipes.push({
        id: p.id,
        title: p.title,
        categoryName: catMap.get(p.categoryId) || 'Ohne Kategorie',
        markdownContent: p.markdownContent,
        imageBase64: p.imageBase64,
        imageType: p.imageType,
        pdfBase64: p.pdfBase64,
        pdfType: p.pdfType
      });
    }

    setRecipes(validRecipes);
    setIsAuthenticated(true);
    setExpirationDate(payload.expirationDate);
  };

  const handleLogin = async () => {
    if (!importFile || !password) return setError('Bitte wähle eine Datei und gib das Passwort ein.');
    setIsLoading(true);
    setError('');

    try {
      const fileText = await importFile.text();
      const parsedFile = JSON.parse(fileText);

      const ciphertext = await base64ToArrayBuffer(parsedFile.ciphertext);
      const iv = new Uint8Array(await base64ToArrayBuffer(parsedFile.iv));
      const salt = new Uint8Array(await base64ToArrayBuffer(parsedFile.salt));

      const decryptedStr = await decryptPayloadWithPassword(ciphertext, password, iv, salt);
      const payload: PatientExportPayload = JSON.parse(decryptedStr);

      if (payload.expirationDate < Date.now()) {
        throw new Error('Dieses Rezept-Paket ist abgelaufen.');
      }

      await savePatientCache(payload);
      await loadPayloadIntoState(payload);

    } catch (e: any) {
      setError(e.message || 'Login fehlgeschlagen. Falsches Passwort oder ungültige Datei.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearPatientCache();
    setIsAuthenticated(false);
    setRecipes([]);
    setImportFile(null);
    setPassword('');
  };

  if (isLoading && !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center">Lade...</div>;
  }

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newFavs = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem('patient_favorites', JSON.stringify(newFavs));
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const filteredRecipes = recipes.filter(r => {
    if (showFavoritesOnly && !favorites.includes(r.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q) || (r.markdownContent && r.markdownContent.toLowerCase().includes(q));
    }
    return true;
  });

  const handleOpenPdf = async (recipe: DecryptedRecipe) => {
    if (recipe.pdfBase64 && recipe.pdfType) {
      const pdfBuf = await base64ToArrayBuffer(recipe.pdfBase64);
      const pdfUrl = createBlobUrl(pdfBuf, recipe.pdfType);
      setViewingPdfUrl(pdfUrl);
    }
  };

  const restartTour = () => {
    localStorage.removeItem('onboardingCompleted');
    setTourKey(prev => prev + 1);
  };

  if (selectedRecipe) {
    return (
      <div className="min-h-screen bg-background pt-[320px] pb-8 px-4 print:pt-0 print:bg-white print:p-0">
        {viewingPdfUrl && (
          <ProtectedPdfViewer pdfUrl={viewingPdfUrl} onClose={() => setViewingPdfUrl(null)} />
        )}
        <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:space-y-0">
          <div className="flex justify-between items-center mb-4 print:hidden">
            <Button variant="ghost" onClick={() => setSelectedRecipe(null)}>
              &larr; Zurück zur Übersicht
            </Button>
            <Button onClick={() => window.print()} variant="secondary">
              <Printer className="w-4 h-4 mr-2" />
              Als PDF speichern / Drucken
            </Button>
          </div>

          <Card className="space-y-8 p-8 md:p-12 print:shadow-none print:p-0 print:space-y-6">
            
            {/* Branded Print Header */}
            <div className="hidden print:flex justify-between items-center border-b pb-6 mb-8">
              <img src="/image_062b03.png" alt="Praxis Sager" className="h-16 object-contain" />
              <div className="text-right text-sm text-gray-500 font-sans">
                <p>Naturheilpraxis TEN</p>
                <p>Katrin Sager</p>
              </div>
            </div>

            <div className="flex justify-between items-start print:mt-4">
              <div>
                <p className="text-primary font-medium text-sm print:text-gray-500">{selectedRecipe.categoryName}</p>
                <h1 className="text-3xl font-bold text-text-main mt-1 print:text-black">{selectedRecipe.title}</h1>
              </div>
              <button onClick={(e) => toggleFavorite(selectedRecipe.id, e)} className="p-2 print:hidden">
                <Heart className={`w-8 h-8 transition-colors ${favorites.includes(selectedRecipe.id) ? 'fill-[#88A388] text-[#88A388]' : 'text-gray-300 hover:text-gray-400'}`} />
              </button>
            </div>

            {selectedRecipe.imageBase64 && (
              <img src={`data:${selectedRecipe.imageType};base64,${selectedRecipe.imageBase64}`} loading="lazy" alt="Ansicht" className="w-full max-h-[500px] object-cover rounded-2xl shadow-sm" />
            )}

            <div className="prose prose-gray max-w-none print:font-sans print:text-black print:prose-p:leading-relaxed print:prose-headings:text-black">
              <ReactMarkdown>{selectedRecipe.markdownContent}</ReactMarkdown>
            </div>

            {selectedRecipe.pdfBase64 && (
              <div className="pt-8 border-t border-gray-100 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div>
                    <h3 className="font-semibold text-text-main">PDF Dokument</h3>
                    <p className="text-sm text-gray-500">Für dich hinterlegt</p>
                  </div>
                </div>
                <Button onClick={() => handleOpenPdf(selectedRecipe)}>
                  <Download className="w-4 h-4 mr-2" />
                  PDF Öffnen
                </Button>
              </div>
            )}

            {/* Branded Print Footer */}
            <div className="hidden print:block fixed bottom-0 left-0 right-0 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 font-sans mt-12 bg-white">
              <p>&copy; {new Date().getFullYear()} Praxis Sager &middot; www.praxissager.ch &middot; Alle Inhalte sind urheberrechtlich geschützt.</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const daysLeft = expirationDate ? Math.ceil((expirationDate - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return (
      <div className="min-h-screen bg-background pt-[320px] pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="text-3xl font-bold text-text-main flex items-center gap-3">
              <Unlock className="w-8 h-8 text-primary" />
              Deine Dokumente
            </h1>
            <div className="flex items-center gap-4">
              {deferredPrompt && (
                <Button variant="secondary" onClick={handleInstallClick} className="hidden sm:flex text-sm">
                  <Smartphone className="w-4 h-4 mr-2" /> App installieren
                </Button>
              )}
              <Button variant="ghost" onClick={handleLogout}>Vom Gerät abmelden</Button>
            </div>
          </div>

          {daysLeft !== null && daysLeft > 7 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} 
              className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium inline-block"
            >
              Zugang aktiv
            </motion.div>
          )}
          {daysLeft !== null && daysLeft <= 3 && daysLeft >= 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} 
              className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-4 py-3 rounded-xl text-sm font-medium border border-orange-200 dark:border-orange-800"
            >
              Achtung: Dein Zugang läuft in {daysLeft} Tag{daysLeft !== 1 ? 'en' : ''} ab. Sichere dir wichtige Rezepte als PDF.
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative flex-grow w-full">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Rezepte durchsuchen..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                className="w-full h-12 pl-10 pr-4 bg-transparent border-b border-gray-200 focus:border-primary outline-none transition-colors"
              />
              {isSearchFocused && searchQuery && filteredRecipes.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden max-h-80 overflow-y-auto">
                  {filteredRecipes.slice(0, 5).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedRecipe(r); setSearchQuery(''); setIsSearchFocused(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-4 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {r.imageBase64 ? (
                        <img src={`data:${r.imageType};base64,${r.imageBase64}`} loading="lazy" className="w-12 h-12 object-cover rounded-md flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-md flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-text-main line-clamp-1">{highlightMatch(r.title, searchQuery)}</div>
                        <div className="text-xs text-gray-500">{r.categoryName}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors whitespace-nowrap ${showFavoritesOnly ? 'bg-primary/10 border-primary text-primary' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              Favoriten
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.length === 0 && (
              <p className="col-span-full text-gray-500 text-center py-12">Keine Dokumente gefunden.</p>
            )}
            {filteredRecipes.map(r => (
              <Card 
                key={r.id} 
                className="overflow-hidden p-0 cursor-pointer hover:shadow-md transition-shadow group flex flex-col relative"
                onClick={() => setSelectedRecipe(r)}
              >
                <button 
                  onClick={(e) => toggleFavorite(r.id, e)}
                  className="absolute top-3 right-3 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
                >
                  <Heart className={`w-5 h-5 transition-colors ${favorites.includes(r.id) ? 'fill-[#88A388] text-[#88A388]' : 'text-gray-400'}`} />
                </button>
                <div className="h-48 bg-gray-100 relative">
                  {r.imageBase64 ? (
                    <img src={`data:${r.imageType};base64,${r.imageBase64}`} loading="lazy" alt={r.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    {r.categoryName}
                  </span>
                  <h3 className="text-lg font-bold text-text-main mb-2">{r.title}</h3>
                  <div className="mt-auto pt-4 flex gap-2 text-gray-400">
                    {r.pdfBase64 && <FileText className="w-4 h-4" />}
                    {r.markdownContent && <FileText className="w-4 h-4" />}
                  </div>
                </div>
              </Card>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // Login View
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-[320px] relative">
      <OnboardingTour key={tourKey} />
      
      <button 
        onClick={restartTour}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-white p-4 rounded-full shadow-lg border border-gray-100 text-primary hover:bg-gray-50 transition-all hover:scale-105 z-40 group flex items-center gap-2"
        title="Hilfe & Anleitung starten"
      >
        <HelpCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[120px] transition-all duration-300 ease-in-out font-medium text-sm">
          Hilfe starten
        </span>
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-text-main flex items-center justify-center gap-3 mb-2">
          <Lock className="w-8 h-8 text-primary" />
          Patienten-Login
        </h1>
        <p className="text-gray-500">Bitte lade deine .therapie Datei hoch.</p>
      </div>

      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="space-y-4">
          
          <div id="upload-zone" className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
            <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            {importFile ? (
              <span className="text-sm font-medium text-primary">{importFile.name}</span>
            ) : (
              <span className="text-sm text-gray-500">Datei hier ablegen oder klicken</span>
            )}
            <input 
              type="file" 
              accept=".therapie,.tsafe" 
              onChange={e => setImportFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <Input 
            id="password-input"
            type="password"
            placeholder="Passwort eingeben..." 

            value={password} 
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="text-center text-lg tracking-widest"
          />

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          
          <Button id="unlock-btn" onClick={handleLogin} isLoading={isLoading} className="w-full text-lg h-14">
            <Unlock className="w-5 h-5 mr-2" />
            Dokumente entsperren
          </Button>

        </div>
      </Card>
    </div>
  );
}
