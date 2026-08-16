'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AjustesPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/ajustes/usuarios')
  }, [router])

  return null
}
