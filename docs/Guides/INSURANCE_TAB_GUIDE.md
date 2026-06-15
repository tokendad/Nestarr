# Insurance Tab Feature Guide

## Overview

The Insurance Tab is a comprehensive feature added to Nestarr that allows you to manage insurance documentation for your primary locations (homes). This feature was introduced in PR #419 and is available in version 6.3.0 and later.

## How to Access the Insurance Tab

### Prerequisites

**IMPORTANT:** The Insurance tab is **only available for locations marked as "Primary Location (Home)"**.

### Step-by-Step Instructions

1. **Navigate to the Locations page** in Nestarr

2. **Identify or Create a Primary Location:**
   - Look for location cards with a "HOME" badge - these are primary locations
   - If you don't have any primary locations yet:
     - Click the "Add Location" button
     - Fill in the location details
     - **Check the "Primary Location (Home)" checkbox** ✓
     - Complete and save the location

3. **Open Location Settings:**
   - On the location card for your primary location, click the **⚙️ Settings** button
   - This opens the Location Details Modal

4. **Access the Insurance Tab:**
   - In the modal, you'll see two tabs at the top:
     - 📝 Details
     - 🏠 Insurance
   - Click the **🏠 Insurance** tab to access insurance features

## Insurance Tab Features

### Information Management

The Insurance tab allows you to manage:

#### Insurance Company Information
- Company name, address, email, phone
- Agent name
- Policy number

#### Policy Holders
- Primary policy holder (name, phone, email, address)
- Additional policy holders (unlimited)
- Each holder can have their own contact details

#### Property Details
- Property address (auto-populated from location)
- Purchase date and price
- Build date

#### Calculated Values
- **Total Value:** Property purchase price + sum of all item purchase prices
- **Estimated Value:** Property estimated value + sum of all item estimated values
- Values include items from the location and all sub-locations (recursive)

### Print & Export Options

The Insurance tab provides three export options:

#### 1. 📄 Print Basic
- Cover sheet with policy and property information
- One page per room with item tables
- Includes: Item name, model #, serial #, purchase price, purchase date, retailer

#### 2. 📋 Print Comprehensive
- Everything from Basic Print
- Plus: Primary photo and data tag photo for each item
- Includes estimated values

#### 3. 📊 Export CSV
- RFC 4180 compliant CSV file
- All items from the location and sub-locations
- Includes room name, item details, prices, and values
- Filename format: `insurance_[LocationName]_[Date].csv`

## Troubleshooting

### "I don't see the Insurance tab"

This is the most common issue. Check the following:

1. **Verify the location is marked as Primary:**
   - Open the location's Settings (⚙️ button)
   - Go to the Details tab
   - Ensure "Primary Location (Home)" checkbox is checked ✓
   - Save changes

2. **Check for the HOME badge:**
   - Primary locations display a "HOME" badge on their location card
   - If you don't see this badge, the location is not marked as primary

3. **Create a new primary location:**
   - If you're using seed/demo data from before version 6.3.0, it may not have any primary locations
   - Create a new location and mark it as primary, or
   - Edit an existing location to mark it as primary

### "The Settings button doesn't appear"

The Settings button (⚙️) should appear on all location cards. If it doesn't:
- Try refreshing the page
- Clear your browser cache
- Check that you're using version 6.3.0 or later

## Version History

- **v6.3.0** (2025-12-19): Initial release of Insurance Tab feature via PR #419
  - Added InsuranceTab component with full CRUD operations
  - Added LocationDetailsModal with tabbed interface
  - Implemented Basic and Comprehensive print functionality
  - Added CSV export with RFC 4180 compliance
  - Included security measures (HTML escaping, CSV escaping, filename sanitization)

## Technical Details

### Data Structure

Insurance information is stored in the `insurance_info` JSON field of the Location model with the following structure:

```typescript
interface InsuranceInfo {
  // Insurance Company
  company_name?: string;
  company_address?: string;
  company_email?: string;
  company_phone?: string;
  agent_name?: string;
  
  // Policy
  policy_number?: string;
  
  // Policy Holders
  primary_holder?: PolicyHolder;
  additional_holders?: PolicyHolder[];
  
  // Property
  purchase_date?: string;
  purchase_price?: number;
  build_date?: string;
}
```

### File Locations

- Frontend component: `src/components/InsuranceTab.tsx`
- Modal component: `src/components/LocationDetailsModal.tsx`
- Type definitions: `src/lib/api.ts` (InsuranceInfo, PolicyHolder interfaces)
- Integration: `src/components/LocationsPage.tsx`

## Support

If you continue to experience issues with the Insurance tab:
1. Verify you're running version 6.3.0 or later
2. Check that PR #419 was successfully merged
3. Review this guide for troubleshooting steps
4. Check the application logs for any errors
