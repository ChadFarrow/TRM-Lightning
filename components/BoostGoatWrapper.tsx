'use client'

import dynamic from 'next/dynamic'

const BoostGoat = dynamic(() => import('@/components/BoostGoat'), { ssr: false })

export default function BoostGoatWrapper() {
  return <BoostGoat />
}
