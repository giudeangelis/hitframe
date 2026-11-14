import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import Calendario from './pages/Calendario'
import Diario from './pages/Diario'
import Home from './pages/Home'
import Impostazioni from './pages/Impostazioni'
import Profilo from './pages/Profilo'
import Allenamento from './pages/Allenamento'
import DrillDettaglio from './pages/DrillDettaglio'
import Timer from './pages/Timer'
import Sessioni from './pages/Sessioni'
import Gare from './pages/Gare'
import Munizioni from './pages/Munizioni'
import RicettaDettaglio from './pages/RicettaDettaglio'
import Attrezzatura, { ArmaDettaglio } from './pages/Attrezzatura'

// Il modulo Analisi gara (con pdf.js) si carica solo quando lo apri
const AnalisiGare = lazy(() => import('./pages/AnalisiGare'))
const AnalisiDettaglio = lazy(() => import('./pages/AnalisiDettaglio'))
const StudioStage = lazy(() => import('./pages/StudioStage'))
const Risultati = lazy(() => import('./pages/Risultati'))
const Statistiche = lazy(() => import('./pages/Statistiche'))
const StageDesigner = lazy(() => import('./pages/StageDesigner'))
const RisultatoDettaglio = lazy(() => import('./pages/RisultatoDettaglio'))

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
            <Route path="allenamento" element={<Allenamento />} />
            <Route path="allenamento/:id" element={<DrillDettaglio />} />
            <Route path="timer" element={<Timer />} />
            <Route path="sessioni" element={<Sessioni />} />
            <Route path="gare" element={<Gare />} />
            <Route path="stage-designer" element={<Suspense fallback={<div className="page" />}><StageDesigner /></Suspense>} />
            <Route path="stage-designer/:id" element={<Suspense fallback={<div className="page" />}><StageDesigner /></Suspense>} />
            <Route path="statistiche" element={<Suspense fallback={<div className="page" />}><Statistiche /></Suspense>} />
            <Route path="risultati" element={<Suspense fallback={<div className="page" />}><Risultati /></Suspense>} />
            <Route path="risultati/:id" element={<Suspense fallback={<div className="page" />}><RisultatoDettaglio /></Suspense>} />
            <Route path="munizioni" element={<Munizioni />} />
            <Route path="munizioni/ricetta/:id" element={<RicettaDettaglio />} />
            <Route path="attrezzatura" element={<Attrezzatura />} />
            <Route path="attrezzatura/:id" element={<ArmaDettaglio />} />
            <Route path="analisi-gara" element={<Suspense fallback={<div className="page" />}><AnalisiGare /></Suspense>} />
            <Route path="analisi-gara/:id" element={<Suspense fallback={<div className="page" />}><AnalisiDettaglio /></Suspense>} />
            <Route path="analisi-gara/:id/stage/:n" element={<Suspense fallback={<div className="page" />}><StudioStage /></Suspense>} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </ToastProvider>
  )
}
