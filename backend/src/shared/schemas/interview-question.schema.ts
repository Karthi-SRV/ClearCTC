import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'interview_questions' })
export class InterviewQuestion {
  @Prop({ type: Types.ObjectId, ref: 'Interview', required: true, index: true })
  interviewId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  roundId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  question: string;
}

export type InterviewQuestionDocument = InterviewQuestion & Document;
export const InterviewQuestionSchema =
  SchemaFactory.createForClass(InterviewQuestion);
