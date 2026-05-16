import { useState } from 'react';
import { Button } from './Button';

interface ProtectedPdfViewerProps {
  pdfUrl: string;
  onClose: () => void;
  isAdminPreview?: boolean;
}

export function ProtectedPdfViewer({ pdfUrl, onClose, isAdminPreview = false }: ProtectedPdfViewerProps) {
  const [opacity, setOpacity] = useState(15);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-2 md:p-8" 
      onContextMenu={e => e.preventDefault()}
    >
      {/* Admin Vorschau Banner */}
      {isAdminPreview && (
        <div className="w-full max-w-5xl bg-yellow-400 text-yellow-900 px-4 py-3 rounded-t-2xl font-medium flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>⚠️ Vorschau-Modus: So sieht Ihr Patient dieses Dokument</span>
          </div>
          <div className="flex items-center gap-3 bg-white/50 px-3 py-1.5 rounded-lg text-sm">
            <label className="font-semibold" htmlFor="opacity-slider">Wasserzeichen-Deckkraft:</label>
            <input 
              id="opacity-slider"
              type="range" 
              min="5" 
              max="30" 
              value={opacity} 
              onChange={(e) => setOpacity(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="w-8 text-right">{opacity}%</span>
          </div>
        </div>
      )}

      <div className={`bg-white w-full max-w-5xl h-full flex flex-col relative overflow-hidden ${isAdminPreview ? 'rounded-b-2xl' : 'rounded-2xl'}`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-4">
            {isAdminPreview && (
              <img src="/image_062b03.png" alt="Praxis Sager" className="h-8 object-contain" />
            )}
            <h2 className="text-xl font-bold text-text-main">PDF Ansicht</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>Schließen</Button>
        </div>
        
        <div className="flex-grow relative bg-gray-200 overflow-hidden">
          {/* PDF Container */}
          <iframe 
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`} 
            className="w-full h-full"
            title="PDF Ansicht"
          />
          
          {/* Overlay for Copy Protection & Watermark */}
          {/* The overlay is full width but pointer-events-none to allow scrolling, OR pointer-events-auto but right 20px open for scrollbar.
              Given touch devices, pointer-events-none is safer for scrolling, but we add a transparent blocker that covers most to deter selection. */}
          <div 
            className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-end"
            style={{ userSelect: 'none' }}
          >
            {/* Transparent click blocker covering 95% width to prevent selection, leaving 5% for scrollbar */}
            <div 
              className="absolute top-0 left-0 bottom-0 w-[95%] pointer-events-auto opacity-0"
              onContextMenu={e => e.preventDefault()}
            />

            {/* Watermark */}
            <div className="sticky bottom-6 w-full text-center pb-4 z-20 pointer-events-none">
              <span 
                className="inline-block px-4 py-2 bg-white/30 backdrop-blur-[1px] rounded-full"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '9px',
                  opacity: opacity / 100,
                  color: '#000',
                  userSelect: 'none'
                }}
              >
                © Praxis Katrin Sager – Nur zur persönlichen Verwendung
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
