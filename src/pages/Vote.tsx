import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const USAGE_OPTIONS = [
  { level: 1, code: 'L1', label: '完全不用', sub: '沒有固定使用習慣' },
  { level: 2, code: 'L2', label: '聊天問答', sub: 'ChatGPT / Claude 問問題、寫東西' },
  { level: 3, code: 'L3', label: '生圖／生影片', sub: 'Midjourney、Sora、ComfyUI' },
  { level: 4, code: 'L4', label: '串接 API／寫 Prompt', sub: '自己打 API、系統提示詞工程' },
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
    <div className="min-h-dvh bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      {step === 1 && (
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="text-center">
            <p className="text-cyan-400 text-sm font-mono tracking-widest uppercase mb-2">Step 1 / 2</p>
            <h1 className="text-2xl font-bold text-white">你的 AI 使用程度</h1>
            <p className="text-gray-400 text-sm mt-1">選一個最符合你現況的選項</p>
          </div>
          <div className="flex flex-col gap-3">
            {USAGE_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => handleUsage(opt.level)}
                className="flex items-center gap-4 rounded-2xl border border-cyan-800 bg-gray-900 hover:bg-cyan-900/40 hover:border-cyan-400 active:scale-95 transition-all duration-150 px-6 py-4 cursor-pointer"
              >
                <span className="text-cyan-400 font-mono text-lg font-bold w-8 shrink-0 text-center">{opt.code}</span>
                <div className="flex flex-col items-start">
                  <span className="text-white text-base font-semibold">{opt.label}</span>
                  <span className="text-gray-400 text-xs text-left">{opt.sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="text-center">
            <p className="text-cyan-400 text-sm font-mono tracking-widest uppercase mb-2">Step 2 / 2</p>
            <h1 className="text-2xl font-bold text-white">你對 AI 能力的評價</h1>
            <p className="text-gray-400 text-sm mt-1">目前你認為 AI 是⋯</p>
          </div>
          <div className="flex flex-col gap-3">
            {EVAL_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => handleEval(opt.level)}
                disabled={submitting}
                className="flex items-center gap-4 rounded-2xl border border-cyan-800 bg-gray-900 hover:bg-cyan-900/40 hover:border-cyan-400 active:scale-95 transition-all duration-150 px-6 py-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-cyan-400 font-mono text-lg font-bold w-8 shrink-0 text-center">{opt.code}</span>
                <div className="flex flex-col items-start">
                  <span className="text-white text-base font-semibold">{opt.label}</span>
                  <span className="text-gray-400 text-xs text-left">{opt.sub}</span>
                </div>
              </button>
            ))}
          </div>
          {error && (
            <p className="text-red-400 text-center text-sm">{error}</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-6 text-center px-4">
          <div className="text-6xl animate-bounce">✅</div>
          <h1 className="text-3xl font-bold text-cyan-400">感謝投票！</h1>
          <p className="text-xl text-white">請抬頭看大螢幕 👀</p>
          <p className="text-gray-500 text-sm mt-4">你的資料已即時更新到圖表上</p>
        </div>
      )}
    </div>
  )
}
