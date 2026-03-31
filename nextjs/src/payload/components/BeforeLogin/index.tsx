import React from 'react'

const BeforeLogin: React.FC = () => {
  return (
    <div>
      <p>
        <b>Welcome to your dashboard!</b>
        {' This is where site admins will log in to manage your website.'}
      </p>
      <p className="mt-2 text-sm text-white/60">
        If you&apos;re a regular user, you&apos;ll be redirected to the Loans app after signing in.
      </p>
    </div>
  )
}

export default BeforeLogin
