# SmartChoice Recommendation Engine Scoring Redesign — Mathematical Design Specification

## 1. Architectural Separation: Nutritional Classification vs. Match Scoring

A fundamental finding of the system audit was the conflation of **statutory nutritional classification** (e.g. FSSAI / CODEX benchmarks for "Low Sodium", "High Protein", "Low Sugar") with **personalized Match percentage scoring**.

- **Nutritional Classification (Objective Reference Standards)**:
  - Classifies products into discrete regulatory buckets (e.g. *Very Low Sodium*, *Low Sodium*, *Moderate Sodium*, *High Sodium*).
  - Governed by codified FSSAI Advertising & Claims Regulations and CODEX Alimentarius Guidelines.
  - Used for objective labeling, filters, and nutritional claims.

- **Personalized Match Score (Continuous Dynamic Optimization)**:
  - Quantifies how closely a product aligns with an individual user's active health preferences.
  - Must provide continuous discrimination across the nutritional spectrum, including within statutory claim boundaries:
    - A product with $0\text{ mg}$ sodium achieves higher compatibility than a product with $120\text{ mg}$ sodium ($100\%$ vs $85\%$).
    - A product with $45\text{g}$ protein achieves higher compatibility than a product with $20\text{g}$ protein ($100\%$ vs $90\%$).
    - A product with $0\text{g}$ sugar achieves higher compatibility than a product with $2.5\text{g}$ sugar ($100\%$ vs $90\%$).
  - Never relies on catalogue-wide min/max/mean/median; scoring is 100% independent of catalogue composition.

---

## 2. Redesigned Individual Nutritional Preference Formulas

Each nutritional preference implements a continuous piecewise-linear mapping $f: \mathbb{R}_{\ge 0} \rightarrow [0, 100]$ with strict monotonicity and continuous boundary transitions.

### 2.1 Low Sodium (Solid & Liquid)
- **Reference Points**:
  - $0\text{ mg}$ (Absolute zero sodium): $100\%$
  - $40\text{ mg}$ (FSSAI/CODEX "Very Low Sodium" boundary): $95\%$
  - $120\text{ mg}$ (FSSAI/CODEX "Low Sodium" statutory threshold): $85\%$
  - $400\text{ mg}$ (Moderate sodium ceiling): $50\%$
  - $600\text{ mg}$ (High sodium threshold): $20\%$
  - $1000\text{ mg}$ (Excessive sodium ceiling): $0\%$
- **Mathematical Function**:
  $$\text{score}(s) = \begin{cases} 
  \text{round}\left(100 - \frac{s}{40} \times 5\right) & 0 \le s \le 40 \\
  \text{round}\left(95 - \frac{s - 40}{80} \times 10\right) & 40 < s \le 120 \\
  \text{round}\left(85 - \frac{s - 120}{280} \times 35\right) & 120 < s \le 400 \\
  \text{round}\left(50 - \frac{s - 400}{200} \times 30\right) & 400 < s \le 600 \\
  \max\left(0, \text{round}\left(20 - \frac{s - 600}{400} \times 20\right)\right) & 600 < s \le 1000 \\
  0 & s > 1000
  \end{cases}$$

### 2.2 Low Sugar
- **Solid**:
  - $0\text{g}$ (Sugar-free): $100\%$
  - $2.5\text{g}$ (FSSAI "Low Sugar" statutory threshold): $90\%$
  - $5.0\text{g}$ (Moderate sugar threshold): $75\%$
  - $15.0\text{g}$ (High sugar threshold): $35\%$
  - $25.0\text{g}$ (Excessive sugar ceiling): $0\%$
  - Formula:
    $$\text{score}(s) = \begin{cases}
    \text{round}\left(100 - \frac{s}{2.5} \times 10\right) & 0 \le s \le 2.5 \\
    \text{round}\left(90 - \frac{s - 2.5}{2.5} \times 15\right) & 2.5 < s \le 5.0 \\
    \text{round}\left(75 - \frac{s - 5.0}{10.0} \times 40\right) & 5.0 < s \le 15.0 \\
    \max\left(0, \text{round}\left(35 - \frac{s - 15.0}{10.0} \times 35\right)\right) & 15.0 < s \le 25.0 \\
    0 & s > 25.0
    \end{cases}$$
- **Liquid** (Beverages):
  - $0\text{g} \rightarrow 100\%$
  - $1.0\text{g} \rightarrow 90\%$
  - $2.5\text{g} \rightarrow 75\%$
  - $7.5\text{g} \rightarrow 30\%$
  - $11.25\text{g} \rightarrow 0\%$

### 2.3 High Protein
- **Solid**:
  - $0\text{g} \rightarrow 0\%$
  - $5.0\text{g} \rightarrow 35\%$
  - $10.0\text{g}$ (FSSAI "Source of Protein"): $70\%$
  - $20.0\text{g}$ (FSSAI "High in Protein"): $90\%$
  - $45.0\text{g}$ (Concentrates / Isolates / Pure Protein benchmark): $100\%$
  - Above $45.0\text{g}$: $100\%$ (up to $100\text{g}$, beyond which flagged `INVALID`).
  - Formula:
    $$\text{score}(p) = \begin{cases}
    \text{round}\left(\frac{p}{5.0} \times 35\right) & 0 \le p < 5.0 \\
    \text{round}\left(35 + \frac{p - 5.0}{5.0} \times 35\right) & 5.0 \le p < 10.0 \\
    \text{round}\left(70 + \frac{p - 10.0}{10.0} \times 20\right) & 10.0 \le p < 20.0 \\
    \text{round}\left(90 + \frac{p - 20.0}{25.0} \times 10\right) & 20.0 \le p < 45.0 \\
    100 & 45.0 \le p \le 100.0
    \end{cases}$$
- **Liquid**:
  - $0\text{g} \rightarrow 0\%$
  - $3.0\text{g}$ (Source of Protein): $60\%$
  - $6.0\text{g}$ (High Protein): $90\%$
  - $12.0\text{g}$: $100\%$

### 2.4 High Fibre
- **Solid**:
  - $0\text{g} \rightarrow 0\%$
  - $3.0\text{g}$ (FSSAI "Source of Fibre"): $40\%$
  - $6.0\text{g}$ (FSSAI "High in Fibre"): $80\%$
  - $8.0\text{g}$ (Very High Fibre): $90\%$
  - $15.0\text{g}$ (Exceptional Fibre): $100\%$
  - Above $15.0\text{g}$: $100\%$
- **Special Categories**:
  - Brewed infusions, spices, cooking oils $\rightarrow 0\%$ (non-contributory).

### 2.5 Low Calories (Continuous Discontinuity-Free Formula)
- **Solid**:
  - Solves the $400/401\text{ kcal}$ cliff ($5\% \rightarrow 0\%$) by smoothly extending linear descent to $500\text{ kcal}$.
  - $0\text{ kcal} \rightarrow 100\%$
  - $40\text{ kcal}$ (FSSAI Low Energy benchmark): $90\%$
  - $120\text{ kcal}$: $70\%$
  - $250\text{ kcal}$: $35\%$
  - $400\text{ kcal}$: $10\%$
  - $500\text{ kcal}$: $0\%$
  - Above $500\text{ kcal}$: $0\%$
  - Formula:
    $$\text{score}(c) = \begin{cases}
    \text{round}\left(100 - \frac{c}{40} \times 10\right) & 0 \le c \le 40 \\
    \text{round}\left(90 - \frac{c - 40}{80} \times 20\right) & 40 < c \le 120 \\
    \text{round}\left(70 - \frac{c - 120}{130} \times 35\right) & 120 < c \le 250 \\
    \text{round}\left(35 - \frac{c - 250}{150} \times 25\right) & 250 < c \le 400 \\
    \max\left(0, \text{round}\left(10 - \frac{c - 400}{100} \times 10\right)\right) & 400 < c \le 500 \\
    0 & c > 500
    \end{cases}$$
- **Liquid**:
  - $0\text{ kcal} \rightarrow 100\%$
  - $20\text{ kcal} \rightarrow 90\%$
  - $60\text{ kcal} \rightarrow 60\%$
  - $120\text{ kcal} \rightarrow 20\%$
  - $180\text{ kcal} \rightarrow 0\%$

### 2.6 Low Saturated Fat
- **Solid & Liquid**:
  - $0\text{g} \rightarrow 100\%$
  - $0.5\text{g} \rightarrow 95\%$
  - $1.5\text{g}$ (FSSAI Low Saturated Fat): $85\%$
  - $5.0\text{g}$: $45\%$
  - $10.0\text{g}$: $0\%$

### 2.7 Low Fat
- **Solid**:
  - $0\text{g} \rightarrow 100\%$
  - $1.5\text{g} \rightarrow 95\%$
  - $3.0\text{g}$ (FSSAI Low Fat): $85\%$
  - $10.0\text{g}$: $50\%$
  - $25.0\text{g}$: $0\%$
- **Liquid**:
  - $0\text{g} \rightarrow 100\%$
  - $0.75\text{g} \rightarrow 95\%$
  - $1.5\text{g}$ (FSSAI Low Fat Liquid): $85\%$
  - $3.0\text{g} \rightarrow 50\%$
  - $10.0\text{g} \rightarrow 0\%$

---

## 3. Multi-Preference Aggregation Engine

### Model Comparison & Justification
- **Arithmetic Mean**: Exhibited severe dilution ($[100, 0] \rightarrow 50\%$).
- **Geometric Mean**: Zero-annihilation converted all soft preferences into absolute hard disqualifications ($[100, 100, 0] \rightarrow 0\%$).
- **Current Hybrid ($0.70\text{avg} + 0.30\text{min}$)**: Suffered from dilution when $N$ increased ($[100, 0] \rightarrow 35\%$, $[100, 0, 100] \rightarrow 47\%$, $[100, 0, 100, 100] \rightarrow 53\%$).
- **Redesigned Hybrid Model with Critical Failure Cap (Adopted)**:
  Let $S = [s_1, s_2, \dots, s_N]$.
  $$\text{avg} = \frac{1}{N} \sum s_i, \quad \text{min} = \min(S)$$
  Base score:
  $$\text{baseScore} = 0.65 \times \text{avg} + 0.35 \times \text{min}$$
  **Critical Failure Guard**:
  If a product completely fails one of the user's active goals ($\text{min} = 0$), its combined score is strictly capped:
  $$\text{cap} = \max(15, 30 - (\text{zeroCount} - 1) \times 10)$$
  $$\text{score} = \min(\text{baseScore}, \text{cap})$$
  If $\text{min} < 35$ (severe weakness):
  $$\text{cap} = 40 + \left(\frac{\text{min}}{35}\right) \times 15$$
  $$\text{score} = \min(\text{baseScore}, \text{cap})$$

### Behavior Under Standard Test Vectors
- $[100, 100] \rightarrow \mathbf{100\%}$
- $[100, 0] \rightarrow \mathbf{30\%}$
- $[100, 0, 100] \rightarrow \mathbf{30\%}$ (Dilution eliminated: capped at 30%)
- $[100, 0, 100, 100] \rightarrow \mathbf{30\%}$ (Dilution eliminated: capped at 30%)
- $[100, 88, 100, 100] \rightarrow \mathbf{94\%}$ (High compatibility across all dimensions)
- $[100, 40] \rightarrow \mathbf{60\%}$
- $[50, 50] \rightarrow \mathbf{50\%}$
- $[100, 100, 100, 100] \rightarrow \mathbf{100\%}$

---

## 4. Missing and Invalid Data Policy

### Five Explicit Evaluation States
1. `VERIFIED_MATCH`: Complete, authentic nutrition data satisfying the preference ($\text{score} \ge 75$).
2. `PARTIAL_MATCH`: Complete data moderately satisfying the preference ($35 \le \text{score} < 75$).
3. `NO_MATCH`: Complete data failing the preference ($\text{score} < 35$).
4. `UNKNOWN`: Nutritional information is undeclared on package label ($\text{score} = 40$, flagged as unverified uncertainty).
5. `INVALID`: Numerical values violate physical laws or mass balance ($> 100\text{g}/100\text{g}$, negative calories, or macro sum $> 115\text{g}$) ($\text{score} = 15$, flagged as corrupted data).

### Aggregation Treatment
- Unknown values are penalized with score $40$, ensuring they never masquerade as positive matches.
- In single-preference sorting, products with missing values are placed after all verified products (`?? 99999` for ascending nutrients, `?? -1` for descending nutrients).
- Match Score (compatibility), Quality Score (intrinsic healthfulness), Confidence (data certainty), and Data Completeness (attribute coverage) remain strictly independent metrics.
