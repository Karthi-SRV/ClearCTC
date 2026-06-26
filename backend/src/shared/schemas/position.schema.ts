import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'positions' })
export class Position {
  @Prop({ required: true, unique: true, index: true, trim: true })
  name: string;
}

export type PositionDocument = Position & Document;
export const PositionSchema = SchemaFactory.createForClass(Position);
