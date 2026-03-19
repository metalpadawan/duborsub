// PATCH: Add to AdminService (admin.module.ts) — listAllComments method

/*
Add this method to AdminService:

async listAllComments(query: AdminQueryDto) {
  const { page = 1, limit = 30 } = query;
  const skip = (page - 1) * limit;

  const [comments, total] = await this.prisma.$transaction([
    this.prisma.comment.findMany({
      where: { isDeleted: false },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user:  { select: { id: true, username: true } },
        anime: { select: { id: true, title: true } },
      },
    }),
    this.prisma.comment.count({ where: { isDeleted: false } }),
  ]);

  return { comments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

And add this route to AdminController:

@Get('comments')
listComments(@Query() query: AdminQueryDto) {
  return this.adminService.listAllComments(query);
}
*/
