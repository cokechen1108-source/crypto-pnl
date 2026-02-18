import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          padding: 24,
          maxWidth: 600,
          margin: '40px auto',
          background: '#111826',
          borderRadius: 12,
          border: '1px solid #1e2633',
          color: '#e6edf3',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>页面出错</h2>
          <pre style={{
            margin: 0,
            padding: 12,
            background: '#0b0f14',
            borderRadius: 8,
            fontSize: 12,
            overflow: 'auto',
            color: '#e74c3c',
          }}>
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 12, fontSize: 14, color: '#8a98a9' }}>
            请打开开发者工具 (F12) Console 查看完整报错。若后端未启动，请先运行：cd apps/api && npm run start:dev
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
