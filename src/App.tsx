import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import { MODULI_FUTURI } from './modules'
import Calendario from './pages/Calendario'
import Diario from './pages/Diario'
import Home from './pages/Home'
import Impostazioni from './pages/Impostazioni'
import InArrivo from './pages/InArrivo'
import Moduli from './pages/Moduli'
import Profilo from './pages/Profilo'
import Allenamento from './pages/Allenamento'
import DrillDettaglio from './pages/DrillDettaglio'
import Timer from './pages/Timer'

// Il modulo Analisi gara (con pdf.js) si carica solo quando lo apri
const AnalisiGare = lazy(() => import('./pages/AnalisiGare'))
const AnalisiDettaglio = lazy(() => import('./pages/AnalisiDettaglio'))
const StudioStage = lazy(() => import('./pages/StudioStage'))

// HashRouter: funziona offline e su GitHub Pages senza configurazioni del server
export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="diario" element={<Diario />} />
            <Route path="profilo" element={<Profilo />} />
            <Route path="impostazioni" element={<Impostazioni />} />
            <Route path="moduli" element={<Moduli />} />
            <Route path="allenamento" element={<Allenamento />} />
            <Route path="allenamento/:id" element={<DrillDettaglio />} />
            <Route path="timer" element={<Timer />} />
            <Route path="analisi-gara" element={<Suspense fallback={<div className="page" />}><AnalisiGare /></Suspense>} />
            <Route path="analisi-gara/:id" element={<Suspense fallback={<div className="page" />}><AnalisiDettaglio /></Suspense>} />
            <Route path="analisi-gara/:id/stage/:n" element={<Suspense fallback={<div className="page" />}><StudioStage /></Suspense>} />
            {MODULI_FUTURI.map((m) => (
              <Route key={m.path} path={m.path.slice(1)} element={<InArrivo modulo={m} />} />
            ))}
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
