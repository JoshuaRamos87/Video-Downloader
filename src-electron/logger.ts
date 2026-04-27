import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  formattedMessage: string;
}

class Logger {
  private logFile: string;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;
  private onLogCallbacks: ((entry: LogEntry) => void)[] = [];

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logFile = path.join(userDataPath, 'app.log');
    
    // Clear log file on startup in dev mode, or append in prod
    if (process.env.NODE_ENV === 'development') {
      try { fs.writeFileSync(this.logFile, ''); } catch (e) {}
    }
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    let formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}`.trim();
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = this.formatMessage(level, message, ...args);
    
    const entry: LogEntry = {
      level,
      message: `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`.trim(),
      timestamp,
      formattedMessage
    };

    // Store in buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Trigger callbacks
    this.onLogCallbacks.forEach(cb => cb(entry));
    
    // Log to terminal
    switch (level) {
      case 'INFO':
        console.log('\x1b[32m%s\x1b[0m', formattedMessage); // Green
        break;
      case 'WARN':
        console.warn('\x1b[33m%s\x1b[0m', formattedMessage); // Yellow
        break;
      case 'ERROR':
        console.error('\x1b[31m%s\x1b[0m', formattedMessage); // Red
        break;
      case 'DEBUG':
        console.debug('\x1b[36m%s\x1b[0m', formattedMessage); // Cyan
        break;
    }

    // Log to file
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (e) {
      // Fallback if file writing fails
    }
  }

  info(message: string, ...args: any[]): void {
    this.log('INFO', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('WARN', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('ERROR', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log('DEBUG', message, ...args);
  }

  getLogPath(): string {
    return this.logFile;
  }

  getLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  onLog(callback: (entry: LogEntry) => void): () => void {
    this.onLogCallbacks.push(callback);
    return () => {
      this.onLogCallbacks = this.onLogCallbacks.filter(cb => cb !== callback);
    };
  }
}

export const logger = new Logger();
