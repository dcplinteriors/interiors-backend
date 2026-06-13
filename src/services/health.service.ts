export interface HealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export function getHealth(): HealthStatus {
  return {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}
