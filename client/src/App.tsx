import { useState } from 'react'

import './App.css'
import type { IChatMessage } from './types/chat'
import { chatStream } from './services/chat.service'

function App() {
  const [messages, setMessages] = useState<IChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState("")

  async function handleSubmit(event: React.SubmitEvent) {
    event.preventDefault()

    const message = input.trim();

    if (!message || loading) {
      return;
    }

    setInput("")

    const userMessage: IChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message
    }

    const assistantId = crypto.randomUUID()
    const assistantMessage: IChatMessage = {
      id: assistantId,
      role: "assistant",
      content: ""
    }

    setMessages((prev) => (
      [
        ...prev,
        userMessage,
        assistantMessage
      ]
    ))

    try {
      setLoading(true);
      await chatStream(
        message,
        (chunk) => {
        setMessages((prev) => 
           prev.map(item => 
            item.id === assistantId ?
               {
                ...item,
                content: item.content + chunk,
              } : item
           )
          )
        }
      )
    } catch (err) {
      console.log("Chat failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-chat">
    <h1>AI knowledge & Support Agent</h1>
      {messages.map(message => {
        const isUser = message.role === "user";
        
        return (<div className="message-bubble" key={message.id}>
           <strong>{isUser ? "user" : "AI"}</strong>
           <p className={isUser ? "user-message" : "assistant-message"}>{message.content}</p>
        </div>)
      })}
      <form onSubmit={handleSubmit} className="chat-input">
        <input className="chat-input" type="text" value={input} disabled={loading} onChange={(e) => setInput(e.target.value)} />
        <button className="send-button" type="submit" disabled={loading || !input.trim()}>{loading ? "Thinking..." : "Send"}</button>
      </form>
    </div>
  )
}

export default App
