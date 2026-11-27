import type { Metadata } from 'next'
import EncuestaPuenteClient from './EncuestaPuenteClient'

export const metadata: Metadata = {
  title: 'Encuesta de Satisfacción | Centrovisión',
  description: 'Tu opinión nos ayuda a mejorar la atención médica.',
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'Encuesta de Satisfacción',
    description: 'Contanos brevemente cómo fue tu experiencia en la clínica.',
    type: 'website',
  },
}

export default function EncuestaPublicaPage({
  params,
}: {
  params: { token: string }
}) {
  return <EncuestaPuenteClient token={params.token} />
}
