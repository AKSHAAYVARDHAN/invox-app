
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { InformationCircleIcon } from '../ui/Icons';

interface ErrorBoundaryProps {
  /**
   * Children prop is optional for nested content.
   */
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * ErrorBoundary component to catch rendering errors in its child tree and display a fallback UI.
 */
// FIX: Extending Component directly from React named imports ensures that 'props' and 'state' are correctly recognized.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Explicitly declaring the props and state properties helps resolve the error: Property 'props' or 'state' does not exist on type 'ErrorBoundary'.
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // FIX: Initializing the state within the constructor.
    this.state = {
      hasError: false
    };
  }

  /**
   * Static method to update state when an error is thrown in a child component.
   */
  public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Lifecycle method to log error information.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service if available
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    // FIX: Destructuring state and props from 'this' which are inherited from Component.
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="bg-invox-dark-accent rounded-lg border border-red-900/50 p-4 mb-4 text-center">
            <div className="flex flex-col items-center justify-center">
                <InformationCircleIcon className="w-10 h-10 text-invox-red mb-3" />
                <h2 className="text-invox-red font-bold text-lg">Oops! Something went wrong.</h2>
                <p className="text-invox-light-gray mt-2">
                    We're sorry, this content could not be displayed. Please try refreshing the page.
                </p>
            </div>
        </div>
      );
    }
    
    // Ensure we return children or null if none provided.
    return children || null;
  }
}

export default ErrorBoundary;
