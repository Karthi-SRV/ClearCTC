import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  currentCity: string;

  /** Total CTC = basicPayLpa + variablePayLpa (or entire fixed salary when isFixed) */
  @Prop({ required: true })
  currentCtcLpa: number;

  /** Basic / fixed component in LPA */
  @Prop({ required: true })
  basicPayLpa: number;

  /** Variable / performance component in LPA. 0 when isFixed = true. */
  @Prop({ required: true, default: 0 })
  variablePayLpa: number;

  /** Whether CTC is fully fixed (no variable component) */
  @Prop({ required: true, default: false })
  isFixed: boolean;

  @Prop({ required: true })
  expectedHikePct: number;

  @Prop({ required: true, trim: true })
  currentRole: string;

  /** Cities the user is open to relocating to */
  @Prop({ type: [String], default: [] })
  preferredCities: string[];
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
