import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from '@/components/Icon/Icon';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary] ${this.props.fallbackLabel ?? 'Component'} crashed:`, error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '32px',
            textAlign: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-lg)',
            margin: '24px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              color: 'var(--danger)',
              marginBottom: '12px',
            }}
          >
            <Icon name="alert-triangle" size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Something went wrong
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 20px',
              background: 'var(--danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
