import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Position,
  PositionSchema,
} from '../../shared/schemas/position.schema.js';
import { PositionService } from './position.service.js';
import { PositionController } from './position.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Position.name, schema: PositionSchema },
    ]),
  ],
  controllers: [PositionController],
  providers: [PositionService],
  exports: [PositionService],
})
export class PositionModule {}
