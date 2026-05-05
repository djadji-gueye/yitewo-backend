import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private service: SocialService) {}

  // ── FOLLOW ────────────────────────────────────────────────

  // GET /social/follow/:slug?phone=221xxxxxxxx
  @Get('follow/:slug')
  getFollowStatus(@Param('slug') slug: string, @Query('phone') phone: string) {
    return this.service.getFollowStatus(slug, phone);
  }

  // POST /social/follow/:slug  { phone, name? }
  @Post('follow/:slug')
  follow(@Param('slug') slug: string, @Body() body: { phone: string; name?: string }) {
    return this.service.followPartner(slug, body.phone, body.name);
  }

  // DELETE /social/follow/:slug  { phone }
  @Delete('follow/:slug')
  unfollow(@Param('slug') slug: string, @Body() body: { phone: string }) {
    return this.service.unfollowPartner(slug, body.phone);
  }

  // ── REVIEWS ───────────────────────────────────────────────

  // GET /social/reviews/:slug
  @Get('reviews/:slug')
  getReviews(@Param('slug') slug: string, @Query('limit') limit?: string) {
    return this.service.getReviews(slug, limit ? Number(limit) : 10);
  }

  // POST /social/reviews/:slug  { rating, comment?, phone?, name?, orderId? }
  @Post('reviews/:slug')
  addReview(@Param('slug') slug: string, @Body() body: {
    rating: number;
    comment?: string;
    phone?: string;
    name?: string;
    orderId?: string;
  }) {
    return this.service.addReview(slug, body);
  }

  // ── PROMOS ────────────────────────────────────────────────

  // GET /social/promos  → toutes les promos actives (homepage)
  @Get('promos')
  getActivePromos() {
    return this.service.getActivePromos();
  }

  // GET /social/promos/:slug  → promo active d'un partenaire
  @Get('promos/:slug')
  getPartnerPromo(@Param('slug') slug: string) {
    return this.service.getPartnerPromo(slug);
  }

  // POST /social/promos  { token, title, description?, discount?, endsAt }
  @Post('promos')
  createPromo(@Body() body: {
    token: string;
    title: string;
    description?: string;
    discount?: number;
    endsAt: string;
  }) {
    return this.service.createPromo(body.token, {
      title:       body.title,
      description: body.description,
      discount:    body.discount,
      endsAt:      body.endsAt,
    });
  }

  // DELETE /social/promos/:id  { token }
  @Delete('promos/:id')
  deletePromo(@Param('id') id: string, @Body() body: { token: string }) {
    return this.service.deletePromo(id, body.token);
  }

  // ── PUSH NOTIFICATIONS (Business+) ───────────────────────

  // POST /social/notify  { token, message }
  @Post('notify')
  notifyFollowers(@Body() body: { token: string; message: string }) {
    return this.service.notifyFollowers(body.token, body.message);
  }

  // ── STATS ─────────────────────────────────────────────────

  // GET /social/stats/:slug
  @Get('stats/:slug')
  getStats(@Param('slug') slug: string) {
    return this.service.getPartnerStats(slug);
  }
}
