import { SetMetadata } from '@nestjs/common';
import { TraceConfig } from '../interfaces/monitoring.interfaces';

export const TRACE_METADATA_KEY = 'trace';

export interface TraceOptions {
  name?: string;
  kind?: 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  attributes?: Record<string, string>;
  ignoreExceptions?: boolean[];
}

export const Trace = (options?: TraceOptions) => SetMetadata(TRACE_METADATA_KEY, options);

export const TraceMethod = (methodName?: string, attributes?: Record<string, string>) => 
  SetMetadata(TRACE_METADATA_KEY, { name: methodName, attributes });
