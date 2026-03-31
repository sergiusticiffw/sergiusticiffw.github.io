/* eslint-disable react/no-danger */
'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to your dashboard!</h4>
      </Banner>
      <div className="mt-4 mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-[11px] uppercase tracking-widest text-white/60">Quick access</div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <a
            className="rounded-2xl bg-[var(--color-app-accent,#3b82f6)] px-4 py-2 text-sm font-medium hover:opacity-90 transition"
            href="/loans"
          >
            Go to Loans
          </a>
          <a
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            href="/admin/collections/loans"
          >
            Loans (Admin)
          </a>
          <a
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
            href="/admin/collections/payments"
          >
            Payments (Admin)
          </a>
        </div>
      </div>
      Here&apos;s what to do next:
      <ul className={`${baseClass}__instructions`}>
        <li>
          <SeedButton />
          {' with a few pages, posts, and projects to jump-start your new site, then '}
          <a href="/" target="_blank">
            visit your website
          </a>
          {' to see the results.'}
        </li>
        <li>
          {'Modify your '}
          <a
            href="https://payloadcms.com/docs/configuration/collections"
            rel="noopener noreferrer"
            target="_blank"
          >
            collections
          </a>
          {' and add more '}
          <a
            href="https://payloadcms.com/docs/fields/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            fields
          </a>
          {' as needed. If you are new to Payload, we also recommend you check out the '}
          <a
            href="https://payloadcms.com/docs/getting-started/what-is-payload"
            rel="noopener noreferrer"
            target="_blank"
          >
            Getting Started
          </a>
          {' docs.'}
        </li>
        <li>
          Commit and push your changes to the repository to trigger a redeployment of your project.
        </li>
      </ul>
      {'Pro Tip: This block is a '}
      <a
        href="https://payloadcms.com/docs/custom-components/overview"
        rel="noopener noreferrer"
        target="_blank"
      >
        custom component
      </a>
      , you can remove it at any time by updating your <strong>payload.config</strong>.
    </div>
  )
}

export default BeforeDashboard
