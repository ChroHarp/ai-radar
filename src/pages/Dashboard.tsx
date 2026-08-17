import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { isSameLocalDay } from '../date'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from 'recharts'
import { QRCodeSVG } from 'qrcode.react'

interface VoteDoc {
  usage_level: number
  evaluation_level: number
  created_at?: Timestamp | null
}

interface PlotPoint {
  x: number
  y: number
  id: string
  usageLevel: number
  evaluationLevel: number
  isToday: boolean
}

interface ClusterStats {
  count: number
  levelTotal: number
}

interface TooltipPayloadItem {
  payload?: PlotPoint
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
}

const X_LABELS: Record<number, string> = {
  1: 'L1 完全不用',
  2: 'L2 聊天問答',
  3: 'L3 生圖／影',
  4: 'L4 API／Agent',
  5: 'L5 工具調用',
  6: 'L6 代理編排',
}
const Y_LABELS: Record<number, string> = {
  1: 'S1 炫目垃圾',
  2: 'S2 不可靠',
  3: 'S3 稱職助理',
  4: 'S4 副駕駛',
  5: 'S5 達成者',
}

function xTickFormatter(v: number) {
  return X_LABELS[Math.round(v)] ?? ''
}

function yTickFormatter(v: number) {
  return Y_LABELS[Math.round(v)] ?? ''
}

function stableUnit(id: string, salt: string) {
  let hash = 2166136261
  const input = `${salt}:${id}`
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function getStableJitter(id: string) {
  return {
    jx: (stableUnit(id, 'x') - 0.5) * 0.32,
    jy: (stableUnit(id, 'y') - 0.5) * 0.32,
  }
}

function clusterKey(usageLevel: number, evaluationLevel: number) {
  return `${usageLevel}-${evaluationLevel}`
}

function formatPercent(count: number, total: number) {
  if (total <= 0) return '0%'
  const percent = (count / total) * 100
  return percent >= 10 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`
}

function RadarDot(props: { cx?: number; cy?: number; payload?: PlotPoint }) {
  const { cx = 0, cy = 0, payload } = props
  const id = payload?.id ?? 'preview'
  const isToday = payload?.isToday ?? true
  const angle = stableUnit(id, 'entry-angle') * Math.PI * 2
  const distance = 80 + stableUnit(id, 'entry-distance') * 70
  const entryStyle = {
    '--dot-from-x': `${(Math.cos(angle) * distance).toFixed(2)}px`,
    '--dot-from-y': `${(Math.sin(angle) * distance).toFixed(2)}px`,
    '--dot-duration': `${(0.75 + stableUnit(id, 'entry-speed') * 0.35).toFixed(2)}s`,
    '--dot-delay': `${(stableUnit(id, 'entry-delay') * 0.14).toFixed(2)}s`,
  } as CSSProperties

  return (
    <g
      transform={`translate(${cx} ${cy})`}
      style={{ filter: `drop-shadow(0 2px 3px ${isToday ? 'rgba(234,88,12,0.28)' : 'rgba(79,70,229,0.18)'})` }}
    >
      <g className="radar-dot-enter" style={entryStyle}>
        {isToday && <circle className="radar-dot-halo" r={14} fill="rgba(249,115,22,0.13)" />}
        <circle
          r={isToday ? 7 : 5.5}
          fill={isToday ? '#f97316' : 'rgba(99,102,241,0.42)'}
          stroke={isToday ? '#fff7ed' : '#6366f1'}
          strokeWidth={isToday ? 2 : 1.5}
          strokeDasharray={isToday ? undefined : '3 2'}
        />
      </g>
    </g>
  )
}

export default function Dashboard() {
  const [points, setPoints] = useState<PlotPoint[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const qrDialogRef = useRef<HTMLDialogElement>(null)

  const voteUrl = `${window.location.origin}/vote`
  const todayPoints = useMemo(() => points.filter((point) => point.isToday), [points])
  const historyPoints = useMemo(() => points.filter((point) => !point.isToday), [points])
  const visiblePoints = showHistory ? points : todayPoints

  const clusterStats = useMemo(() => {
    const clusters: Record<string, number> = {}
    const levelTotals: Record<number, number> = {}

    visiblePoints.forEach((point) => {
      const key = clusterKey(point.usageLevel, point.evaluationLevel)
      clusters[key] = (clusters[key] ?? 0) + 1
      levelTotals[point.usageLevel] = (levelTotals[point.usageLevel] ?? 0) + 1
    })

    return Object.fromEntries(
      Object.entries(clusters).map(([key, count]) => {
        const usageLevel = Number(key.split('-')[0])
        return [key, { count, levelTotal: levelTotals[usageLevel] ?? 0 }]
      }),
    ) as Record<string, ClusterStats>
  }, [visiblePoints])

  useEffect(() => {
    const updateLayout = () => setIsCompact(window.innerWidth < 640)
    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'audience_votes'),
      (snapshot) => {
        const newPoints: PlotPoint[] = []
        snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data({ serverTimestamps: 'estimate' }) as VoteDoc
          const { jx, jy } = getStableJitter(doc.id)
          const createdAt = data.created_at?.toDate()
          newPoints.push({
            id: doc.id,
            x: data.usage_level + jx,
            y: data.evaluation_level + jy,
            usageLevel: data.usage_level,
            evaluationLevel: data.evaluation_level,
            isToday: createdAt ? isSameLocalDay(createdAt) : false,
          })
        })
        setPoints(newPoints)
        setHasLoaded(true)
      },
      (err) => {
        console.error('Firestore listen error:', err)
        setHasLoaded(true)
      },
    )
    return () => unsub()
  }, [])

  function renderTooltip({ active, payload }: ChartTooltipProps) {
    const point = payload?.[0]?.payload
    if (!active || !point) return null

    const stats = clusterStats[clusterKey(point.usageLevel, point.evaluationLevel)] ?? { count: 0, levelTotal: 0 }
    const usageLabel = X_LABELS[point.usageLevel] ?? `L${point.usageLevel}`
    const evaluationLabel = Y_LABELS[point.evaluationLevel] ?? `S${point.evaluationLevel}`

    return (
      <div className="rounded-xl bg-white/95 px-4 py-3 text-left text-slate-800 shadow-[0_6px_8px_rgba(51,65,85,0.14)] ring-1 ring-white backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${point.isToday ? 'bg-orange-500' : 'bg-indigo-500/60'}`} />
          <p className="text-sm font-bold">{point.isToday ? '今日資料' : '歷史資料'}</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-900">{usageLabel}</p>
        <p className="mt-0.5 text-xs text-slate-600">{evaluationLabel}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-500">同群光點</p>
            <p className="text-xl font-bold text-slate-900">{stats.count}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">佔 {usageLabel.split(' ')[0]}</p>
            <p className="text-xl font-bold text-slate-900">{formatPercent(stats.count, stats.levelTotal)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="radar-shell min-h-dvh text-slate-800 flex flex-col px-3 py-4 sm:p-6 gap-4 sm:gap-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 break-words">AI 認知雷達</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-1">即時觀眾認知地圖</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <label className="glass-panel flex cursor-pointer items-center justify-between gap-4 rounded-xl px-4 py-3 sm:min-w-56">
            <span>
              <span className="block text-sm font-semibold text-slate-900">顯示歷史資料</span>
              <span className="block text-xs text-slate-600">另有 {historyPoints.length} 筆</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={showHistory}
              onChange={(event) => setShowHistory(event.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-indigo-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:after:translate-x-5" />
          </label>

          <div className="glass-panel flex items-center justify-between sm:justify-start gap-3 rounded-xl px-4 py-3 sm:min-w-36" aria-live="polite">
            <span className="text-3xl sm:text-4xl font-bold text-slate-950">{visiblePoints.length}</span>
            <span className="text-slate-600 text-sm leading-tight text-right sm:text-left">
              {showHistory ? '全部' : '今日'}<br />投票
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-4 sm:gap-6 min-h-0">
        <div className="glass-panel flex-1 rounded-xl p-2 sm:p-4 min-w-0">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pt-1 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500 ring-2 ring-orange-100" />今日</span>
            {showHistory && <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400/70 ring-1 ring-indigo-500" />歷史</span>}
            <span className="ml-auto text-slate-500">資料以瀏覽器所在時區判定日期</span>
          </div>

          <div style={{ height: 'clamp(360px, 60dvh, 540px)' }}>
            <div className="relative h-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 18, right: 14, bottom: isCompact ? 74 : 82, left: isCompact ? 6 : 18 }}>
                  <CartesianGrid strokeDasharray="3 4" stroke="rgba(71,85,105,0.16)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    domain={[0.5, 6.5]}
                    ticks={[1, 2, 3, 4, 5, 6]}
                    tickFormatter={(value) => isCompact ? `L${Math.round(value)}` : xTickFormatter(value)}
                    tick={{ fill: '#475569', fontSize: isCompact ? 12 : 13, fontWeight: 650 }}
                    stroke="rgba(71,85,105,0.36)"
                    interval={0}
                  >
                    <Label
                      value="X 軸：AI 使用方式成熟度"
                      position="insideBottom"
                      offset={isCompact ? -44 : -50}
                      style={{ fill: '#334155', fontSize: isCompact ? 13 : 15, fontWeight: 700 }}
                    />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="y"
                    domain={[0.5, 5.5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tickFormatter={(value) => isCompact ? `S${Math.round(value)}` : yTickFormatter(value)}
                    tick={{ fill: '#475569', fontSize: isCompact ? 12 : 13, fontWeight: 650 }}
                    stroke="rgba(71,85,105,0.36)"
                    width={isCompact ? 46 : 96}
                  >
                    <Label
                      value="Y 軸：AI 能力信任度"
                      angle={-90}
                      position="insideLeft"
                      offset={isCompact ? -30 : -58}
                      style={{ fill: '#334155', fontSize: isCompact ? 13 : 15, fontWeight: 700 }}
                    />
                  </YAxis>
                  <Tooltip cursor={{ stroke: 'rgba(79,70,229,0.28)' }} content={renderTooltip} />
                  {showHistory && (
                    <Scatter key="history" name="歷史" data={historyPoints} shape={<RadarDot />} isAnimationActive={false} />
                  )}
                  <Scatter key="today" name="今日" data={todayPoints} shape={<RadarDot />} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>

              {(!hasLoaded || visiblePoints.length === 0) && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
                  <div className="rounded-xl bg-white/85 px-5 py-4 text-slate-800 shadow-[0_6px_8px_rgba(51,65,85,0.12)] ring-1 ring-white backdrop-blur-xl">
                    <p className="text-sm sm:text-base font-bold">
                      {!hasLoaded ? '載入投票資料' : showHistory ? '目前沒有投票資料' : '今日尚無投票'}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600">
                      {!hasLoaded
                        ? '資料同步後，光點會進入圖表'
                        : !showHistory && historyPoints.length > 0
                          ? '可開啟「顯示歷史資料」查看過往光點'
                          : '掃描 QR code 後，光點會即時出現'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4 sm:gap-6 justify-center">
          <div className="glass-panel rounded-xl p-4 sm:p-5 flex flex-col items-center gap-3 w-full sm:w-auto">
            <p className="text-sm font-semibold text-slate-700">掃碼投票</p>
            <button
              type="button"
              onClick={() => qrDialogRef.current?.showModal()}
              className="group rounded-lg bg-white p-3 ring-1 ring-slate-200 transition duration-200 hover:ring-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
              aria-label="放大投票 QR code"
            >
              <QRCodeSVG value={voteUrl} size={144} bgColor="#ffffff" fgColor="#334155" />
              <span className="mt-2 block text-xs font-semibold text-indigo-700 group-hover:text-indigo-900">點一下放大</span>
            </button>
            <p className="text-xs text-slate-500 text-center max-w-full sm:max-w-44 break-all">{voteUrl}</p>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
            即時連線
          </div>
        </div>
      </div>

      <dialog
        ref={qrDialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
        className="m-auto w-[min(92vw,36rem)] max-h-[calc(100dvh-2rem)] rounded-2xl bg-white/95 p-0 text-slate-900 shadow-[0_8px_32px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm"
        aria-labelledby="qr-dialog-title"
      >
        <div className="flex flex-col items-center gap-5 overflow-auto p-5 sm:p-7">
          <div className="flex w-full items-center justify-between gap-4">
            <div>
              <h2 id="qr-dialog-title" className="text-xl font-bold">掃描 QR code 投票</h2>
              <p className="mt-1 text-sm text-slate-600">完成兩個問題，結果會即時出現在圖表上。</p>
            </div>
            <button
              type="button"
              onClick={() => qrDialogRef.current?.close()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl leading-none text-slate-700 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              aria-label="關閉放大的 QR code"
            >
              ×
            </button>
          </div>
          <div className="w-full rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:p-6">
            <QRCodeSVG
              value={voteUrl}
              size={420}
              bgColor="#ffffff"
              fgColor="#1e293b"
              className="mx-auto h-auto w-full max-w-[420px]"
            />
          </div>
          <p className="max-w-full break-all text-center text-sm text-slate-600">{voteUrl}</p>
        </div>
      </dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs leading-relaxed text-slate-600">
        <div className="flex flex-col gap-1">
          <p className="font-bold text-slate-800">X 軸（使用程度）</p>
          <p>L1 完全不用 → L2 聊天問答 → L3 生圖／生影片</p>
          <p>→ L4 API／Agent 工具 → L5 MCP／工具調用 → L6 編排代理</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-bold text-slate-800">Y 軸（能力評價）</p>
          <p>S1 炫目垃圾 → S2 不可靠實習生 → S3 稱職助理</p>
          <p>→ S4 策略副駕駛 → S5 目標達成者</p>
        </div>
      </div>
    </div>
  )
}
