import {
  Controller, Post, Get, Patch, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { OpportunitiesService, FindAllParams } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { SubmitOpportunityDto } from './dto/submit-opportunity.dto';
import { CreateInterestDto } from './dto/create-interest.dto';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(private service: OpportunitiesService) {}

  // ══ ADMIN routes first (before parametric routes) ══

  @Get('admin/all')
  findAllAdmin(@Query('status') status?: string) {
    return this.service.findAllAdmin(status);
  }

  @Get('admin/submissions')
  findSubmissions() { return this.service.findSubmissions(); }

  @Post('admin/submissions/:id/approve')
  approve(@Param('id') id: string) { return this.service.approveSubmission(id); }

  @Post('admin/submissions/:id/reject')
  reject(@Param('id') id: string) { return this.service.rejectSubmission(id); }

  @Patch('admin/:id/publish')
  togglePublish(@Param('id') id: string, @Body('isPublished') isPublished: boolean) {
    return this.service.togglePublish(id, isPublished);
  }

  @Delete('admin/:id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  // ══ PUBLIC routes ══

  @Get()
  findAll(
    @Query('page')       page?: string,
    @Query('limit')      limit?: string,
    @Query('category')   category?: string,
    @Query('city')       city?: string,
    @Query('search')     search?: string,
    @Query('isExternal') isExternal?: string,
  ) {
    const params: FindAllParams = {
      page:       page     ? Number(page)  : 1,
      limit:      limit    ? Number(limit) : 12,
      category,
      city,
      search,
      isExternal: isExternal !== undefined ? isExternal === 'true' : undefined,
    };
    return this.service.findAll(params);
  }

  @Get('submissions/by-contact')
  findByContact(@Query('contact') contact: string) {
    return this.service.findSubmissionsByContact(contact);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) { return this.service.findBySlug(slug); }

  @Post('submit')
  submit(@Body() dto: SubmitOpportunityDto) { return this.service.submit(dto); }

  @Post(':id/interest')
  addInterest(@Param('id') id: string, @Body() dto: CreateInterestDto) {
    return this.service.addInterest(id, dto);
  }

  @Post()
  create(@Body() dto: CreateOpportunityDto) { return this.service.create(dto); }
}
