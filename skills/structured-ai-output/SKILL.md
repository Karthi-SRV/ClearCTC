# Skill: structured-ai-output

## When to load this skill

Load this skill whenever any task involves:
- Writing a prompt that must return JSON
- Parsing an AI response into typed application data
- Validating AI output before storing or rendering it
- Adding a new AI-powered data fetch (expenses, company profile, offer reasoning)
- Handling AiParseError in a service or filter

---

## Core principle

The AI produces structured estimates. The application validates them before
trusting them. If validation fails, the response is rejected — never stored,
never rendered. This is non-negotiable.

---

## Prompt construction rules

### System prompt (always the same pattern)
```
You are a [role] with knowledge of [domain] as of [year].
Return only valid JSON — no prose, no markdown, no explanation.
Start your response with { and end with }.
```

The "start with { end with }" instruction is important for local models (Ollama)
which often wrap JSON in backticks even when told not to.

### User prompt structure
```
[Context about what the user is trying to do]

[Structured input data as JSON — the facts the AI reasons over]

Return exactly this JSON shape:
[schema definition]

Rules you must follow:
- [constraint 1]
- [constraint 2]
- If uncertain about a field, use [fallback] — do not guess
```

### Temperature
Always use low temperature (0.1–0.2) for structured output.
Higher temperature increases creative variation — harmful for JSON compliance.

---

## The three AI calls in Paisa Sahi

### 1. City expense breakdown (CityExpenseFetchService)

Purpose: estimate monthly living costs for a family of 3 in a given city.

System: `You are a compensation research assistant. Return only valid JSON. No prose. No markdown. Start with { and end with }.`

User:
```
Provide a realistic monthly expense breakdown for a salaried professional
living in {city}, India in 2025–26. Assume a family of 3 (couple + 1
school-going child). Include rent for a decent 2BHK in a good residential
area, not city centre.

Return exactly this JSON shape:
{
  "rent": <integer>,
  "groceries": <integer>,
  "utilities": <integer>,
  "transport": <integer>,
  "foodDining": <integer>,
  "personalLifestyle": <integer>,
  "kidsEducation": <integer>,
  "insurance": <integer>,
  "miscellaneous": <integer>,
  "total": <integer>,
  "disclaimer": "<one sentence — estimates for planning purposes only>"
}

All values in INR per month as integers.
total must equal the exact sum of all other fields.
disclaimer must be a non-empty string.
```

Validation (throw AiParseError if any fail):
- Every numeric field is a positive integer.
- `total === rent + groceries + utilities + transport + foodDining + personalLifestyle + kidsEducation + insurance + miscellaneous` exactly.
- `disclaimer` is a non-empty string.

### 2. Company profile (CompanyFetchService)

Purpose: generate structured company data for offer comparison.

System: `You are a compensation research analyst with knowledge of Indian companies as of 2025-26. Return only valid JSON. No prose. No markdown. Start with { and end with }.`

User:
```
Generate a structured company profile for "{companyName}" for Indian software
engineers evaluating job offers in 2025-26.

Include:
- companyType: one of startup | mid-size | large-enterprise | mnc
- payStructure: { basicPct (30–60% of fixed), hraPct (% of basic), pfApplicable }
- insurance: { healthCoverLpa, isFamilyFloater, termInsuranceIncluded, notes }
- otherBenefits: string array, max 6
- ratings: 1–2 sources, each { overall, wlb, culture, growth, jobSecurity, source, asOf }
- reviewSnippets: 2–3 items { text (max 30 words), sentiment, source, asOf }
- pros: max 5 strings
- cons: max 5 strings
- roleBenchmarks: for Junior SE / SE / Senior SE / Tech Lead / EM
  each { role, minCtcLpa, medianCtcLpa, maxCtcLpa }
- disclaimer: one sentence — AI-generated estimates for planning only

Rules:
- basicPct must be between 30 and 60.
- All ratings must be 1.0–5.0.
- For each benchmark: minCtcLpa ≤ medianCtcLpa ≤ maxCtcLpa.
- pros and cons: max 5 items each.
- If uncertain: use "Not available" for strings, 0 for numbers.
```

Validation (throw AiParseError if any fail):
- `basicPct` between 30 and 60.
- Every rating field between 1.0 and 5.0.
- Every benchmark: `min ≤ median ≤ max`.
- `pros.length ≤ 5` and `cons.length ≤ 5`.
- `disclaimer` non-empty.

### 3. Offer comparison reasoning (OfferComparisonService)

Purpose: reason over pre-computed offer snapshots and produce a ranked recommendation.

System:
```
You are a senior compensation analyst helping an Indian software engineer
make a job-switching decision. You reason over structured data supplied to
you. You never invent salary figures, ratings, or company facts not present
in the input. Every claim must cite the data field that drove it.
Return only valid JSON. Start with { and end with }.
```

User:
```
The candidate is in {currentCity} earning {currentCtcLpa} LPA.

OFFER SNAPSHOTS (deterministic — computed by the backend — trust exactly):
{JSON.stringify(snapshots)}

COMPANY DATA (from database — use for ratings and benefits):
{JSON.stringify(companyProfiles)}

Reason over all offers together. Return this exact JSON:
{
  "offers": [{
    "companyName": string,
    "companySize": string,
    "basicInsurance": string,
    "otherBenefits": string[],
    "employeeRating": { "overall": number, "wlb": number, "culture": number,
      "growth": number, "jobSecurity": number, "source": string,
      "disagreementFlag": string | null },
    "pros": string[],      // max 4; cite data field
    "cons": string[],      // max 4; cite data field
    "riskAssessment": { "level": "low"|"medium"|"high",
      "factors": string[], "benefitForRisk": string },
    "score": number,       // 0–100
    "scoreBreakdown": { "financial": number, "qualitative": number, "risk": number }
  }],
  "recommendation": {
    "bestOffer": string,
    "suggestion": string,
    "whyBest": string,
    "whyNotOthers": { "<companyName>": string },
    "confidence": "high"|"medium"|"low",
    "caveat": string
  }
}

Rules:
- Never introduce a salary figure not in the snapshot data.
- Never invent a company benefit not in the company data.
- If a field is missing from company data: say "Not available in data".
- score must reflect the data — high salary + poor WLB + high risk ≠ score 95.
- financial + qualitative + risk components must sum to ≤ 100.
- bestOffer must exactly match one of the submitted companyName values.
- pros and cons: max 4 each.
- If offers are within 5 points of each other, state this in caveat.
```

Validation (throw AiParseError if any fail):
- Every `score` is 0–100.
- `scoreBreakdown.financial + scoreBreakdown.qualitative + scoreBreakdown.risk ≤ 100`.
- `bestOffer` exactly matches one submitted `companyName`.
- `pros.length ≤ 4` and `cons.length ≤ 4` for every offer.
- `riskAssessment.level` is one of `low | medium | high`.

---

## AiParseError

```typescript
// core/ai/ai-parse.error.ts
export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiParseError';
  }
}
```

Caught by `AiExceptionFilter` → returns 502 with safe message.
Never expose raw AI response or internal error details to the client.

---

## AiResponseParser

```typescript
// core/ai/ai-response-parser.ts
export class AiResponseParser {
  static parse<T>(
    raw: AiRawResponse,
    validate: (data: unknown) => T,
  ): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.content);
    } catch {
      throw new AiParseError(
        `JSON parse failed — provider: ${raw.provider}, model: ${raw.model}`
      );
    }
    try {
      return validate(parsed);
    } catch (err) {
      throw new AiParseError(
        `Validation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
```

Never call `JSON.parse` directly on AI output anywhere in the codebase.
Always go through `AiResponseParser.parse<T>()`.

---

## AiExceptionFilter

```typescript
// shared/filters/ai-exception.filter.ts
@Catch(AiParseError)
export class AiExceptionFilter implements ExceptionFilter {
  catch(exception: AiParseError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(502).json({
      statusCode: 502,
      message: 'AI service returned an unexpected response. Please try again.',
      // Never include exception.message — may contain raw AI output
    });
  }
}
```

Register globally in `main.ts`:
```typescript
app.useGlobalFilters(new AiExceptionFilter());
```

---

## Common mistakes to avoid

| Mistake | Correct |
|---|---|
| `JSON.parse(raw.content)` directly in a service | Always use `AiResponseParser.parse<T>()` |
| Rendering `data.content[0].text` directly to the DOM | Parse, validate, then render typed fields |
| Asking the AI to compute tax or take-home in the prompt | Supply computed numbers; AI reasons over them |
| No timeout on AI HTTP call | Always use `AbortSignal.timeout(30_000)` |
| Not validating total === sum in expense breakdown | The model can return arithmetic errors — always verify |
| Making N AI calls for N offers | One call with all offers together — enables relative reasoning |
| Using high temperature for structured output | Use 0.1–0.2 for JSON compliance |
| Storing AI response without validation | Validate first, store after — never the reverse |