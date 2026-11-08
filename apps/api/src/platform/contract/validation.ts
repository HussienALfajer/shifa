// Validates params, query and body against the handler's contract before the handler runs, and
// hands the handler the parsed (coerced, stripped) values. Runs after the access guard, so
// callers without access never learn the shape of a request.
// Not Nest's StandardSchemaValidationPipe: that validates one parameter at a time with a schema
// per decorator and answers with Zod's messages; here one contract per route, all issues at once,
// and the answer carries field paths and issue codes only (never a submitted value).
import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Contract, type ValidationIssue, ValidationIssueCode } from '@shifa/contracts';
import type { FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';
import type { z } from 'zod';
import { CONTRACT_METADATA } from './decorator.ts';

/** A request that does not match its contract; the filter answers 400 `validation_failed`. */
export class RequestValidationError extends BadRequestException {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super('request validation failed');
  }
}

const PARTS = ['params', 'query', 'body'] as const;

function issueCode(code: string): ValidationIssue['code'] {
  const parsed = ValidationIssueCode.safeParse(code);
  return parsed.success ? parsed.data : 'custom';
}

/** Path and code of each issue; Zod's messages are dropped because some quote the input. */
function toIssues(part: string, error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: [part, ...issue.path.map(String)].join('.'),
    code: issueCode(issue.code),
  }));
}

@Injectable()
export class ContractValidationInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const contract = this.reflector.get<Contract | undefined>(
      CONTRACT_METADATA,
      context.getHandler(),
    );
    const request = contract?.request;
    if (!request) return next.handle();
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const issues: ValidationIssue[] = [];
    for (const part of PARTS) {
      const schema = request[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) req[part] = result.data;
      else issues.push(...toIssues(part, result.error));
    }
    if (issues.length > 0) {
      req.log.info({ route: req.routeOptions.url, issues }, 'request validation failed');
      throw new RequestValidationError(issues);
    }
    return next.handle();
  }
}
