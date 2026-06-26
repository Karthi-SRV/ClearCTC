import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../shared/schemas/user.schema.js';
import { SignupDto } from './dtos/signup.dto.js';
import { LoginDto } from './dtos/login.dto.js';

const SALT_ROUNDS = 12;

export interface AuthPayload {
  sub: string;
  email: string;
}

export interface AuthUser {
  id: string;
  email: string;
  currentCity: string;
  currentCtcLpa: number;
  basicPayLpa: number;
  variablePayLpa: number;
  isFixed: boolean;
  expectedHikePct: number;
  currentRole: string;
  preferredCities: string[];
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const exists = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .lean()
      .exec();

    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Ensure CTC = basic + variable (trust the client but also self-correct)
    const basicPayLpa = dto.basicPayLpa;
    const variablePayLpa = dto.isFixed ? 0 : dto.variablePayLpa;
    const currentCtcLpa = Math.round((basicPayLpa + variablePayLpa) * 10) / 10;

    const created = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      currentCity: dto.currentCity,
      basicPayLpa,
      variablePayLpa,
      currentCtcLpa,
      isFixed: dto.isFixed,
      expectedHikePct: dto.expectedHikePct,
      currentRole: dto.currentRole,
      preferredCities: dto.preferredCities ?? [],
    });

    return this.buildResponse(created);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildResponse(user);
  }

  private buildResponse(user: UserDocument): AuthResponse {
    const payload: AuthPayload = {
      sub: (user as any)._id.toString(),
      email: user.email,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: (user as any)._id.toString(),
        email: user.email,
        currentCity: user.currentCity,
        currentCtcLpa: user.currentCtcLpa,
        basicPayLpa: user.basicPayLpa,
        variablePayLpa: user.variablePayLpa,
        isFixed: user.isFixed,
        expectedHikePct: user.expectedHikePct,
        currentRole: user.currentRole,
        preferredCities: user.preferredCities ?? [],
      },
    };
  }
}
