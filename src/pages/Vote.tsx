import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const USAGE_OPTIONS = [
  { level: 1, code: 'L1', label: '完全不用', sub: '沒有固定使用習慣' },
  { level: 2, code: 'L2', label: '聊天問答', sub: 'ChatGPT / Claude 問問題、寫東西' },
  { level: 3, code: 'L3', label: '生圖／生影片', sub: 'Midjourney、Sora、ComfyUI' },
  { level: 4, code: 'L4', label: 'API／Agent 工具', sub: '使用 API、Antigravity、Codex、Cursor、Claude Code 等把 AI 接進工作流程' },
  { level: 5, code: 'L5', label: '用 MCP／工具調用', sub: '讓 AI 操作外部工具（MCP Server、Function Calling）' },
  { level: 6, code: 'L6', label: '編排 AI 代理團隊', sub: '用 LangGraph、CrewAI、AutoGen、Harness 等協調多個 Agent' },
]

const EVAL_OPTIONS = [
  { level: 1, code: 'S1', label: '炫目垃圾', sub: '娛樂可以，做事不行' },
  { level: 2, code: 'S2', label: '不可靠實習生', sub: '能做事，但檢查的時間比自己做還久' },
  { level: 3, code: 'S3', label: '稱職助理', sub: '特定任務穩定，但專業度有限' },
  { level: 4, code: 'S4', label: '策略副駕駛', sub: '能架構複雜問題，提供決策參考' },
  { level: 5, code: 'S5', label: '目標達成者', sub: '給予模糊目標即可完成交付' },
]

export default function Vote() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [usageLevel, setUsageLevel] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleUsage(level: number) {
    setUsageLevel(level)
    setStep(2)
  }

  async function handleEval(evalLevel: number) {
    if (usageLevel === null || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await addDoc(collection(db, 'audience_votes'), {
        usage_level: usageLevel,
        evaluation_level: evalLevel,
        created_at: serverTimestamp(),
      })
      setStep(3)
    } catch (e) {
      console.error(e)
      setError('提交失敗，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="radar-shell min-h-dvh text-slate-950 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10 overflow-x-hidden">
      {step === 1 && (
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center">
            <p className="text-indigo-700 text-base font-semibold mb-3">第 1 步，共 2 步</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-950">你的 AI 使用程度</h1>
            <p className="text-slate-600 text-lg mt-3">選一個最符合你現況的選項</p>
          </div>
          <div className="flex flex-col gap-4">
            {USAGE_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => handleUsage(opt.level)}
                className="glass-panel flex items-start gap-4 rounded-xl hover:bg-white/90 hover:border-indigo-300 active:scale-[0.99] transition-all duration-150 px-4 sm:px-6 py-5 cursor-pointer w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span className="bg-indigo-100 text-indigo-800 rounded-md text-lg sm:text-xl font-bold w-12 shrink-0 text-center leading-9">{opt.code}</span>
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-slate-950 text-xl sm:text-2xl font-bold leading-snug">{opt.label}</span>
                  <span className="text-slate-600 text-base sm:text-lg text-left leading-relaxed break-words mt-1">{opt.sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center">
            <p className="text-indigo-700 text-base font-semibold mb-3">第 2 步，共 2 步</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-950">你對 AI 能力的評價</h1>
            <p className="text-slate-600 text-lg mt-3">目前你認為 AI 是...</p>
          </div>
          <div className="flex flex-col gap-4">
            {EVAL_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => handleEval(opt.level)}
                disabled={submitting}
                className="glass-panel flex items-start gap-4 rounded-xl hover:bg-white/90 hover:border-indigo-300 active:scale-[0.99] transition-all duration-150 px-4 sm:px-6 py-5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <span className="bg-indigo-100 text-indigo-800 rounded-md text-lg sm:text-xl font-bold w-12 shrink-0 text-center leading-9">{opt.code}</span>
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-slate-950 text-xl sm:text-2xl font-bold leading-snug">{opt.label}</span>
                  <span className="text-slate-600 text-base sm:text-lg text-left leading-relaxed break-words mt-1">{opt.sub}</span>
                </div>
              </button>
            ))}
          </div>
          {error && (
            <p className="text-red-600 text-center text-base font-medium">{error}</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-5 sm:gap-6 text-center px-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-5xl text-emerald-700" aria-hidden="true">✓</div>
          <h1 className="text-3xl sm:text-4xl font-bold text-indigo-700">感謝投票！</h1>
          <p className="text-xl sm:text-2xl text-slate-950 font-semibold">請抬頭看大螢幕 👀</p>
          <p className="text-slate-600 text-base sm:text-lg mt-2">你的資料已即時更新到圖表上</p>
        </div>
      )}
    </div>
  )
}
