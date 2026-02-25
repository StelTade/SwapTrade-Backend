import { SetMetadata } from '@nestjs/common';

export const METRICS_METADATA_KEY = 'metrics';

export interface MetricsOptions {
  counter?: string;
  histogram?: string;
  gauge?: string;
  labels?: string[];
  description?: string;
  unit?: string;
}

export const Metrics = (options: MetricsOptions) => 
  SetMetadata(METRICS_METADATA_KEY, options);

export const CountRequests = (name: string, labels?: string[]) =>
  Metrics({ counter: name, labels, description: `Total number of ${name} requests` });

export const MeasureLatency = (name: string, labels?: string[]) =>
  Metrics({ histogram: name, labels, unit: 'seconds', description: `Latency for ${name}` });

export const TrackActiveConnections = (name: string) =>
  Metrics({ gauge: name, description: `Current number of active ${name}` });
