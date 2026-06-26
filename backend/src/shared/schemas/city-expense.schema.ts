import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FamilyType = 'individual' | 'family';

export class ExpenseBreakdown {
  rent: number;
  groceries: number;
  utilities: number;
  transport: number;
  foodDining: number;
  personalLifestyle: number;
  miscellaneous: number;
  total: number;
}

@Schema({ timestamps: false, collection: 'city-expenses' })
export class CityExpense {
  _id?: any;
  @Prop({ required: true, unique: true, index: true }) city: string;
  @Prop({ required: false }) colIndex?: number;
  @Prop({ required: false }) isBase?: boolean;
  @Prop({ type: Object, required: false }) individual?: ExpenseBreakdown;
  @Prop({ type: Object, required: false }) family?: ExpenseBreakdown; // 2 members
  @Prop({ type: Object, required: false }) family3?: ExpenseBreakdown; // 3 members
  @Prop({ type: Object, required: false }) family4?: ExpenseBreakdown; // 4 members
  @Prop({ type: Object, required: false }) family5?: ExpenseBreakdown; // 5 members
  @Prop({ type: Object, required: false }) family6?: ExpenseBreakdown; // 6 members
  @Prop({ required: false }) generatedBy?: string;
  @Prop({ required: false }) generatedAt?: Date;
  @Prop({ required: false }) modelUsed?: string;
  @Prop({ required: false }) disclaimer?: string;
}

export type CityExpenseDocument = CityExpense & Document;
export const CityExpenseSchema = SchemaFactory.createForClass(CityExpense);
