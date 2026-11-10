import type { ReasoningEffort } from '../types'

export const reasoningOptions: { label: string, value: ReasoningEffort }[] = [
  { label: '默认', value: 'default' },
  { label: '关闭（none）', value: 'none' },
  { label: '最低（minimal）', value: 'minimal' },
  { label: '低（low）', value: 'low' },
  { label: '中（medium）', value: 'medium' },
  { label: '高（high）', value: 'high' },
  { label: '极高（xhigh）', value: 'xhigh' },
  { label: '最大（max）', value: 'max' },
]
