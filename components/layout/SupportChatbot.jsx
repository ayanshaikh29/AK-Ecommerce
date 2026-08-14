'use client'
import React, { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X, Send, ArrowRight, Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

function renderMarkdown(text) {
  if (!text) return ''
  
  // 1. Escaping raw HTML tags to prevent XSS (injection)
  let safeText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // 2. Normalize and remove any literal <br> tags since we already escaped < and >
  safeText = safeText.replace(/&lt;br\s*\/?&gt;/gi, '\n')

  // 3. Parse tables: markdown table structure (e.g. | header | header | \n | --- | --- | \n | cell | cell |)
  const lines = safeText.split('\n')
  let inTable = false
  let tableHeader = null
  let tableRows = []
  const parsedBlocks = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (!inTable) {
        inTable = true
        tableHeader = cells
        tableRows = []
      } else {
        if (line.includes('---')) continue
        tableRows.push(cells)
      }
    } else {
      if (inTable) {
        parsedBlocks.push({ type: 'table', headers: tableHeader, rows: tableRows })
        inTable = false
        tableHeader = null
        tableRows = []
      }
      if (line) {
        parsedBlocks.push({ type: 'text', content: line })
      } else {
        parsedBlocks.push({ type: 'break' })
      }
    }
  }
  if (inTable) {
    parsedBlocks.push({ type: 'table', headers: tableHeader, rows: tableRows })
  }

  // 4. Map blocks to JSX elements safely!
  return parsedBlocks.map((block, idx) => {
    if (block.type === 'break') {
      return <div key={idx} className="h-2" />
    }
    if (block.type === 'table') {
      return (
        <div key={idx} className="my-3 overflow-x-auto border rounded-lg max-w-full no-scrollbar">
          <table className="w-full text-xs text-left border-collapse min-w-[200px]">
            <thead>
              <tr className="bg-secondary/40 border-b">
                {block.headers.map((h, hIdx) => (
                  <th key={hIdx} className="p-1.5 font-bold border-r last:border-r-0" dangerouslySetInnerHTML={{ __html: inlineStyles(h) }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b last:border-b-0 hover:bg-secondary/10">
                  {row.map((c, cIdx) => (
                    <td key={cIdx} className="p-1.5 border-r last:border-r-0 text-foreground/90 font-medium" dangerouslySetInnerHTML={{ __html: inlineStyles(c) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // Check if it's a list item
    if (block.content.startsWith('- ') || block.content.startsWith('* ')) {
      const cleanText = block.content.substring(2)
      return (
        <li key={idx} className="ml-4 list-disc text-xs py-0.5" dangerouslySetInnerHTML={{ __html: inlineStyles(cleanText) }} />
      )
    }
    
    // Check numbered list
    const numMatch = block.content.match(/^(\d+)\.\s(.*)/)
    if (numMatch) {
      return (
        <li key={idx} className="ml-4 list-decimal text-xs py-0.5" dangerouslySetInnerHTML={{ __html: inlineStyles(numMatch[2]) }} />
      )
    }

    return (
      <p key={idx} className="text-xs py-0.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineStyles(block.content) }} />
    )
  })
}

function inlineStyles(rawStr) {
  let s = rawStr
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.*?)\*/g, '<em>$1</em>')
  s = s.replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
    const safeUrl = url.trim().toLowerCase().startsWith('javascript:') ? '#' : url
    return `<a href="${safeUrl}" class="text-accent underline font-bold" target="_blank" rel="noopener noreferrer">${text}</a>`
  })
  return s
}

export function SupportChatbot({ settings }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/admin') || pathname?.includes('/admin') || pathname?.startsWith('/vendor') || pathname?.includes('/vendor')) {
    return null
  }

  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hasBadge, setHasBadge] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Initialize session and load chat history
  useEffect(() => {
    setMounted(true)
    // Generate simple UUID or random string if not present
    let sId = sessionStorage.getItem('chat_session_id')
    if (!sId) {
      sId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
      sessionStorage.setItem('chat_session_id', sId)
      // Show badge on first load of a new session to notify user
      setHasBadge(true)
    }
    setSessionId(sId)

    // Load saved messages from sessionStorage
    const saved = sessionStorage.getItem('chat_history')
    if (saved) {
      setMessages(JSON.parse(saved))
    } else {
      // Welcome message
      setMessages([
        {
          sender: 'bot',
          text: "Hello! Welcome to AK Enterprises Customer Support. How can I help you today?",
          suggestions: ['Track my order', 'Shipping info', 'Browse products', 'Talk to a human'],
          timestamp: new Date().toISOString()
        }
      ])
    }
  }, [])

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    // Save to session storage
    if (messages.length > 0) {
      sessionStorage.setItem('chat_history', JSON.stringify(messages))
    }
  }, [messages])

  const toggleChat = () => {
    setIsOpen(!isOpen)
    if (hasBadge) setHasBadge(false)
  }

  const handleSendMessage = async (text) => {
    if (!text.trim() || isLoading) return
    
    const userMsg = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    }
    
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history: messages,
          sessionId
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to send message')
      }
      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: data.text,
          suggestions: data.suggestions || [],
          isWhatsAppHandoff: data.isWhatsAppHandoff,
          timestamp: data.timestamp || new Date().toISOString()
        }
      ])
    } catch (e) {
      console.error(e)
      toast.error('Unable to reach chat server. Connecting to WhatsApp...')
      
      // Fallback message inside chat
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: "I am having trouble connecting right now. Click below to chat directly with our team on WhatsApp.",
          isWhatsAppHandoff: true,
          suggestions: ['Browse products', 'Main menu'],
          timestamp: new Date().toISOString()
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Pre-fill WhatsApp message
  const getWhatsAppLink = (lastMsgText) => {
    const phone = settings?.whatsapp_number || '918308860894'
    const defaultMsg = `Hi AK Enterprises support team, I need assistance. Last query: "${lastMsgText || ''}"`
    return `https://wa.me/${phone}?text=${encodeURIComponent(defaultMsg)}`
  }

  if (!mounted) return null

  return (
    <>
      {/* Floating Chat Bubble Icon */}
      <button
        onClick={toggleChat}
        className={`fixed z-40 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-dramatic transition-all duration-300 hover:scale-110 hover:rotate-3 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        } ${
          // Symmetrical placement on the bottom-left corner
          'bottom-20 md:bottom-6 left-6'
        }`}
        aria-label="Open support chat"
      >
        <MessageSquare className="w-7 h-7 text-accent" />
        {/* Subtle pulsing glow */}
        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping z-[-1]" />
        
        {/* Unread Alert Badge */}
        {hasBadge && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce border-2 border-primary">
            1
          </span>
        )}
      </button>

      {/* Chat Window Panel */}
      <div
        className={`fixed z-50 flex flex-col bg-card border shadow-elevated transition-all duration-300 ease-out overflow-hidden ${
          // Mobile vs Desktop styling:
          // Mobile: Full page bottom sheet
          // Desktop: Fixed floating window on the bottom-left
          isOpen 
            ? 'bottom-0 right-0 left-0 h-full md:right-auto md:left-6 md:bottom-6 md:w-[380px] md:h-[580px] md:rounded-2xl opacity-100 translate-y-0' 
            : 'bottom-0 right-0 left-0 h-0 md:right-auto md:left-6 md:bottom-6 md:w-[380px] md:h-0 opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center font-display font-black text-primary text-sm shadow-soft">
              AK
            </div>
            <div>
              <h4 className="font-display font-bold text-sm tracking-wide text-white">AK Support Assistant</h4>
              <p className="text-[10px] text-accent font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                24/7 Online Helpdesk
              </p>
            </div>
          </div>
          <button 
            onClick={toggleChat} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/10">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col max-w-[85%] ${
                msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
              }`}
            >
              {/* Message Bubble */}
              <div
                className={`p-3 rounded-2xl text-sm leading-relaxed shadow-soft ${
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-none whitespace-pre-line'
                    : 'bg-card border rounded-tl-none text-foreground'
                }`}
              >
                {msg.sender === 'user' ? msg.text : renderMarkdown(msg.text)}

                {/* WhatsApp Handoff Action Button inside chat bubble */}
                {msg.isWhatsAppHandoff && (
                  <div className="mt-3 pt-3 border-t border-dashed border-border/40">
                    <a
                      href={getWhatsAppLink(messages[messages.length - 2]?.text)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 text-xs font-bold text-white bg-[#25D366] rounded-full hover:bg-[#20ba59] transition shadow-soft"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                      Chat on WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[9px] text-muted-foreground mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {/* Quick Reply Suggestions (attached to the bot's latest message only) */}
              {msg.sender === 'bot' && msg.suggestions && msg.suggestions.length > 0 && index === messages.length - 1 && !isLoading && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {msg.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sug)}
                      className="text-xs border border-accent text-primary bg-accent/10 px-3 py-1.5 rounded-full hover:bg-accent/25 hover:border-primary/40 font-medium transition active:scale-95"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex flex-col max-w-[80%] mr-auto items-start">
              <div className="p-3 bg-card border rounded-2xl rounded-tl-none flex items-center gap-1 shadow-soft">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Form Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage(inputValue)
          }}
          className="p-3 border-t bg-card flex gap-2 items-center shrink-0"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 min-w-0 bg-secondary/30 h-10 px-4 rounded-full text-sm border-0 focus:ring-1 focus:ring-accent outline-none"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition disabled:opacity-50 disabled:scale-100 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
            ) : (
              <Send className="w-4 h-4 text-accent" />
            )}
          </button>
        </form>
      </div>
    </>
  )
}
