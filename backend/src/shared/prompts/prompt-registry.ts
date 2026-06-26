export const OFFER_COMPARISON_SYSTEM_PROMPT =
  'You are a senior compensation analyst helping an Indian software engineer make a job-switching decision. ' +
  'You reason over structured data supplied to you. You never invent salary figures, ratings, company facts, or benefits not present in the supplied data. ' +
  'Every claim must cite which data field drove it. Return only valid JSON. Start with { and end with }.';

export function buildOfferComparisonUserPrompt(
  currentCity: string,
  currentCtcLpa: number,
  leanSnapshots: any[],
  companyContext: any[],
  taskInstruction: string,
  schemaResponse: any,
): string {
  return `Candidate currentCity: "${currentCity}", currentCtcLpa: ${currentCtcLpa} LPA.

DETERMINISTIC SNAPSHOTS (do not modify these figures):
${JSON.stringify(leanSnapshots)}

COMPANY PROFILES:
${JSON.stringify(companyContext)}

TASK: ${taskInstruction}
Return JSON matching this schema:
${JSON.stringify(schemaResponse)}

RULES:
- Never introduce a salary figure not in the snapshot data.
- Never invent a benefit, rating, or company fact not in the company profiles.
- If a field is missing, output "Not available in data". Do not guess.
- Bounds: score 0-100; breakdown: financial 0-40, qualitative 0-40, risk 0-20; sum must equal score exactly.
- bestOffer must match submitted companyName exactly.
- High-salary with poor ratings and high risk must not score above 75.
- benefitForRisk must weigh monthlySavings delta against risk factors.
- If offers are within 5 score points of each other, state this in caveat.`;
}

export const COMPANY_PROFILE_SYSTEM_PROMPT =
  'You are a workplace analyst. Summarize the company profile from the ' +
  'supplied ratings and reviews only. Never invent facts not present in the data. ' +
  'All claims must cite the review source or rating dimension that drove them. ' +
  'Return only valid JSON. Start with { and end with }.';

export function buildCompanyProfileUserPrompt(
  companyName: string,
  ratings: any[],
  reviews: any[],
): string {
  return `Company: "${companyName}"

SEEDED RATINGS (per source):
${JSON.stringify(ratings ?? [])}

SEEDED REVIEWS (snippets):
${JSON.stringify(reviews ?? [])}

Return exactly this JSON object (no extra fields):
{
  "companySize": "<headcount band, e.g. Large (50,000+) or Mid-size (1,000–10,000)>",
  "basicInsurance": "<mediclaim/health insurance typical for this company type>",
  "otherBenefits": ["<max 3 benefits derived from review text or company reputation>"],
  "pros": ["<max 4 items — each must cite which review text or rating dimension drove it>"],
  "cons": ["<max 4 items — each must cite which review text or rating dimension drove it>"],
  "riskLevel": "<low|medium|high — low if jobSecurity > 4.0 across sources, high if < 3.2, else medium>",
  "riskFactors": ["<max 3 factors citing jobSecurity rating or specific review text>"],
  "benefitForRisk": "<one sentence weighing what the company offers against its risk level>"
}

RULES: Pros and cons must be grounded in the supplied reviews or ratings only. If a field cannot be determined, output "Not available in data". Output only the JSON object.`;
}

export const COMPANY_FETCH_SYSTEM_PROMPT =
  'You are a compensation research assistant for Indian tech companies.\n' +
  'Return ONLY valid JSON — no markdown, no extra text.\n' +
  'Data must reflect realistic Indian market conditions as of 2025.\n' +
  'All avgCTC values must be in INR (full number, not LPA shorthand).\n' +
  'All rating values must be floats between 1.0 and 5.0 with one decimal place.';

export function buildCompanyFetchUserPrompt(name: string): string {
  return `Provide realistic 2025 data for the Indian tech company "${name}".

Return exactly this JSON structure (no extra fields):
{
  "aliases": ["<common short names or alternate spellings, max 3>"],
  "roles": [
    {
      "title": "<standard engineering role title>",
      "avgCTC": <integer in INR — e.g. 1200000 for 12 LPA>,
      "experienceMin": <integer years>,
      "experienceMax": <integer years>
    }
  ],
  "ratings": [
    {
      "source": "ambitionbox",
      "wlb": <float 1.0-5.0>,
      "culture": <float 1.0-5.0>,
      "growth": <float 1.0-5.0>,
      "jobSecurity": <float 1.0-5.0>
    },
    {
      "source": "glassdoor",
      "wlb": <float 1.0-5.0>,
      "culture": <float 1.0-5.0>,
      "growth": <float 1.0-5.0>,
      "jobSecurity": <float 1.0-5.0>
    }
  ],
  "reviews": [
    {
      "text": "<realistic employee review snippet, 1-2 sentences>",
      "source": "<ambitionbox or glassdoor>",
      "date": "<YYYY-MM between 2024-01 and 2025-06>",
      "sentiment": "<positive, negative, or mixed>",
      "dimension": "<wlb, culture, growth, jobSecurity, or general>"
    }
  ]
}

RULES:
- Include all standard engineering role bands (e.g. from Associate/Junior Software Engineer to Principal/Manager, covering 0-15+ years experience) that exist for this company, with no experience gaps or overlaps.
- avgCTC must be realistic for the company tier (IT services: 600000-3000000, Indian startups/unicorns: 1500000-10000000, FAANG/MNCs: 2500000-15000000, BFSI: 1500000-9000000).
- Ratings must reflect the company's known reputation in India — do not invent unrealistically high scores.
- Include exactly 2-3 review snippets grounded in the company's actual culture.
- Return only the JSON object.`;
}

export const CITY_EXPENSE_SYSTEM_PROMPT =
  'You are a cost-of-living research assistant for Indian cities. Return ONLY valid JSON — no markdown, no extra text.\n' +
  'The JSON must have exactly these keys: individual, family, family3, family4, family5, family6.\n' +
  "Each key's value must be an expense breakdown object with these integer fields (positive INR per month):\n" +
  'rent, groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous, total.\n' +
  'For each breakdown, the total field MUST equal the exact arithmetic sum of all other fields.\n' +
  'Include a top-level non-empty disclaimer string.';

export function buildCityExpenseUserPrompt(city: string): string {
  return `Provide a realistic, data-driven monthly expense estimate in INR for a middle-class lifestyle specifically in ${city}, India. 

Because the cost of living varies heavily across Indian metros, do NOT use generic or static averages. Use your real-world knowledge of ${city}'s localized real estate market, typical middle-class neighborhoods, and local consumer pricing to generate these numbers.

Strictly adhere to these parameters:
1. Dynamic Real Estate: Estimate the "rent" field based entirely on current middle-class standards in ${city}. Specifically, assume the following accommodation sizes:
   - individual (1 member): 1BHK or shared accommodation
   - family (2 members): 1BHK
   - family3 (3 members): 1-2BHK
   - family4 (4 members): 1-2BHK
   - family5 (5 members): 2-3BHK
   - family6 (6 members): 2-3BHK
   Ensure the rent reflects these standards in standard residential areas of ${city}.
2. Natural Scaling: Ensure that all non-rent fields (groceries, utilities, transport, foodDining, personalLifestyle, miscellaneous) reflect the actual local costs of ${city} and scale up incrementally and logically with each added family member.
3. Strict Integers: Every single expense field must be a realistic, non-zero positive integer.
4. ABSOLUTE MATHEMATICAL CONSTRAINT: For every family size block, the "total" field MUST exactly equal the arithmetic sum of the other fields: rent + groceries + utilities + transport + foodDining + personalLifestyle + miscellaneous. Double-check the math before outputting.

Return ONLY the JSON structure matching the system template. Do not include markdown formatting or conversational text.`;
}
