/**
 * BOWER JJ — Centralized Observability, Telemetry & Safe Logging System
 *
 * Tracks server health, multiplayer performance, competitive integrity,
 * and outputs sanitized, structured logs without exposing sensitive player data.
 */

import os from 'os';

export interface LatencyHistogram {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface TelemetrySnapshot {
  timestamp: number;
  server: {
    status: 'healthy' | 'degraded' | 'critical';
    uptimeSec: number;
    nodeVersion: string;
    osPlatform: string;
    cpu: {
      cores: number;
      loadAvg: number[];
      userCpuUsageMs: number;
      systemCpuUsageMs: number;
    };
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      externalMb: number;
    };
  };
  multiplayer: {
    activeConnections: number;
    peakConnections: number;
    totalConnectionsOpened: number;
    activeRooms: number;
    totalMatchesStarted: number;
    totalMatchesCompleted: number;
    totalMatchesAbandoned: number;
    matchCompletionRate: number; // percentage (0 - 100)
    authLatency: LatencyHistogram;
    messageProcessingLatency: LatencyHistogram;
  };
  integrity: {
    duplicateRewardAttemptsBlocked: number;
    invalidGameplayActionsBlocked: number;
    rateLimitViolationsBlocked: number;
    authFailuresBlocked: number;
    suspiciousDisconnectionsCount: number;
  };
}

class TelemetryRegistry {
  private startTime: number = Date.now();
  private prevCpuUsage: NodeJS.CpuUsage = process.cpuUsage();
  
  // Connection counters
  public activeConnections: number = 0;
  public peakConnections: number = 0;
  public totalConnectionsOpened: number = 0;
  public activeRooms: number = 0;

  // Match counters
  public totalMatchesStarted: number = 0;
  public totalMatchesCompleted: number = 0;
  public totalMatchesAbandoned: number = 0;

  // Latency sample buffers (rolling 500 samples)
  private authLatencySamples: number[] = [];
  private messageLatencySamples: number[] = [];
  private readonly MAX_SAMPLES = 500;

  // Security & Integrity counters
  public duplicateRewardAttemptsBlocked: number = 0;
  public invalidGameplayActionsBlocked: number = 0;
  public rateLimitViolationsBlocked: number = 0;
  public authFailuresBlocked: number = 0;
  public suspiciousDisconnectionsCount: number = 0;

  public onConnectionOpened() {
    this.activeConnections++;
    this.totalConnectionsOpened++;
    if (this.activeConnections > this.peakConnections) {
      this.peakConnections = this.activeConnections;
    }
  }

  public onConnectionClosed() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  public recordAuthLatency(latencyMs: number) {
    if (this.authLatencySamples.length >= this.MAX_SAMPLES) {
      this.authLatencySamples.shift();
    }
    this.authLatencySamples.push(Math.round(latencyMs));
  }

  public recordMessageLatency(latencyMs: number) {
    if (this.messageLatencySamples.length >= this.MAX_SAMPLES) {
      this.messageLatencySamples.shift();
    }
    this.messageLatencySamples.push(Math.round(latencyMs));
  }

  private calculateHistogram(samples: number[]): LatencyHistogram {
    if (samples.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / sorted.length);
    const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? max;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? max;

    return {
      count: sorted.length,
      min,
      max,
      avg,
      p50,
      p95,
      p99,
    };
  }

  public getSnapshot(): TelemetrySnapshot {
    const mem = process.memoryUsage();
    const cpuDelta = process.cpuUsage(this.prevCpuUsage);
    const uptimeSec = Math.round((Date.now() - this.startTime) / 1000);

    const totalFinished = this.totalMatchesCompleted + this.totalMatchesAbandoned;
    const matchCompletionRate = totalFinished > 0
      ? Math.round((this.totalMatchesCompleted / totalFinished) * 100)
      : 100;

    return {
      timestamp: Date.now(),
      server: {
        status: this.activeConnections < 1000 ? 'healthy' : 'degraded',
        uptimeSec,
        nodeVersion: process.version,
        osPlatform: `${os.type()} ${os.release()}`,
        cpu: {
          cores: os.cpus().length,
          loadAvg: os.loadavg ? os.loadavg() : [0, 0, 0],
          userCpuUsageMs: Math.round(cpuDelta.user / 1000),
          systemCpuUsageMs: Math.round(cpuDelta.system / 1000),
        },
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          externalMb: Math.round(mem.external / 1024 / 1024),
        },
      },
      multiplayer: {
        activeConnections: this.activeConnections,
        peakConnections: this.peakConnections,
        totalConnectionsOpened: this.totalConnectionsOpened,
        activeRooms: this.activeRooms,
        totalMatchesStarted: this.totalMatchesStarted,
        totalMatchesCompleted: this.totalMatchesCompleted,
        totalMatchesAbandoned: this.totalMatchesAbandoned,
        matchCompletionRate,
        authLatency: this.calculateHistogram(this.authLatencySamples),
        messageProcessingLatency: this.calculateHistogram(this.messageLatencySamples),
      },
      integrity: {
        duplicateRewardAttemptsBlocked: this.duplicateRewardAttemptsBlocked,
        invalidGameplayActionsBlocked: this.invalidGameplayActionsBlocked,
        rateLimitViolationsBlocked: this.rateLimitViolationsBlocked,
        authFailuresBlocked: this.authFailuresBlocked,
        suspiciousDisconnectionsCount: this.suspiciousDisconnectionsCount,
      },
    };
  }
}

export const telemetry = new TelemetryRegistry();

// ==============================================================================
// SANITIZED STRUCTURED LOGGER
// Never logs passwords, tokens, full hands, or private credentials
// ==============================================================================

const SENSITIVE_KEYS = new Set([
  'token',
  'accesstoken',
  'sessiontoken',
  'password',
  'secret',
  'servicerolekey',
  'service_role',
  'cards',
  'yourhand',
  'hands',
  'deck',
  'kitty',
]);

function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      clean[key] = sanitizeData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ level: 'INFO', time: timestamp, msg: message, ...(context ? sanitizeData(context) : {}) }));
    } else {
      console.log(`[INFO ${timestamp}] ${message}`, context ? sanitizeData(context) : '');
    }
  },
  warn: (message: string, context?: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    if (process.env.NODE_ENV === 'production') {
      console.warn(JSON.stringify({ level: 'WARN', time: timestamp, msg: message, ...(context ? sanitizeData(context) : {}) }));
    } else {
      console.warn(`[WARN ${timestamp}] ${message}`, context ? sanitizeData(context) : '');
    }
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    const errPayload = error instanceof Error
      ? { errorMessage: error.message, errorStack: error.stack }
      : { errorMessage: String(error) };

    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify({ level: 'ERROR', time: timestamp, msg: message, ...errPayload, ...(context ? sanitizeData(context) : {}) }));
    } else {
      console.error(`[ERROR ${timestamp}] ${message}`, errPayload.errorMessage, context ? sanitizeData(context) : '');
    }
  },
  audit: (action: string, context: Record<string, any>) => {
    const timestamp = new Date().toISOString();
    const payload = { level: 'AUDIT', time: timestamp, action, ...sanitizeData(context) };
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(payload));
    } else {
      console.log(`[AUDIT ${timestamp}] ${action}`, sanitizeData(context));
    }
  },
};
