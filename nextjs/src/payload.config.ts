import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'
import { OAuth2Plugin } from 'payload-oauth2'

import { Users } from './payload/collections/collections/Users'
import { Loans } from './payload/collections/collections/Loans'
import { Payments } from './payload/collections/collections/Payments'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = getServerSideURL()

function safeRedirectFromState(state: string | null | undefined) {
  if (!state) return '/'
  if (state.startsWith('/') && !state.startsWith('//')) return state
  return '/'
}

const googleOAuth = OAuth2Plugin({
  enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  strategyName: 'google',
  useEmailAsIdentity: true,
  serverURL,
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  authorizePath: '/oauth/google',
  callbackPath: '/oauth/google/callback',
  authCollection: 'users',
  onUserNotFoundBehavior: 'create',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  scopes: ['openid', 'email', 'profile'],
  providerAuthorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  getUserInfo: async (accessToken, _req) => {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const user = await response.json()
    return { email: user.email, sub: user.sub, name: user.name }
  },
  successRedirect: (req) => safeRedirectFromState(req.searchParams.get('state')),
  failureRedirect: () => '/login?error=oauth_failed',
})

const githubOAuth = OAuth2Plugin({
  enabled: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  strategyName: 'github',
  useEmailAsIdentity: true,
  serverURL,
  clientId: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  authorizePath: '/oauth/github',
  callbackPath: '/oauth/github/callback',
  authCollection: 'users',
  onUserNotFoundBehavior: 'create',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  scopes: ['user:email'],
  providerAuthorizationUrl: 'https://github.com/login/oauth/authorize',
  getUserInfo: async (accessToken) => {
    const meRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    })
    const me = await meRes.json()

    // Email can be null depending on privacy settings; fetch emails list.
    let email: string | undefined = me?.email ?? undefined
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      })
      const emails = await emailsRes.json()
      const primary = Array.isArray(emails) ? emails.find((e) => e?.primary) : null
      email = primary?.email ?? (Array.isArray(emails) ? emails[0]?.email : undefined)
    }

    return { email, sub: String(me?.id ?? ''), name: me?.name ?? me?.login }
  },
  successRedirect: (req) => safeRedirectFromState(req.searchParams.get('state')),
  failureRedirect: () => '/login?error=oauth_failed',
})

// NOTE: Facebook/LinkedIn configs can vary by app permissions. We include defaults behind env flags.
const facebookOAuth = OAuth2Plugin({
  enabled: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
  strategyName: 'facebook',
  useEmailAsIdentity: true,
  serverURL,
  clientId: process.env.FACEBOOK_CLIENT_ID || '',
  clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  authorizePath: '/oauth/facebook',
  callbackPath: '/oauth/facebook/callback',
  authCollection: 'users',
  onUserNotFoundBehavior: 'create',
  tokenEndpoint: 'https://graph.facebook.com/v19.0/oauth/access_token',
  scopes: ['email', 'public_profile'],
  providerAuthorizationUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
  getUserInfo: async (accessToken) => {
    const res = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    )
    const user = await res.json()
    return { email: user.email, sub: String(user.id ?? ''), name: user.name }
  },
  successRedirect: (req) => safeRedirectFromState(req.searchParams.get('state')),
  failureRedirect: () => '/login?error=oauth_failed',
})

const linkedinOAuth = OAuth2Plugin({
  enabled: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  strategyName: 'linkedin',
  useEmailAsIdentity: true,
  serverURL,
  clientId: process.env.LINKEDIN_CLIENT_ID || '',
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  authorizePath: '/oauth/linkedin',
  callbackPath: '/oauth/linkedin/callback',
  authCollection: 'users',
  onUserNotFoundBehavior: 'create',
  tokenEndpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
  scopes: ['openid', 'profile', 'email'],
  providerAuthorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  getUserInfo: async (accessToken) => {
    // LinkedIn OIDC userinfo
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const user = await res.json()
    return { email: user.email, sub: String(user.sub ?? ''), name: user.name }
  },
  successRedirect: (req) => safeRedirectFromState(req.searchParams.get('state')),
  failureRedirect: () => '/login?error=oauth_failed',
})

const microsoftTenant = process.env.MICROSOFT_TENANT_ID || 'common'

const microsoftOAuth = OAuth2Plugin({
  enabled: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
  strategyName: 'microsoft',
  useEmailAsIdentity: true,
  serverURL,
  clientId: process.env.MICROSOFT_CLIENT_ID || '',
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  authorizePath: '/oauth/microsoft',
  callbackPath: '/oauth/microsoft/callback',
  authCollection: 'users',
  onUserNotFoundBehavior: 'create',
  tokenEndpoint: `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/token`,
  providerAuthorizationUrl: `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/authorize`,
  scopes: ['openid', 'profile', 'email', 'offline_access'],
  getUserInfo: async (accessToken) => {
    // OIDC userinfo via Microsoft Graph
    const res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const user = await res.json()
    return {
      email: user.email ?? user.preferred_username,
      sub: String(user.sub ?? ''),
      name: user.name,
    }
  },
  successRedirect: (req) => safeRedirectFromState(req.searchParams.get('state')),
  failureRedirect: () => '/login?error=oauth_failed',
})

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/payload/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/payload/components/BeforeDashboard'],
      beforeNavLinks: ['@/payload/components/LoansAppLink'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
    },
  }),
  collections: [Users, Loans, Payments],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [],
  plugins: [googleOAuth, githubOAuth, facebookOAuth, linkedinOAuth, microsoftOAuth, ...plugins],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
