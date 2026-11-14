import { Navigate } from 'react-router-dom'

/** Vecchia pagina "Altro": dalla 0.10 le sezioni sono divise in aree. Resta solo per compatibilità. */
export default function Moduli() {
  return <Navigate to="/" replace />
}
