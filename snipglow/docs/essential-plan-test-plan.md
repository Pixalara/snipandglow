# Snip & Glow — Essential Plan Test Plan

**Website:** https://snipandglow.com (start at https://snipandglow.com/signup)
**Plan under test:** Essential (Trial)
**Tester name:** ________________  **Device / Browser:** ________________  **Date:** ____________

---

## How to use this checklist
- Use a **fresh test account** — not a real salon's data.
- Keep **two phones** ready: one for the salon owner (signup + OTP), one to act as a **customer** to receive WhatsApp messages.
- On Essential, WhatsApp messages come from the **shared Snip & Glow number** (a dedicated number is Pro-only; multi-branch is Growth-only — skip those).
- For every row, tick **Pass** or **Fail** and add a note. For a failure, write: what you did, what you expected, what actually happened (attach a screenshot if it looks wrong).
- Legend: ✅ Pass · ❌ Fail · ⬜ Not tested

---

### 1. Signup & Onboarding
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 1 | Open snipandglow.com and start Sign up | Signup screen opens | ⬜ | |
| 2 | Complete signup and verify phone with the WhatsApp OTP | Phone verified, moves to onboarding | ⬜ | |
| 3 | Fill the onboarding form (salon name, owner, timings) and submit | Account created, lands on Dashboard | ⬜ | |
| 4 | Observe the first-run tour | Getting-started tour appears for the new account | ⬜ | |

### 2. Dashboard
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 5 | Click through the tour steps and close it | Tour closes | ⬜ | |
| 6 | Refresh the page | Tour does NOT show again | ⬜ | |
| 7 | Review greeting, stats, and quick-action buttons | Everything loads without errors | ⬜ | |

### 3. Settings
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 8 | Edit salon profile and save | Changes saved | ⬜ | |
| 9 | Set salon timings and save | Timings saved | ⬜ | |
| 10 | Add GST details and save | Saved (GST locks after saving) | ⬜ | |
| 11 | Turn on a default discount and save | Discount saved | ⬜ | |
| 12 | Copy the WhatsApp booking link and QR code | Link + QR available | ⬜ | |

### 4. Services
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 13 | Add 3–4 services with prices | Services appear in the list | ⬜ | |
| 14 | Edit one service, then deactivate and reactivate it | Edits and status changes save | ⬜ | |

### 5. Staff & Payroll
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 15 | Add a staff member with a login | Staff created | ⬜ | |
| 16 | Keep adding staff up to and beyond the limit | Essential allows **5 staff logins**; a clear limit message appears at the 6th | ⬜ | |
| 17 | Mark attendance / set a shift | Attendance saved | ⬜ | |
| 18 | Payroll → generate a payslip and download PDF | PDF downloads with correct hours/pay | ⬜ | |

### 6. Customers
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 19 | Add a customer with an Indian mobile + date of birth | Customer saved | ⬜ | |
| 20 | Add a customer with a **foreign number** (with country code) | Saves without error | ⬜ | |

### 7. Loyalty setup
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 21 | Settings → Loyalty Points → turn on, keep defaults, save | Settings saved, marked Live | ⬜ | |
| 22 | Return to Dashboard | A "Loyalty Points" summary card appears | ⬜ | |

### 8. Appointments
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 23 | Create an appointment (service, staff, date, time) | Appointment created | ⬜ | |
| 24 | Check the customer's phone | WhatsApp booking confirmation received | ⬜ | |
| 25 | Reschedule the appointment | Customer gets the updated time | ⬜ | |
| 26 | Cancel an appointment | Customer gets the cancellation message | ⬜ | |

### 9. Billing
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 27 | Create a bill: add services, apply discount, pick payment method | Totals calculate correctly | ⬜ | |
| 28 | Use the **Collected amount** field (e.g. ₹400 on a ₹410 bill) | Shortfall auto-recorded as a discount | ⬜ | |
| 29 | Generate the bill | Customer receives the bill/receipt (with PDF) on WhatsApp | ⬜ | |
| 30 | Wait for the follow-up message | A "rate your visit" feedback request arrives | ⬜ | |

### 10. Wallet
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 31 | Customer profile → Add Balance (top-up) | Balance updates, top-up receipt sent | ⬜ | |
| 32 | New bill paid partly/fully from wallet | Wallet drops; receipt shows the split | ⬜ | |

### 11. Memberships
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 33 | Create a membership plan with a discount % | Plan created | ⬜ | |
| 34 | Sell/assign it to a customer | A bill is raised for the plan price | ⬜ | |
| 35 | Bill that customer for a service | Membership discount auto-applies | ⬜ | |

### 12. Loyalty — earn & redeem
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 36 | Open the customer's profile after the bills above | Loyalty card shows points earned, tier, and a Points history tab | ⬜ | |
| 37 | Create a new bill and use **Redeem loyalty points** | Points reduce the payable amount; receipt shows it | ⬜ | |
| 38 | On the loyalty card, use **Adjust** to add bonus points | Balance updates | ⬜ | |

### 13. Inventory
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 39 | Add a product with stock quantity | Product saved | ⬜ | |
| 40 | Sell that product on a bill | Stock decreases by the sold quantity | ⬜ | |

### 14. Expenses & Leads
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 41 | Record an expense (category + amount) | Expense saved | ⬜ | |
| 42 | Add a lead and update its status | Lead saved and status updates | ⬜ | |

### 15. WhatsApp booking (customer side)
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 43 | From the customer phone, open the booking link / scan the QR and book via chat | Booking flow works, appointment is created | ⬜ | |
| 44 | Dashboard → WhatsApp / Automation Logs | The activity is recorded | ⬜ | |

### 16. Revenue & Feedback
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 45 | Open Revenue / Analytics | Today's bills, top services, and charts reflect the test data | ⬜ | |
| 46 | Submit a rating from the customer's WhatsApp, then open Feedback | The rating appears | ⬜ | |

### 17. Audit Log
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 47 | Open Audit Log | Entries read in plain English (Added / Edited / Removed, e.g. "Edited bill INV-…") — not INSERT/UPDATE/DELETE | ⬜ | |
| 48 | Click Export CSV | File downloads with the same friendly labels | ⬜ | |

### 18. Support ticket
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 49 | Help & Support → create a ticket describing a test issue → submit | Ticket submitted | ⬜ | |
| 50 | Review the tickets list | The new ticket appears with its status | ⬜ | |

### 19. Cross-cutting checks
| # | Test action | Expected result | Pass / Fail | Notes |
|---|-------------|-----------------|:-----------:|-------|
| 51 | Log out and log back in | Data persists | ⬜ | |
| 52 | Open Dashboard, Billing, Customer profile & Loyalty on a **phone** and a **tablet** | Layouts look right and are usable | ⬜ | |
| 53 | Note anything slow, broken, or confusing anywhere | — | ⬜ | |

---

## Notes for testers
- **Reminders** (appointment reminders) fire automatically ~24 hours and ~3 hours before the appointment, so they can't be seen instantly — record them separately if you can schedule an appointment for the near future.
- Anything labelled **multi-branch** or **dedicated WhatsApp number** is not part of Essential — it's fine to skip.
- Use real phone numbers you control for the "customer" so WhatsApp messages actually arrive.

## Summary
- Total steps: 53
- Passed: ______  Failed: ______  Not tested: ______
- Overall notes / top issues found:
