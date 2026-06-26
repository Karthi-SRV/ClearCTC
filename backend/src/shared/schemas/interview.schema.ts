import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class InterviewRound {
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  @Prop({ required: true })
  roundNumber: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    enum: ['Completed', 'Pending', 'Expected', 'Waiting'],
    default: 'Pending',
  })
  status: string;

  @Prop({ default: '', trim: true })
  feedback: string;
}

export const InterviewRoundSchema =
  SchemaFactory.createForClass(InterviewRound);

@Schema({ timestamps: true, collection: 'interviews' })
export class Interview {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Company', required: true })
  companyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Position', required: true })
  positionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CityExpense', required: true })
  locationId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  totalRounds: number;

  @Prop({ required: true })
  expectedPackage: number; // LPA

  @Prop({ default: 0 })
  companyProposed: number; // LPA

  @Prop({
    required: true,
    validate: {
      validator: function (v: string) {
        return /^(Shared Resume|Shortlisted|In-Progress|Hold|Selected|Offer Released|Rejected|Moved to Round \d+)$/.test(
          v,
        );
      },
      message: (props: any) => `${props.value} is not a valid status!`,
    },
    default: 'Shared Resume',
  })
  status: string;

  @Prop({ default: '', trim: true })
  lastRoundFeedback: string;

  @Prop({ default: '', trim: true })
  contactNo: string;

  @Prop({ default: '', trim: true })
  contactName: string;

  @Prop({ default: '', trim: true })
  contactEmail: string;

  @Prop({ type: [InterviewRoundSchema], default: [] })
  rounds: InterviewRound[];
}

export type InterviewDocument = Interview & Document;
export const InterviewSchema = SchemaFactory.createForClass(Interview);
