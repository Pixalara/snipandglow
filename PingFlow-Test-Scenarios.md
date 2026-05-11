# PingFlow — Test Scenarios
# For Manual Testing by QA Engineer
# App URL: https://pingflow.pixalara.io
# Date: April 14, 2026

---

## HOW TO USE THIS DOCUMENT
- Test each scenario in order
- Mark PASS or FAIL next to each step
- If FAIL, note the exact error message or screenshot
- Use Chrome browser (desktop + mobile view)
- Use incognito window for new user tests

---

## SECTION 1: NEW USER SIGNUP (Email + Dual OTP)

### Test 1.1 — Email Signup Form
1. Open https://pingflow.pixalara.io/signup in incognito
2. Check: Left panel shows rolling text animation
3. Check: Form has fields — Full Name, WhatsApp Number, Email, Password
4. Check: WhatsApp Number field only accepts numbers (try typing letters)
5. Check: WhatsApp Number field stops at 10 digits
6. Leave WhatsApp Number empty → click submit → should show error
7. Enter 8 digits only → click submit → should show "Enter a valid 10-digit WhatsApp number"

### Test 1.2 — Send OTP
1. Fill all fields correctly (use a new email that doesn't exist)
2. Click "Create Account & Verify Email"
3. Check: Loading state shows
4. Check: Redirects to /verify-otp page
5. Check: Page shows "Verify Your Identity" with the email you entered
6. Check: Shows "WhatsApp ending ****XXXX" with last 4 digits of your phone

### Test 1.3 — Receive OTPs
1. Check your email inbox → should receive email from "PingFlow Auth <auth@pixalara.com>"
2. Check: Email has a 6-digit code in a styled box
3. Check your WhatsApp → should receive a message with a 6-digit code
4. Note: Email and WhatsApp codes are DIFFERENT numbers

### Test 1.4 — Enter OTP Codes
1. On the verify page, enter the email code in the top 6 boxes
2. Check: Each box auto-advances to the next when you type a digit
3. Check: Green border appears when all 6 digits are entered
4. Check: "✓ Entered" text appears next to "EMAIL CODE"
5. Enter the WhatsApp code in the bottom 6 boxes
6. Check: Same behavior — auto-advance, green border, "✓ Entered"
7. Check: "Verify & Create Account" button turns red (active)

### Test 1.5 — Verify and Create Account
1. Click "Verify & Create Account"
2. Check: Loading spinner shows
3. Check: Toast message "Account verified! Welcome to PingFlow 🎉"
4. Check: Redirects to /onboarding page (NOT dashboard)

### Test 1.6 — Wrong OTP
1. Start a new signup with different email
2. On verify page, enter WRONG codes
3. Check: Error message shows "Invalid code. X attempts remaining"
4. Try wrong codes 3 times
5. Check: Shows locked state with 🔒 icon and "Contact hello@pixalara.com" button

### Test 1.7 — Resend WhatsApp Code
1. Start a new signup
2. On verify page, click "Resend Code"
3. Check: Toast shows "New WhatsApp code sent!"
4. Check: Button changes to "Resend in 60s" countdown
5. Check: Button is disabled during countdown
6. Check: New code arrives on WhatsApp (old code no longer works)

---

## SECTION 2: GOOGLE SIGNUP + WHATSAPP VERIFICATION

### Test 2.1 — Google Signup
1. Open /signup in incognito
2. Click "Sign up with Google"
3. Complete Google authentication
4. Check: Redirects to /complete-profile (NOT dashboard)
5. Check: Shows "One More Step" with WhatsApp verification prompt
6. Check: Shows your Google name in the greeting

### Test 2.2 — WhatsApp Verification for Google Users
1. Enter your 10-digit WhatsApp number
2. Click "Send WhatsApp Verification Code"
3. Check: Redirects to /verify-whatsapp
4. Check: Shows single 6-box OTP input (no email code needed)
5. Enter the WhatsApp code
6. Click "Verify WhatsApp"
7. Check: Redirects to /onboarding

---

## SECTION 3: ONBOARDING

### Test 3.1 — Fill Gym Details
1. After signup, should be on /onboarding page
2. Check: Shows "Finalize Gym Profile" heading
3. Fill: Gym Name, Owner Name, Phone
4. Click "Finalize Onboarding"
5. Check: Redirects to Dashboard

### Test 3.2 — Verify Data Saved
1. Go to Settings page
2. Check: "Gym Information" section shows the gym name you entered
3. Check: Owner name matches what you entered
4. Check: Sidebar shows gym name under "PingFlow" logo
5. Check: Dashboard greeting says "Good [time], [Your Name] 👋"

---

## SECTION 4: LOGIN

### Test 4.1 — Login with Email
1. Open /login
2. Enter the email and password from your signup
3. Click "Sign In"
4. Check: Redirects to Dashboard

### Test 4.2 — Login with Google
1. Open /login
2. Click "Continue with Google"
3. Check: Redirects to Dashboard

### Test 4.3 — Wrong Password
1. Open /login
2. Enter correct email but wrong password
3. Check: Shows "Invalid email or password" error

---

## SECTION 5: PLANS

### Test 5.1 — Create Plan
1. Go to Plans page from sidebar
2. Click "Add Plan"
3. Fill: Name = "Monthly", Duration = 30 days, Price = 500
4. Save
5. Check: Plan appears in the list

### Test 5.2 — Create Another Plan
1. Add: Name = "Quarterly", Duration = 90 days, Price = 1200
2. Save and verify

---

## SECTION 6: MEMBERS

### Test 6.1 — Add Member
1. Go to Members page
2. Click "Add Member"
3. Fill: Name = "Test Member", Phone = 9876543210
4. Select "Monthly" plan, set start date to today
5. Save
6. Check: Member appears with "Active" status

### Test 6.2 — Add Expiring Member
1. Add another member with start date 27 days ago (so it expires in 3 days)
2. Check: Shows "Expiring" status with amber badge

### Test 6.3 — Search
1. Type "Test" in search box
2. Check: Only matching members show

### Test 6.4 — Filter by Status
1. Click "Active" tab → only active members
2. Click "Expiring" tab → only expiring members
3. Click "All" tab → all members

### Test 6.5 — Edit Member
1. Click edit on a member
2. Change the name
3. Save → verify name updated

### Test 6.6 — Delete Member
1. Click delete on a member
2. Confirm deletion
3. Check: Member removed from list

---

## SECTION 7: BILLING

### Test 7.1 — Record Payment
1. Go to Billing page
2. Click "Record Payment"
3. Type a member name in the search box
4. Check: Matching members appear in dropdown
5. Select a member → Check: Plan auto-fills
6. Check: Subtotal, GST (18%), and Total calculate correctly
7. Enter paid amount, select "Cash"
8. Click "Authorize Entry"
9. Check: Payment appears in the table with invoice number

### Test 7.2 — Print Invoice
1. Click the print icon on a payment
2. Check: Invoice opens in new tab
3. Check: Shows correct gym name (not "My Gym")
4. Check: GST breakdown is correct
5. Click "Print Invoice" → check print preview looks clean

### Test 7.3 — Collect Balance
1. Record a payment where paid amount < total (partial payment)
2. Check: Shows "PARTIAL" status with balance due
3. Click "Collect" button
4. Enter remaining amount
5. Check: Status changes to "PAID"

---

## SECTION 8: SETTINGS

### Test 8.1 — Edit Gym Info
1. Go to Settings
2. Click "Edit Gym"
3. Change gym name
4. Save
5. Check: Sidebar updates with new name
6. Check: Dashboard greeting updates

### Test 8.2 — Configure Invoicing
1. Click "Configure Ledger"
2. Fill: Address = "Bengaluru", GSTIN = "22AAAAA0000A1Z5", HSN = "99972"
3. Click "Lock Parameters"
4. Check: Saves without error (no "Failed to save" toast)
5. Check: Merchant Branding shows gym name (not editable)

---

## SECTION 9: AUTOMATIONS

### Test 9.1 — Run Manual Trigger
1. Go to Automations page
2. Check: Shows "Sync Status" and "Run Manual Trigger" buttons
3. Click "Run Manual Trigger"
4. Check: Success message with count

### Test 9.2 — View Message Details
1. Click on any log row
2. Check: Expands to show:
   - "Message Sent" with full WhatsApp message text
   - Recipient name and phone number
   - Delivery Status
   - Template name used

### Test 9.3 — Sync Status
1. Click "Sync Status"
2. Check: Shows success message

---

## SECTION 10: BROADCAST

### Test 10.1 — Compose Message
1. Go to Broadcast page
2. Check: Wallet balance shows in sidebar
3. Select "All Members" toggle
4. Check: Recipient count and cost update

### Test 10.2 — AI Assist
1. Type: "summer offer 3 months for price of 2"
2. Click "✨ AI Assist"
3. Check: Message gets rewritten with emojis and formatting
4. Click AI Assist again → should generate different style
5. Check: Preview card on right updates

### Test 10.3 — Quick Templates
1. Click "Festival Offer" template
2. Check: Textarea fills with template text

### Test 10.4 — Inactive Filter
1. Select "Inactive" toggle
2. Check: Count changes to show only inactive/expired members

### Test 10.5 — Low Balance
1. If wallet is ₹0, check: "Insufficient Balance" warning shows
2. Check: Send button is disabled

### Test 10.6 — Top Up Wallet
1. Click wallet widget in sidebar (or "+ TOP UP")
2. Select ₹500
3. Click "Add ₹500"
4. Check: Balance updates in sidebar

---

## SECTION 11: EMPLOYEES (RBAC)

### Test 11.1 — Create Employee
1. Go to Employees page (admin only)
2. Click "Add Employee"
3. Fill: Name, Email, Phone, Password (min 6 chars)
4. Click "Create Account"
5. Check: Employee appears in list with "EMPLOYEE" badge

### Test 11.2 — Edit Employee
1. Click "Edit" on the employee
2. Change name
3. Change Access Level to "Admin Access"
4. Save
5. Check: Badge changes to "ADMIN"

### Test 11.3 — Employee Login
1. Open incognito window
2. Go to /login
3. Enter employee email and password
4. Check: Goes to Dashboard (not onboarding)
5. Check: Shows employee's name (not owner's name)

### Test 11.4 — Employee Restricted Access
1. As employee with "Employee Access":
   - Should see: Dashboard, Members, Plans, Billing, Automations, Broadcast
   - Should NOT see: Employees, Settings, Wallet, Activity Log, Branches
2. Try going to /employees directly → should show "Access Denied"

### Test 11.5 — Employee with Admin Access
1. Edit employee → set to "Admin Access"
2. Login as that employee
3. Check: Can see Settings, Broadcast (but NOT Employees or Wallet)

### Test 11.6 — Disable Employee
1. As admin, click "Disable" on an employee
2. Check: Badge changes to "Disabled"
3. Try logging in as that employee → should fail or show restricted view

---

## SECTION 12: BRANCHES

### Test 12.1 — Create First Branch
1. Go to Branches page
2. Click "Add Branch"
3. Fill: Name = "Main Branch", Address = "Downtown"
4. Save
5. Check: Branch appears in list with "DEFAULT" badge

### Test 12.2 — Create Second Branch
1. Add: Name = "North Branch", Address = "Uptown"
2. Check: Branch switcher appears in the header area

### Test 12.3 — Switch Branches
1. Click branch switcher dropdown
2. Select "North Branch"
3. Check: Dashboard data refreshes
4. Switch back to "Main Branch"

### Test 12.4 — Global View (Admin Only)
1. Click branch switcher → select "🌐 All Branches"
2. Check: Dashboard says "all branches" in greeting
3. Check: "Branch Performance" chart appears

### Test 12.5 — Employee Branch Assignment
1. Go to Employees → Edit an employee
2. Check: Branch checkboxes appear
3. Assign to only "Main Branch"
4. Save

---

## SECTION 13: ACTIVITY LOG

### Test 13.1 — View Logs
1. Go to Activity Log page (admin only)
2. Check: Shows recent actions grouped by date
3. Check: Login events appear
4. Check: Member add/edit events appear

### Test 13.2 — Filter
1. Filter by user name → only that user's actions
2. Filter by action type → only that type

---

## SECTION 14: WHATSAPP MESSAGES

### Test 14.1 — D-3 Reminder
1. Add a member with expiry 3 days from today
2. Run Manual Trigger
3. Check: WhatsApp message received with "Don't Lose Your Progress!" header
4. Check: Has "Call My Gym" and "Renew Online" buttons

### Test 14.2 — Renew Online Button
1. Click "Renew Online" in WhatsApp message
2. Check: Opens https://pingflow.pixalara.io/pay
3. Check: Shows UPI payment page

---

## SECTION 15: LANDING PAGE

### Test 15.1 — Homepage
1. Open https://pingflow.pixalara.io (logged out)
2. Check: Rolling text animation in hero section
3. Check: WhatsApp phone mockup cycles through 5 scenarios
4. Check: Each scenario has header, body, footer, and CTA buttons
5. Check: "Login" button in navbar
6. Check: "Start Free Trial" button goes to /signup

### Test 15.2 — Pricing Section
1. Scroll to pricing
2. Check: Starter (₹999/month) and Pro (₹2,499/month) cards
3. Click "Start Free Trial" → goes to /signup

---

## SECTION 16: UPI PAY PAGE

### Test 16.1 — Desktop
1. Open https://pingflow.pixalara.io/pay
2. Check: Shows "Opening payment app..." briefly
3. Check: Then shows fallback page with UPI ID and "Pay with UPI" button

### Test 16.2 — Mobile
1. Open same URL on phone
2. Check: Should try to open UPI app (GPay/PhonePe)
3. If no UPI app: shows fallback page

---

## SECTION 17: INVOICE PDF

### Test 17.1 — Invoice Quality
1. Go to Billing → click print icon on any payment
2. Check: Gym name is correct (not "My Gym")
3. Check: GST breakdown shows correctly
4. Check: "Thank you for choosing [Gym Name]!" at bottom
5. In print dialog: uncheck "Headers and footers"
6. Check: PDF matches preview (no browser date/URL)

---

## QUICK REFERENCE: EXPECTED SIDEBAR ITEMS

### Admin (Owner):
Dashboard, Members, Plans, Billing, Automations, Broadcast, Employees, Branches, Activity Log, Settings, Wallet

### Manager (Admin Access Employee):
Dashboard, Members, Plans, Billing, Automations, Broadcast, Settings

### Employee (Basic Access):
Dashboard, Members, Plans, Billing, Automations, Broadcast

---

## NOTES FOR TESTER
- Always test in Chrome (latest version)
- Test mobile view using Chrome DevTools (F12 → toggle device toolbar)
- For WhatsApp tests, use a real Indian phone number (+91)
- OTP codes expire in 5 minutes
- If stuck on verification screen, ask admin to set isWhatsAppVerified: true in Firebase Console
- Report bugs with: Test number, exact error message, screenshot, browser version
