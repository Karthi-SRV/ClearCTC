import {
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInterviewRoundDto {
  @IsInt()
  @Min(1)
  roundNumber: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['Completed', 'Pending', 'Expected', 'Waiting'])
  status: string;

  @IsOptional()
  @IsString()
  feedback?: string = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questions?: string[] = [];
}

export class CreateInterviewDto {
  @IsMongoId()
  companyId: string;

  @IsMongoId()
  positionId: string;

  @IsMongoId()
  locationId: string;

  @IsInt()
  @Min(1)
  totalRounds: number;

  @IsNumber()
  @Min(0)
  expectedPackage: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  companyProposed?: number = 0;

  @Matches(/^(Shared Resume|Shortlisted|In-Progress|Hold|Selected|Offer Released|Rejected|Moved to Round \d+)$/, {
    message: 'status must be a valid interview status (e.g., Shared Resume, In-Progress, or Moved to Round X)',
  })
  status: string;

  @IsOptional()
  @IsString()
  lastRoundFeedback?: string = '';

  @IsOptional()
  @IsString()
  contactNo?: string = '';

  @IsOptional()
  @IsString()
  contactName?: string = '';

  @IsOptional()
  @IsString()
  contactEmail?: string = '';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInterviewRoundDto)
  rounds: CreateInterviewRoundDto[];
}
