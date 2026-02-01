# Financial Scenario Simulator

A visual financial planning tool to explore different financial futures based on the decisions you make. Model your income, savings, charitable giving, home purchases, and retirement drawdown to see how your wealth evolves over a 40-year horizon.

## Getting Started

Simply open https://adfrederick1.github.io/financial_simulation/ in a web browser.

## Features

- **Multi-scenario comparison**: Create multiple scenarios with different assumptions and compare them side-by-side
- **Interactive visualizations**: D3.js-powered charts showing asset growth, cash flow, and tax implications
- **FIFO lot tracking**: Accurate capital gains calculations for charitable donations using first-in-first-out accounting
- **Realistic tax modeling**: 2026 Federal, NY State, and payroll tax calculations

---

## Scenario Builder Prompts

### Income & Growth

Configure your primary income and how it evolves over time.

| Field | Description |
|-------|-------------|
| **Starting Annual Income** | Your current W2 salary or primary income source |
| **Annual Growth Rate** | Expected yearly salary increase (e.g., 3% for inflation-matching raises) |
| **Years Until Retirement** | How long until your primary income stops. After this, only secondary income continues |
| **Starting Liquid Savings** | Current investment account balance (non-retirement) that will grow and compound |
| **Secondary Income Streams** | Additional income sources like rental income, side business, or spouse's income. Each can have its own start year and growth rate |

### Regular Deductions

Set recurring expenses as percentages of income.

| Field | Description |
|-------|-------------|
| **Rent Expense** | Portion of income spent on rent. Automatically stops when you purchase a home |
| **Savings Rate** | Percentage of income directed to liquid investments each year |

### Charitable Giving

Model charitable giving with three modes: **Off**, **Annual Gift (Cash)**, or **Donor Advised Fund (DAF)**.

| Field | Description |
|-------|-------------|
| **Giving Mode** | Choose between Off (no giving), Annual Gift (direct cash donations), or DAF (Donor Advised Fund) |

#### Annual Gift Mode

Simple direct charitable donations as a percentage of income each year.

| Field | Description |
|-------|-------------|
| **Annual Gift** | Percentage of income donated as cash each year (60% AGI deduction limit) |

#### DAF Mode

Model a Donor Advised Fund strategy with tax-advantaged giving of appreciated securities.

| Field | Description |
|-------|-------------|
| **Starting DAF Balance** | Existing DAF balance at simulation start (if you already have a DAF) |
| **DAF Contribution** | Percentage of income contributed to your DAF. Contributions provide immediate tax deductions |
| **DAF Growth Rate** | Expected investment growth inside the DAF (default 8%) |
| **Start Donating** | Years after simulation start to begin making grants from the DAF |
| **Initial Donation Rate** | Starting percentage of DAF value to donate annually |
| **Stable Donation Rate** | Target annual donation rate after transition period (e.g., 5%) |
| **Transition Period** | Years to ramp up from initial to stable donation rate |

The simulator uses **FIFO (First-In-First-Out)** accounting for DAF donations, meaning oldest lots are donated first. This maximizes the capital gains avoided since older contributions typically have more appreciation. DAF contributions of appreciated securities have a 30% AGI deduction limit.

### Home Purchases

Add one or more property purchases to your scenario.

| Field | Description |
|-------|-------------|
| **Property Label** | Name to identify the property (e.g., "Primary Residence", "Vacation Home") |
| **Purchase Year** | Years after simulation start to buy the property |
| **Purchase Price** | Total purchase price of the home |
| **Down Payment** | Percentage of purchase price paid upfront (comes from liquid savings) |
| **Mortgage Rate** | Annual interest rate on the mortgage |
| **Home Appreciation** | Expected annual appreciation rate for the property |
| **Monthly Prepayment** | Optional extra principal payment each month to pay off mortgage faster |

When you purchase a home:
- Rent expense automatically stops
- Property tax (1.5% of home value) and mortgage payments are added to expenses
- Home equity is tracked separately from liquid assets

### Liquid Asset Drawdown

Configure withdrawals from investments during retirement or financial independence.

| Field | Description |
|-------|-------------|
| **Enable Drawdown** | Toggle to activate the drawdown feature |
| **Start Year** | Years after simulation start to begin withdrawals |
| **Initial Withdrawal Rate** | Starting percentage of liquid assets to withdraw annually |
| **Stable Withdrawal Rate** | Target withdrawal rate (the classic "4% rule" suggests 4%) |
| **Transition Period** | Years to ramp from initial to stable withdrawal rate |

Drawdown provides income when primary employment ends, funded by selling liquid assets.

### Large Purchases

Model one-time major expenses.

| Field | Description |
|-------|-------------|
| **Year** | Years after simulation start when the purchase occurs |
| **Amount** | Total cost of the purchase |
| **Description** | Optional note (e.g., "New car", "Wedding", "Kids' college") |

Large purchases are deducted from liquid assets in the specified year.

---

## Charts

### Asset Worth Over Time
Shows the growth of your total assets broken down by:
- **Liquid Securities**: Investment accounts that can be drawn down
- **Home Equity**: Property value minus remaining mortgage
- **Charitable DAF**: Donor Advised Fund balance

### Annual Cash Flow
Visualizes your yearly financial picture:
- **Total Income**: Primary + secondary income streams
- **Total Expenses**: Rent/mortgage, taxes, and other costs
- **Discretionary Cash**: Income minus expenses, available for savings

### Taxes & Charitable Impact
Tracks tax implications:
- **Total Tax Burden**: Federal, state, and payroll taxes paid
- **Tax Savings from Donations**: Reduction in taxes due to charitable deductions
- **Capital Gains Avoided**: Appreciation that wasn't taxed due to donating securities (FIFO)

---

## Tips

1. **Compare scenarios**: Click the "+" button in the header to create a new scenario. Use "Copy Scenario" to duplicate your current setup as a starting point for variations.

2. **Toggle chart series**: Click legend items to show/hide specific data series.

3. **Hover for details**: Mouse over chart lines to see exact values at any year.

4. **Experiment with timing**: Try different years for home purchases, retirement, and drawdown to find optimal timing.

5. **Model life changes**: Use secondary income streams to model a spouse starting work, or use large purchases to plan for major life events.
