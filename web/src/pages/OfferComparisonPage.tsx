import { useState } from 'react';
import OfferComparisonForm from '../components/OfferComparisonForm';
import OfferComparisonResult from '../components/OfferComparisonResult';
import type { Phase2Response } from '../types';

export default function OfferComparisonPage() {
  const [result, setResult] = useState<Phase2Response | null>(null);

  return (
    <main className="page">
      <h2>AI Comparison</h2>
      <p className="subtitle">
        See real post-tax take-home for each offer, adjusted for city cost-of-living.
      </p>
      <OfferComparisonForm onResult={setResult} />
      {result && <OfferComparisonResult result={result} />}
    </main>
  );
}
