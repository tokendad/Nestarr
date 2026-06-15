# Living Items User Guide

## Overview

Living Items is a feature in Nestarr v6.15.0+ that allows you to track people, pets, and plants as part of your home inventory. This guide explains how to use the feature effectively.

## What are Living Items?

Living Items are inventory items that represent living things:
- **People** - Family members, roommates, tenants
- **Pets** - Dogs, cats, birds, reptiles, etc.
- **Plants** - Houseplants, garden plants

Unlike regular inventory items, Living Items have special fields for birthdates, contact information, and relationships.

## Accessing Living Items

### For People and Pets

1. Navigate to your **Home** location in the Locations view
2. Click on the Home location to open its details
3. Select the **"Living"** tab (appears only for Home location)
4. You'll see a list of all people and pets organized in separate sections

### For Plants

Plants are tracked as regular items with the "Living" tag. They can be placed in any room or location, not just Home.

## Adding People and Pets

1. Open the Home location and go to the **Living** tab
2. Click the **"+ Add"** button
3. Choose **"Person"** or **"Pet"**
4. Fill in the details:
   - **Name** - Full name (required)
   - **Birthdate** - For age calculation
   - **Relationship** - Self, spouse, child, pet, etc.
   - **Contact Info** - Phone, email, address
   - **Emergency Contacts** - (People only) Backup contact information
   - **Profile Photo** - Upload a photo (circular display)

5. Click **"Save"** to add the living item

## Fields Explained

### Common Fields (People & Pets)

| Field | Description | Required |
|-------|-------------|----------|
| **Name** | Full name of person or pet | ✅ Yes |
| **Birthdate** | Date of birth (shows calculated age) | ❌ No |
| **Relationship Type** | Type (self, family, pet, plant) | ✅ Yes |
| **Contact Info** | Phone, email, address, notes | ❌ No |
| **Profile Photo** | Photo (circular crop) | ❌ No |
| **Link to User Account** | Associate with a Nestarr user | ❌ No |

### People-Specific

- **Emergency Contacts** - List of backup contacts with name, phone, relationship
- **NO Medical Records** - For privacy/HIPAA compliance, medical info is not stored for people

### Pet-Specific

- **Medical Records** - Vet visits, vaccinations, medications
- **Microchip Number** - Pet identification
- **Breed & Species** - Dog, cat, bird, etc.
- **Care Instructions** - Special needs, diet, medications

### Plant-Specific

Plants are regular items tagged as "Living". Store care information in custom fields:
- **Watering Schedule** - How often to water
- **Sunlight Needs** - Full sun, partial shade, etc.
- **Fertilizer Schedule** - When and what to feed
- **Species** - Scientific or common name

## Managing Living Items

### Viewing Details

- Click on any person/pet name in the Living tab
- A detail modal opens showing all information
- Edit fields directly in the modal

### Editing

1. Click the person/pet name to open details
2. Click **"Edit"** button
3. Update any fields
4. Click **"Save"** to apply changes

### Deleting

1. Find the person/pet in the Living tab
2. Click the **trash icon** (🗑️) next to their name
3. Confirm the deletion
4. **Note:** This is permanent and cannot be undone

### Age Calculation

If a birthdate is provided, Nestarr automatically calculates and displays age:
- **Format:** "35 years old (born 1990-05-15)"
- **Updates:** Age recalculates each time you view the item

## Location Rules

**IMPORTANT:** People and pets MUST be assigned to the "Home" location.

- The backend automatically enforces this rule
- You cannot move people/pets to other rooms or locations
- This ensures family/pet information is centralized in one place

**Plants** are NOT restricted - they can be in any room or location.

## Privacy & Security

### HIPAA Compliance

- **People:** Medical records are NOT stored (HIPAA privacy requirement)
- **Pets:** Medical records ARE supported (vet records, vaccinations)

### Data Protection

- Contact information is stored securely in encrypted JSON fields
- Only authenticated users can view living items
- Access control respects user permissions (Admin, Editor, Viewer)

### Sensitive Information

Store only necessary information. Avoid:
- Social Security Numbers
- Financial account numbers
- Passwords or PINs
- Highly sensitive personal data

## API & Mobile App

### API Access

Living Items can be queried via the REST API:

```bash
# Get all living items
GET /api/items?is_living=true

# Get only pets
GET /api/items?relationship_type=pet

# Get people/pets at Home location
GET /api/items?is_living=true&location_id=<home-uuid>
```

### Mobile App

The [Nestarr Mobile App](https://github.com/tokendad/Android-Nestarr) will support Living Items in a future update. See [Android-Nestarr#66](https://github.com/tokendad/Android-Nestarr/issues/66) for progress.

## Tips & Best Practices

### For People

1. **Use "Self" for yourself** - Mark your own entry with `relationship_type = "self"`
2. **Link to user accounts** - Associate people with Nestarr user accounts for better tracking
3. **Keep emergency contacts updated** - Regularly review and update backup contact info
4. **Use profile photos** - Makes the interface more personal and easier to navigate

### For Pets

1. **Upload vet records** - Store vaccination certificates and medical history
2. **Record microchip number** - Essential for lost pet recovery
3. **Set reminders** - Use maintenance tracking for vet appointments and vaccinations
4. **Add photos** - Multiple photos (puppy stage, current, funny moments)

### For Plants

1. **Tag with "Living"** - Ensures plants are recognized as living items
2. **Add care instructions** - Store watering, sunlight, and fertilizer needs
3. **Use custom fields** - Create fields for purchase date, nursery, or planting location
4. **Track growth** - Add photos over time to document plant growth

## Troubleshooting

### "Living tab doesn't appear"

- **Solution:** The Living tab only appears on the **Home** location
- Check that you're viewing the Home location details, not another location

### "Can't move person/pet to another room"

- **Solution:** This is by design - people/pets must stay in Home location
- If you need to track a person at another property, create a separate "Home" location for that property

### "Medical records not showing for people"

- **Solution:** Medical records for people are intentionally disabled for HIPAA compliance
- Use the Notes field for non-medical health information if needed

### "Age calculation is wrong"

- **Solution:** Verify the birthdate is entered correctly (YYYY-MM-DD format)
- Age is calculated as years since birth (doesn't include months/days)

## Support

For bugs, feature requests, or questions:
- GitHub Issues: https://github.com/tokendad/Nestarr/issues
- Mobile App Issues: https://github.com/tokendad/Android-Nestarr/issues

---

**Version:** 6.15.0  
**Last Updated:** 2026-04-07
