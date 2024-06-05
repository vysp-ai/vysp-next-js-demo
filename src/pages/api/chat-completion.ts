import { Message } from '@/models'
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import VYSPClient from "vysp-ts"

export const config = {
  runtime: 'edge'
}

const vysp_client = VYSPClient.clientFromConfig({
  tenantApiKey: process.env.VYSP_TENANT_API_KEY!,
  gateApiKey: process.env.VYSP_GATE_API_KEY!,
  installationType: "custom",
  installationUrl: "http://localhost:8000"
})



const handler = async (req: Request): Promise<Response> => {
  try {
    const { messages } = (await req.json()) as {
      messages: Message[]
    }


    const charLimit = 12000
    let charCount = 0
    let messagesToSend = []

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      if (charCount + message.content.length > charLimit) {
        break
      }
      charCount += message.content.length
      messagesToSend.push(message)
    }

    const prompt = messagesToSend[messagesToSend.length - 1]?.content
    
    // Scan input with VYSP.AI client
    const checkInputResult = await vysp_client.checkInput("demo_user_id", prompt, false, { clientInfo: "clientMetadata" });
    if (checkInputResult.flagged) {
      return new Response(createStream("VYSP.AI Security Error: Please try again. This input was flagged as high-risk."))
    }


    const modelInfo = determineAPIConfig();

    const stream = await OpenAIStream(modelInfo.apiUrl, modelInfo.apiKey, modelInfo.model, messagesToSend)

    const decoder = new TextDecoder('utf-8')
    let done = false
    const reader = stream.getReader()
    // Collect Stream response in variable to scan with VYSP.AI
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
        }
      }
      done = readerDone
    }

    // Scan output with VYSP.AI client
    const checkOutputResult = await vysp_client.checkOutput("demo_user_id", prompt, currentResponse, false, { clientInfo: "clientMetadata" });
    if (checkOutputResult.flagged) {
      return new Response(createStream("VYSP.AI Security Error: Sorry, there was an error in model output."))
    }





    return new Response(createStream(currentResponse))
  } catch (error) {
    console.error(error)
    return new Response('Error', { status: 500 })
  }
}

const OpenAIStream = async (apiUrl: string, apiKey: string, model: string, messages: Message[]) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const res = await fetch(apiUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'api-key': `${apiKey}`
    },
    method: 'POST',
    body: JSON.stringify({
      model: model,
      frequency_penalty: 0,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that helps people find information.`
        },
        ...messages
      ],
      presence_penalty: 0,
      stream: true,
      temperature: 0.7,
      top_p: 0.95
    })
  })



  if (res.status !== 200) {
    const statusText = res.statusText
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} and message ${statusText}`
    )
  }



  return new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data

          if (data === '[DONE]') {

            controller.close()

            return
          }

          try {
            const json = JSON.parse(data)
            const text = json.choices[0]?.delta.content
            const queue = encoder.encode(text)
            controller.enqueue(queue)
          } catch (e) {
            controller.error(e)
          }
        }
      }

      const parser = createParser(onParse)

      for await (const chunk of res.body as any) {
        const str = decoder.decode(chunk).replace('[DONE]\n', '[DONE]\n\n')
        parser.feed(str)
      }
    }
  })
}
export default handler


function determineAPIConfig() {
  let apiUrl: string;
  let apiKey: string;
  let model: string;

  const useAzureOpenAI = process.env.AZURE_OPENAI_API_BASE_URL && process.env.AZURE_OPENAI_API_BASE_URL.length > 0;
  if (useAzureOpenAI) {
    let apiBaseUrl = process.env.AZURE_OPENAI_API_BASE_URL
    const version = '2024-02-01'
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || ''
    if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1)
    }
    apiUrl = `${apiBaseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${version}`
    apiKey = process.env.AZURE_OPENAI_API_KEY || ''
    model = '' // Model selection is ignored here
  } else {
    apiUrl = `${process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'}/v1/chat/completions`
    apiKey = process.env.OPENAI_API_KEY || ''
    model = 'gpt-3.5-turbo' // Default model
  }
  return { apiUrl, apiKey, model };
}

function createStream(message: string) {
  const encoder = new TextEncoder();
  const messageEncoded = encoder.encode(message);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(messageEncoded);
      controller.close();
    }
  });
}