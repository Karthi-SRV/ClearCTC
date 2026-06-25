import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class AiProfile {
  @Prop({ required: true }) companySize: string;
  @Prop({ required: true }) basicInsurance: string;
  @Prop([String]) otherBenefits: string[];
  @Prop([String]) pros: string[];
  @Prop([String]) cons: string[];
  @Prop({ required: true }) riskLevel: string;
  @Prop([String]) riskFactors: string[];
  @Prop({ required: true }) benefitForRisk: string;
  @Prop({ required: true }) generatedAt: Date;
}

export const AiProfileSchema = SchemaFactory.createForClass(AiProfile);

@Schema()
export class RoleBenchmark {
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) avgCTC: number;
  @Prop({ required: true }) experienceMin: number;
  @Prop({ required: true }) experienceMax: number;
}

export const RoleBenchmarkSchema = SchemaFactory.createForClass(RoleBenchmark);

@Schema()
export class RatingSet {
  @Prop({ required: true }) source: string;
  @Prop({ required: true }) wlb: number;
  @Prop({ required: true }) culture: number;
  @Prop({ required: true }) growth: number;
  @Prop({ required: true }) jobSecurity: number;
}

export const RatingSetSchema = SchemaFactory.createForClass(RatingSet);

@Schema()
export class ReviewSnippet {
  @Prop({ required: true }) text: string;
  @Prop({ required: true }) source: string;
  @Prop({ required: true }) date: string;
  @Prop({ required: true }) sentiment: string;
  @Prop({ required: true }) dimension: string;
}

export const ReviewSnippetSchema = SchemaFactory.createForClass(ReviewSnippet);

@Schema({ timestamps: false })
export class Company {
  @Prop({ required: true, unique: true }) name: string;
  @Prop({ type: [String], index: true }) aliases: string[];
  @Prop({ type: [RoleBenchmarkSchema] }) roles: RoleBenchmark[];
  @Prop({ type: [RatingSetSchema] }) ratings: RatingSet[];
  @Prop({ type: [ReviewSnippetSchema] }) reviews: ReviewSnippet[];
  @Prop({ required: true }) dataAsOf: Date;
  @Prop({ type: AiProfileSchema, default: null }) aiProfile: AiProfile | null;
}

export type CompanyDocument = Company & Document;
export const CompanySchema = SchemaFactory.createForClass(Company);
