import { useState, useEffect } from 'react';
import { ExternalLink, Moon, Sun, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminArea = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    window.location.reload();
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return (
    <header 
      className={`fixed top-0 left-0 right-0 w-full flex items-center justify-between z-50 print:hidden transition-all duration-300 ease-in-out ${
        isScrolled 
          ? 'py-3 px-6 md:px-8 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-gray-800' 
          : 'py-6 px-6 md:px-12 bg-transparent'
      }`}
    >
      <div className="flex-shrink-0">
        <img 
          src="/image_062b03.png" 
          alt="Praxis Sager Logo" 
          className={`object-contain transition-all duration-300 ease-in-out origin-left ${
            isScrolled ? 'h-16 md:h-20' : 'h-[200px] md:h-[240px]'
          }`}
        />
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative w-10 h-10 flex items-center justify-center text-primary"
          aria-label="Theme umschalten"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.div
                key="moon"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                <Moon className="w-5 h-5 fill-current" />
              </motion.div>
            ) : (
              <motion.div
                key="sun"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                <Sun className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
        {isAdminArea && (
          <Button 
            variant="ghost" 
            onClick={handleLogout} 
            className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 hidden sm:flex"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        )}
        <a 
          href="https://www.praxissager.ch/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center"
        >
          <Button variant="secondary" className="text-sm border-primary/20 hover:border-primary/50 text-primary bg-primary/5 hover:bg-primary/10">
            Zur Praxishomepage
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </a>
      </div>
    </header>
  );
}
