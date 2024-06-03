import { useEffect, useReducer, useRef, useState } from 'react'

import ClipboardJS from 'clipboard'
import { throttle } from 'lodash-es'

import { ChatGPTProps, ChatMessage, ChatRole } from './interface'
import VYSPClient from "vysp-ts"

const vysp_client = new VYSPClient({
  tenantApiKey: process.env.NEXT_PUBLIC_VYSP_TENANT_API_KEY!,
  gateApiKey: process.env.NEXT_PUBLIC_VYSP_GATE_API_KEY!,
  installationType: "cloud"
})


const scrollDown = throttle(
  () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  },
  300,
  {
    leading: true,
    trailing: false
  }
)

const requestMessage = async (
  url: string,
  messages: ChatMessage[],
  controller: AbortController | null
) => {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({
      messages
    }),
    signal: controller?.signal
  })

  console.log(response)

  if (!response.ok) {
    throw new Error(response.statusText)
  }
  const data = response.body

  if (!data) {
    throw new Error('No data')
  }

  return data.getReader()
}

export const useChatGPT = (props: ChatGPTProps) => {
  const { fetchPath } = props
  const [, forceUpdate] = useReducer((x) => !x, false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [disabled] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  const controller = useRef<AbortController | null>(null)
  const currentMessage = useRef<string>('')

  const archiveCurrentMessage = () => {
    const content = currentMessage.current
    currentMessage.current = ''
    setLoading(false)
    if (content) {
      setMessages((messages) => {
        return [
          ...messages,
          {
            content,
            role: ChatRole.Assistant
          }
        ]
      })
      scrollDown()
    }
  }

  const fetchMessage = async (messages: ChatMessage[]) => {
    try {
      currentMessage.current = ''
      controller.current = new AbortController()
      setLoading(true)

      // Check the most recent message with the VYSP.AI Client
      const prompt = messages[messages.length - 1].content
      const checkInputResult = await vysp_client.checkInput({client_ref_user_id: "demo_user_id", prompt: prompt, client_ref_internal: false, metadata: { clientInfo: "clientMetadata" }});
      if (checkInputResult.flagged) {
        currentMessage.current = "VYSP.AI Security Error: Please try again. This input was flagged as high-risk."
        throw new Error('Please try again. This input was flagged as high-risk.')
      }

      const reader = await requestMessage(fetchPath, messages, controller.current)
      const decoder = new TextDecoder('utf-8')
      let done = false
      // Collect Stream response in variable to prevent showing potentially harmful output to the user
      let currentResponse = ""

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (value) {
          const char = decoder.decode(value)
          if (char === '\n' && currentResponse.endsWith('\n')) {
            continue
          }
          if (char) {
            currentResponse += char
            forceUpdate()
          }
          scrollDown()
        }
        done = readerDone
      }

      // Check the most recent message with the VYSP.AI Client
      const checkOutputResult = await vysp_client.checkOutput({client_ref_user_id: "demo_user_id", prompt: prompt, model_output: currentResponse, client_ref_internal: false, metadata: { clientInfo: "clientMetadata" }});
      if (checkOutputResult.flagged) {
        currentMessage.current = "VYSP.AI Security Error: Sorry, there was an error with model output."
        throw new Error('Sorry, there was an error with model output.')
      }

      currentMessage.current = currentResponse


      archiveCurrentMessage()
    } catch (e) {
      console.error(e)
      setLoading(false)
      return
    }
  }

  const onStop = () => {
    if (controller.current) {
      controller.current.abort()
      archiveCurrentMessage()
    }
  }

  const onSend = (message: ChatMessage) => {
    const newMessages = [...messages, message]
    setMessages(newMessages)
    fetchMessage(newMessages)
  }

  const onClear = () => {
    setMessages([])
  }

  useEffect(() => {
    new ClipboardJS('.chat-wrapper .copy-btn')
  }, [])

  return {
    loading,
    disabled,
    messages,
    currentMessage,
    onSend,
    onClear,
    onStop
  }
}
