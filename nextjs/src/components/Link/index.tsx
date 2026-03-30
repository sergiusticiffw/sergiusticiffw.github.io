import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: string
    // `payload-types.ts` may vary depending on which collections are enabled.
    // We only need enough information to build an href.
    value: unknown
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href =
    type === 'reference' && reference
      ? (() => {
          const { relationTo, value } = reference
          if (value && typeof value === 'object') {
            const maybeSlug = (value as { slug?: unknown }).slug
            const maybeId = (value as { id?: unknown }).id

            if (typeof maybeSlug === 'string' && maybeSlug.length > 0) return `/${relationTo}/${maybeSlug}`
            if (typeof maybeId === 'string' && maybeId.length > 0) return `/${relationTo}/${maybeId}`
          }

          if (typeof value === 'string' || typeof value === 'number') {
            return `/${relationTo}/${value}`
          }

          return undefined
        })()
      : url

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={href || url || ''} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
