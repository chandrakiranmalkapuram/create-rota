# Create Rota — Scheduling Engine Specification (Milestone 4)

## 1. Overview

The Create Rota scheduling engine is an automated, constraint-programming system powered by **Google OR-Tools CP-SAT (`ortools.sat.python.cp_model`)**. It generates fair, mathematically verified draft rotas without relying on greedy heuristics, random assignments, or hardcoded mock data.

---

## 2. Mathematical Formulation

### 2.1 Variables
- Let $S$ be the set of active staff members in the workspace.
- Let $D = [d_0, d_1, \dots, d_{N-1}]$ be the dates in the rota period.
- For each date $d$, let $B_d$ be the list of staffing requirement bands.
- For each band $b \in B_d$ and staff member $s \in S$:
  - $x[s, b] \in \{0, 1\}$: Binary variable indicating whether staff member $s$ is assigned to band $b$.
- For each band $b \in B_d$:
  - $slack[b] \in [0, b.\text{target\_staff\_count}]$: Slack integer variable representing unmet demand.

### 2.2 Coverage Constraint
For every band $b \in B_d$:
$$\sum_{s \in S} x[s, b] + slack[b] == b.\text{target\_staff\_count}$$

---

## 3. Hard Constraints (Strictly Mandatory)

Hard constraints are non-negotiable. The solver will **never** violate a hard constraint:

1. **Active Staff Only**:
   - Staff with `is_archived == True` are excluded entirely from assignment.
2. **Skill / Role Matching**:
   - If a requirement band specifies `skill_id`, staff members lacking that skill have $x[s, b] = 0$.
3. **Availability & Recurring Days Off**:
   - If a staff member has an availability rule with `is_recurring_day_off == True` or `is_available == False` for that weekday, $x[s, b] = 0$.
   - If an availability time window $[start, end]$ is set, any band with hours outside this window is disqualified.
4. **Approved Leave & Sickness Blocks**:
   - If a date falls within an approved `UnavailabilityBlock` (holiday, sickness, training), all overlapping bands have $x[s, b] = 0$.
5. **No Overlapping Shifts (At most 1 shift per day)**:
   - For any staff member $s$ on date $d$:
     $$\sum_{b \in B_d} x[s, b] \le 1$$
6. **Minimum Rest Between Shifts**:
   - Respects `min_rest_hours_between_shifts` (default 11.0 hours) across consecutive days:
     If band $b_1$ on day $d$ and band $b_2$ on day $d+1$ provide fewer than 11 hours of rest, $x[s, b_1] + x[s, b_2] \le 1$.
7. **Maximum Shifts Per Week**:
   - If `contract.max_shifts_per_week` is configured:
     $$\sum_{b \in \text{week}} x[s, b] \le \text{max\_shifts\_per\_week}$$
8. **Maximum Weekly Hours**:
   - If `contract.max_hours_per_week` is configured:
     $$\sum_{b \in \text{week}} b.\text{paid\_minutes} \times x[s, b] \le \text{max\_hours\_per\_week} \times 60$$
9. **Maximum Consecutive Working Days**:
   - For window size $K + 1$ (where $K = \text{max\_consecutive\_days}$):
     $$\sum_{j=0}^{K} worked[s, d_{i+j}] \le K$$

---

## 4. Soft Objectives (Preferences & Fairness)

Soft constraints are optimized without violating hard constraints:

1. **Primary Goal: Demand Satisfaction**:
   - Heavily penalizes unfulfilled coverage slots:
     $$\text{Penalty}_{\text{coverage}} = 10,000 \times \sum slack[b]$$
2. **Secondary Goal: Contract Hours Adherence**:
   - Minimizes absolute deviation $|assigned\_minutes - target\_contract\_minutes|$ for each staff member:
     $$\text{Penalty}_{\text{contract}} = 1 \times \sum_{s} dev_s$$
3. **Objective**:
   $$\text{Minimize } \left( \text{Penalty}_{\text{coverage}} + \text{Penalty}_{\text{contract}} \right)$$

---

## 5. Solver Outcomes & Honest Diagnostics

The engine returns one of four explicit outcomes:

| Outcome | Description | Actionable Guidance |
| :--- | :--- | :--- |
| `feasible` | All required shift slots filled with 100% hard & soft constraint satisfaction. | Rota draft saved and ready for review. |
| `partially_feasible` | A valid partial schedule was found, but some coverage bands had insufficient eligible staff. | Itemized list of dates and time bands that could not be filled, detailing why (e.g. leave blocks, weekly hour limits). |
| `infeasible` | No mathematical solution exists that satisfies the mandatory hard constraints. | Diagnosis of conflicting constraints (e.g., zero active staff or missing required skill). |
| `timeout` | Solver reached user-specified time limit (5s–30s) without finding or proving optimality. | Manager prompted to increase solver time limit or relax constraints. |

---

## 6. Multi-Tenant Workspace Isolation

Every rota, requirement band, and shift belongs strictly to the authenticated user's workspace:
- URL structure: `/api/v1/workspaces/{workspace_id}/rotas/{rota_id}`
- Verified against `get_workspace_membership` dependency with owner/admin role verification.
- Cross-workspace queries return `403 Forbidden` or `404 Not Found` (preventing IDOR).
