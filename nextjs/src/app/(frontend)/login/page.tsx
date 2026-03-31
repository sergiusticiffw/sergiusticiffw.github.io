import React, { Suspense } from 'react'

import { LoginClient } from './ui'

export default function LoginPage() {
  return (
    <div className="max-w-xl mx-auto px-4 pt-10 pb-10">
      <Suspense>
        <LoginClient />
      </Suspense>
    </div>
  )
}

