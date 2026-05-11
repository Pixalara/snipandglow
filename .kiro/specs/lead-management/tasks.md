# Implementation Plan: Lead Management

## Overview

Implement a full lead pipeline for PingFlow — tracking prospective gym members from initial contact through conversion to active membership. Leads are branch-scoped Firestore documents with seven pipeline stages, integrated with the existing RBAC model, plan-based gating, and WhatsApp messaging via AiSensy. The implementation follows the existing service/page patterns (members.service.ts, Members.tsx) and uses React + TypeScript + Vite, Firebase/Firestore, and Zustand.

## Tasks

- [x] 1. Add Lead type definitions and update config maps
  - [x] 1.1 Add Lead types to the shared types module
    - Add `LeadStatus`, `LeadSource`, `LeadNote`, and `Lead` interfaces to `frontend/src/types/index.ts`
    - `LeadStatus` = `'New' | 'Contacted' | 'Trial Scheduled' | 'Trial Done' | 'Negotiation' | 'Converted' | 'Lost'`
    - `LeadSource` = `'Social Media' | 'Walk-in' | 'Referral'`
    - `LeadNote` = `{ text: string; createdBy: string; createdAt: Timestamp }`
    - `Lead` = `{ id?, name, phone, email?, source, status, assignedTo, trialDate, notes, createdAt, updatedAt }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Update Permission Map with leads resource
    - Add `'leads'` to the `Resource` type union in `frontend/src/config/permissionMap.ts`
    - Add `leads` actions for each role: admin (`create,read,update,delete`), branch_manager (`create,read,update,delete`), trainer (`read,update`), sales_executive (`create,read,update`), receptionist (`read`)
    - Add `'leads'` to `sidebarItems` for admin, branch_manager, trainer, and sales_executive (NOT receptionist)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 1.3 Update Plan Configuration with leads feature and limits
    - Add `'leads'` and `'leads_analytics'` to `FeatureName` type in `frontend/src/config/planConfig.ts`
    - Add `'leads'` to `ResourceName` type
    - Add `leads` to `PlanLimits` interface and `PLAN_LIMITS`: trial=50, starter=50, pro=Infinity
    - Add `'leads'` to `PLAN_FEATURES` for all plans; add `'leads_analytics'` only for pro
    - _Requirements: 11.1, 11.2, 12.3_

  - [ ]* 1.4 Write property test for plan limit gating (Property 7)
    - **Property 7: Plan limit gating for lead creation**
    - For any active lead count and plan type, `isAtLimit` returns true iff plan is not `'pro'` AND count >= plan lead limit (50). Pro plans never block.
    - Use fast-check generators: `fc.constantFrom('trial','starter','pro')` for plan, `fc.nat({max:200})` for count
    - **Validates: Requirements 11.3, 11.4**

  - [ ]* 1.5 Write unit tests for permission map and plan config
    - Verify exact actions for each role on `leads` resource
    - Verify `sidebarItems` includes `leads` for admin, branch_manager, trainer, sales_executive
    - Verify `sidebarItems` excludes `leads` for receptionist
    - Verify `PLAN_LIMITS.leads` is 50 for trial/starter, Infinity for pro
    - Verify `PLAN_FEATURES` includes `leads` for all plans and `leads_analytics` only for pro
    - _Requirements: 4.2–4.7, 11.1, 11.2, 12.3_

- [x] 2. Implement phone masking utility
  - [x] 2.1 Add `maskPhone` function to `frontend/src/lib/utils.ts`
    - Strip non-digit characters, strip `91` country code prefix for 12-digit numbers
    - Show first 2 and last 2 digits, replace middle with `*`
    - Handle edge cases: numbers shorter than 4 digits returned as-is
    - _Requirements: 8.1, 8.2_

  - [ ]* 2.2 Write property test for phone masking (Property 5)
    - **Property 5: Phone number masking**
    - For any phone string of 10+ digits, `maskPhone` returns a string where only first 2 and last 2 local digits are visible, middle replaced with `*`, output length equals local number length
    - Use fast-check: `fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), {minLength:10, maxLength:12})`
    - **Validates: Requirements 8.1, 8.2**

- [ ] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Lead CRUD service and audit integration
  - [x] 4.1 Add lead audit action types to `frontend/src/services/audit.service.ts`
    - Add `'LEAD_ADDED' | 'LEAD_UPDATED' | 'LEAD_DELETED' | 'LEAD_CLAIMED' | 'LEAD_WHATSAPP_SENT' | 'LEAD_CONVERTED'` to the `ActionType` union
    - _Requirements: 3.6, 6.3, 9.5, 10.5_

  - [x] 4.2 Create `frontend/src/services/leads.service.ts`
    - Create `leadsCollection(gymId)` and `leadDoc(gymId, leadId)` helpers using `getDataPathSegments()` (same pattern as `members.service.ts`)
    - Implement `subscribeLeads(gymId, onData, onError) → Unsubscribe` — real-time listener ordered by `createdAt desc`
    - Implement `createLead(gymId, data: CreateLeadInput) → Promise<string>` — defaults `status: 'New'`, `assignedTo: null`, formats phone via `formatPhoneE164`, logs `LEAD_ADDED` to audit
    - Implement `updateLead(gymId, leadId, data: Partial<Lead>) → Promise<void>` — sets `updatedAt` to server timestamp, logs `LEAD_UPDATED` to audit
    - Implement `deleteLead(gymId, leadId) → Promise<void>` — deletes doc, logs `LEAD_DELETED` to audit
    - Implement `claimLead(gymId, leadId, trainerUid, trainerName) → Promise<void>` — sets `assignedTo`, logs `LEAD_CLAIMED` to audit
    - Define `CreateLeadInput` interface: `{ name, phone, email?, source, trialDate?, notes? }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.3_

  - [ ]* 4.3 Write property test for lead creation defaults (Property 1)
    - **Property 1: Lead creation produces a complete document with correct defaults**
    - For any valid lead input (random name, E.164 phone, random LeadSource), the created document has all required fields with `status: 'New'` and `assignedTo: null`
    - Use fast-check: `fc.record({ name: fc.string({minLength:1}), phone: fc.stringMatching(/^\+91\d{10}$/), source: fc.constantFrom('Social Media','Walk-in','Referral') })`
    - **Validates: Requirements 1.2, 1.4, 3.3**

  - [ ]* 4.4 Write property test for audit trail logging (Property 10)
    - **Property 10: Audit trail logging on lead operations**
    - For any lead CRUD operation (create, update, delete, claim, convert), the operation produces a corresponding audit log entry with correct `actionType` and description containing the lead's name
    - **Validates: Requirements 3.6, 6.3, 9.5, 10.5**

- [ ] 5. Implement Leads page UI with pipeline view
  - [x] 5.1 Create `frontend/src/pages/Leads.tsx` with status-tab pipeline view
    - Subscribe to leads via `subscribeLeads` on mount, store in component state
    - Implement status tabs: New, Contacted, Trial Scheduled, Trial Done, Negotiation, Converted, Lost
    - Display each lead card with: name, source, assigned trainer name (or "Unassigned"), trial date, masked phone via `maskPhone()`
    - Implement trainer privacy filtering: if `role === 'trainer'`, show only leads where `assignedTo === uid` OR (`assignedTo === null` AND `status === 'New'`); hide Converted/Lost tabs for trainers
    - Admin/branch_manager see all leads unfiltered
    - Gate "Add Lead" button behind `can('create', 'leads')` AND plan limit check (show `UpgradeModal` if at limit)
    - Gate "Edit" behind `can('update', 'leads')`, "Delete" behind `can('delete', 'leads')`
    - Show "Claim Lead" button only for trainers on unassigned New leads; hide when `assignedTo` is non-null
    - Show "Convert to Member" button for users with `update` permission; hide if lead status is already `'Converted'`
    - Show WhatsApp icon button on every lead card
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 5.1, 5.2, 5.3, 6.1, 6.4, 8.1, 8.2, 8.3, 9.1, 10.6, 11.3, 11.4_

  - [ ]* 5.2 Write property test for trainer lead visibility filter (Property 2)
    - **Property 2: Trainer lead visibility filter**
    - For any array of leads with random `assignedTo` and `status`, and any trainer UID, the filter returns only leads where `assignedTo === trainerUid` OR (`assignedTo === null` AND `status === 'New'`). Never contains Converted or Lost.
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 5.3 Write property test for admin/branch_manager sees all leads (Property 3)
    - **Property 3: Admin and Branch Manager see all leads**
    - For any array of leads, when role is admin or branch_manager, the filter returns the entire unmodified array.
    - **Validates: Requirements 5.3**

  - [ ]* 5.4 Write property test for lead card required fields (Property 9)
    - **Property 9: Lead card displays required fields**
    - For any lead with random name, source, assignedTo, and trialDate, the rendered output contains the lead's name, source label, trainer name (or "Unassigned"), and formatted trial date (or empty if null).
    - **Validates: Requirements 7.2**

- [ ] 6. Implement Add/Edit Lead modal and Claim action
  - [x] 6.1 Create Add/Edit Lead drawer/modal component
    - Reuse existing `Drawer` component pattern
    - Form fields: Name (required), Phone (required, formatted via `formatPhoneE164`), Email (optional), Source (select: Social Media, Walk-in, Referral), Status (select, edit-only, defaults to New on create), Assigned To (select, edit-only, list of branch employees), Trial Date (date picker, optional), Notes (textarea, optional — on create becomes first note, on edit appends new note)
    - On create: call `createLead(gymId, input)` with success/error toast
    - On edit: call `updateLead(gymId, leadId, changes)` with success/error toast
    - _Requirements: 7.4, 7.5, 7.6, 1.4, 3.3, 3.4_

  - [ ]* 6.2 Write property test for claim lead (Property 4)
    - **Property 4: Claim lead sets assignedTo to trainer UID**
    - For any trainer UID and any unassigned lead, calling claim sets `assignedTo` to exactly the trainer's UID.
    - **Validates: Requirements 6.2**

- [ ] 7. Implement Convert to Member flow
  - [x] 7.1 Create Convert to Member modal component
    - Display lead name and phone (read-only)
    - Plan selector dropdown (fetch plans from `plans` subcollection)
    - Start date picker (defaults to today)
    - On confirm: call `createMember(gymId, { name, phone, planId, planName, startDate, endDate, lastVisitDate: null })`, then `updateLead(gymId, leadId, { status: 'Converted' })`, log `LEAD_CONVERTED` to audit, show success toast
    - Handle errors: if `createMember` fails, show error toast and don't update lead status; if `updateLead` fails after member creation, show warning toast
    - Retain lead document in Firestore (do not delete)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 7.2 Write property test for lead-to-member conversion integrity (Property 6)
    - **Property 6: Lead-to-member conversion data integrity**
    - For any lead with random name/phone and any valid plan, converting produces a member with matching name/phone and selected plan. Lead status becomes `'Converted'`.
    - **Validates: Requirements 10.2, 10.3**

- [ ] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement WhatsApp Quick Action (Cloud Function + frontend)
  - [x] 9.1 Create `functions/src/whatsapp/sendLeadWhatsApp.ts` Cloud Function
    - Callable Cloud Function following `sendBroadcast` pattern
    - Input: `{ gymId, phone, leadName }`
    - Validate auth and input, read `AISENSY_API_KEY` from env
    - Clean phone (strip non-digits, add `91` prefix if 10 digits)
    - Send via AiSensy API with `pingflow_lead_followup` template and params `[leadName, gymName]`
    - Return `{ success: boolean, error?: string }`
    - _Requirements: 9.2_

  - [x] 9.2 Export the new Cloud Function from `functions/src/index.ts`
    - Add `export * from './whatsapp/sendLeadWhatsApp'` to the index
    - _Requirements: 9.2_

  - [x] 9.3 Wire WhatsApp quick action button in Leads page
    - On click: call `httpsCallable('sendLeadWhatsApp')({ gymId, phone, leadName })` using `getFunctions(app, 'asia-south1')`
    - Show success toast on success, error toast with failure reason on error
    - Log `LEAD_WHATSAPP_SENT` to audit trail
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 10. Implement Conversion Heatmap analytics (Pro only)
  - [x] 10.1 Add Conversion Heatmap section to Leads page
    - Filter leads with `status === 'Converted'`, group by `assignedTo` (trainer) and by `source`
    - Display conversion counts per trainer and per source
    - Gate behind `canAccess('leads_analytics')` — only visible for Pro plan users
    - Hide for starter and trial plans
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 10.2 Write property test for heatmap computation accuracy (Property 8)
    - **Property 8: Conversion heatmap computation accuracy**
    - For any array of leads with random statuses, assignedTo, and source values, the heatmap counts only `status === 'Converted'` leads. Sum of counts by assignedTo equals total converted. Sum of counts by source equals total converted.
    - **Validates: Requirements 12.1, 12.2, 12.4**

- [ ] 11. Wire routing and navigation
  - [x] 11.1 Update Sidebar with Leads navigation item
    - Add a leads/funnel SVG icon to the `Icons` object in `frontend/src/components/layout/Sidebar.tsx`
    - Add `{ icon: Icons.leads, label: 'Leads', path: '/leads', resource: 'leads', feature: 'leads' }` to `allNavItems` array, positioned after Members
    - _Requirements: 14.1_

  - [x] 11.2 Add `/leads` route to `frontend/src/App.tsx`
    - Lazy-load `Leads` page: `const LeadsPage = lazy(() => import('@/pages/Leads'))`
    - Add route: `<Route path="/leads" element={<PageGuard resource="leads"><LeadsPage /></PageGuard>} />`
    - _Requirements: 14.2, 14.3, 14.4_

- [ ] 12. Add Firestore composite index for leads
  - [x] 12.1 Update `firestore.indexes.json` with leads composite index
    - Add composite index on `leads` collection: `status` (ASC) + `createdAt` (DESC)
    - _Requirements: 1.5_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check + Vitest
- Unit tests validate specific examples and edge cases
- The existing Firestore wildcard security rules already cover the leads subcollection — no new rules needed (Requirement 13.1–13.4)
- The design specifies TypeScript throughout, so all implementation uses TypeScript
