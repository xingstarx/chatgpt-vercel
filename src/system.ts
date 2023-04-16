import type { Model } from "./types"

export const defaultSetting = {
  continuousDialogue: true,
  archiveSession: false,
  openaiAPIKey: "",
  openaiAPITemperature: 60,
  password: "",
  systemRule: "",
  model: "gpt-3.5-turbo" as Model
}

export const defaultMessage = `Powered by OpenAI Vercel
- 本网站是由xingstarx搭建部署的，参考的是 Github开源社区的一个项目，[chatgpt-vercel](https://github.com/ourongxing/chatgpt-vercel) 要感谢作者ourongxing搞了一个这么好的开源项目。
- 如果你也想要搭建一个属于自己的ChatGPT，可以参考这篇文章[手把手教你搭建一个属于自己的ChatGPT
](https://www.jianshu.com/p/998c723443bd)
- 如果你是技术人员，可以参考上面我写的文章自己搭建一个。
- 如果你不懂技术也想要搭建一个类似的，那么可以出技术服务费找我，我帮你搞定技术问题，提供后续的技术支持(不支持定制化需求)，你只需要提供API Key,以及域名(可代买)，可详谈。
- 也支持部署类似这张图[ChatGPT-Next-Web](https://www.cheapxyzs.online/chatgpt_0_2.jpg)的效果哦，可以通过授权码访问的，防止白嫖，用来收费哦。
- 如果你想要更进一步的了解ChatGPT的使用,变现,最新资讯等可以考虑一下这个小专栏[ChatGPT从0到1](https://www.cheapxyzs.online/chatgpt_0_1.jpg)
- 目前的API Key 由我自己免费提供，欢迎大家白嫖，一般需求用我这个就可以了，我也是用爱发电啊。
- 如果大家有不用的API Key，可以提供给我，表示感谢呢。
- 如果你有啥疑问或者问题也可以联系我，微信:xingstarx。
- 如果你看到这段英文[[You exceeded your current quota, please check your plan and billing details.]] 意味着余额不足了，你可以加我微信提醒我更换API Key。
- 嗨，已经解决恶意刷接口的问题了，目前限制是每天免费20次，欢迎大家愉快的玩耍啦。
- [[Shift]] + [[Enter]] 换行。开头输入 [[/]] 或者 [[空格]] 搜索 Prompt 预设。[[↑]] 可编辑最近一次提问。点击顶部名称滚动到顶部，点击输入框滚动到底部。`

export type Setting = typeof defaultSetting

export const defaultResetContinuousDialogue = false

export const defaultMaxInputTokens: Record<Model, number> = {
  "gpt-3.5-turbo": 3072,
  "gpt-4": 6144,
  "gpt-4-32k": 24576
}

export const defaultModel: Model = "gpt-3.5-turbo"
