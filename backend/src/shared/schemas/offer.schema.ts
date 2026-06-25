import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Offer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  inputs: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  snapshot: Record<string, unknown>;
}

export type OfferDocument = Offer & Document;
export const OfferSchema = SchemaFactory.createForClass(Offer);
