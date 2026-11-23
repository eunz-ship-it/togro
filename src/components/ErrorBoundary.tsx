import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || '알 수 없는 오류가 발생했습니다.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--tg-bg)] flex items-center justify-center p-6">
          <div className="max-w-lg w-full tg-card p-8">
            <h1 className="text-xl font-bold text-[var(--tg-text)] mb-2">
              화면 처리 중 문제가 발생했습니다
            </h1>
            <p className="text-sm text-[var(--tg-text-muted)] leading-relaxed mb-4">
              일시적인 네트워크 또는 권한 확인 문제일 수 있습니다. 새로고침 후 다시 시도해 주세요.
            </p>
            <pre className="text-xs font-mono bg-[var(--tg-bg)] border border-[var(--tg-border)] rounded-xl p-3.5 text-[var(--tg-text)] overflow-x-auto mb-6">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="tg-btn-primary px-5 py-2.5 text-sm cursor-pointer"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
