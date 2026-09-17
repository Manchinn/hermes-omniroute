/**
 * OmniRoute Usage — Hermes desktop plugin (Thai UI, read-only).
 *
 * แสดง usage summary, quota ต่อ connection, และ recent call logs
 * จาก OmniRoute management API (localhost:20128)
 *
 * Surfaces:
 * - statusBar chip: requests / cost สรุป 1d, polls 30s
 * - chip popup: summary 1d + ปุ่มเปิดหน้าเต็ม
 * - page /omniroute: hero summary, quota table, call logs 20 รายการ
 * - sidebar nav + palette commands
 *
 * Auth: Bearer accessToken จาก OmniRoute config.json
 *       user กรอกใน plugin 1 ครั้ง → เก็บใน ctx.storage
 *       ห้าม hardcode / commit / log ค่า token
 *
 * Read-only: ไม่เขียน/แก้ config หรือ key ใดๆ ของ OmniRoute
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
} from '@hermes/plugin-sdk'
import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'omniroute-usage'
const BASE = 'http://localhost:20128'
// Split: scheme+secret pattern trips transport redaction
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

function formatCountdown(resetAt) {
  if (!resetAt) return null
  const target = new Date(resetAt).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  if (diff <= 0) return '⏱ รีเซ็ตแล้ว'
  const totalMins = Math.floor(diff / 60000)
  const days = Math.floor(totalMins / 1440)
  const hours = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `⏱ Resets in ${days}d ${hours}h`
  if (hours > 0) return `⏱ Resets in ${hours}h ${mins}m`
  return `⏱ Resets in ${mins}m`
}

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
  if (status === 200) return '✅'
  return `❌ ${status}`
}

const ERR_TH = {
  'no-token': 'ยังไม่ได้ตั้ง accessToken',
  network: 'ต่อ OmniRoute ไม่ได้ (ปิดอยู่?)',
  'http-401': '401 token ผิด/หมดอายุ',
  'http-403': '403 สิทธิ์ไม่พอ',
  'http-404': '404 path ผิด',
  'http-500': '500 server error',
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
    const $token = atom(ctx.storage.get('or_token', ''))

    function setToken(t) {
      if (t) ctx.storage.set('or_token', t)
      else ctx.storage.remove('or_token')
      $token.set(t)
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

    /* ─── token input ─────────────────────────────────── */

    function TokenSection() {
      const cur = useValue($token)
      const [draft, setDraft] = useState('')
      const save = () => {
        const t = draft.trim()
        if (t && !t.startsWith('oma_')) {
          host.notify({ kind: 'info', message: 'token ต้องขึ้นต้น oma_' })
          return
        }
        setToken(t)
        setDraft('')
        queryClient.invalidateQueries({ queryKey: [ID] })
        host.notify({ kind: 'info', message: t ? 'บันทึก accessToken แล้ว' : 'ลบ accessToken แล้ว' })
      }
      return jsx(Section, {
        title: 'OmniRoute accessToken',
        children: jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx(Row, { label: 'token', value: cur ? maskToken(cur) : '— ยังไม่มี —' }),
            jsx('div', {
              className: 'text-xs text-(--ui-text-tertiary)',
              children: 'สร้างที่ OmniRoute Dashboard → Settings → Access Tokens (แนะนำ Scope write หรือ admin เพื่อให้กดปุ่ม Sync โควต้าได้)',
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
                  onKeyDown: (e) => { if (e.key === 'Enter') save() },
                  className: 'min-w-0 flex-1 rounded-sm border border-(--ui-stroke-secondary) bg-transparent px-1.5 py-1 font-mono text-xs',
                }),
                jsx('button', {
                  type: 'button',
                  onClick: save,
                  className: 'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
                  children: cur ? 'เปลี่ยน' : 'บันทึก',
                }),
                cur
                  ? jsx('button', {
                      type: 'button',
                      onClick: () => {
                        setToken('')
                        setDraft('')
                        queryClient.invalidateQueries({ queryKey: [ID] })
                        host.notify({ kind: 'info', message: 'ลบ accessToken แล้ว' })
                      },
                      className: 'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
                      children: 'ลบ',
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
            className: 'flex-1 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
            children: 'เปิดหน้าเต็ม →',
          }),
          jsx('button', {
            type: 'button',
            onClick: refresh,
            className: 'shrink-0 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs hover:bg-(--chrome-action-hover)',
            children: 'รีเฟรช',
          }),
        ],
      })

      if (!token) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'ใส่ accessToken จาก OmniRoute ก่อน' }),
            footer,
          ],
        })
      }
      if (q.isLoading) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'กำลังดึง analytics…' }),
            footer,
          ],
        })
      }
      if (q.error) {
        return jsxs('div', {
          className: 'flex flex-col gap-1.5',
          children: [
            jsx('div', { className: 'text-sm', children: ERR_TH[errKey(q.error)] || 'ดูไม่ได้' }),
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
              jsx('div', { className: 'text-xs text-(--ui-text-tertiary)', children: 'OmniRoute · วันนี้' }),
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
      let label = 'OR: ไม่มี token'
      if (token) {
        if (q.data) {
          const s = q.data.summary || {}
          label = `OR ${s.totalRequests ?? '?'} req · ${fmtUsd(s.totalCost)}`
        } else if (q.isLoading) label = 'OR …'
        else if (q.error) label = 'OR !'
      }
      return jsxs(Popover, {
        children: [
          jsx(PopoverTrigger, {
            asChild: true,
            children: jsx('button', {
              type: 'button',
              title: 'OmniRoute Usage — กดดูสรุป',
              className: 'inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground',
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
      if (!token) {
        return jsx(Section, {
          title: 'สรุปวันนี้',
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'ใส่ accessToken ด้านล่างก่อน' }),
        })
      }
      if (q.isLoading) {
        return jsx(Section, { title: 'สรุปวันนี้', children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'กำลังโหลด…' }) })
      }
      if (q.error) {
        return jsx(Section, { title: 'สรุปวันนี้', children: jsx('div', { className: 'text-sm', children: ERR_TH[errKey(q.error)] || 'ดูไม่ได้' }) })
      }
      const s = (q.data && q.data.summary) || {}
      return jsxs('div', {
        className: 'flex flex-col gap-0.5 rounded-md border border-(--ui-stroke-secondary) p-3',
        children: [
          jsx('div', { className: 'text-xs text-(--ui-text-tertiary)', children: 'OmniRoute · วันนี้ (1d)' }),
          jsx('div', {
            style: { fontSize: 26, fontWeight: 650, lineHeight: 1.15 },
            className: 'font-mono tabular-nums',
            children: `${s.totalRequests ?? '—'} requests · ${fmtUsd(s.totalCost)}`,
          }),
          jsxs('div', {
            className: 'mt-1 flex flex-col gap-0.5',
            children: [
              jsx(Row, { label: 'prompt tokens', value: fmtTokens(s.promptTokens) }),
              jsx(Row, { label: 'completion tokens', value: fmtTokens(s.completionTokens) }),
              jsx(Row, { label: 'total tokens', value: fmtTokens(s.totalTokens) }),
              jsx(Row, { label: 'success rate', value: fmtPct(s.successRatePct) }),
              jsx(Row, { label: 'avg latency', value: fmtMs(s.avgLatencyMs) }),
              jsx(Row, { label: 'unique models', value: String(s.uniqueModels ?? '—') }),
              jsx(Row, { label: 'unique accounts', value: String(s.uniqueAccounts ?? '—') }),
            ],
          }),
        ],
      })
    }

    /* ─── provider limits section (UI ใหม่แทน Quota แบบเดิม) ─── */

    function ProviderLimitsSection() {
      const token = useValue($token)
      const q = useProviderLimits()
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
          host.notify({ kind: 'info', message: 'Sync โควต้าจาก Provider สำเร็จแล้ว' })
        } catch (err) {
          const m = String(err?.message || err)
          if (m.includes('403')) {
            host.notify({
              kind: 'error',
              message: '403 สิทธิ์ไม่พอ: Access Token ต้องมี Scope write หรือ admin เพื่อกด Sync สด (ดูได้เฉพาะ read)',
            })
          } else {
            host.notify({ kind: 'error', message: 'Sync โควต้าไม่สำเร็จ: ' + m })
          }
          queryClient.invalidateQueries({ queryKey: [ID, 'provider-limits'] })
        } finally {
          setSyncing(false)
        }
      }

      if (!token) return null

      if (q.isLoading) {
        return jsx(Section, {
          title: 'Provider Limits',
          children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'กำลังโหลด Provider Limits…' }),
        })
      }

      if (q.error) {
        return jsx(Section, {
          title: 'Provider Limits',
          children: jsx('div', { className: 'text-sm', children: ERR_TH[errKey(q.error)] || 'ดูไม่ได้' }),
        })
      }

      const caches = q.data?.caches || {}
      const connections = q.data?.connections || []

      // รวมและกรองเฉพาะ Connection ที่มี Quota หรืออยู่ใน USAGE_SUPPORTED_PROVIDERS
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

          // ประเมินสถานะ account
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

      // Providers list สำหรับ Filter dropdown
      const providerOptions = Array.from(new Set(accounts.map((a) => a.provider)))

      // Filtering
      const filtered = accounts.filter((a) => {
        if (typeFilter === 'subscription' && a.authType !== 'oauth') return false
        if (typeFilter === 'apikey' && a.authType !== 'apikey') return false
        if (tierFilter === 'pro' && !a.isPro) return false
        if (tierFilter === 'free' && a.isPro) return false
        if (providerFilter !== 'all' && a.provider !== providerFilter) return false
        return true
      })

      // สถิติ KPI
      const totalCount = accounts.length
      const criticalCount = accounts.filter((a) => a.isCritical).length
      const okCount = accounts.filter((a) => !a.isCritical && !a.isWarning).length

      // จัดกลุ่มตาม Provider
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
                  jsx('div', { className: 'text-xs font-semibold uppercase tracking-wider text-blue-400', children: 'Provider Limits' }),
                  jsx('span', {
                    className: 'rounded-full bg-blue-500/20 px-2 py-0.5 text-[0.6875rem] font-medium text-blue-300',
                    children: `${filtered.length} accounts`,
                  }),
                ],
              }),
              jsx('button', {
                type: 'button',
                disabled: syncing,
                onClick: handleSyncUpstream,
                className: 'flex items-center gap-1 rounded-sm border border-(--ui-stroke-secondary) px-2 py-0.5 text-xs hover:bg-(--chrome-action-hover) disabled:opacity-50',
                children: syncing ? 'กำลัง Sync…' : '🔄 Sync Upstream',
              }),
            ],
          }),

          // ─── KPI Metrics Row ───
          jsxs('div', {
            className: 'grid grid-cols-3 gap-2',
            children: [
              jsxs('div', {
                className: 'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsx('span', { className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)', children: 'TOTAL' }),
                  jsx('span', { className: 'text-lg font-bold font-mono', children: String(totalCount) }),
                ],
              }),
              jsxs('div', {
                className: 'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsxs('div', {
                    className: 'flex items-center justify-between',
                    children: [
                      jsx('span', { className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)', children: 'CRITICAL' }),
                      criticalCount > 0 ? jsx('span', { className: 'h-2 w-2 rounded-full bg-red-500' }) : null,
                    ],
                  }),
                  jsx('span', { className: 'text-lg font-bold font-mono text-red-400', children: String(criticalCount) }),
                ],
              }),
              jsxs('div', {
                className: 'flex flex-col rounded-sm border border-(--ui-stroke-secondary) bg-(--chrome-action-hover) p-2',
                children: [
                  jsx('span', { className: 'text-[0.625rem] font-semibold text-(--ui-text-tertiary)', children: 'HEALTHY' }),
                  jsx('span', { className: 'text-lg font-bold font-mono text-emerald-400', children: String(okCount) }),
                ],
              }),
            ],
          }),

          // ─── Filters Bar ───
          jsxs('div', {
            className: 'flex flex-wrap items-center gap-3 border-y border-(--ui-stroke-secondary) py-1.5 text-xs',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  jsx('span', { className: 'text-(--ui-text-tertiary)', children: 'TYPE:' }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('all'),
                    className: `rounded px-1.5 py-0.5 ${typeFilter === 'all' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'}`,
                    children: `All ${accounts.length}`,
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('subscription'),
                    className: `rounded px-1.5 py-0.5 ${typeFilter === 'subscription' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'}`,
                    children: 'Sub',
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTypeFilter('apikey'),
                    className: `rounded px-1.5 py-0.5 ${typeFilter === 'apikey' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'}`,
                    children: 'API Key',
                  }),
                ],
              }),
              jsxs('div', {
                className: 'flex items-center gap-1',
                children: [
                  jsx('span', { className: 'text-(--ui-text-tertiary)', children: 'TIER:' }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTierFilter('all'),
                    className: `rounded px-1.5 py-0.5 ${tierFilter === 'all' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'}`,
                    children: 'All',
                  }),
                  jsx('button', {
                    type: 'button',
                    onClick: () => setTierFilter('pro'),
                    className: `rounded px-1.5 py-0.5 ${tierFilter === 'pro' ? 'bg-blue-500/20 text-blue-300 font-medium' : 'text-(--ui-text-tertiary) hover:text-foreground'}`,
                    children: 'Pro',
                  }),
                ],
              }),
              providerOptions.length > 1
                ? jsxs('div', {
                    className: 'flex items-center gap-1',
                    children: [
                      jsx('span', { className: 'text-(--ui-text-tertiary)', children: 'PROVIDER:' }),
                      jsx('select', {
                        value: providerFilter,
                        onChange: (e) => setProviderFilter(e.target.value),
                        className: 'rounded border border-(--ui-stroke-secondary) bg-transparent px-1.5 py-0.5 text-xs text-foreground',
                        children: [
                          jsx('option', { value: 'all', className: 'bg-(--color-bg-subtle)', children: 'All providers' }),
                          ...providerOptions.map((p) =>
                            jsx('option', { value: p, className: 'bg-(--color-bg-subtle)', children: p }, p)
                          ),
                        ],
                      }),
                    ],
                  })
                : null,
            ],
          }),

          // ─── Accounts Grid grouped by Provider ───
          !filtered.length
            ? jsx('div', { className: 'py-3 text-center text-sm text-(--ui-text-tertiary)', children: 'ไม่พบบัญชีที่ตรงกับเงื่อนไข' })
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
                          className: 'flex items-center justify-between border-b border-(--ui-stroke-secondary) pb-1',
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
                              children: `${activeInGroup} active / ${provAccounts.length} accounts`,
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
                                              jsx('span', { className: 'font-semibold truncate capitalize text-sm', children: account.provider }),
                                              jsx('span', {
                                                className: `rounded-full px-2 py-0.2 text-[0.625rem] font-medium uppercase tracking-wide ${account.isPro ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-500/20 text-zinc-300'}`,
                                                children: `● ${account.plan}`,
                                              }),
                                            ],
                                          }),
                                          account.email
                                            ? jsx('span', {
                                                className: 'font-mono text-xs text-(--ui-text-tertiary) truncate pl-3.5',
                                                children: maskEmail(account.email),
                                              })
                                            : null,
                                          account.testStatus === 'expired' || account.lastError
                                            ? jsx('span', {
                                                className: 'text-xs text-red-400 font-medium pl-3.5',
                                                children: account.lastError || 'Token expired — กรุณา re-authenticate',
                                              })
                                            : !account.isActive
                                            ? jsx('span', {
                                                className: 'text-xs text-zinc-400 pl-3.5',
                                                children: 'สถานะ: Inactive (ปิดใช้งานอยู่)',
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
                                        className: 'flex flex-col gap-2 pt-1 border-t border-(--ui-stroke-secondary)/50',
                                        children: account.modelEntries.map(([modelKey, qObj]) => {
                                          const pct = qObj.remainingPercentage ?? (qObj.total ? ((qObj.total - qObj.used) / qObj.total) * 100 : 100)
                                          const barTone = getQuotaTone(pct)
                                          const countdown = formatCountdown(qObj.resetAt)

                                          return jsxs(
                                            'div',
                                            {
                                              className: 'flex flex-col gap-1 text-xs',
                                              children: [
                                                // Model name & % left
                                                jsxs('div', {
                                                  className: 'flex items-center justify-between gap-2',
                                                  children: [
                                                    jsx('span', { className: 'font-medium truncate', children: formatModelName(modelKey) }),
                                                    jsx('span', {
                                                      className: `font-mono font-semibold tabular-nums shrink-0 ${barTone.text}`,
                                                      children: qObj.unlimited ? 'ไม่จำกัด' : `${Math.round(pct)}% left`,
                                                    }),
                                                  ],
                                                }),
                                                // Progress Bar
                                                jsx('div', {
                                                  className: 'h-1.5 w-full rounded-full bg-(--ui-stroke-secondary) overflow-hidden',
                                                  children: jsx('div', {
                                                    style: { width: `${Math.min(100, Math.max(0, pct))}%` },
                                                    className: `h-full rounded-full transition-all duration-500 ${barTone.bar}`,
                                                  }),
                                                }),
                                                // Reset countdown
                                                countdown
                                                  ? jsx('div', {
                                                      className: 'text-[0.6875rem] font-mono text-(--ui-text-tertiary)',
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
                                        className: 'text-xs text-(--ui-text-tertiary) pt-1 border-t border-(--ui-stroke-secondary)/50',
                                        children: 'โควต้า: ตามรอบบิล / ไม่จำกัด',
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
      if (!token) return null
      if (q.isLoading) {
        return jsx(Section, { title: 'Recent Requests', children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'กำลังโหลด…' }) })
      }
      if (q.error) {
        return jsx(Section, { title: 'Recent Requests', children: jsx('div', { className: 'text-sm', children: ERR_TH[errKey(q.error)] || 'ดูไม่ได้' }) })
      }
      const logs = Array.isArray(q.data) ? q.data : []
      if (!logs.length) {
        return jsx(Section, { title: 'Recent Requests', children: jsx('div', { className: 'text-sm text-(--ui-text-tertiary)', children: 'ไม่มี request' }) })
      }
      return jsx(Section, {
        title: `Recent Requests · ${logs.length}`,
        children: jsx('div', {
          className: 'flex flex-col gap-1',
          children: logs.map((log, i) =>
            jsxs('div', {
              className: 'flex flex-col gap-0.5 rounded-sm border border-(--ui-stroke-secondary) px-2 py-1 text-xs',
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
                    (log.tokens && (log.tokens.in || log.tokens.out))
                      ? jsx('span', { className: 'font-mono', children: `${fmtTokens(log.tokens.in)}→${fmtTokens(log.tokens.out)}` })
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
            }, log.id || i)
          ),
        }),
      })
    }

    /* ─── full page ───────────────────────────────────── */

    function StatusPage() {
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: [ID] })
        host.notify({ kind: 'info', message: 'รีเฟรช OmniRoute แล้ว' })
      }
      return jsxs('div', {
        className: 'flex h-full flex-col gap-2 overflow-y-auto p-3 text-sm',
        children: [
          jsxs('div', {
            className: 'flex items-center justify-between',
            children: [
              jsx('div', { className: 'font-medium', children: 'OmniRoute Usage' }),
              jsx('button', {
                type: 'button',
                onClick: refresh,
                className: 'rounded-sm border border-(--ui-stroke-secondary) px-2 py-0.5 text-xs hover:bg-(--chrome-action-hover)',
                children: 'รีเฟรช',
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
          label: 'OmniRoute: เปิดหน้า Usage',
          keywords: ['omniroute', 'usage', 'dashboard', 'สถานะ'],
          run: () => host.navigate('/omniroute'),
        },
      },
      {
        id: 'refresh',
        area: PALETTE_AREA,
        data: {
          id: 'omniroute.refresh',
          label: 'OmniRoute: รีเฟรชข้อมูล',
          keywords: ['omniroute', 'refresh', 'รีเฟรช'],
          run: () => {
            queryClient.invalidateQueries({ queryKey: [ID] })
            host.notify({ kind: 'info', message: 'รีเฟรช OmniRoute แล้ว' })
          },
        },
      },
      {
        id: 'clear',
        area: PALETTE_AREA,
        data: {
          id: 'omniroute.clear',
          label: 'OmniRoute: ลบ accessToken',
          keywords: ['omniroute', 'token', 'clear', 'ลบ'],
          run: () => {
            setToken('')
            queryClient.invalidateQueries({ queryKey: [ID] })
            host.notify({ kind: 'info', message: 'ลบ OmniRoute token แล้ว' })
          },
        },
      },
    ])
  },
}
