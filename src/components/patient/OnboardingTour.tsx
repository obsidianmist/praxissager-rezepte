import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../common/Button';

interface Step {
  targetId: string | null;
  content: React.ReactNode;
  position: 'top' | 'bottom' | 'center';
}

const steps: Step[] = [
  {
    targetId: null,
    content: (
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2">Willkommen bei Praxis Sager</h3>
        <p>Wir führen dich kurz durch das Login-Verfahren.</p>
      </div>
    ),
    position: 'center'
  },
  {
    targetId: 'upload-zone',
    content: 'Hier lädst du deine Rezept-Datei hoch, die du von mir erhalten hast.',
    position: 'bottom'
  },
  {
    targetId: 'password-input',
    content: 'Gib hier dein persönliches Passwort ein.',
    position: 'bottom'
  },
  {
    targetId: 'unlock-btn',
    content: 'Klicke auf Freischalten, um deine individuellen Rezepte zu sehen.',
    position: 'top'
  }
];

export function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const isCompleted = localStorage.getItem('onboardingCompleted') === 'true';
    if (isCompleted) {
      setCompleted(true);
      return;
    }

    const updatePosition = () => {
      const targetId = steps[currentStep].targetId;
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        }
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [currentStep]);

  if (completed) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      localStorage.setItem('onboardingCompleted', 'true');
      setCompleted(true);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setCompleted(true);
  };

  const step = steps[currentStep];

  // Calculate overlay position based on target rect
  let popupStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 9999
  };

  if (targetRect && step.position !== 'center') {
    if (step.position === 'bottom') {
      popupStyle = {
        position: 'fixed',
        top: targetRect.bottom + 20,
        left: targetRect.left + targetRect.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 9999
      };
    } else if (step.position === 'top') {
      popupStyle = {
        position: 'fixed',
        top: targetRect.top - 20,
        left: targetRect.left + targetRect.width / 2,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999
      };
    }
  }

  return (
    <AnimatePresence>
      {!completed && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[9998]"
            onClick={handleNext}
          />
          
          {/* Highlight ring for target element */}
          {targetRect && step.targetId && (
            <motion.div
              layout
              className="fixed border-2 border-primary rounded-xl z-[9999] pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: 1,
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}

          {/* Tooltip Popup */}
          <motion.div
            key={currentStep}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={popupStyle}
            className="bg-white p-6 rounded-2xl shadow-2xl w-[90%] max-w-sm"
          >
            {/* Bouncing Arrow */}
            {targetRect && (
              <motion.div 
                className={`absolute left-1/2 -ml-3 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent ${step.position === 'bottom' ? 'border-b-[12px] border-b-white -top-3' : 'border-t-[12px] border-t-white -bottom-3'}`}
                animate={{ y: step.position === 'bottom' ? [-5, 0, -5] : [5, 0, 5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}

            <div className="text-gray-800 text-center text-lg mb-6 leading-relaxed">
              {step.content}
            </div>

            <div className="flex justify-between items-center">
              <button 
                onClick={handleSkip} 
                className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
              >
                Überspringen
              </button>
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? 'Starten' : 'Weiter'}
              </Button>
            </div>
            
            {/* Step Indicators */}
            <div className="flex justify-center gap-1.5 mt-4">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-2 h-2 rounded-full transition-colors ${idx === currentStep ? 'bg-primary' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
