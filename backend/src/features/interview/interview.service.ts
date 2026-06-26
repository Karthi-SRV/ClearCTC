import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Interview,
  InterviewDocument,
} from '../../shared/schemas/interview.schema.js';
import {
  InterviewQuestion,
  InterviewQuestionDocument,
} from '../../shared/schemas/interview-question.schema.js';
import { CreateInterviewDto } from './dtos/create-interview.dto.js';
import { UpdateInterviewDto } from './dtos/update-interview.dto.js';

@Injectable()
export class InterviewService {
  constructor(
    @InjectModel(Interview.name)
    private readonly interviewModel: Model<InterviewDocument>,
    @InjectModel(InterviewQuestion.name)
    private readonly questionModel: Model<InterviewQuestionDocument>,
  ) {}

  async findAll(userId: string): Promise<unknown[]> {
    const list = await this.interviewModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('companyId', 'name')
      .populate('positionId', 'name')
      .populate('locationId', 'city')
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    return list as unknown[];
  }

  async findOne(id: string, userId: string): Promise<unknown> {
    const item = await this.interviewModel
      .findOne({ _id: new Types.ObjectId(id) })
      .populate('companyId', 'name ratings reviews aiProfile')
      .populate('positionId', 'name')
      .populate('locationId', 'city colIndex')
      .lean()
      .exec();

    if (!item) {
      throw new NotFoundException(`Interview with ID ${id} not found`);
    }

    if (item.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this interview',
      );
    }

    return item as unknown;
  }

  async findQuestions(
    id: string,
    userId: string,
  ): Promise<{ questions: unknown[] }> {
    const interview = await this.interviewModel
      .findOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (!interview) {
      throw new NotFoundException(`Interview with ID ${id} not found`);
    }

    if (interview.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access these questions',
      );
    }

    const questions = await this.questionModel
      .find({ interviewId: new Types.ObjectId(id) })
      .lean()
      .exec();
    return { questions: questions as unknown[] };
  }

  async create(userId: string, dto: CreateInterviewDto): Promise<unknown> {
    const interviewDoc = new this.interviewModel({
      userId: new Types.ObjectId(userId),
      companyId: new Types.ObjectId(dto.companyId),
      positionId: new Types.ObjectId(dto.positionId),
      locationId: new Types.ObjectId(dto.locationId),
      totalRounds: dto.totalRounds,
      expectedPackage: dto.expectedPackage,
      companyProposed: dto.companyProposed || 0,
      status: dto.status,
      lastRoundFeedback: dto.lastRoundFeedback || '',
      contactNo: dto.contactNo || '',
      contactName: dto.contactName || '',
      contactEmail: dto.contactEmail || '',
      rounds: dto.rounds.map((r) => ({
        roundNumber: r.roundNumber,
        name: r.name,
        status: r.status,
        feedback: r.feedback || '',
      })),
    });

    const saved = await interviewDoc.save();

    // Now insert individual questions for each round
    for (const round of saved.rounds) {
      const match = dto.rounds.find((r) => r.roundNumber === round.roundNumber);
      if (match?.questions && match.questions.length > 0) {
        const questionDocs = match.questions.map((q) => ({
          interviewId: saved._id,
          roundId: round._id,
          question: q,
        }));
        await this.questionModel.insertMany(questionDocs);
      }
    }

    return this.findOne(saved._id.toString(), userId);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateInterviewDto,
  ): Promise<unknown> {
    const interview = await this.interviewModel
      .findOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (!interview) {
      throw new NotFoundException(`Interview with ID ${id} not found`);
    }

    if (interview.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this interview',
      );
    }

    if (dto.companyId) interview.companyId = new Types.ObjectId(dto.companyId);
    if (dto.positionId)
      interview.positionId = new Types.ObjectId(dto.positionId);
    if (dto.locationId)
      interview.locationId = new Types.ObjectId(dto.locationId);
    if (dto.totalRounds !== undefined) interview.totalRounds = dto.totalRounds;
    if (dto.expectedPackage !== undefined)
      interview.expectedPackage = dto.expectedPackage;
    if (dto.companyProposed !== undefined)
      interview.companyProposed = dto.companyProposed;
    if (dto.status) interview.status = dto.status;
    if (dto.lastRoundFeedback !== undefined)
      interview.lastRoundFeedback = dto.lastRoundFeedback;
    if (dto.contactNo !== undefined) interview.contactNo = dto.contactNo;
    if (dto.contactName !== undefined) interview.contactName = dto.contactName;
    if (dto.contactEmail !== undefined)
      interview.contactEmail = dto.contactEmail;

    if (dto.rounds) {
      // 1. Maintain round updates
      const newRounds = dto.rounds.map((r) => {
        const existingRound = interview.rounds.find(
          (ex) =>
            ex.roundNumber === r.roundNumber ||
            (r._id && ex._id.toString() === r._id),
        );
        return {
          _id: existingRound ? existingRound._id : new Types.ObjectId(),
          roundNumber: r.roundNumber,
          name: r.name,
          status: r.status,
          feedback: r.feedback || '',
        };
      });

      interview.rounds = newRounds;
      await interview.save();

      // 2. Refresh questions for the rounds
      for (const r of dto.rounds) {
        const matchingRoundObj = interview.rounds.find(
          (ex) => ex.roundNumber === r.roundNumber,
        );
        if (matchingRoundObj) {
          // Delete old questions
          await this.questionModel.deleteMany({
            interviewId: interview._id,
            roundId: matchingRoundObj._id,
          });

          // Insert new questions if provided
          if (r.questions && r.questions.length > 0) {
            const questionDocs = r.questions.map((q) => ({
              interviewId: interview._id,
              roundId: matchingRoundObj._id,
              question: q,
            }));
            await this.questionModel.insertMany(questionDocs);
          }
        }
      }
    } else {
      await interview.save();
    }

    return this.findOne(id, userId);
  }

  async delete(id: string, userId: string): Promise<{ success: boolean }> {
    const interview = await this.interviewModel
      .findOne({ _id: new Types.ObjectId(id) })
      .exec();
    if (!interview) {
      throw new NotFoundException(`Interview with ID ${id} not found`);
    }

    if (interview.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this interview',
      );
    }

    await this.interviewModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();

    // Clean up all round questions
    await this.questionModel
      .deleteMany({ interviewId: new Types.ObjectId(id) })
      .exec();

    return { success: true };
  }
}
