import { Module } from '@nestjs/common';
import { MiiverseController } from './miiverse.controller';
import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { CommunitiesService } from './communities.service';
import { ProfilesService } from './profiles.service';
import { ModerationService } from './moderation.service';
import { MiiverseSchemaService } from './schema/miiverse-schema.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MiiverseController],
  providers: [
    MiiverseSchemaService,
    PostsService,
    CommentsService,
    CommunitiesService,
    ProfilesService,
    ModerationService,
  ],
})
export class MiiverseModule {}
