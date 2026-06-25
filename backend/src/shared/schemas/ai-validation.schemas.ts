import { z } from 'zod';

export const AiOfferEntrySchema = z.object({
  companyName: z.string(),
  companySize: z.string().optional(),
  basicInsurance: z.string().optional(),
  otherBenefits: z.array(z.string()).optional(),
  pros: z.array(z.string()).max(4).optional(),
  cons: z.array(z.string()).max(4).optional(),
  riskAssessment: z.object({
    level: z.enum(['low', 'medium', 'high']),
    factors: z.array(z.string()),
    benefitForRisk: z.string(),
  }).optional(),
  score: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    financial: z.number().min(0).max(40),
    qualitative: z.number().min(0).max(40),
    risk: z.number().min(0).max(20),
  }),
}).refine((o) => {
  const sum = (o.scoreBreakdown.financial || 0) + (o.scoreBreakdown.qualitative || 0) + (o.scoreBreakdown.risk || 0);
  return Math.abs(sum - o.score) <= 1;
}, {
  message: 'scoreBreakdown does not sum to score',
  path: ['score'],
});

export const AiOfferComparisonSchema = z.object({
  offers: z.array(AiOfferEntrySchema),
  recommendation: z.object({
    bestOffer: z.string(),
    suggestion: z.string(),
    whyBest: z.string(),
    whyNotOthers: z.record(z.string(), z.string()),
    confidence: z.enum(['low', 'medium', 'high']),
    caveat: z.string(),
  }),
});

export type AiOfferEntry = z.infer<typeof AiOfferEntrySchema>;
export type AiOfferComparisonResponse = z.infer<typeof AiOfferComparisonSchema>;

export const CompanyAiProfileSchema = z.object({
  companySize: z.string().min(1, 'companySize cannot be empty'),
  basicInsurance: z.string().min(1, 'basicInsurance cannot be empty'),
  otherBenefits: z.array(z.string()).max(3, 'otherBenefits exceeds 3 items'),
  pros: z.array(z.string()).max(4, 'pros exceeds 4 items'),
  cons: z.array(z.string()).max(4, 'cons exceeds 4 items'),
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskFactors: z.array(z.string()).max(3, 'riskFactors exceeds 3 items'),
  benefitForRisk: z.string().min(1, 'benefitForRisk cannot be empty'),
});

export type CompanyAiProfileValidationResult = z.infer<typeof CompanyAiProfileSchema>;

export const CompanyFetchRoleSchema = z.object({
  title: z.string().min(1, 'title cannot be empty'),
  avgCTC: z.number().min(100_000).max(100_000_000),
  experienceMin: z.number().int(),
  experienceMax: z.number().int(),
}).refine((r) => r.experienceMin < r.experienceMax, {
  message: 'experienceMin must be less than experienceMax',
  path: ['experienceMin'],
});

export const CompanyFetchRatingSchema = z.object({
  source: z.string().min(1),
  wlb: z.number().min(1).max(5),
  culture: z.number().min(1).max(5),
  growth: z.number().min(1).max(5),
  jobSecurity: z.number().min(1).max(5),
});

export const CompanyFetchReviewSchema = z.object({
  text: z.string().min(1),
  source: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}$/, 'date must be in YYYY-MM format'),
  sentiment: z.enum(['positive', 'negative', 'mixed']),
  dimension: z.enum(['wlb', 'culture', 'growth', 'jobSecurity', 'general']),
});

export const CompanyFetchSchema = z.object({
  aliases: z.array(z.string()),
  roles: z.array(CompanyFetchRoleSchema).min(1, 'roles must contain at least 1 role'),
  ratings: z.array(CompanyFetchRatingSchema).min(1, 'ratings must contain at least 1 rating'),
  reviews: z.array(CompanyFetchReviewSchema).min(1, 'reviews must contain at least 1 review'),
});

export type CompanyFetchValidationResult = z.infer<typeof CompanyFetchSchema>;
