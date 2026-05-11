# Requirements Document

## Introduction

PingFlow is a WhatsApp-based Gym CRM. This feature introduces a Lead Management System — a full lead pipeline that tracks prospective gym members from initial contact through conversion to active membership. Leads are stored as branch-scoped Firestore documents with status tracking across seven pipeline stages (New, Contacted, Trial Scheduled, Trial Done, Negotiation, Converted, Lost). The system integrates with the existing RBAC model (trainers see only their assigned or unassigned leads), the plan-based gating system (starter: 50 active leads with basic list view; pro: unlimited leads with conversion heatmap analytics), and WhatsApp messaging via AiSensy for quick lead outreach. A "Convert to Member" flow bridges the lead pipeline to the existing member management system.

## Glossary

- **Lead**: A Firestore document stored at `gyms/{gymId}/branches/{branchId}/leads/{leadId}` representing a prospective gym member with contact details, source, pipeline status, and assignment info
- **Lead_Status**: One of seven pipeline stages: `'New'`, `'Contacted'`, `'Trial Scheduled'`, `'Trial Done'`, `'Negotiation'`, `'Converted'`, `'Lost'`
- **Lead_Source**: The origin channel of a lead: `'Social Media'`, `'Walk-in'`, `'Referral'`
- **Lead_Note**: A timestamped text entry stored in the `notes` array field on a Lead document, recording interactions or observations
- **Lead_Pipeline**: The main UI view for managing leads, displaying leads organized by Lead_Status columns or a status-switcher interface
- **Active_Lead**: A Lead whose Lead_Status is not `'Converted'` and not `'Lost'`; used for plan limit counting
- **Assigned_Lead**: A Lead whose `assignedTo` field contains a staff member's UID
- **Unassigned_Lead**: A Lead whose `assignedTo` field is `null` or empty
- **Claim_Lead**: The action where a Trainer sets a Lead's `assignedTo` field to their own UID, taking ownership of that lead
- **Convert_To_Member**: The process of creating a Member document from a Lead's data, setting the member status to active, and marking the Lead's status as `'Converted'`
- **Conversion_Heatmap**: A Pro-only analytics view showing which trainer and which Lead_Source produce the most conversions
- **Masked_Phone**: A phone number displayed with middle digits hidden (e.g., `98******01`) for privacy in the UI
- **WhatsApp_Quick_Action**: A button next to each lead that triggers an AiSensy WhatsApp template message via a Cloud Function
- **Lead_Service**: The frontend service module (`leads.service.ts`) handling Firestore CRUD operations for leads
- **Permission_Map**: The centralized role-to-permission mapping in `permissionMap.ts`
- **Plan_Configuration**: The plan limits and features config in `planConfig.ts`
- **Audit_Trail**: The existing audit logging system that records significant user actions

## Requirements

### Requirement 1: Lead Firestore Schema

**User Story:** As a developer, I want a well-defined Firestore schema for leads, so that lead data is consistent and queryable across the application.

#### Acceptance Criteria

1. THE Lead SHALL be stored as a document in the collection `gyms/{gymId}/branches/{branchId}/leads`
2. THE Lead document SHALL contain the following fields: `name` (string), `phone` (string in E.164 format), `email` (string, optional), `source` (Lead_Source), `status` (Lead_Status), `assignedTo` (string UID or null), `trialDate` (Firestore Timestamp or null), `notes` (array of Lead_Note objects), `createdAt` (Firestore Timestamp), and `updatedAt` (Firestore Timestamp)
3. THE Lead_Note object SHALL contain `text` (string), `createdBy` (string UID), `createdAt` (Firestore Timestamp)
4. THE Lead document SHALL default `status` to `'New'` and `assignedTo` to `null` when created
5. THE Firestore indexes SHALL include a composite index on `branchId + status` for efficient pipeline queries

### Requirement 2: Lead TypeScript Type Definitions

**User Story:** As a developer, I want typed interfaces for leads, so that lead data is type-safe across the frontend codebase.

#### Acceptance Criteria

1. THE PingFlow SHALL define a `Lead` interface in the shared types module with all fields from the Lead Firestore schema
2. THE PingFlow SHALL define a `LeadStatus` type as the union: `'New' | 'Contacted' | 'Trial Scheduled' | 'Trial Done' | 'Negotiation' | 'Converted' | 'Lost'`
3. THE PingFlow SHALL define a `LeadSource` type as the union: `'Social Media' | 'Walk-in' | 'Referral'`
4. THE PingFlow SHALL define a `LeadNote` interface with `text`, `createdBy`, and `createdAt` fields

### Requirement 3: Lead CRUD Service

**User Story:** As a developer, I want a service module for lead Firestore operations, so that lead data access is centralized and branch-scoped.

#### Acceptance Criteria

1. THE Lead_Service SHALL use `getDataPathSegments()` from `useBranch` to resolve the branch-scoped collection path for leads
2. THE Lead_Service SHALL provide a `subscribeLeads` function that returns a real-time listener on the leads collection ordered by `createdAt` descending
3. THE Lead_Service SHALL provide a `createLead` function that creates a Lead document with default `status` of `'New'` and `assignedTo` of `null`
4. THE Lead_Service SHALL provide an `updateLead` function that updates specified fields on an existing Lead document and sets `updatedAt` to the server timestamp
5. THE Lead_Service SHALL provide a `deleteLead` function that removes a Lead document from Firestore
6. WHEN a lead is created, updated, or deleted, THE Lead_Service SHALL log the action to the Audit_Trail

### Requirement 4: Permission Map Update for Leads

**User Story:** As a gym owner, I want lead access controlled by the existing role system, so that each staff role has appropriate lead permissions.

#### Acceptance Criteria

1. THE Permission_Map SHALL include `'leads'` as a new Resource type
2. THE Permission_Map SHALL grant Admin full CRUD access (`create`, `read`, `update`, `delete`) to the leads resource
3. THE Permission_Map SHALL grant Branch_Manager full CRUD access to the leads resource
4. THE Permission_Map SHALL grant Trainer `read` and `update` access to the leads resource
5. THE Permission_Map SHALL grant Sales_Executive `create`, `read`, and `update` access to the leads resource
6. THE Permission_Map SHALL grant Receptionist `read` access to the leads resource
7. THE Permission_Map SHALL add `'leads'` to the `sidebarItems` array for Admin, Branch_Manager, Trainer, and Sales_Executive roles

### Requirement 5: Trainer Lead Privacy Scoping

**User Story:** As a gym owner, I want trainers to see only leads assigned to them or unassigned new leads, so that lead data is private between trainers.

#### Acceptance Criteria

1. WHILE the current user's role is Trainer, THE Lead_Pipeline SHALL display only leads where `assignedTo` equals the Trainer's UID or where `assignedTo` is null and `status` is `'New'`
2. WHILE the current user's role is Trainer, THE Lead_Pipeline SHALL hide leads with `status` of `'Converted'` or `'Lost'`
3. WHILE the current user's role is Admin or Branch_Manager, THE Lead_Pipeline SHALL display all leads regardless of assignment or status

### Requirement 6: Claim Lead Action

**User Story:** As a trainer, I want to claim an unassigned lead, so that I take ownership and other trainers can no longer see that lead.

#### Acceptance Criteria

1. WHEN a Lead is unassigned and has `status` of `'New'`, THE Lead_Pipeline SHALL display a "Claim Lead" button for Trainer users
2. WHEN a Trainer clicks the "Claim Lead" button, THE Lead_Service SHALL update the Lead's `assignedTo` field to the Trainer's UID
3. WHEN a Trainer claims a Lead, THE Lead_Service SHALL log the claim action to the Audit_Trail with the Trainer's name and the Lead's name
4. WHEN a Lead's `assignedTo` field is already set to a non-null UID, THE Lead_Pipeline SHALL hide the "Claim Lead" button

### Requirement 7: Lead Pipeline UI

**User Story:** As a gym staff member, I want a visual pipeline view of all leads organized by status, so that I can track lead progress at a glance.

#### Acceptance Criteria

1. THE Lead_Pipeline SHALL display leads grouped by Lead_Status columns or provide a status-switcher to filter leads by status
2. THE Lead_Pipeline SHALL display each lead's name, source, assigned trainer name, and trial date (if set)
3. THE Lead_Pipeline SHALL allow users with `update` permission on leads to change a lead's status by moving the lead between status groups
4. THE Lead_Pipeline SHALL provide an "Add Lead" form accessible to users with `create` permission on leads
5. THE Lead_Pipeline SHALL provide an "Edit Lead" form accessible to users with `update` permission on leads
6. THE Lead_Pipeline SHALL include all Lead fields (name, phone, email, source, status, assignedTo, trialDate, notes) in the Add and Edit forms

### Requirement 8: Phone Number Masking

**User Story:** As a gym owner, I want lead phone numbers masked in the UI, so that sensitive contact data is not fully visible to all staff.

#### Acceptance Criteria

1. THE Lead_Pipeline SHALL display lead phone numbers in masked format with only the first two and last two digits visible (e.g., `98******01`)
2. THE Lead_Pipeline SHALL apply phone masking for all roles including Admin
3. THE WhatsApp_Quick_Action button SHALL remain functional despite the phone number being masked in the display

### Requirement 9: WhatsApp Quick Action

**User Story:** As a gym staff member, I want to send a WhatsApp message to a lead with one click, so that I can quickly reach out without manually copying the phone number.

#### Acceptance Criteria

1. THE Lead_Pipeline SHALL display a WhatsApp icon button next to each lead entry
2. WHEN a user clicks the WhatsApp_Quick_Action button, THE PingFlow SHALL trigger an AiSensy template message to the lead's phone number via a Cloud Function
3. WHEN the WhatsApp message is sent successfully, THE PingFlow SHALL display a success notification to the user
4. IF the WhatsApp message fails to send, THEN THE PingFlow SHALL display an error notification with the failure reason
5. WHEN a WhatsApp message is sent to a lead, THE Lead_Service SHALL log the action to the Audit_Trail

### Requirement 10: Convert Lead to Member

**User Story:** As a gym staff member, I want to convert a qualified lead into an active member, so that the lead's journey is completed and they appear in the member management system.

#### Acceptance Criteria

1. WHEN a user with `update` permission on leads clicks "Convert to Member" on a Lead, THE PingFlow SHALL open a modal prompting the user to select a Membership Plan
2. WHEN the user confirms the plan selection in the conversion modal, THE PingFlow SHALL create a new Member document using the Lead's name and phone number with the selected plan and `status` set to `'active'`
3. WHEN the user confirms the conversion, THE PingFlow SHALL update the Lead's `status` to `'Converted'`
4. THE PingFlow SHALL retain the converted Lead document in Firestore for analytics purposes and SHALL NOT delete the Lead document upon conversion
5. WHEN a Lead is successfully converted, THE PingFlow SHALL log the conversion to the Audit_Trail with the Lead name, selected plan, and new Member ID
6. IF the Lead's `status` is already `'Converted'`, THEN THE Lead_Pipeline SHALL hide the "Convert to Member" button for that Lead

### Requirement 11: Plan Gating for Leads

**User Story:** As a gym owner, I want lead access gated by my subscription plan, so that starter plan users have a capped experience and pro plan users get full analytics.

#### Acceptance Criteria

1. THE Plan_Configuration SHALL include `'leads'` in the Feature_Gate list for `'trial'`, `'starter'`, and `'pro'` Plan_Types
2. THE Plan_Configuration SHALL define a `leads` Resource_Limit: trial allows 50 active leads, starter allows 50 active leads, pro allows unlimited active leads
3. WHEN a user on the starter or trial plan attempts to create a new lead and the active lead count equals or exceeds 50, THE Lead_Pipeline SHALL display the Upgrade_Modal with a message indicating the active lead limit has been reached
4. IF the current Plan_Type is `'pro'`, THEN THE Lead_Pipeline SHALL allow lead creation without any count check

### Requirement 12: Conversion Heatmap Analytics (Pro Only)

**User Story:** As a gym owner on the Pro plan, I want to see which trainers and lead sources produce the most conversions, so that I can optimize my lead generation and staff allocation.

#### Acceptance Criteria

1. WHEN a Pro plan user views the Lead_Pipeline, THE PingFlow SHALL display a Conversion_Heatmap section showing conversion counts grouped by trainer
2. WHEN a Pro plan user views the Lead_Pipeline, THE PingFlow SHALL display conversion counts grouped by Lead_Source
3. WHILE the current Plan_Type is `'starter'` or `'trial'`, THE Lead_Pipeline SHALL hide the Conversion_Heatmap section
4. THE Conversion_Heatmap SHALL compute its data from the existing leads collection by counting leads with `status` of `'Converted'` grouped by `assignedTo` and `source` fields

### Requirement 13: Firestore Security Rules for Leads

**User Story:** As a developer, I want Firestore security rules for the leads subcollection, so that lead data is protected at the database level.

#### Acceptance Criteria

1. THE Firestore rules SHALL allow Admin users full read and write access to the leads subcollection under any branch
2. THE Firestore rules SHALL allow linked employees with the branch in their `assignedBranches` to read and write leads under that branch
3. THE Firestore rules SHALL deny read and write access to the leads subcollection for unauthenticated users
4. THE Firestore rules SHALL follow the same pattern as existing branch-scoped subcollection rules (members, plans, payments)

### Requirement 14: Application Routing and Navigation for Leads

**User Story:** As a gym staff member, I want to access the leads page from the sidebar and via a direct URL, so that lead management is integrated into the existing navigation.

#### Acceptance Criteria

1. THE Sidebar SHALL display a "Leads" navigation item for roles that have `leads` in their `sidebarItems` list in the Permission_Map
2. THE App.tsx SHALL include a `/leads` route wrapped in a `PageGuard` component with `resource="leads"`
3. WHEN a user without `read` permission on leads navigates to `/leads`, THE PageGuard SHALL display the "Access Denied" message
4. THE Leads page SHALL be lazy-loaded using React `lazy()` consistent with other page components
