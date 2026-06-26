import { InterviewService } from './interview.service.js';
import { Types } from 'mongoose';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('InterviewService', () => {
  let service: InterviewService;

  // Mock Mongoose model queries
  const mockInterviewModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockQuestionModel = {
    find: jest.fn(),
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(() => {
    service = new InterviewService(
      mockInterviewModel as any,
      mockQuestionModel as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return a list of interviews', async () => {
      const userId = new Types.ObjectId().toString();
      const mockInterviews = [
        {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(userId),
          companyId: { name: 'Google' },
          rounds: [
            { _id: new Types.ObjectId(), roundNumber: 1, name: 'Coding' },
          ],
        },
      ];

      // Setup mongoose queries chain
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockInterviews),
      };
      mockInterviewModel.find.mockReturnValue(mockQuery);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(mockInterviewModel.find).toHaveBeenCalledWith({
        userId: new Types.ObjectId(userId),
      });
    });
  });

  describe('findQuestions', () => {
    it('should return questions for a given interview', async () => {
      const interviewId = new Types.ObjectId();
      const userId = new Types.ObjectId().toString();
      const mockInterview = {
        _id: interviewId,
        userId: new Types.ObjectId(userId),
      };

      const mockQuestions = [
        {
          _id: new Types.ObjectId(),
          interviewId,
          roundId: new Types.ObjectId(),
          question: 'Write binary search',
        },
      ];

      mockInterviewModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockInterview),
      });

      const mockQuestionQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockQuestions),
      };
      mockQuestionModel.find.mockReturnValue(mockQuestionQuery);

      const result = await service.findQuestions(
        interviewId.toString(),
        userId,
      );

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question).toBe('Write binary search');
      expect(mockQuestionModel.find).toHaveBeenCalledWith({
        interviewId,
      });
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if interview does not exist', async () => {
      const interviewId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      mockInterviewModel.findOne.mockReturnValue(mockQuery);

      await expect(service.findOne(interviewId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if interview does not belong to user', async () => {
      const interviewId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const otherUserId = new Types.ObjectId().toString();

      const mockInterview = {
        _id: new Types.ObjectId(interviewId),
        userId: new Types.ObjectId(otherUserId),
        rounds: [],
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockInterview),
      };
      mockInterviewModel.findOne.mockReturnValue(mockQuery);

      await expect(service.findOne(interviewId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
