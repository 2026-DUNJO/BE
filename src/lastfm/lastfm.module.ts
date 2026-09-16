import { Module } from '@nestjs/common';

import { LastfmController } from './lastfm.controller.js';
import { LastfmService } from './lastfm.service.js';

@Module({
  controllers: [LastfmController],
  providers: [LastfmService],

  exports: [LastfmService],
})
export class LastfmModule {}