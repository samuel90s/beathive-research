// src/recommendations/evaluation.service.ts
import { Injectable } from '@nestjs/common';

export interface EvaluationResult {
  precisionAtK: number;
  recallAtK: number;
  ndcgAtK: number;
  fMeasure: number;
  averagePrecision: number;
  k: number;
}

export interface BatchEvaluationResult {
  meanPrecisionAtK: number;
  meanRecallAtK: number;
  meanNdcgAtK: number;
  meanFMeasure: number;
  mapAtK: number;
  intralistDiversity: number;
  k: number;
  totalQueries: number;
}

/**
 * Evaluation metrics for offline recommendation quality measurement.
 *
 * Precision@K  : fraction of top-K results that are relevant
 * Recall@K     : fraction of relevant items found in top-K
 * NDCG@K       : ranking quality (relevant items higher = better score)
 * MAP@K        : mean average precision across multiple queries
 * F-Measure    : harmonic mean of precision and recall
 * ILD          : intra-list diversity (average pairwise dissimilarity)
 */
@Injectable()
export class EvaluationService {

  /** Precision@K: hits in top-K / K */
  precisionAtK(relevant: Set<string>, recommended: string[], k: number): number {
    if (k === 0) return 0;
    const hits = recommended.slice(0, k).filter(id => relevant.has(id)).length;
    return hits / k;
  }

  /** Recall@K: hits in top-K / total relevant */
  recallAtK(relevant: Set<string>, recommended: string[], k: number): number {
    if (relevant.size === 0) return 0;
    const hits = recommended.slice(0, k).filter(id => relevant.has(id)).length;
    return hits / relevant.size;
  }

  /**
   * NDCG@K: normalized discounted cumulative gain.
   * DCG = Σ 1/log2(rank+1) for relevant items in top-K
   * NDCG = DCG / IDCG (ideal DCG with all relevant at top)
   */
  ndcgAtK(relevant: Set<string>, recommended: string[], k: number): number {
    const topK = recommended.slice(0, k);
    const dcg = topK.reduce(
      (acc, id, i) => acc + (relevant.has(id) ? 1 / Math.log2(i + 2) : 0),
      0,
    );
    const idealLen = Math.min(relevant.size, k);
    const idcg = Array.from({ length: idealLen }, (_, i) => 1 / Math.log2(i + 2))
      .reduce((a, b) => a + b, 0);
    return idcg > 0 ? dcg / idcg : 0;
  }

  /** Average Precision for a single query. */
  averagePrecision(relevant: Set<string>, recommended: string[], k: number): number {
    if (relevant.size === 0) return 0;
    let hits = 0, sum = 0;
    const topK = recommended.slice(0, k);
    for (let i = 0; i < topK.length; i++) {
      if (relevant.has(topK[i])) {
        hits++;
        sum += hits / (i + 1);
      }
    }
    return sum / Math.min(relevant.size, k);
  }

  /**
   * F-Measure: F_β = (1 + β²) × P × R / (β² × P + R)
   * Default β=1 (F1) gives harmonic mean of P and R.
   */
  fMeasure(precision: number, recall: number, beta = 1): number {
    const b2 = beta * beta;
    const denom = b2 * precision + recall;
    return denom > 0 ? (1 + b2) * precision * recall / denom : 0;
  }

  /** Evaluate a single query. */
  evaluate(relevant: Set<string>, recommended: string[], k: number): EvaluationResult {
    const p = this.precisionAtK(relevant, recommended, k);
    const r = this.recallAtK(relevant, recommended, k);
    return {
      precisionAtK: p,
      recallAtK: r,
      ndcgAtK: this.ndcgAtK(relevant, recommended, k),
      fMeasure: this.fMeasure(p, r),
      averagePrecision: this.averagePrecision(relevant, recommended, k),
      k,
    };
  }

  /** MAP@K over multiple queries. */
  mapAtK(queries: { relevant: Set<string>; recommended: string[] }[], k: number): number {
    if (queries.length === 0) return 0;
    return queries.reduce((acc, q) => acc + this.averagePrecision(q.relevant, q.recommended, k), 0)
      / queries.length;
  }

  /** Batch evaluation: mean metrics across multiple queries. */
  batchEvaluate(
    queries: { relevant: Set<string>; recommended: string[] }[],
    k: number,
    recommendedForDiversity: { categories: string[]; tags: string[] }[][] = [],
  ): BatchEvaluationResult {
    if (queries.length === 0) {
      return { meanPrecisionAtK: 0, meanRecallAtK: 0, meanNdcgAtK: 0, meanFMeasure: 0, mapAtK: 0, intralistDiversity: 0, k, totalQueries: 0 };
    }

    const results = queries.map(q => this.evaluate(q.relevant, q.recommended, k));
    const n = results.length;
    const avgILD = recommendedForDiversity.length > 0
      ? recommendedForDiversity.reduce((acc, r) => acc + this.intralistDiversity(r), 0) / recommendedForDiversity.length
      : 0;

    return {
      meanPrecisionAtK: results.reduce((a, r) => a + r.precisionAtK, 0) / n,
      meanRecallAtK: results.reduce((a, r) => a + r.recallAtK, 0) / n,
      meanNdcgAtK: results.reduce((a, r) => a + r.ndcgAtK, 0) / n,
      meanFMeasure: results.reduce((a, r) => a + r.fMeasure, 0) / n,
      mapAtK: this.mapAtK(queries, k),
      intralistDiversity: avgILD,
      k,
      totalQueries: n,
    };
  }

  /**
   * Intra-List Diversity (ILD): average pairwise Jaccard distance
   * among the recommended items' category+tag sets.
   * 1.0 = fully diverse, 0.0 = all identical.
   */
  intralistDiversity(items: { categories: string[]; tags: string[] }[]): number {
    if (items.length < 2) return 0;
    let total = 0, pairs = 0;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const catDist = 1 - this.jaccardSim(new Set(items[i].categories), new Set(items[j].categories));
        const tagDist = 1 - this.jaccardSim(new Set(items[i].tags), new Set(items[j].tags));
        total += catDist * 0.6 + tagDist * 0.4;
        pairs++;
      }
    }
    return pairs > 0 ? total / pairs : 0;
  }

  private jaccardSim(a: Set<string>, b: Set<string>): number {
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 ? intersection / union : 0;
  }
}
