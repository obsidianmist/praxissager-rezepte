import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TherapistDashboard } from './pages/TherapistDashboard';
import { PatientPortal } from './pages/PatientPortal';

import { AdminRoute } from './components/admin/AdminRoute';
import { LegalFooter } from './components/common/LegalFooter';
import { GlobalHeader } from './components/common/GlobalHeader';

function App() {
  return (
    <Router>
      <GlobalHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/patient" replace />} />
        <Route path="/patient" element={<PatientPortal />} />
        <Route path="/admin" element={
          <AdminRoute>
            <TherapistDashboard />
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/patient" replace />} />
      </Routes>
      <LegalFooter />
    </Router>
  );
}

export default App;
