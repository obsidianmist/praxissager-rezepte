import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type LegalType = 'impressum' | 'datenschutz' | 'urheberrecht' | null;

export function LegalFooter() {
  const [openModal, setOpenModal] = useState<LegalType>(null);

  const closeModal = () => setOpenModal(null);

  const getModalContent = () => {
    switch (openModal) {
      case 'impressum':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-main mb-4">Impressum</h2>
            <p><strong>Herausgeberin:</strong></p>
            <p>
              Katrin Sager<br />
              Herbrigsteig 1<br />
              9042 Speicher<br />
              077 436 56 11<br />
              <a href="mailto:praxis.sager@hotmail.com" className="text-primary hover:underline">praxis.sager@hotmail.com</a><br />
              <a href="https://www.praxissager.ch" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.praxissager.ch</a>
            </p>
            <h3 className="font-semibold text-text-main mt-6">Aufsichtsbehörde & Berufsbezeichnung:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Berufsbezeichnung:</strong> Naturheilpraktikerin TEN</li>
              <li><strong>Verliehen in:</strong> Schweiz</li>
              <li><strong>Zuständige kantonale Behörde:</strong> Gesundheitsdepartement Appenzell Ausserrhoden</li>
            </ul>
          </div>
        );
      case 'datenschutz':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-main mb-4">Datenschutzerklärung</h2>
            <p>Diese Applikation arbeitet 100% lokal. Es werden keine Daten an Server übertragen. Alle Rezepte sind lokal verschlüsselt. Wir nutzen kein Tracking und keine Cookies.</p>
            
            <h3 className="font-semibold text-text-main mt-6">Im Detail (Local-Only App):</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Keine Datenübertragung:</strong> Es werden keinerlei personenbezogene Daten an einen Server oder Dritte übertragen. Sämtliche Eingaben verbleiben lokal in Ihrem Browser-Cache (IndexedDB).</li>
              <li><strong>Lokale Verschlüsselung:</strong> Die Inhalte sind durch die von der Therapeutin vergebenen Passwörter lokal verschlüsselt (AES-GCM Standard).</li>
              <li><strong>Kein Tracking:</strong> Wir verwenden keine Cookies, kein Google Analytics und keine anderen Tracking-Tools.</li>
              <li><strong>Verantwortung:</strong> Da die Daten lokal auf Ihrem Gerät gespeichert sind, liegt die Sicherheit Ihres Geräts (z.B. Bildschirmsperre) in Ihrer Verantwortung.</li>
            </ul>
          </div>
        );
      case 'urheberrecht':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-text-main mb-4">Urheberrechtshinweis</h2>
            <p>Alle Inhalte sind urheberrechtlich geschützt. Das geistige Eigentum liegt bei der Therapeutin. Nutzung nur für private Zwecke gestattet.</p>
            <p className="mt-4">
              Sämtliche in dieser App bereitgestellten Rezepte, Bilder und Therapieanweisungen sind urheberrechtlich geschützt. Das geistige Eigentum liegt bei Katrin Sager. Die Inhalte sind ausschliesslich für den persönlichen Gebrauch im Rahmen der Behandlung bestimmt. Eine Vervielfältigung, Weitergabe an Dritte oder kommerzielle Nutzung ist ohne schriftliche Genehmigung untersagt.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Sticky Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 px-6 flex justify-center gap-6 z-40 print:hidden text-xs" style={{ color: '#888888' }}>
        <button onClick={() => setOpenModal('impressum')} className="hover:text-gray-600 transition-colors">Impressum</button>
        <button onClick={() => setOpenModal('datenschutz')} className="hover:text-gray-600 transition-colors">Datenschutz</button>
        <button onClick={() => setOpenModal('urheberrecht')} className="hover:text-gray-600 transition-colors">Urheberrecht</button>
      </footer>

      {/* Modal Overlay */}
      <AnimatePresence>
        {openModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#FAFAF9] rounded-2xl shadow-2xl p-8 max-h-[85vh] overflow-y-auto"
            >
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                Schliessen
              </button>
              
              <div className="text-gray-600 leading-relaxed text-sm">
                {getModalContent()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
