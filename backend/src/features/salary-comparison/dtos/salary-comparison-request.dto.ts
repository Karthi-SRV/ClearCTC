import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { FamilyType } from '../../../shared/schemas/city-expense.schema.js';

export class SalaryComparisonOfferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName: string;

  @IsNumber()
  @Min(1)
  totalCtcLpa: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  variablePct: number;

  @IsBoolean()
  variableGuaranteed: boolean;

  @IsNumber()
  @Min(0)
  joiningBonusLpa: number;

  @IsIn(['statutory', 'none'])
  employerPf: 'statutory' | 'none';

  @IsString()
  @IsNotEmpty()
  targetCity: string;

  @IsBoolean()
  isWfh: boolean;
}

export class QuickSalaryComparisonDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => SalaryComparisonOfferDto)
  offers: SalaryComparisonOfferDto[];

  @IsOptional()
  @IsEnum(['individual', 'family'])
  familyType?: FamilyType = 'family';

  @ValidateIf((o: QuickSalaryComparisonDto) => o.familyType === 'family')
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  memberCount?: number = 4;
}
