// Test-only contract fixtures: named schemas and a probe controller whose handlers echo what
// validation handed them. Nothing here is reachable from src/.
import { Body, Controller, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  defineContract,
  type RequestBody,
  type RequestParams,
  type RequestQuery,
} from '@shifa/contracts';
import { z } from 'zod';
import { Public, RequirePermission } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { TEST_READ } from '../access/probe.ts';

export const ProbeKind = z.enum(['first', 'second']).meta({ id: 'ProbeKind' });

export const ProbeItemParams = z.object({ id: z.uuid() }).meta({ id: 'ProbeItemParams' });

export const ProbeItemQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(50), kind: ProbeKind.optional() })
  .meta({ id: 'ProbeItemQuery' });

export const ProbeItemInput = z
  .object({ name: z.string().min(1), phone: z.string().min(7) })
  .meta({ id: 'ProbeItemInput' });

export const ProbeItemEcho = z
  .object({
    id: z.string(),
    limit: z.number(),
    kind: ProbeKind.nullable(),
    name: z.string(),
    phone: z.string(),
  })
  .meta({ id: 'ProbeItemEcho' });

export const probeUpdateItem = defineContract({
  operationId: 'probeUpdateItem',
  method: 'POST',
  path: '/__contract/items/:id',
  request: { params: ProbeItemParams, query: ProbeItemQuery, body: ProbeItemInput },
  responses: { 200: ProbeItemEcho },
});

export const probeProtected = defineContract({
  operationId: 'probeProtected',
  method: 'POST',
  path: '/__contract/protected',
  request: { body: ProbeItemInput },
  responses: { 200: ProbeItemEcho },
});

@Controller('__contract')
export class ContractProbeController {
  @Public()
  @Contract(probeUpdateItem)
  @HttpCode(200)
  @Post('items/:id')
  update(
    @Param() params: RequestParams<typeof probeUpdateItem>,
    @Query() query: RequestQuery<typeof probeUpdateItem>,
    @Body() body: RequestBody<typeof probeUpdateItem>,
  ): z.output<typeof ProbeItemEcho> {
    return { id: params.id, limit: query.limit, kind: query.kind ?? null, ...body };
  }

  @RequirePermission(TEST_READ)
  @Contract(probeProtected)
  @HttpCode(200)
  @Post('protected')
  guarded(@Body() body: RequestBody<typeof probeProtected>): z.output<typeof ProbeItemEcho> {
    return { id: 'none', limit: 0, kind: null, ...body };
  }
}
