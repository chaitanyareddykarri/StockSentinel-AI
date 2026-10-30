import unittest
import math
from ml.src.demand.baseline_poisson import (
    calculate_dow_multiplier,
    calculate_cumulative_lambda,
    compute_poisson_zero_probability,
    DOW_MULTIPLIERS,
)
from ml.src.detection.anomaly_detector import (
    calculate_risk_score,
    detect_streak_anomaly,
)
from ml.src.ranking.store_ranker import rank_store_alerts
from ml.src.explanations.reason_generator import generate_alert_explanation
from ml.src.evaluation.metrics import (
    calculate_precision_at_k,
    calculate_recall,
    calculate_f1_score,
    evaluate_benchmark,
    estimate_annual_recovery_rupees,
)


class TestDemandModule(unittest.TestCase):
    def test_dow_multiplier(self):
        # Sunday peak is 1.35
        self.assertEqual(DOW_MULTIPLIERS[0], 1.35)
        # Monday slump is 0.85
        self.assertEqual(DOW_MULTIPLIERS[1], 0.85)
        # Saturday peak is 1.45
        self.assertEqual(DOW_MULTIPLIERS[6], 1.45)

    def test_cumulative_lambda_and_poisson(self):
        # 3 zero days with baseline demand 2.0 and no promo
        dates = ["2026-10-25", "2026-10-26", "2026-10-27"]
        cum_lambda = calculate_cumulative_lambda(2.0, dates, is_promo=False)
        self.assertGreater(cum_lambda, 0.0)

        # Poisson zero probability
        p_zero = compute_poisson_zero_probability(cum_lambda)
        self.assertTrue(0.0 <= p_zero <= 1.0)
        self.assertAlmostEqual(p_zero, math.exp(-cum_lambda), places=5)


class TestDetectionModule(unittest.TestCase):
    def test_risk_score_bounds(self):
        # High probability anomaly should yield high risk score
        score_high = calculate_risk_score(
            poisson_p=0.001,
            consecutive_zero_days=5,
            base_demand=3.0,
            recorded_stock=15,
            is_promo=True,
        )
        self.assertGreaterEqual(score_high, 75)
        self.assertLessEqual(score_high, 99)

        # Low velocity slow mover should have dampened score
        score_slow = calculate_risk_score(
            poisson_p=0.10,
            consecutive_zero_days=2,
            base_demand=0.4,
            recorded_stock=3,
            is_promo=False,
        )
        self.assertLess(score_slow, 50)

    def test_detect_streak_anomaly(self):
        history = [
            {"date": f"2026-10-{i:02d}", "units_sold": 4} for i in range(1, 10)
        ] + [
            {"date": f"2026-10-{i:02d}", "units_sold": 0} for i in range(10, 15)
        ]
        result = detect_streak_anomaly(
            sales_history=history,
            on_hand_stock=20,
            base_demand=3.5,
            unit_price=12.50,
            is_promo=True,
            min_consecutive_zero_days=2,
        )
        self.assertTrue(result.get("is_anomaly"))
        self.assertEqual(result.get("consecutive_zero_days"), 5)
        self.assertGreater(result.get("risk_score", 0), 75)


class TestRankingModule(unittest.TestCase):
    def test_store_ranker_truncation(self):
        alerts = [
            {"sku": f"SKU-{i}", "risk_score": i, "est_lost_revenue_daily": 10.0}
            for i in range(1, 35)
        ]
        ranked = rank_store_alerts(alerts, max_rank=20)
        self.assertEqual(len(ranked), 20)
        # Highest risk score first
        self.assertEqual(ranked[0]["risk_score"], 34)
        self.assertEqual(ranked[0]["rank"], 1)
        self.assertEqual(ranked[-1]["rank"], 20)


class TestExplanationsModule(unittest.TestCase):
    def test_explanation_generation(self):
        explanation = generate_alert_explanation(
            recorded_stock=12,
            consecutive_zero_days=4,
            expected_daily_sales=3.2,
            poisson_p=0.002,
            is_promo=True,
            base_demand=3.0,
        )
        self.assertIn("12 units in inventory", explanation)
        self.assertIn("4 days during an active promotion", explanation)


class TestEvaluationModule(unittest.TestCase):
    def test_precision_recall_arithmetic(self):
        ranked = [{"store_id": "S1", "sku": f"SKU-{i}"} for i in range(20)]
        ground_truth = {("S1", f"SKU-{i}"): (i < 8) for i in range(20)}
        p20 = calculate_precision_at_k(ranked, ground_truth, k=20)
        self.assertEqual(p20, 40.0)  # 8 / 20 = 40%

        recall = calculate_recall(ranked, ground_truth, k=20)
        self.assertEqual(recall, 100.0)  # 8 / 8 = 100%

        f1 = calculate_f1_score(p20, recall)
        self.assertAlmostEqual(f1, 57.14, places=1)

    def test_annual_rupees_recovery_calculation(self):
        recovery = estimate_annual_recovery_rupees(
            precision_at_20=40.0,
            num_stores=10,
            daily_walks_per_store=20,
            avg_lost_per_phantom_rupees=3000.0,
            resolution_rate=0.85,
            operational_days_per_year=365,
        )
        # 10 stores * 20 walks = 200 investigations
        # 200 * 0.40 precision = 80 phantoms
        # 80 * 0.85 resolution = 68 restocked
        # 68 * 3000 = 204,000 INR daily
        # 204,000 * 365 = 74,460,000 INR annual = 7.45 Crores
        self.assertEqual(recovery["daily_rupees_recovered"], 204000.0)
        self.assertEqual(recovery["annual_rupees_recovered"], 74460000.0)
        self.assertIn("Crores", recovery["formatted_crores"])
        self.assertEqual(len(recovery["calculation_steps"]), 5)



if __name__ == "__main__":
    unittest.main()

