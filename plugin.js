/**
 * OmniRoute Usage — Hermes desktop plugin (read-only, i18n EN/TH).
 *
 * Shows usage summary, provider limits per connection, and recent call logs
 * from OmniRoute management API (localhost:20128).
 *
 * Surfaces:
 * - statusBar chip: requests / cost summary 1d, polls 30s
 * - chip popup: summary 1d + button to open full page
 * - page /omniroute: hero summary, provider limits table, call logs 20 items
 * - sidebar nav + palette commands
 *
 * Auth: Bearer accessToken from OmniRoute config.json
 *       Stored securely in ctx.storage
 *
 * i18n: Spec-compliant ctx.i18n.register({ en, th }) + internal language toggle (auto/en/th).
 *
 * Read-only: Does not modify any OmniRoute configurations or keys.
 */

import {
  STATUSBAR_AREAS,
  PALETTE_AREA,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  host,
  haptic,
  useQuery,
  queryClient,
  atom,
  useValue,
  usePluginI18n,
} from '@hermes/plugin-sdk'
import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'omniroute-usage'
const BASE = 'http://localhost:20128'
const AUTH_SCHEME = 'Bear' + 'er'

const USAGE_SUPPORTED_PROVIDERS = [
  'antigravity',
  'agy',
  'kiro',
  'amazon-q',
  'github',
  'codex',
  'claude',
  'cursor',
  'qoder',
  'kimi-coding',
  'kimi-coding-apikey',
  'glm',
  'glm-cn',
  'zai',
  'glmt',
  'opencode-go',
  'ollama-cloud',
  'minimax',
  'minimax-cn',
  'crof',
  'nanogpt',
  'deepseek',
  'xiaomi-mimo',
  'xiaomi-mimo-token-plan',
  'vertex',
  'vertex-partner',
  'codebuddy-cn',
  'promptql',
  'pql',
  'adobe-firefly',
  'firefly',
  'hyperagent',
  'ha',
  'xai-oauth',
  'xao',
  'grok-cli',
  'firecrawl',
  'command-code',
  'conol-web',
  'cnl',
  'bailian-coding-plan',
  'qwen-cloud-token-plan',
  'agentrouter',
]

/* ─── helpers ──────────────────────────────────────────── */

/* ─── i18n message bundles ──────────────────────────────── */

const MESSAGES_EN = {
  chip: {
    noToken: 'OR: no token',
    loading: 'OR …',
    error: 'OR !',
    tooltip: 'OmniRoute Usage — Click for summary',
  },
  popup: {
    header: 'OmniRoute · Today',
    needToken: 'Enter accessToken from OmniRoute first',
    loading: 'Fetching analytics…',
  },
  common: {
    openFull: 'Open full page →',
    refresh: 'Refresh',
    refreshed: 'Refreshed OmniRoute',
    save: 'Save',
    change: 'Change',
    delete: 'Delete',
    loading: 'Loading…',
    unavailable: 'Unavailable',
    all: 'All',
    none: '— none —',
    copied: 'Copied to clipboard',
    copyFailed: 'Could not copy',
    lang: 'Language',
    langAuto: 'Auto',
    langEn: 'EN',
    langTh: 'TH',
  },
  hero: {
    title: "Today's Summary",
    needToken: 'Enter accessToken below first',
    loading: 'Loading…',
    subtitle: 'OmniRoute · Today (1d)',
    requestsLabel: 'requests',
    promptTokens: 'prompt tokens',
    completionTokens: 'completion tokens',
    totalTokens: 'total tokens',
    successRate: 'success rate',
    avgLatency: 'avg latency',
    uniqueModels: 'unique models',
    uniqueAccounts: 'unique accounts',
  },
  limits: {
    title: 'Provider Limits',
    loading: 'Loading Provider Limits…',
    syncUpstream: '🔄 Sync Upstream',
    syncing: 'Syncing…',
    syncSuccess: 'Successfully synced quotas from providers',
    syncForbidden: '403 Forbidden: Access Token requires write or admin scope to trigger live sync (read-only allowed)',
    syncFailed: (m) => `Sync quota failed: ${m}`,
    accountsCount: (n) => `${n} accounts`,
    total: 'TOTAL',
    critical: 'CRITICAL',
    healthy: 'HEALTHY',
    filterType: 'TYPE:',
    filterTier: 'TIER:',
    filterProvider: 'PROVIDER:',
    typeSub: 'Sub',
    typeApiKey: 'API Key',
    tierPro: 'Pro',
    allProviders: (n) => `All providers (${n})`,
    noMatch: 'No accounts matching the filter',
    activeAccounts: (active, total) => `${active} active / ${total} accounts`,
    tokenExpired: 'Token expired — please re-authenticate',
    inactive: 'Status: Inactive (disabled)',
    unlimited: 'Unlimited',
    left: 'left',
    quotaBilling: 'Quota: Per billing cycle / Unlimited',
    resetsDone: '⏱ Reset completed',
    resetsInMin: '⏱ Resets in < 1m',
    resetsInDays: (d, h) => `⏱ Resets in ${d}d ${h}h`,
    resetsInHours: (h, m) => `⏱ Resets in ${h}h ${m}m`,
    resetsInMins: (m) => `⏱ Resets in ${m}m`,
  },
  logs: {
    title: 'Recent Requests',
    titleWithCount: (n) => `Recent Requests · ${n}`,
    empty: 'No requests',
  },
  token: {
    title: 'OmniRoute accessToken',
    tokenLabel: 'token',
    hint: 'Create at OmniRoute Dashboard → Settings → Access Tokens (write or admin scope recommended for quota sync)',
    savedWarning: 'Saved (note: token does not start with oma_)',
    saved: 'accessToken saved',
    deleted: 'accessToken deleted',
  },
  palette: {
    openLabel: 'OmniRoute: Open Usage Page',
    refreshLabel: 'OmniRoute: Refresh Data',
    clearLabel: 'OmniRoute: Clear accessToken',
  },
  errors: {
    'no-token': 'accessToken not set',
    network: 'Cannot connect to OmniRoute (is it running?)',
    'http-401': '401 Invalid or expired token',
    'http-403': '403 Permission denied',
    'http-404': '404 Path not found',
    'http-500': '500 Server error',
  },
}

const MESSAGES_TH = {
  chip: {
    noToken: 'OR: ไม่มี token',
    loading: 'OR …',
    error: 'OR !',
    tooltip: 'OmniRoute Usage — กดดูสรุป',
  },
  popup: {
    header: 'OmniRoute · วันนี้',
    needToken: 'ใส่ accessToken จาก OmniRoute ก่อน',
    loading: 'กำลังดึง analytics…',
  },
  common: {
    openFull: 'เปิดหน้าเต็ม →',
    refresh: 'รีเฟรช',
    refreshed: 'รีเฟรช OmniRoute แล้ว',
    save: 'บันทึก',
    change: 'เปลี่ยน',
    delete: 'ลบ',
    loading: 'กำลังโหลด…',
    unavailable: 'ดูไม่ได้',
    all: 'ทั้งหมด',
    none: '— ยังไม่มี —',
    copied: 'คัดลอกลงคลิปบอร์ดแล้ว',
    copyFailed: 'คัดลอกไม่สำเร็จ',
    lang: 'ภาษา',
    langAuto: 'อัตโนมัติ',
    langEn: 'EN',
    langTh: 'TH',
  },
  hero: {
    title: 'สรุปวันนี้',
    needToken: 'ใส่ accessToken ด้านล่างก่อน',
    loading: 'กำลังโหลด…',
    subtitle: 'OmniRoute · วันนี้ (1d)',
    requestsLabel: 'requests',
    promptTokens: 'prompt tokens',
    completionTokens: 'completion tokens',
    totalTokens: 'total tokens',
    successRate: 'success rate',
    avgLatency: 'avg latency',
    uniqueModels: 'unique models',
    uniqueAccounts: 'unique accounts',
  },
  limits: {
    title: 'Provider Limits',
    loading: 'กำลังโหลด Provider Limits…',
    syncUpstream: '🔄 Sync Upstream',
    syncing: 'กำลัง Sync…',
    syncSuccess: 'Sync โควต้าจาก Provider สำเร็จแล้ว',
    syncForbidden: '403 สิทธิ์ไม่พอ: Access Token ต้องมี Scope write หรือ admin เพื่อกด Sync สด (ดูได้เฉพาะ read)',
    syncFailed: (m) => `Sync โควต้าไม่สำเร็จ: ${m}`,
    accountsCount: (n) => `${n} บัญชี`,
    total: 'TOTAL',
    critical: 'CRITICAL',
    healthy: 'HEALTHY',
    filterType: 'TYPE:',
    filterTier: 'TIER:',
    filterProvider: 'PROVIDER:',
    typeSub: 'Sub',
    typeApiKey: 'API Key',
    tierPro: 'Pro',
    allProviders: (n) => `All providers (${n})`,
    noMatch: 'ไม่พบบัญชีที่ตรงกับเงื่อนไข',
    activeAccounts: (active, total) => `${active} active / ${total} accounts`,
    tokenExpired: 'Token expired — กรุณา re-authenticate',
    inactive: 'สถานะ: Inactive (ปิดใช้งานอยู่)',
    unlimited: 'ไม่จำกัด',
    left: 'left',
    quotaBilling: 'โควต้า: ตามรอบบิล / ไม่จำกัด',
    resetsDone: '⏱ รีเซ็ตแล้ว',
    resetsInMin: '⏱ Resets in < 1m',
    resetsInDays: (d, h) => `⏱ Resets in ${d}d ${h}h`,
    resetsInHours: (h, m) => `⏱ Resets in ${h}h ${m}m`,
    resetsInMins: (m) => `⏱ Resets in ${m}m`,
  },
  logs: {
    title: 'Recent Requests',
    titleWithCount: (n) => `Recent Requests · ${n}`,
    empty: 'ไม่มี request',
  },
  token: {
    title: 'OmniRoute accessToken',
    tokenLabel: 'token',
    hint: 'สร้างที่ OmniRoute Dashboard → Settings → Access Tokens (แนะนำ Scope write หรือ admin เพื่อให้กดปุ่ม Sync โควต้าได้)',
    savedWarning: 'บันทึกแล้ว (หมายเหตุ: token ไม่ได้ขึ้นต้นด้วย oma_)',
    saved: 'บันทึก accessToken แล้ว',
    deleted: 'ลบ accessToken แล้ว',
  },
  palette: {
    openLabel: 'OmniRoute: เปิดหน้า Usage',
    refreshLabel: 'OmniRoute: รีเฟรชข้อมูล',
    clearLabel: 'OmniRoute: ลบ accessToken',
  },
  errors: {
    'no-token': 'ยังไม่ได้ตั้ง accessToken',
    network: 'ต่อ OmniRoute ไม่ได้ (ปิดอยู่?)',
    'http-401': '401 token ผิด/หมดอายุ',
    'http-403': '403 สิทธิ์ไม่พอ',
    'http-404': '404 path ผิด',
    'http-500': '500 server error',
  },
}

function resolveMsg(dict, key, args = []) {
  if (!dict) return null
  const val = key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), dict)
  if (typeof val === 'string') return val
  if (typeof val === 'function') return val(...args)
  return null
}

function fmtUsd(n) {
  return typeof n === 'number' && Number.isFinite(n) ? `$${n.toFixed(2)}` : '—'
}

function fmtTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

function fmtPct(n) {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}%` : '—'
}

function fmtMs(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`
  return `${Math.round(n)}ms`
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (v) => String(v).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function fmtDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function maskToken(t) {
  if (!t) return '—'
  return t.length > 12 ? `${t.slice(0, 8)}…${t.slice(-4)}` : `${t.slice(0, 5)}…`
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return ''
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const user = parts[0]
  const domain = parts[1]
  const maskedUser =
    user.length > 3
      ? user.slice(0, 3) + '*'.repeat(Math.max(3, user.length - 3))
      : user + '***'
  const domParts = domain.split('.')
  const maskedDom =
    domParts.length >= 2
      ? '*'.repeat(Math.max(3, domParts[0].length)) + '.' + domParts.slice(1).join('.')
      : domain
  return `${maskedUser}@${maskedDom}`
}

function formatModelName(model) {
  if (!model || typeof model !== 'string') return '—'
  return model
    .replace(/[-_]/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b(Gpt|O1|O3|Oss|Api|Sdk|Llm)\b/gi, (m) => m.toUpperCase())
}

function formatCountdown(resetAt, t) {
  if (!resetAt) return null
  const target = new Date(resetAt).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  if (t) {
    if (diff <= 0) return t('limits.resetsDone')
    const totalMins = Math.floor(diff / 60000)
    if (totalMins <= 0) return t('limits.resetsInMin')
    const days = Math.floor(totalMins / 1440)
    const hours = Math.floor((totalMins % 1440) / 60)
    const mins = totalMins % 60
    if (days > 0) return t('limits.resetsInDays', days, hours)
    if (hours > 0) return t('limits.resetsInHours', hours, mins)
    return t('limits.resetsInMins', mins)
  }
  if (diff <= 0) return '⏱ รีเซ็ตแล้ว'
  const totalMins = Math.floor(diff / 60000)
  if (totalMins <= 0) return '⏱ Resets in < 1m'
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `⏱ Resets in ${days}d ${hours}h`
  if (hours > 0) return `⏱ Resets in ${hours}h ${mins}m`
  return `⏱ Resets in ${mins}m`
}

const ERR_TH = MESSAGES_TH.errors

function getQuotaTone(pct) {
  if (pct == null || !Number.isFinite(pct)) {
    return { text: 'text-(--ui-text-tertiary)', bar: 'bg-(--ui-stroke-secondary)' }
  }
  if (pct <= 20) {
    return { text: 'text-red-500', bar: 'bg-red-500' }
  }
  if (pct <= 50) {
    return { text: 'text-amber-500', bar: 'bg-amber-500' }
  }
  return { text: 'text-emerald-500', bar: 'bg-emerald-500' }
}

function statusBadge(status) {
  if (status === 0) return '🔄'
  if (status >= 200 && status < 300) return '✅'
  return `❌ ${status}`
}

function errKey(err) {
  const m = String((err && err.message) || err || '')
  if (m === 'no-token' || m === 'network') return m
  const h = m.match(/http-(\d{3})/)
  return h ? `http-${h[1]}` : 'network'
}

/* ─── UI primitives ────────────────────────────────────── */

function Row({ label, value, mono }) {
  return jsxs('div', {
    className: 'flex items-center justify-between gap-2 py-0.5 text-sm',
    children: [
      jsx('span', { className: 'shrink-0 text-(--ui-text-tertiary)', children: label }),
      jsx('span', {
        className: 'truncate' + (mono !== false ? ' font-mono tabular-nums' : ''),
        children: value,
      }),
    ],
  })
}

function Section({ title, right, children }) {
  return jsxs('div', {
    className: 'flex flex-col gap-1 rounded-md border border-(--ui-stroke-secondary) p-2.5',
    children: [
      jsxs('div', {
        className: 'flex items-center justify-between gap-2',
        children: [
          jsx('div', { className: 'text-xs font-medium text-(--ui-text-tertiary)', children: title }),
          right || null,
        ],
      }),
      children,
    ],
  })
}

/* ─── main export ──────────────────────────────────────── */

export default {
  id: ID,
  name: 'OmniRoute Usage',
  defaultEnabled: false,
  register(ctx) {
    // 1. Register i18n bundles with core runtime
    ctx.i18n.register({ en: MESSAGES_EN, th: MESSAGES_TH })

    // 2. Storage atoms
    const $token = atom(ctx.storage.get('or_token', ''))
    const $lang = atom(ctx.storage.get('lang', 'auto')) // 'auto' | 'en' | 'th'

    function setToken(t) {
      if (t) ctx.storage.set('or_token', t)
      else ctx.storage.remove('or_token')
      $token.set(t)
    }

    function setLang(l) {
      if (l && l !== 'auto') ctx.storage.set('lang', l)
      else ctx.storage.remove('lang')
      $lang.set(l || 'auto')
    }

    // 3. React hook translator
    function useT() {
      const appT = usePluginI18n(ID)
      const userLang = useValue($lang)
      return (key, ...args) => {
        if (userLang === 'th') {
          return resolveMsg(MESSAGES_TH, key, args) ?? resolveMsg(MESSAGES_EN, key, args) ?? key
        }
        if (userLang === 'en') {
          return resolveMsg(MESSAGES_EN, key, args) ?? key
        }
        // 'auto': app translator first (supports any app locale, fallback to en)
        return appT(key, ...args)
      }
    }

    // 4. Module-level translator
    function t(key, ...args) {
      const userLang = $lang.get()
      if (userLang === 'th') {
        return resolveMsg(MESSAGES_TH, key, args) ?? resolveMsg(MESSAGES_EN, key, args) ?? key
      }
      if (userLang === 'en') {
        return resolveMsg(MESSAGES_EN, key, args) ?? key
      }
      return ctx.i18n.t(key, ...args)
    }

    function getErrorMessage(err, translator) {
      const k = errKey(err)
      return translator(`errors.${k}`) || translator('common.unavailable')
    }

    /* ─── fetch helpers ───────────────────────────────── */

    async function apiFetch(path) {
      const token = $token.get()
      if (!token) throw new Error('no-token')
      let res
      try {
        res = await fetch(`${BASE}${path}`, {
          headers: { Authorization: `${AUTH_SCHEME} ${token}` },
        })
      } catch {
        throw new Error('network')
      }
      if (!res.ok) throw new Error(`http-${res.status}`)
      return res.json()
    }

    const fetchAnalytics = () => apiFetch('/api/usage/analytics?range=1d')
    const fetchLogs = () => apiFetch('/api/usage/call-logs?limit=20')

    async function apiPost(path) {
      const token = $token.get()
      if (!token) throw new Error('no-token')
      let res
      try {
        res = await fetch(`${BASE}${path}`, {
          method: 'POST',
          headers: { Authorization: `${AUTH_SCHEME} ${token}` },
        })
      } catch {
        throw new Error('network')
      }
      if (!res.ok) throw new Error(`http-${res.status}`)
      return res.json()
    }

    const fetchProviderLimits = async () => {
      const [limitsData, connsData] = await Promise.all([
        apiFetch('/api/usage/provider-limits').catch(() => ({ caches: {} })),
        apiFetch('/api/providers/client').catch(() => ({ connections: [] })),
      ])
      return {
        caches: limitsData?.caches || {},
        connections: connsData?.connections || [],
        intervalMinutes: limitsData?.intervalMinutes,
        lastAutoSyncAt: limitsData?.lastAutoSyncAt,
      }
    }

    /* ─── hooks ───────────────────────────────────────── */

    function useAnalytics() {
      const token = useValue($token)
      return useQuery({
        queryKey: [ID, 'analytics'],
        queryFn: fetchAnalytics,
        enabled: !!token,
        refetchInterval: 30_000,
        retry: false,
      })
    }

    function useProviderLimits() {
      const token = useValue($token)
      return useQuery({
        queryKey: [ID, 'provider-limits'],
        queryFn: fetchProviderLimits,
        enabled: !!token,
        refetchInterval: 45_000,
        retry: false,
      })
    }

    function useLogs() {
      const token = useValue($token)
      return useQuery({
        queryKey: [ID, 'logs'],
        queryFn: fetchLogs,
        enabled: !!token,
        refetchInterval: 15_000,
        retry: false,
      })
    }

    /* ─── language switch UI ─────────────────────────── */

    function LangSwitch() {
      const lang = useValue($lang)
      const tr = useT()
      return jsxs('div', {
        className: 'flex items-center gap-0.5 rounded-sm border border-(--ui-stroke-secondary) p-0.5 text-xs',
        children: [
          jsx('button', {
            type: 'button',
            onClick: () => {
              haptic('tap')
              setLang('auto')
            },
            className: `rounded px-1.5 py-0.5 text-[0.6875rem] transition-colors ${
              lang === 'auto' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'
            }`,
            title: 'Auto (Follow App Language)',
            children: tr('common.langAuto'),
          }),
          jsx('button', {
            type: 'button',
            onClick: () => {
              haptic('tap')
              setLang('en')
            },
            className: `rounded px-1.5 py-0.5 text-[0.6875rem] transition-colors ${
              lang === 'en' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'
            }`,
            children: tr('common.langEn'),
          }),
          jsx('button', {
            type: 'button',
            onClick: () => {
              haptic('tap')
              setLang('th')
            },
            className: `rounded px-1.5 py-0.5 text-[0.6875rem] transition-colors ${
              lang === 'th' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'
            }`,
            children: tr('common.langTh'),
          }),
        ],
      })
    }

    /* ─── token input ─────────────────────────────────── */

    function TokenSection() {
      const cur = useValue($token)
      const [draft, setDraft] = useState('')
      const tr = useT()
      const save = () => {
        const str = draft.trim()
        if (!str && !cur) return
        if (str && !str.startsWith('oma_')) {
          host.notify({
            kind: 'warning',
            message: tr('token.savedWarning'),
          })
        } else {
          host.notify({
            kind: 'info',
            message: str ? tr('token.saved') : tr('token.deleted'),
          })
        }
        setToken(str)
        setDraft('')
        queryClient.invalidateQueries({ queryKey: [ID] })
      }
      return jsx(Section, {
        title: tr('token.title'),
        children: jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx(Row, { label: tr('token.tokenLabel'), value: cur ? maskToken(cur) : tr('common.none') }),
            jsx('div', {
              className: 'text-xs text-(--ui-text-tertiary)',
              children: tr('token.hint'),
            }),
            jsxs('div', {
              className: 'flex gap-1.5',
              children: [
                jsx('input', {
                  type: 'password',
                  value: draft,
                  spellCheck: false,
                  autoComplete: 'off',
                  placeholder: 'oma_…',
                  onChange: (e) => setDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') save()
                  },
                  className:
                    'min-w-0 flex-1 rounded-sm border border-(--ui-stroke-secondary) bg-transparent px-1.5 py-1 font-mono text-xs',
                }),
                jsx('button', {
                  type: 'button',
                  onClick: save,
                  className:
                    'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
                  children: cur ? tr('common.change') : tr('common.save'),
                }),
                cur
                  ? jsx('button', {
                      type: 'button',
                      onClick: () => {
                        setToken('')
                        setDraft('')
                        queryClient.invalidateQueries({ queryKey: [ID] })
                        host.notify({ kind: 'info', message: tr('token.deleted') })
                      },
                      className:
                        'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
                      children: tr('common.delete'),
                    })
                  : null,
              ],
            }),
          ],
        }),
      })
    }

    /* ─── chip popup ──────────────────────────────────── */

    function ChipPopup() {
      const token = useValue($token)
      const q = useAnalytics()
      const tr = useT()
      const refresh = () => {
        haptic('tap')
        queryClient.invalidateQueries({ queryKey: [ID] })
      }
      const openFull = () => {
        haptic('tap')
        host.navigate('/omniroute')
      }
      const footer = jsxs('div', {
        className: 'flex gap-1.5',
        children: [
          jsx('button', {
            type: 'button',
            onClick: openFull,
            className:
              'flex-1 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
            children: tr('common.openFull'),
          }),
          jsx('button', {
            type: 'button',
            onClick: refresh,
            className:
              'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
            children: tr('common.refresh'),
          }),
        ],
      })

      if (!token) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('popup.needToken') }),
            footer,
          ],
        })
      }
      if (q.isLoading) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('popup.loading') }),
            footer,
          ],
        })
      }
      if (q.error) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm', children: getErrorMessage(q.error, tr) }),
            footer,
          ],
        })
      }

      const s = (q.data && q.data.summary) || {}
      return jsxs('div', {
        style: { maxHeight: '60vh', overflowY: 'auto' },
        className: 'flex flex-col gap-2',
        children: [
          jsxs('div', {
            className: 'flex flex-col gap-0.5',
            children: [
              jsx('div', { className: 'text-xs text-(--ui-text-tertiary)', children: tr('popup.header') }),
              jsx('div', {
                style: { fontSize: 22, fontWeight: 650, lineHeight: 1.15 },
                className: 'font-mono tabular-nums',
                children: `${s.totalRequests ?? '—'} req · ${fmtUsd(s.totalCost)}`,
              }),
            ],
          }),
          jsxs('div', {
            className: 'flex flex-col gap-0.5 border-t border-(--ui-stroke-secondary) pt-1.5',
            children: [
              jsx(Row, { label: 'tokens', value: fmtTokens(s.totalTokens) }),
              jsx(Row, { label: 'success', value: fmtPct(s.successRatePct) }),
              jsx(Row, { label: 'avg latency', value: fmtMs(s.avgLatencyMs) }),
              jsx(Row, { label: 'models', value: String(s.uniqueModels ?? '—') }),
            ],
          }),
          footer,
        ],
      })
    }

    /* ─── chip ────────────────────────────────────────── */

    function Chip() {
      const token = useValue($token)
      const q = useAnalytics()
      const tr = useT()
      let label = tr('chip.noToken')
      if (token) {
        if (q.data) {
          const s = q.data.summary || {}
          label = `OR ${s.totalRequests ?? '?'} req · ${fmtUsd(s.totalCost)}`
        } else if (q.isLoading) label = tr('chip.loading')
        else if (q.error) label = tr('chip.error')
      }
      return jsxs(Popover, {
        children: [
          jsx(PopoverTrigger, {
            asChild: true,
            children: jsx('button', {
              type: 'button',
              title: tr('chip.tooltip'),
              className:
                'inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
              onClick: () => haptic('tap'),
              children: label,
            }),
          }),
          jsx(PopoverContent, {
            side: 'top',
            align: 'end',
            sideOffset: 8,
            collisionPadding: 12,
            className: 'z-[1000] w-72 p-3',
            children: jsx(ChipPopup, {}),
          }),
        ],
      })
    }

    /* ─── hero section ────────────────────────────────── */

    function HeroSection() {
      const token = useValue($token)
      const q = useAnalytics()
      const tr = useT()
      if (!token) {
        return jsx(Section, {
          title: tr('hero.title'),
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('hero.needToken') }),
        })
      }
      if (q.isLoading) {
        return jsx(Section, {
          title: tr('hero.title'),
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('hero.loading') }),
        })
      }
      if (q.error) {
        return jsx(Section, {
          title: tr('hero.title'),
          children: jsx('div', { className: 'text-sm', children: getErrorMessage(q.error, tr) }),
        })
      }
      const s = (q.data && q.data.summary) || {}
      return jsxs('div', {
        className: 'flex flex-col gap-0.5 rounded-md border border-(--ui-stroke-secondary) p-3',
        children: [
          jsx('div', { className: 'text-xs text-(--ui-text-tertiary)', children: tr('hero.subtitle') }),
          jsx('div', {
            style: { fontSize: 26, fontWeight: 650, lineHeight: 1.15 },
            className: 'font-mono tabular-nums',
            children: `${s.totalRequests ?? '—'} ${tr('hero.requestsLabel')} · ${fmtUsd(s.totalCost)}`,
          }),
          jsxs('div', {
            className: 'mt-1 flex flex-col gap-0.5',
            children: [
              jsx(Row, { label: tr('hero.promptTokens'), value: fmtTokens(s.promptTokens) }),
              jsx(Row, { label: tr('hero.completionTokens'), value: fmtTokens(s.completionTokens) }),
              jsx(Row, { label: tr('hero.totalTokens'), value: fmtTokens(s.totalTokens) }),
              jsx(Row, { label: tr('hero.successRate'), value: fmtPct(s.successRatePct) }),
              jsx(Row, { label: tr('hero.avgLatency'), value: fmtMs(s.avgLatencyMs) }),
              jsx(Row, { label: tr('hero.uniqueModels'), value: String(s.uniqueModels ?? '—') }),
              jsx(Row, { label: tr('hero.uniqueAccounts'), value: String(s.uniqueAccounts ?? '—') }),
            ],
          }),
        ],
      })
    }

    /* ─── provider limits section ─────────────────────── */

    function ProviderLimitsSection() {
      const token = useValue($token)
      const q = useProviderLimits()
      const tr = useT()
      const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'subscription' | 'apikey'
      const [tierFilter, setTierFilter] = useState('all') // 'all' | 'pro' | 'free'
      const [providerFilter, setProviderFilter] = useState('all')
      const [syncing, setSyncing] = useState(false)

      const handleSyncUpstream = async () => {
        setSyncing(true)
        haptic('tap')
        try {
          await apiPost('/api/usage/provider-limits')
          await queryClient.invalidateQueries({ queryKey: [ID, 'provider-limits'] })
          host.notify({ kind: 'info', message: tr('limits.syncSuccess') })
        } catch (err) {
          const m = String(err?.message || err)
          if (m.includes('403')) {
            host.notify({
              kind: 'error',
              message: tr('limits.syncForbidden'),
            })
          } else {
            host.notify({ kind: 'error', message: tr('limits.syncFailed', m) })
          }
          queryClient.invalidateQueries({ queryKey: [ID, 'provider-limits'] })
        } finally {
          setSyncing(false)
        }
      }

      if (!token) return null

      if (q.isLoading) {
        return jsx(Section, {
          title: tr('limits.title'),
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('limits.loading') }),
        })
      }

      if (q.error) {
        return jsx(Section, {
          title: tr('limits.title'),
          children: jsx('div', { className: 'text-sm', children: getErrorMessage(q.error, tr) }),
        })
      }

      const caches = q.data?.caches || {}
      const connections = q.data?.connections || []

      const accounts = connections
        .filter((c) => {
          const hasCache = !!caches[c.id]
          const isSupported = USAGE_SUPPORTED_PROVIDERS.includes(c.provider)
          return hasCache || isSupported
        })
        .map((c) => {
          const cache = caches[c.id] || {}
          const plan = cache.plan || (c.authType === 'oauth' ? 'Pro' : 'Free')
          const isPro = plan.toLowerCase().includes('pro')
          const authType = c.authType || 'apikey'
          const purchaseType = authType === 'oauth' ? (isPro ? 'subscription' : 'oauth-free') : 'apikey'
          const quotas = cache.quotas || {}
          const modelEntries = Object.entries(quotas)

          let isCritical = c.testStatus === 'expired' || !!c.lastError
          let isWarning = false
          for (const [, qObj] of modelEntries) {
            const pct = qObj.remainingPercentage
            if (pct != null && pct <= 20) isCritical = true
            else if (pct != null && pct <= 50) isWarning = true
          }

          return {
            id: c.id,
            provider: c.provider,
            name: c.name || c.email || c.provider,
            email: c.email || (c.name && c.name.includes('@') ? c.name : ''),
            authType,
            purchaseType,
            plan,
            isPro,
            isActive: c.isActive !== false,
            testStatus: c.testStatus || 'active',
            lastError: c.lastError,
            quotas,
            modelEntries,
            isCritical,
            isWarning,
          }
        })

      const providerOptions = Array.from(new Set(accounts.map((a) => a.provider)))

      const filtered = accounts.filter((a) => {
        if (typeFilter === 'subscription' && a.authType !== 'oauth') return false
        if (typeFilter === 'apikey' && a.authType !== 'apikey') return false
        if (tierFilter === 'pro' && !a.isPro) return false
        if (tierFilter === 'free' && a.isPro) return false
        if (providerFilter !== 'all' && a.provider !== providerFilter) return false
        return true
      })

      const totalCount = accounts.length
      const criticalCount = accounts.filter((a) => a.isCritical).length
      const okCount = accounts.filter((a) => !a.isCritical && !a.isWarning).length

      const grouped = filtered.reduce((acc, accObj) => {
        acc[accObj.provider] = acc[accObj.provider] || []
        acc[accObj.provider].push(accObj)
        return acc
      }, {})

      return jsxs('div', {
        className: 'flex flex-col gap-2 rounded-md border border-(--ui-stroke-secondary) p-3',
        children: [
          // ─── Header: Title & Action ───
          jsxs('div', {
            className: 'flex items-center justify-between',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  jsx('div', {
                    className: 'text-xs font-semibold uppercase tracking-wider text-blue-400',
                    children: tr('limits.title'),
                  }),
                  jsx('span', {
                    className: 'rounded-full bg-blue-500/20 px-2 py-0.5 text-[0.6875rem] font-medium text-blue-300',
                    children: tr('limits.accountsCount', filtered.length),
                  }),
                ],
              }),
              jsx('button', {
                type: 'button',
                disabled: syncing,
                onClick: handleSyncUpstream,
                className:
                  'flex items-center gap-1 rounded-sm border border-(--ui-stroke-secondary) px-2 py-0.5 text-xs hover:bg-(--chrome-action-hover) disabled:opacity-50',
                children: syncing ? tr('limits.syncing') : tr('limits.syncUpstream'),
              }),
            ],
          }),

          // ─── KPI Metrics Row ───
          jsxs('div', {
            className: 'grid grid-cols-3 gap-2',
            children: [
              jsxs('div', {
                className:
                  'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsx('span', {
                    className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)',
                    children: tr('limits.total'),
                  }),
                  jsx('span', { className: 'text-lg font-bold font-mono', children: String(totalCount) }),
                ],
              }),
              jsxs('div', {
                className:
                  'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsxs('div', {
                    className: 'flex items-center justify-between',
                    children: [
                      jsx('span', {
                        className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)',
                        children: tr('limits.critical'),
                      }),
                      criticalCount > 0 ? jsx('span', { className: 'h-2 w-2 rounded-full bg-red-500' }) : null,
                    ],
                  }),
                  jsx('span', { className: 'text-lg font-bold font-mono text-red-400', children: String(criticalCount) }),
                ],
              }),
              jsxs('div', {
                className:
                  'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsx('span', {
                    className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)',
                    children: tr('limits.healthy'),
                  }),
                  jsx('span', { className: 'text-lg font-bold font-mono text-emerald-400', children: String(okCount) }),
                ],
              }),
            ],
          }),

          // ─── Filters Bar ───
          jsxs('div', {
            className:
              'flex flex-wrap items-center gap-3 border-y border-(--ui-stroke-secondary) py-1.5 text-xs',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  jsx('span', { className: 'text-(--ui-text-tertiary)', children: tr('limits.filterType') }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('all'),
                    className: `rounded px-1.5 py-0.5 ${
                      typeFilter === 'all'
                        ? 'bg-blue-500/20 text-blue-300 font-medium'
                        : 'text-(--ui-text-tertiary) hover:text-foreground'
                    }`,
                    children: `${tr('common.all')} ${accounts.length}`,
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('subscription'),
                    className: `rounded px-1.5 py-0.5 ${
                      typeFilter === 'subscription'
                        ? 'bg-blue-500/20 text-blue-300 font-medium'
                        : 'text-(--ui-text-tertiary) hover:text-foreground'
                    }`,
                    children: tr('limits.typeSub'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('apikey'),
                    className: `rounded px-1.5 py-0.5 ${
                      typeFilter === 'apikey'
                        ? 'bg-blue-500/20 text-blue-300 font-medium'
                        : 'text-(--ui-text-tertiary) hover:text-foreground'
                    }`,
                    children: tr('limits.typeApiKey'),
                  }),
                ],
              }),
              jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  jsx('span', { className: 'text-(--ui-text-tertiary)', children: tr('limits.filterTier') }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTierFilter('all'),
                    className: `rounded px-1.5 py-0.5 ${
                      tierFilter === 'all'
                        ? 'bg-blue-500/20 text-blue-300 font-medium'
                        : 'text-(--ui-text-tertiary) hover:text-foreground'
                    }`,
                    children: tr('common.all'),
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTierFilter('pro'),
                    className: `rounded px-1.5 py-0.5 ${
                      tierFilter === 'pro'
                        ? 'bg-blue-500/20 text-blue-300 font-medium'
                        : 'text-(--ui-text-tertiary) hover:text-foreground'
                    }`,
                    children: tr('limits.tierPro'),
                  }),
                ],
              }),
              providerOptions.length > 1
                ? jsxs('div', {
                    className: 'flex items-center gap-1',
                    children: [
                      jsx('span', { className: 'text-(--ui-text-tertiary)', children: tr('limits.filterProvider') }),
                      jsx('select', {
                        value: providerFilter,
                        onChange: (e) => {
                          haptic('tap')
                          setProviderFilter(e.target.value)
                        },
                        style: { backgroundColor: '#18181b', color: '#f4f4f5' },
                        className:
                          'cursor-pointer rounded border border-(--ui-stroke-secondary) bg-zinc-900 px-2 py-0.5 text-xs text-zinc-100 focus:border-blue-400 focus:outline-none',
                        children: [
                          jsx('option', {
                            value: 'all',
                            style: { backgroundColor: '#18181b', color: '#f4f4f5' },
                            children: tr('limits.allProviders', accounts.length),
                          }),
                          ...providerOptions.map((p) => {
                            const count = accounts.filter((a) => a.provider === p).length
                            return jsx(
                              'option',
                              {
                                value: p,
                                style: { backgroundColor: '#18181b', color: '#f4f4f5' },
                                children: `${p} (${count})`,
                              },
                              p
                            )
                          }),
                        ],
                      }),
                    ],
                  })
                : null,
            ],
          }),

          // ─── Accounts Grid grouped by Provider ───
          !filtered.length
            ? jsx('div', {
                className: 'py-3 text-center text-sm text-(--ui-text-tertiary)',
                children: tr('limits.noMatch'),
              })
            : jsxs('div', {
                className: 'flex flex-col gap-3',
                children: Object.entries(grouped).map(([provName, provAccounts]) => {
                  const activeInGroup = provAccounts.filter((a) => a.isActive).length
                  return jsxs(
                    'div',
                    {
                      className: 'flex flex-col gap-2',
                      children: [
                        // Group Accordion Header
                        jsxs('div', {
                          className:
                            'flex items-center justify-between border-b border-(--ui-stroke-secondary) pb-1',
                          children: [
                            jsxs('div', {
                              className: 'flex items-center gap-1.5 font-medium',
                              children: [
                                jsx('span', { className: 'text-xs text-blue-400', children: '▾' }),
                                jsx('span', { className: 'capitalize', children: provName }),
                              ],
                            }),
                            jsx('span', {
                              className: 'text-xs text-(--ui-text-tertiary)',
                              children: tr('limits.activeAccounts', activeInGroup, provAccounts.length),
                            }),
                          ],
                        }),

                        // Accounts Cards
                        jsxs('div', {
                          className: 'flex flex-col gap-2',
                          children: provAccounts.map((account) => {
                            const tone = account.isCritical
                              ? 'border-red-500/40 bg-red-500/5'
                              : account.isWarning
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-emerald-500/40 bg-emerald-500/5'

                            const dotColor = account.isCritical
                              ? 'bg-red-500'
                              : account.isActive
                              ? 'bg-emerald-500'
                              : 'bg-zinc-500'

                            return jsxs(
                              'div',
                              {
                                className: `flex flex-col gap-2 rounded-md border p-2.5 transition-all ${tone}`,
                                children: [
                                  // Account Card Header
                                  jsxs('div', {
                                    className: 'flex items-start justify-between gap-2',
                                    children: [
                                      jsxs('div', {
                                        className: 'flex flex-col gap-0.5 min-w-0',
                                        children: [
                                          jsxs('div', {
                                            className: 'flex items-center gap-1.5',
                                            children: [
                                              jsx('span', { className: `h-2 w-2 rounded-full shrink-0 ${dotColor}` }),
                                              jsx('span', {
                                                className: 'font-semibold truncate capitalize text-sm',
                                                children: account.provider,
                                              }),
                                              jsx('span', {
                                                className: `rounded-full px-2 py-0.2 text-[0.625rem] font-medium uppercase tracking-wide ${
                                                  account.isPro
                                                    ? 'bg-emerald-500/20 text-emerald-300'
                                                    : 'bg-zinc-500/20 text-zinc-300'
                                                }`,
                                                children: `● ${account.plan}`,
                                              }),
                                            ],
                                          }),
                                          account.email
                                            ? jsx('span', {
                                                className:
                                                  'font-mono text-xs text-(--ui-text-tertiary) truncate pl-3.5',
                                                children: maskEmail(account.email),
                                              })
                                            : null,
                                          account.testStatus === 'expired' || account.lastError
                                            ? jsx('span', {
                                                className: 'text-xs text-red-400 font-medium pl-3.5',
                                                children: account.lastError || tr('limits.tokenExpired'),
                                              })
                                            : !account.isActive
                                            ? jsx('span', {
                                                className: 'text-xs text-zinc-400 pl-3.5',
                                                children: tr('limits.inactive'),
                                              })
                                            : null,
                                        ],
                                      }),
                                      jsx('div', {
                                        className: 'text-xs font-mono text-(--ui-text-tertiary) shrink-0',
                                        children: account.authType,
                                      }),
                                    ],
                                  }),

                                  // Model Quotas Rows & Progress Bars
                                  account.modelEntries.length > 0
                                    ? jsxs('div', {
                                        className:
                                          'flex flex-col gap-2 pt-1 border-t border-(--ui-stroke-secondary)/50',
                                        children: account.modelEntries.map(([modelKey, qObj]) => {
                                          const pct =
                                            qObj.remainingPercentage ??
                                            (qObj.total ? ((qObj.total - qObj.used) / qObj.total) * 100 : 100)
                                          const barTone = getQuotaTone(pct)
                                          const countdown = formatCountdown(qObj.resetAt, tr)

                                          return jsxs(
                                            'div',
                                            {
                                              className: 'flex flex-col gap-1 text-xs',
                                              children: [
                                                // Model name & % left
                                                jsxs('div', {
                                                  className: 'flex items-center justify-between gap-2',
                                                  children: [
                                                    jsx('span', {
                                                      className: 'font-medium truncate',
                                                      children: formatModelName(modelKey),
                                                    }),
                                                    jsx('span', {
                                                      className: `font-mono font-semibold tabular-nums shrink-0 ${barTone.text}`,
                                                      children: qObj.unlimited
                                                        ? tr('limits.unlimited')
                                                        : `${Math.round(pct)}% ${tr('limits.left')}`,
                                                    }),
                                                  ],
                                                }),
                                                // Progress Bar
                                                jsx('div', {
                                                  className:
                                                    'h-1.5 w-full rounded-full bg-(--ui-stroke-secondary) overflow-hidden',
                                                  children: jsx('div', {
                                                    style: { width: `${Math.min(100, Math.max(0, pct))}%` },
                                                    className: `h-full rounded-full transition-all duration-500 ${barTone.bar}`,
                                                  }),
                                                }),
                                                // Reset countdown
                                                countdown
                                                  ? jsx('div', {
                                                      className:
                                                        'text-[0.6875rem] font-mono text-(--ui-text-tertiary)',
                                                      children: countdown,
                                                    })
                                                  : null,
                                              ],
                                            },
                                            modelKey
                                          )
                                        }),
                                      })
                                    : jsx('div', {
                                        className:
                                          'text-xs text-(--ui-text-tertiary) pt-1 border-t border-(--ui-stroke-secondary)/50',
                                        children: tr('limits.quotaBilling'),
                                      }),
                                ],
                              },
                              account.id
                            )
                          }),
                        }),
                      ],
                    },
                    provName
                  )
                }),
              }),
        ],
      })
    }

    /* ─── call logs section ───────────────────────────── */

    function LogsSection() {
      const token = useValue($token)
      const q = useLogs()
      const tr = useT()
      if (!token) return null
      if (q.isLoading) {
        return jsx(Section, {
          title: tr('logs.title'),
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('common.loading') }),
        })
      }
      if (q.error) {
        return jsx(Section, {
          title: tr('logs.title'),
          children: jsx('div', { className: 'text-sm', children: getErrorMessage(q.error, tr) }),
        })
      }
      const logs = Array.isArray(q.data) ? q.data : []
      if (!logs.length) {
        return jsx(Section, {
          title: tr('logs.title'),
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: tr('logs.empty') }),
        })
      }
      return jsx(Section, {
        title: tr('logs.titleWithCount', logs.length),
        children: jsx('div', {
          className: 'flex flex-col gap-1',
          children: logs.map((log, i) =>
            jsxs(
              'div',
              {
                className:
                  'flex flex-col gap-0.5 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs',
                children: [
                  jsxs('div', {
                    className: 'flex items-center justify-between gap-2',
                    children: [
                      jsx('span', { className: 'truncate font-medium', children: log.model || '—' }),
                      jsxs('span', {
                        className: 'shrink-0 font-mono text-(--ui-text-tertiary)',
                        children: `${statusBadge(log.status)} · ${fmtTime(log.timestamp)}`,
                      }),
                    ],
                  }),
                  jsxs('div', {
                    className: 'flex items-center gap-3 text-(--ui-text-tertiary)',
                    children: [
                      jsx('span', { children: log.provider || '—' }),
                      jsx('span', { children: log.account || '—' }),
                      jsx('span', { className: 'font-mono', children: fmtDuration(log.duration) }),
                      log.tokens && (log.tokens.in || log.tokens.out)
                        ? jsx('span', {
                            className: 'font-mono',
                            children: `${fmtTokens(log.tokens.in)}→${fmtTokens(log.tokens.out)}`,
                          })
                        : null,
                    ],
                  }),
                  log.error
                    ? jsx('div', {
                        style: { color: 'var(--ui-text-tertiary)' },
                        className: 'truncate',
                        children: typeof log.error === 'string' ? log.error : JSON.stringify(log.error),
                      })
                    : null,
                ],
              },
              log.id || i
            )
          ),
        }),
      })
    }

    /* ─── full page ───────────────────────────────────── */

    function StatusPage() {
      const tr = useT()
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: [ID] })
        host.notify({ kind: 'info', message: tr('common.refreshed') })
      }
      return jsxs('div', {
        className: 'flex h-full flex-col gap-2 overflow-y-auto p-3 text-sm',
        children: [
          jsxs('div', {
            className: 'flex items-center justify-between',
            children: [
              jsx('div', { className: 'font-medium', children: 'OmniRoute Usage' }),
              jsxs('div', {
                className: 'flex items-center gap-2',
                children: [
                  jsx(LangSwitch, {}),
                  jsx('button', {
                    type: 'button',
                    onClick: refresh,
                    className:
                      'rounded-sm border border-(--ui-stroke-secondary) px-2 py-0.5 text-xs hover:bg-(--chrome-action-hover)',
                    children: tr('common.refresh'),
                  }),
                ],
              }),
            ],
          }),
          jsx(HeroSection, {}),
          jsx(ProviderLimitsSection, {}),
          jsx(LogsSection, {}),
          jsx(TokenSection, {}),
        ],
      })
    }

    /* ─── registrations ───────────────────────────────── */

    ctx.register({
      id: 'chip',
      area: STATUSBAR_AREAS.right,
      order: 125,
      render: () => jsx(Chip, {}),
    })

    ctx.register({
      id: 'page',
      area: ROUTES_AREA,
      data: { path: '/omniroute' },
      render: () => jsx(StatusPage, {}),
    })

    ctx.register({
      id: 'nav',
      area: SIDEBAR_NAV_AREA,
      data: { path: '/omniroute', label: 'OmniRoute', codicon: 'dashboard' },
    })

    ctx.registerMany([
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'omniroute.open',
          label: MESSAGES_EN.palette.openLabel,
          keywords: ['omniroute', 'usage', 'dashboard', 'สถานะ', 'เปิด'],
          run: () => host.navigate('/omniroute'),
        },
      },
      {
        id: 'refresh',
        area: PALETTE_AREA,
        data: {
          id: 'omniroute.refresh',
          label: MESSAGES_EN.palette.refreshLabel,
          keywords: ['omniroute', 'refresh', 'รีเฟรช'],
          run: () => {
            queryClient.invalidateQueries({ queryKey: [ID] })
            host.notify({ kind: 'info', message: t('common.refreshed') })
          },
        },
      },
      {
        id: 'clear',
        area: PALETTE_AREA,
        data: {
          id: 'omniroute.clear',
          label: MESSAGES_EN.palette.clearLabel,
          keywords: ['omniroute', 'token', 'clear', 'ลบ'],
          run: () => {
            setToken('')
            queryClient.invalidateQueries({ queryKey: [ID] })
            host.notify({ kind: 'info', message: t('token.deleted') })
          },
        },
      },
    ])
  },
}
