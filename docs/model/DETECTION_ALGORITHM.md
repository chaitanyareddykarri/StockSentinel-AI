# Detection Algorithm & Anomaly Formulation

**Module**: StockSentinel AI Detection Engine  
**Implementation**: `src/lib/detector.ts` (TypeScript) and `ml/src/detection/` (Python)  

---

## 1. Problem Formulation

Given:
- A store $s \in S$.
- A product $p \in P$ with retail price $r_p$ and baseline demand $\lambda_p$.
- Recorded on-hand inventory $I_{s,p,t} > 0$ on current date $t$.
- Historical daily sales $Y_{s,p,t-\tau}$ for $\tau \in \{0, 1, \dots, T\}$.

Detect whether the product is suffering from a **phantom stock-out** (i.e. physical shelf stock is zero or depleted despite $I_{s,p,t} > 0$).

---

## 2. Statistical Demand Modeling

### 2.1 Day-of-Week (DoW) Seasonality
Retail foot traffic exhibits cyclic variation. We define normalized multipliers $M_{\text{DoW}}(d)$ for day-of-week $d \in \{0, \dots, 6\}$:
- Sunday ($d=0$): $1.35$
- Monday ($d=1$): $0.85$
- Tuesday ($d=2$): $0.90$
- Wednesday ($d=3$): $0.95$
- Thursday ($d=4$): $1.05$
- Friday ($d=5$): $1.30$
- Saturday ($d=6$): $1.45$

### 2.2 Promotional Demand Lift
When a promotional discount or featured endcap is active on day $t$:
$$M_{\text{promo}}(t) = 1.60$$

### 2.3 Cumulative Expected Demand Rate ($\Lambda$)
Over an observed streak of $k$ consecutive days with 0 sales ($t_1, \dots, t_k$):
$$\Lambda = \sum_{i=1}^{k} \lambda_p \times M_{\text{DoW}}(\text{day}(t_i)) \times M_{\text{promo}}(t_i)$$

---

## 3. Anomaly Probability & Scoring

### 3.1 Poisson Zero Probability
Under a Poisson demand process with cumulative expected rate $\Lambda$, the probability of observing 0 sales is:
$$P(X = 0) = e^{-\Lambda}$$

If $\Lambda = 4.6$ expected units, $P(X=0) = e^{-4.6} \approx 0.010$ (1.0% probability). The smaller $P(X=0)$, the more anomalous the zero streak.

### 3.2 Bounded Risk Score Formulation (0 to 100)
$$\text{Score} = S_{\text{Poisson}} + S_{\text{Streak}} + S_{\text{Stock}} + S_{\text{Promo}}$$

Where:
- $S_{\text{Poisson}} = \text{clamp}\left( (1 - P(X=0)) \times 50, 0, 50 \right)$
- $S_{\text{Streak}} = \text{clamp}\left( \frac{k}{\max(1, 1/\lambda_p)} \times 12, 0, 25 \right)$
- $S_{\text{Stock}} = \text{clamp}\left( \min(I, 20) \times 0.75, 0, 15 \right)$
- $S_{\text{Promo}} = 10 \text{ if active promotion, else } 0$

### 3.3 Velocity Dampening & Fast-Mover Floors
1. **Slow-Mover Shielding**: If $\lambda_p < 0.6$ units/day, zero sales for 2–3 days is normal. We apply:
   $$\text{Score}_{\text{adjusted}} = \lfloor \text{Score} \times 0.65 \rfloor$$
   If $P(X=0) > 0.15$, the candidate is excluded from alerts.
2. **Fast-Mover Floor**: If $\lambda_p \ge 2.5$ units/day, recorded stock $\ge 5$, and $k \ge 3$ consecutive zero days:
   $$\text{Score} = \max(\text{Score}, 78) \quad \implies \text{CRITICAL}$$

---

## 4. Top-20 Daily Shelf Walk Ranking

For each store $s$ on date $t$:
1. Compute $\text{Score}_{s,p}$ for all evaluated SKUs.
2. Sort candidates descending: $\text{Score}_{(1)} \ge \text{Score}_{(2)} \ge \dots \ge \text{Score}_{(N)}$.
3. Truncate to the top 20 candidates per store:
   $$\text{AlertQueue}_s = \{\text{Candidate}_{(1)}, \dots, \text{Candidate}_{(\min(20, N))}\}$$

