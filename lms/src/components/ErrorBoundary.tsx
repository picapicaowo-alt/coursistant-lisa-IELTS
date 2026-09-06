import React from 'react';
import {frontendErrorReporter} from '@/utils/frontendErrorReporter';
import {ErrorFallback} from './ErrorFallback';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Changing this resets the boundary — pass the route so navigating retries. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Last-resort render failure UI. Feature regions should still handle their own errors. */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({error: null});
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    frontendErrorReporter.capture(error, {componentStack: info.componentStack});
  }

  render() {
    if (!this.state.error) return this.props.children;

    return <ErrorFallback onRetry={() => this.setState({error: null})}/>;
  }
}
