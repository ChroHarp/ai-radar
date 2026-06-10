import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { db } from '../firebase'
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
}

interface PlotPoint {
  x: number
  y: number
  id: string
}

const X_LABELS: Record<number, string> = { 
  1: 'L1 完全不用', 
  2: 'L2 聊天問答', 
  3: 'L3 生圖／影', 
  4: 'L4 串接 API', 
  5: 'L5 工具調用', 
  6: 'L6 代理編排' 
}
const Y_LABELS: Record<number, string> = { 1: 'S1 炫目垃圾', 2: 'S2 不可靠', 3: 'S3 稱職助理', 4: 'S4 副駕駛', 5: 'S5 達成者' }

function xTickFormatter(v: number) {
  const rounded = Math.round(v)
  return X_LABELS[rounded] ?? ''
}

function yTickFormatter(v: number) {
  const rounded = Math.round(v)
  return Y_LABELS[rounded] ?? ''
}

// Custom dot with glow effect — opacity scales with density approximation
function GlowDot(props: { cx?: number; cy?: number; payload?: PlotPoint }) {
  const { cx = 0, cy = 0 } = props
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill="rgba(34,211,238,0.55)"
      stroke="rgba(34,211,238,0.9)"
      strokeWidth={1.5}
      style={{ filter: 'drop-shadow(0 0 7px rgba(34,211,238,0.85))' }}
    />
  )
}

export default function Dashboard() {
  const [points, setPoints] = useState<PlotPoint[]>([])
  const [isCompact, setIsCompact] = useState(false)
  const jitterRef = useRef<Record<string, { jx: number; jy: number }>>({})

  const voteUrl = `${window.location.origin}/vote`

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
          const data = doc.data() as VoteDoc
          const id = doc.id
          // Compute jitter once per doc ID, then reuse — prevents jumping on re-render
          if (!jitterRef.current[id]) {
            jitterRef.current[id] = {
              jx: (Math.random() - 0.5) * 0.3,
              jy: (Math.random() - 0.5) * 0.3,
            }
          }
          const { jx, jy } = jitterRef.current[id]
          newPoints.push({
            id,
            x: data.usage_level + jx,
            y: data.evaluation_level + jy,
          })
        })
        setPoints(newPoints)
      },
      (err) => {
        console.error('Firestore listen error:', err)
      }
    )
    return () => unsub()
  }, [])

  return (
    <div className="min-h-dvh bg-gray-950 text-cyan-400 flex flex-col px-3 py-4 sm:p-6 gap-4 sm:gap-6 font-mono overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-cyan-300 break-words" style={{ textShadow: '0 0 20px rgba(34,211,238,0.5)' }}>
            AI 認知雷達
          </h1>
          <p className="text-gray-500 text-[11px] sm:text-sm mt-1 tracking-wider">REAL-TIME AUDIENCE COGNITIVE MAP</p>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-3 bg-gray-900 border border-cyan-900 rounded-lg px-4 py-3 w-full sm:w-auto">
          <span className="text-3xl sm:text-4xl font-bold text-cyan-300" style={{ textShadow: '0 0 15px rgba(34,211,238,0.6)' }}>
            {points.length}
          </span>
          <span className="text-gray-400 text-sm leading-tight text-right sm:text-left">
            總<br />投票
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 sm:gap-6 min-h-0">
        {/* Chart */}
        <div className="flex-1 bg-gray-900/60 border border-cyan-900/50 rounded-lg p-2 sm:p-4 min-w-0">
          <div style={{ height: 'clamp(360px, 62dvh, 560px)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 10, bottom: 68, left: isCompact ? 0 : 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.1)" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0.5, 6.5]}
                ticks={[1, 2, 3, 4, 5, 6]}
                tickFormatter={(value) => isCompact ? `L${Math.round(value)}` : xTickFormatter(value)}
                tick={{ fill: '#67e8f9', fontSize: isCompact ? 9 : 10 }}
                stroke="rgba(34,211,238,0.3)"
                interval={0}
              >
                <Label
                  value="AI 使用程度"
                  position="insideBottom"
                  offset={-40}
                  style={{ fill: '#22d3ee', fontSize: 12, fontFamily: 'monospace' }}
                />
              </XAxis>
              <YAxis
                type="number"
                dataKey="y"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={(value) => isCompact ? `S${Math.round(value)}` : yTickFormatter(value)}
                tick={{ fill: '#67e8f9', fontSize: isCompact ? 9 : 10 }}
                stroke="rgba(34,211,238,0.3)"
                width={isCompact ? 42 : 78}
              >
                <Label
                  value="AI 能力評價"
                  angle={-90}
                  position="insideLeft"
                  offset={isCompact ? -26 : -46}
                  style={{ fill: '#22d3ee', fontSize: 12, fontFamily: 'monospace' }}
                />
              </YAxis>
              <Tooltip
                cursor={{ stroke: 'rgba(34,211,238,0.3)' }}
                content={() => null}
              />
              <Scatter
                data={points}
                shape={<GlowDot />}
                isAnimationActive={true}
                animationDuration={400}
              />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right panel: QR code */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-4 sm:gap-6 justify-center">
          <div className="bg-gray-900 border border-cyan-800 rounded-lg p-4 sm:p-5 flex flex-col items-center gap-3 w-full sm:w-auto">
            <p className="text-xs tracking-widest text-cyan-500 uppercase">掃碼投票</p>
            <div className="rounded-lg overflow-hidden p-2 bg-[#0a0a0f]" style={{ boxShadow: '0 0 20px rgba(34,211,238,0.25)' }}>
              <QRCodeSVG
                value={voteUrl}
                size={144}
                bgColor="#0a0a0f"
                fgColor="#22d3ee"
              />
            </div>
            <p className="text-xs text-gray-500 text-center max-w-full sm:max-w-[170px] break-all">{voteUrl}</p>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style={{ boxShadow: '0 0 6px rgba(34,211,238,0.8)' }} />
            LIVE
          </div>
        </div>
      </div>

      {/* Axis legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-[11px] sm:text-xs leading-relaxed text-gray-500">
        <div className="flex flex-col gap-1">
          <p><span className="text-cyan-700 font-bold mr-2">X 軸 (使用程度)：</span></p>
          <p>L1 完全不用 (沒有固定習慣) → L2 聊天問答 (ChatGPT / Claude) → L3 生圖／生影片 (Midjourney/Sora)</p>
          <p>→ L4 串接 API (提示詞工程) → L5 用 MCP (工具調用) → L6 編排代理 (LangGraph/CrewAI)</p>
        </div>
        <div className="flex flex-col gap-1">
          <p><span className="text-cyan-700 font-bold mr-2">Y 軸 (能力評價)：</span></p>
          <p>S1 炫目垃圾 (做事不行) → S2 不可靠實習生 (檢查很久) → S3 稱職助理 (專業有限)</p>
          <p>→ S4 策略副駕駛 (決策參考) → S5 目標達成者 (Goal Achiever)</p>
        </div>
      </div>
    </div>
  )
}
