import type { APIRoute } from "astro"
import type { ParsedEvent, ReconnectInterval } from "eventsource-parser"
import { createParser } from "eventsource-parser"
import type { ChatMessage, Model } from "~/types"
import { countTokens } from "~/utils/tokens"
import { splitKeys, randomKey, fetchWithTimeout } from "~/utils"
import { defaultMaxInputTokens, defaultModel } from "~/system"
import { ipAddress } from "@vercel/edge"

export const config = {
  runtime: "edge",
  /**
   * https://vercel.com/docs/concepts/edge-network/regions#region-list
   * disable hongkong
   * only for vercel
   */
  regions: [
    "arn1",
    "bom1",
    "bru1",
    "cdg1",
    "cle1",
    "cpt1a",
    "dub1",
    "fra1",
    "gru1",
    "hnd1",
    "iad1",
    "icn1",
    "kix1",
    "lhr1",
    "pdx1",
    "sfo1",
    "sin1",
    "syd1"
  ]
}

export const localKey = import.meta.env.OPENAI_API_KEY || ""

export const baseURL = import.meta.env.NOGFW
  ? "api.openai.com"
  : (import.meta.env.OPENAI_API_BASE_URL || "api.openai.com").replace(
      /^https?:\/\//,
      ""
    )
//将当天免费次数检测服务，以及插入聊天会话消息服务的功能迁移到一个新的站点，
//edge function 不支持操作MongoDB呢，只能用一个新的站点作为mongoDB的代理服务
const mongoDbProxyUrl = import.meta.env.MONGO_DB_PROXY_URL || ""
const mongoDbCollectionName = "chat" //对应的记录是chat表

//访问mongoDB代理服务的鉴权的用户名
const mongoDbProxyUrlUserName =
  import.meta.env.MONGO_DB_PROXY_URL_USER_NAME || ""
//访问mongoDB代理服务的鉴权的用户密码
const mongoDbProxyUrlPassword =
  import.meta.env.MONGO_DB_PROXY_URL_PASS_WORD || ""

const timeout = Number(import.meta.env.TIMEOUT)
//当天的最大免费次数
const totalCount = Number(import.meta.env.TOTAL_COUNT)

let maxInputTokens = defaultMaxInputTokens
const _ = import.meta.env.MAX_INPUT_TOKENS
if (_) {
  try {
    if (Number.isInteger(Number(_))) {
      maxInputTokens = Object.entries(maxInputTokens).reduce((acc, [k]) => {
        acc[k as Model] = Number(_)
        return acc
      }, {} as typeof maxInputTokens)
    } else {
      maxInputTokens = {
        ...maxInputTokens,
        ...JSON.parse(_)
      }
    }
  } catch (e) {
    console.error("Error parsing MAX_INPUT_TOKEN:", e)
  }
}

const pwd = import.meta.env.PASSWORD

export const post: APIRoute = async context => {
  try {
    const req = context.request
    const ip = ipAddress(context.request) || ""

    const body: {
      messages?: ChatMessage[]
      key?: string
      temperature: number
      password?: string
      model: Model
    } = await context.request.json()
    const {
      messages,
      key = localKey,
      temperature = 0.6,
      password,
      model = defaultModel
    } = body

    if (pwd && pwd !== password) {
      throw new Error("密码错误，请联系网站管理员。")
    }

    if (!messages?.length) {
      throw new Error("没有输入任何文字。")
    } else {
      const content = messages.at(-1)!.content.trim()
      if (content.startsWith("查询填写的 Key 的余额")) {
        if (key !== localKey) {
          const billings = await Promise.all(
            splitKeys(key).map(k => fetchBilling(k))
          )
          return new Response(await genBillingsTable(billings))
        } else {
          throw new Error("没有填写 OpenAI API key，不会查询内置的 Key。")
        }
      } else if (content.startsWith("sk-")) {
        const billings = await Promise.all(
          splitKeys(content).map(k => fetchBilling(k))
        )
        return new Response(await genBillingsTable(billings))
      } else if (
        content.startsWith(
          "Please tell me what is ChatGPT in English with at most 20 words"
        )
      ) {
        throw new Error(content)
      }
    }

    const apiKey = randomKey(splitKeys(key))

    if (!apiKey) throw new Error("没有填写 OpenAI API key，或者 key 填写错误。")

    const tokens = messages.reduce((acc, cur) => {
      const tokens = countTokens(cur.content)
      return acc + tokens
    }, 0)

    if (
      tokens > (body.key ? defaultMaxInputTokens[model] : maxInputTokens[model])
    ) {
      if (messages.length > 1)
        throw new Error(
          `由于开启了连续对话选项，导致本次对话过长，请清除部分内容后重试，或者关闭连续对话选项。`
        )
      else throw new Error("太长了，缩短一点吧。")
    }

    // console.log("ip = " + ip)

    if (!ip) {
      // 设备id为空，说明是异常设备，直接抛异常吧
      throw new Error("访问ip不能为空，请联系网站管理员xingstarx")
    }
    // 逻辑修改为，调用另外一个接口服务去判断当天是否还有剩余次数，具体当天最大免费次数的配置也在那个站点上
    // console.log("mongoDbProxyUrl = " + mongoDbProxyUrl)
    // console.log("!mongoDbProxyUrl = " + !mongoDbProxyUrl)

    if (mongoDbProxyUrl) {
      //如果mongoDbProxyUrl是空，说明还没有配置代理服务，需要来监控chatgpt-vercel的站点使用情况, 防止白嫖
      // 查是否当天还有免费次数
      const isReachedLimitCountUrl = `${mongoDbProxyUrl}/api/isReachedLimitCount?collectionName=${mongoDbCollectionName}&ip=${ip}` //在完整的Url后面附带参数
      // console.log("isReachedLimitCountUrl = " + isReachedLimitCountUrl)
      const base64UserNamePassword = btoa(
        `${mongoDbProxyUrlUserName}:${mongoDbProxyUrlPassword}`
      )
      // console.log("base64UserNamePassword = " + base64UserNamePassword)
      const headers = {
        Authorization: "Basic " + base64UserNamePassword,
        "Content-Type": "application/json"
      }
      const response = await fetch(isReachedLimitCountUrl, {
        headers,
        method: "GET"
      })
      const json = await response.json()
      if (response.ok) {
        //data对应的是个boolean值 如果是true, 说明超过上限了
        const data = json?.data
        if (data) {
          // console.log("data = " + data)
          throw new Error(`今天累计使用超过${totalCount}次了，请明天再白嫖吧。`)
        }
      } else {
        // console.log("response = " + response)
        const message = json?.message || ""
        // console.log("json = " + json + ", json.message = " + json?.message)
        throw new Error(
          "errorCode : " + response.status + ", errorMessage: " + message
        )
      }
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const rawRes = await fetchWithTimeout(
      `https://${baseURL}/v1/chat/completions`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        timeout: !timeout || Number.isNaN(timeout) ? 30000 : timeout,
        method: "POST",
        body: JSON.stringify({
          model: model || "gpt-3.5-turbo-1106",
          messages: messages.map(k => ({ role: k.role, content: k.content })),
          temperature,
          // max_tokens: 4096 - tokens,
          stream: true
        })
      }
    ).catch(err => {
      return new Response(
        JSON.stringify({
          error: {
            message: err.message
          }
        }),
        { status: 500 }
      )
    })

    if (!rawRes.ok) {
      return new Response(rawRes.body, {
        status: rawRes.status,
        statusText: rawRes.statusText
      })
    }

    const stream = new ReadableStream({
      async start(controller) {
        let completeData = "" // 定义一个变量用于存储接收到的完整数据
        const streamParser = async (event: ParsedEvent | ReconnectInterval) => {
          if (event.type === "event") {
            const data = event.data
            if (data === "[DONE]") {
              //在这里面写入本次成功的记录数据
              if (mongoDbProxyUrl) {
                //配置MongoDB的代理mongoDbProxyUrl后才执行这个逻辑呢
                const question = messages[messages.length - 1].content
                // console.log("question = " + question)
                // console.log("Complete data: " + completeData) // 输出完整数据
                await insertChatData(ip, question, completeData)
              }
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data)
              const text = json.choices[0].delta?.content
              const queue = encoder.encode(text)
              const tempText = text || ""
              completeData += tempText // 如果不是"[DONE]"，则将数据追加到完整数据变量中
              controller.enqueue(queue)
            } catch (e) {
              controller.error(e)
            }
          }
        }
        const parser = createParser(streamParser)
        for await (const chunk of rawRes.body as any) {
          parser.feed(decoder.decode(chunk))
        }
      }
    })

    return new Response(stream)
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: {
          message: err.message
        }
      }),
      { status: 400 }
    )
  }
}

type Billing = {
  key: string
  rate: number
  totalGranted: number
  totalUsed: number
  totalAvailable: number
}

/**
 * 插入当前的ChatGPT对话数据到MongoDB中
 * @param ip
 * @param deviceId
 */
export async function insertChatData(
  ip: string,
  question: string,
  answer: string
) {
  // 插入本条聊天消息回话
  const insertChatUrl = `${mongoDbProxyUrl}/api/insertChat` //在完整的Url后面附带参数
  const base64UserNamePassword = btoa(
    `${mongoDbProxyUrlUserName}:${mongoDbProxyUrlPassword}`
  )
  // headers
  const headers = {
    Authorization: "Basic " + base64UserNamePassword,
    "Content-Type": "application/json"
  }
  const response = await fetch(insertChatUrl, {
    headers,
    method: "POST",
    body: JSON.stringify({
      collectionName: mongoDbCollectionName,
      document: {
        ip: ip,
        question: question,
        answer: answer
      }
    })
  })
  const json = await response.json()
  if (response.ok) {
    const data = json?.data
    if (!data) {
      console.error(`插入失败了，快去${mongoDbProxyUrl}检查下原因吧`)
      throw new Error(`插入失败了，快去${mongoDbProxyUrl}检查下原因吧`)
    }
  } else {
    // console.log("response = " + response)
    const message = json?.message || ""
    // console.log("json = " + json + ", json.message = " + json?.message)
    throw new Error(
      "errorCode : " + response.status + ", errorMessage: " + message
    )
  }
}

export async function fetchBilling(key: string): Promise<Billing> {
  function formatDate(date: any) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  try {
    const now = new Date()
    const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // 设置API请求URL和请求头
    const urlSubscription =
      "https://api.openai.com/v1/dashboard/billing/subscription" // 查是否订阅
    const urlUsage = `https://api.openai.com/v1/dashboard/billing/usage?start_date=${formatDate(
      startDate
    )}&end_date=${formatDate(endDate)}` // 查使用量
    const headers = {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json"
    }

    // 获取API限额
    const subscriptionData = await fetch(urlSubscription, { headers }).then(r =>
      r.json()
    )
    if (subscriptionData.error?.message)
      throw new Error(subscriptionData.error.message)
    const totalGranted = subscriptionData.hard_limit_usd
    // 获取已使用量
    const usageData = await fetch(urlUsage, { headers }).then(r => r.json())
    const totalUsed = usageData.total_usage / 100
    // 计算剩余额度
    const totalAvailable = totalGranted - totalUsed
    return {
      totalGranted,
      totalUsed,
      totalAvailable,
      key,
      rate: totalAvailable / totalGranted
    }
  } catch (e) {
    console.error(e)
    return {
      key,
      rate: 0,
      totalGranted: 0,
      totalUsed: 0,
      totalAvailable: 0
    }
  }
}

export async function genBillingsTable(billings: Billing[]) {
  const table = billings
    .sort((m, n) => (m.totalGranted === 0 ? -1 : n.rate - m.rate))
    .map((k, i) => {
      if (k.totalGranted === 0)
        return `| ${k.key.slice(0, 8)} | 不可用 | —— | —— |`
      return `| ${k.key.slice(0, 8)} | ${k.totalAvailable.toFixed(4)}(${(
        k.rate * 100
      ).toFixed(1)}%) | ${k.totalUsed.toFixed(4)} | ${k.totalGranted} |`
    })
    .join("\n")

  return `| Key  | 剩余 | 已用 | 总额度 |
| ---- | ---- | ---- | ------ |
${table}
`
}
