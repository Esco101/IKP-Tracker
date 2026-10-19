# Security Specification: Isuzu Out-Stock & Expedition VIN Tracker

## 1. Data Invariants

1. **Default-Deny Catch-All**: Every path not explicitly matched under `/databases/{database}/documents` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Authentication**: All read and write operations require an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
3. **Zero PII Storage & Strict Profile Isolation**: `operatorProfiles/{userId}` stores no PII (no email, phone, or physical address). Access is strictly isolated to the profile owner (`userId == request.auth.uid`) or a verified administrator (`isAdmin()`), with collection listing disabled (`allow list: if false;`).
4. **No Self-Assigned Privileges**: `operatorProfiles/{userId}` contains no `role` or `isAdmin` field. Owner/Admin privileges are derived exclusively from `/admins/{uid}` existence or the verified bootstrap owner email (`escoriyanto@gmail.com` with `email_verified == true`).
5. **Relational Parent Existence on Create**: Creating an `outStockUnits/{unitId}` document requires that the operator's profile `/operatorProfiles/$(request.auth.uid)` exists and its `uid` matches `request.auth.uid`.
6. **Strict Schema & Key Enforcement**: Both `OperatorProfile` and `OutStockUnit` enforce `hasAll` and `hasOnly` key checks, exact string length bounds, enum validation (`TRAGA`, `ELF`, `GIGA`, `D-MAX`, `MU-X` and `OUT_GATE`, `IN_TRANSIT`, `DELIVERED`), and regex guards on IDs and VINs.
7. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` must equal `request.time`. On update, `createdByUid`, `createdAt`, `vin`, and `workspaceId` are strictly immutable (`incoming().field == existing().field`).
8. **Terminal State Locking**: Once an `outStockUnits/{unitId}` reaches `status == 'DELIVERED'`, non-admin operators cannot modify or delete the record.
9. **Cost-Optimized Secure List Queries**: `allow list` on `outStockUnits` contains zero `get()` or `exists()` calls and enforces `resource.data` filtering (`existing().createdByUid == request.auth.uid` or verified owner querying `existing().workspaceId == 'isuzu-yard-01'`).

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Unit Create)**: Authenticated user `user_A` attempts to create `outStockUnits/unit_1` with `createdByUid: "user_B"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Shadow Field Injection on Create)**: User sends valid `OutStockUnit` payload plus extra ghost field `"isAdmin": true`. -> `PERMISSION_DENIED`
3. **Payload 3 (Unverified Admin Email Spoof)**: Attacker with `email: "escoriyanto@gmail.com"` but `email_verified: false` attempts to read or list `outStockUnits`. -> `PERMISSION_DENIED`
4. **Payload 4 (Invalid Vehicle Type Enum)**: User attempts to create `outStockUnits/unit_2` with `vehicleType: "FORKLIFT"` (not in `TRAGA`, `ELF`, `GIGA`, `D-MAX`, `MU-X`). -> `PERMISSION_DENIED`
5. **Payload 5 (VIN Format / Length Poisoning)**: User attempts to create `outStockUnits/unit_3` with lowercase/special characters `vin: "drop table;--"` or a 5,000-char string. -> `PERMISSION_DENIED`
6. **Payload 6 (Client Timestamp Forgery)**: User attempts to create or update `outStockUnits/unit_4` with a past/future `createdAt` or `updatedAt` != `request.time`. -> `PERMISSION_DENIED`
7. **Payload 7 (Orphaned Unit Create Without OperatorProfile)**: User `user_no_profile` attempts to create `outStockUnits/unit_5` before creating `/operatorProfiles/user_no_profile`. -> `PERMISSION_DENIED`
8. **Payload 8 (Terminal State Mutation)**: Operator attempts to update `status` or `notes` on an `outStockUnits/unit_6` whose existing `status` is already `'DELIVERED'`. -> `PERMISSION_DENIED`
9. **Payload 9 (Immutable VIN / Owner Mutation on Update)**: Operator attempts to change `vin` or `createdByUid` during an update to `outStockUnits/unit_7`. -> `PERMISSION_DENIED`
10. **Payload 10 (Value Poisoning on Whitelisted Update Field)**: Operator updates only `['status', 'notes', 'updatedAt']`, but sets `notes` to an integer `12345` or a 10KB string. -> `PERMISSION_DENIED`
11. **Payload 11 (Cross-Tenant Unfiltered List Query)**: Expedition user `user_A` attempts an unfiltered `getDocs(collection(db, 'outStockUnits'))` that touches records where `createdByUid != 'user_A'`. -> `PERMISSION_DENIED`
12. **Payload 12 (Profile Enumeration Attack)**: Authenticated user attempts to `list` `/operatorProfiles` or `get` `/operatorProfiles/other_user`. -> `PERMISSION_DENIED`
