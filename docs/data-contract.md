# Data Contract (LocalStorage)

This document describes the current localStorage keys and expected shapes used by the app.

## `moneyProfile`
```json
{
  "name": "string",
  "incomes": [
    {
      "id": "string|number",
      "name": "string",
      "category": "Income",
      "amount": 1234.56,
      "monthly": 1234.56,
      "incomeType": "personal|business",
      "linkedTxnId": "string|number",
      "frequency": "weekly|biweekly|monthly|threeMonths|annual"
    }
  ],
  "expenses": [
    {
      "id": "string|number",
      "name": "string",
      "category": "string",
      "amount": 123.45,
      "monthly": 123.45,
      "expenseType": "personal|business",
      "linkedTxnId": "string|number",
      "housingType": "Renting|Mortgage"
    }
  ],
  "savingsBalance": "string|number",
  "savingsMonthly": "string|number"
}
```

## `liveBudgetTransactions`
```json
[
  {
    "id": "string|number",
    "type": "income|expense",
    "category": "string",
    "amount": 123.45,
    "note": "string",
    "date": "ISO-8601 string",
    "incomeType": "personal|business",
    "expenseType": "personal|business",
    "baselineSync": true
  }
]
```

## `financialHealthScore`
```json
{
  "status": "ready|insufficient",
  "score": 0,
  "trend": "up|down|flat",
  "rawScore": 0,
  "periodKey": "string",
  "updatedAt": "ISO-8601 string",
  "history": [
    {
      "periodKey": "string",
      "score": 0,
      "trend": "up|down|flat",
      "tier": "string",
      "updatedAt": "ISO-8601 string"
    }
  ],
  "confidence": { "label": "string", "detail": "string", "periods": 0 },
  "milestones": [
    { "key": "string", "title": "string", "message": "string", "periodKey": "string" }
  ],
  "pillars": { "buffer": 0, "freedom": 0, "stability": 0 },
  "explanations": { "buffer": "string", "freedom": "string", "stability": "string" },
  "coaching": { "title": "string", "message": "string" },
  "debtTotal": 0,
  "payoffMonths": 0,
  "savingsBalance": 0
}
```

## `debtPlanType`
```json
"snowball" | "avalanche"
```

## `debtCashForm`
```json
{
  "manualDebts": [
    {
      "id": "string|number",
      "name": "string",
      "balance": 0,
      "minPayment": 0,
      "apr": 0,
      "category": "string",
      "source": "manual|expense"
    }
  ]
}
```

## `creditCards`
```json
[
  {
    "id": "string|number",
    "name": "string",
    "balance": 0,
    "apr": 0,
    "minPayment": 0,
    "rollForward": 0,
    "paid": true
  }
]
```

## `lunaPreferences`
```json
{
  "region": "string",
  "currency": "string",
  "premiumAccess": true,
  "businessFeatures": true,
  "budgetPeriod": "monthly|weekly|biweekly|four-week|quarterly|custom-day|paycheck",
  "budgetPeriodStartDay": 1,
  "budgetPeriodAnchor": "YYYY-MM-DD",
  "tierKey": "critical|tight|balanced|traditional"
}
```

## `periodHistoryIndex_*`
```json
["periodKey", "periodKey", "..."]
```

## `periodHistory_*`
```json
{
  "periodKey": "string",
  "mode": "monthly|weekly|biweekly|four-week|quarterly|custom-day|paycheck",
  "income": 0,
  "expenses": 0,
  "leftover": 0,
  "snowballExtra": 0,
  "tier": "string",
  "createdAt": "ISO-8601 string",
  "updatedAt": "ISO-8601 string"
}
```

## `dashboardHiddenCards`
```json
[
  "score",
  "goals",
  "moneyCoach",
  "monthlySnapshot",
  "spending",
  "creditSnapshot",
  "savings",
  "netWorth",
  "businessToolkit"
]
```

## `userIdentity`
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string"
}
```

## `lunaLoggedIn`
```json
"true" | "false"
```

## `healthConsoleEnabled`
```json
"true" | "false"
```

## `healthConsolePosition`
```json
{ "x": 120, "y": 240, "dock": "tl|tr|bl|br|null" }
```
