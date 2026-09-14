'use client'
/**
 * ChatPanel — real-time-style messenger between customer and hauler.
 *
 * Polls /api/messages?jobId= every 5 seconds for new messages.
 * Sends via POST /api/messages.
 * The current user's role (CUSTOMER | HAULER | ADMIN) determines bubble alignment.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface Msg {
  id: string
  text: string
  senderRole: string
  createdAt: string
  sender: {
    id: string
    name: string | null
    email: string
    role: string
    haulerProfile: { companyName: string } | null
  }
}

interface Props {
  jobId: string
  viewerRole: 'CUSTOMER' | 'HAULER' | 'ADMIN'
  jobStatus: string
  initialMessages: Msg[]
}

const CLOSED_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUNDED']

export default function ChatPanel({ jobId, viewerRole, jobStatus, initialMessages }: Props) {
  const [messages, setMessages]     = useState<Msg[]>(initialMessages)
  const [text, setText]             = useState('')
  const [sending, startSend]        = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const bottomRef                   = useRef<HTMLDivElement>(null)
  const inputRef                    = useRef<HTMLTextAreaElement>(null)
  const isClosed                    = CLOSED_STATUSES.includes(jobStatus)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll every 5 s
  useEffect(() => {
    if (isClosed) return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?jobId=${jobId}`)
        if (res.ok) {
          const { messages: fresh } = await res.json()
          setMessages(fresh)
        }
      } catch { /* network hiccup, skip */ }
    }, 5000)
    return () => clearInterval(iv)
  }, [jobId, isClosed])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError(null)

    startSend(async () => {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, text: trimmed }),
        })
        if (!res.ok) {
          const j = await res.json()
          setError(j.error ?? 'Failed to send')
          return
        }
        const { message } = await res.json()
        setMessages((prev) => [...prev, message])
        setText('')
        setTimeout(() => inputRef.current?.focus(), 0)
      } catch {
        setError('Network error — try again')
      }
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function senderLabel(msg: Msg) {
    if (msg.sender.role === 'HAULER') {
      return msg.sender.haulerProfile?.companyName ?? msg.sender.name ?? msg.sender.email
    }
    if (msg.sender.role === 'ADMIN') return '🛡 JunkRun Support'
    return msg.sender.name ?? msg.sender.email
  }

  const isMe = (msg: Msg) => msg.senderRole === viewerRole

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <h3 className="font-semibold text-ink text-sm">Job Chat</h3>
        {isClosed && (
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
            Conversation closed
          </span>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96 min-h-[200px]">
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">
            No messages yet — say hello!
          </p>
        )}

        {messages.map((msg) => {
          const me = isMe(msg)
          return (
            <div key={msg.id} className={`flex gap-2 ${me ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar initial */}
              <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${msg.senderRole === 'ADMIN' ? 'bg-red-100 text-red-600' :
                  msg.senderRole === 'HAULER' ? 'bg-brand-light text-brand-dark' :
                  'bg-slate-100 text-slate-600'}`}
              >
                {senderLabel(msg).charAt(0).toUpperCase()}
              </div>

              <div className={`max-w-[72%] flex flex-col gap-0.5 ${me ? 'items-end' : 'items-start'}`}>
                {/* Sender + time */}
                <p className="text-[11px] text-slate-400">
                  {senderLabel(msg)} · {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </p>

                {/* Bubble */}
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                  ${me
                    ? 'bg-brand text-white rounded-br-sm'
                    : msg.senderRole === 'ADMIN'
                      ? 'bg-red-50 text-red-900 border border-red-100 rounded-bl-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed && (
        <div className="border-t border-border p-3 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm text-ink placeholder:text-slate-400
              focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 bg-white"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white
              hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {sending ? '…' : 'Send'}
          </button>
        </div>
      )}

      {error && (
        <p className="px-4 pb-3 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
