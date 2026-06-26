import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Interview,
  InterviewSchema,
} from '../../shared/schemas/interview.schema.js';
import {
  InterviewQuestion,
  InterviewQuestionSchema,
} from '../../shared/schemas/interview-question.schema.js';
import { InterviewService } from './interview.service.js';
import { InterviewController } from './interview.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Interview.name, schema: InterviewSchema },
      { name: InterviewQuestion.name, schema: InterviewQuestionSchema },
    ]),
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
