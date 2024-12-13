export enum LogLevel {
    ERROR = '❌',
    WARN = '⚠️',
    SUCCESS = '✅',
    INFO = 'ℹ️',
    DEBUG = '🤖'
}

export class LoggerService {
    private static instance: LoggerService;
    private logLevel: LogLevel;

    private constructor() {
        this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.SUCCESS;
    }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    private formatMessage(level: LogLevel, message: string, metadata?: any): string {
        const timestamp = new Date().toISOString();
        const metadataString = metadata ? ` ${JSON.stringify(metadata)}` : '';
        return `${timestamp} [${level}]: ${message}${metadataString}`;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels = Object.values(LogLevel);
        return levels.indexOf(level) <= levels.indexOf(this.logLevel);
    }

    public error(message: string, metadata?: any): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage(LogLevel.ERROR, message, metadata));
        }
    }

    public warn(message: string, metadata?: any): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message, metadata));
        }
    }

    public info(message: string, metadata?: any): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage(LogLevel.INFO, message, metadata));
        }
    }

    public debug(message: string, metadata?: any): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message, metadata));
        }
    }

    public success(message: string, metadata?: any): void {
        if (this.shouldLog(LogLevel.SUCCESS)) {
            console.log(this.formatMessage(LogLevel.SUCCESS, message, metadata));
        }
    }

    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }
}

export default LoggerService.getInstance();