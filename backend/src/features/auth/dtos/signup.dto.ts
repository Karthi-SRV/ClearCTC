import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @IsString()
  @IsNotEmpty()
  currentCity: string;

  /** Basic / fixed salary component in LPA */
  @IsNumber()
  @Min(0)
  basicPayLpa: number;

  /** Variable / performance component in LPA. Send 0 when isFixed = true. */
  @IsNumber()
  @Min(0)
  variablePayLpa: number;

  /** Computed total CTC = basicPayLpa + variablePayLpa */
  @IsNumber()
  @Min(0)
  currentCtcLpa: number;

  @IsBoolean()
  isFixed: boolean;

  @IsNumber()
  @Min(0)
  expectedHikePct: number;

  @IsString()
  @IsNotEmpty()
  currentRole: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  preferredCities?: string[];
}
