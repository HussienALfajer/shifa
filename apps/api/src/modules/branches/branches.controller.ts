// The branch routes (A-01b criterion 9): the owner's branches (`branches.manage`). Every handler
// takes the scope the guard checked (@CurrentScope()) and nothing else decides the clinic.
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import {
  type ArchiveBranchPreview,
  type Branch,
  type BranchList,
  branchesArchive,
  branchesArchivePreview,
  branchesCreate,
  branchesList,
  branchesRestore,
  branchesUpdate,
  type RequestBody,
  type RequestParams,
} from '@shifa/contracts';
import { CurrentScope, type RequestScope, RequirePermission } from '../../access/index.ts';
import { Contract } from '../../platform/contract/index.ts';
import { ClientRequest, type RequestMeta } from '../../platform/request-meta.ts';
import { BranchesService } from './branches.service.ts';

@Controller('branches')
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branches: BranchesService) {}

  @RequirePermission('branches.manage')
  @Contract(branchesList)
  @Get()
  list(@CurrentScope() scope: RequestScope): Promise<BranchList> {
    return this.branches.list(scope);
  }

  @RequirePermission('branches.manage')
  @Contract(branchesCreate)
  @Post()
  create(
    @Body() body: RequestBody<typeof branchesCreate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<Branch> {
    return this.branches.create(scope, body, request.requestId);
  }

  @RequirePermission('branches.manage')
  @Contract(branchesUpdate)
  @Patch(':id')
  update(
    @Param() params: RequestParams<typeof branchesUpdate>,
    @Body() body: RequestBody<typeof branchesUpdate>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<Branch> {
    return this.branches.update(scope, params.id, body, request.requestId);
  }

  @RequirePermission('branches.manage')
  @Contract(branchesArchivePreview)
  @Get(':id/archive-preview')
  preview(
    @Param() params: RequestParams<typeof branchesArchivePreview>,
    @CurrentScope() scope: RequestScope,
  ): Promise<ArchiveBranchPreview> {
    return this.branches.preview(scope, params.id);
  }

  @RequirePermission('branches.manage')
  @Contract(branchesArchive)
  @HttpCode(200)
  @Post(':id/archive')
  archive(
    @Param() params: RequestParams<typeof branchesArchive>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<Branch> {
    return this.branches.archive(scope, params.id, request.requestId);
  }

  @RequirePermission('branches.manage')
  @Contract(branchesRestore)
  @HttpCode(200)
  @Post(':id/restore')
  restore(
    @Param() params: RequestParams<typeof branchesRestore>,
    @CurrentScope() scope: RequestScope,
    @ClientRequest() request: RequestMeta,
  ): Promise<Branch> {
    return this.branches.restore(scope, params.id, request.requestId);
  }
}
