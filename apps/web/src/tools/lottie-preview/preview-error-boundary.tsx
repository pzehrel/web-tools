import type { ReactNode } from 'react'
import type { LottieDocument } from './types'
import { Component } from 'react'

interface Props {
  animation: LottieDocument
  children: ReactNode
  onError: (message: string) => void
}

interface State {
  animation: LottieDocument
  failed: boolean
}

export class PreviewErrorBoundary extends Component<Props, State> {
  state = { animation: this.props.animation, failed: false }

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.animation === state.animation ? null : { animation: props.animation, failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(`动画预览失败：${error.message}`)
  }

  render() {
    if (this.state.failed)
      return null
    return this.props.children
  }
}
