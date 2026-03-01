// src/components/ui/error-boundary.jsx
"use client";

import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { logger } from "../../lib/logger";
/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Displays a fallback UI instead of crashing the entire app
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
    
    // Optionally reload the page or navigate
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-lg w-full p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">
                {this.props.title || 'Oops! Something went wrong'}
              </h2>
              <p className="text-gray-600">
                {this.props.message || 
                  'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'}
              </p>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-xs font-mono text-red-600 break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                      View stack trace
                    </summary>
                    <pre className="text-xs text-gray-600 mt-2 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button 
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Try Again
              </Button>

              <Button 
                onClick={() => window.location.href = '/dashboard'}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple Error Fallback Component
 * Can be used as a lightweight alternative to the full ErrorBoundary
 */
export function ErrorFallback({ 
  error, 
  resetErrorBoundary,
  title = 'Something went wrong',
  message = 'An error occurred while loading this content.'
}) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        {resetErrorBoundary && (
          <Button onClick={resetErrorBoundary} size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Section Error Boundary
 * Use this for smaller sections that shouldn't crash the entire page
 */
export function SectionErrorBoundary({ 
  children, 
  fallback,
  sectionName = 'this section'
}) {
  return (
    <ErrorBoundary
      title={`Error in ${sectionName}`}
      message={`There was a problem loading ${sectionName}. You can continue using other parts of the application.`}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
