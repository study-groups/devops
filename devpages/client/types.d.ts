interface LogMessageOptions {
    module?: string;
    url?: string;
    method?: string;
    status?: number;
    error?: string;
    [key: string]: any; 
}

interface Window {
  logMessage: (message: string, level: 'info' | 'debug' | 'warn' | 'error', type: string, context?: LogMessageOptions) => void;
} 