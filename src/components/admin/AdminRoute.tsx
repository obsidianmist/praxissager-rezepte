import { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ShieldCheck } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    // Festes Master-Passwort für die Therapeutin
    if (password === 'Praxis2026') { 
      sessionStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Falsches Passwort');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-text-main flex items-center justify-center gap-3 mb-2">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Admin-Bereich
        </h1>
        <p className="text-gray-500">Bitte gib das Master-Passwort ein.</p>
      </div>

      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="space-y-4">
          <Input 
            type="password"
            placeholder="Passwort..." 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <Button onClick={handleLogin} className="w-full text-lg h-14">
            Anmelden
          </Button>
        </div>
      </Card>
    </div>
  );
}
