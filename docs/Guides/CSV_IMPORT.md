# CSV Import Documentation

Nestarr supports importing inventory items from CSV (Comma-Separated Values) files. This feature allows you to bulk import items with their details, including support for downloading images from URLs.

## CSV File Requirements

### Required Columns

The CSV file must contain at least one of the following columns for item names:
- `name`
- `item`
- `item_name`

### Supported Columns

The import feature recognizes the following columns (case-insensitive). Multiple aliases are supported for each field:

#### Basic Item Information
- **Name**: `name`, `item`, `item_name`
- **Description/Notes**: `description`, `notes`, `desc`, `details`, `item_description`
- **Brand**: `brand`, `manufacturer`
- **Model**: `model`, `model_number`, `model_no`
- **Serial Number**: `serial`, `serial_number`, `serial_no`, `sn`
- **UPC/Barcode**: `upc`, `barcode`, `upc_code`

#### Location
- **Location**: `location`, `location_name`, `room`, `place`

#### Purchase Information
- **Purchase Price**: `purchase_price`, `price`, `cost`, `purchase_cost`
- **Purchase Date**: `purchase_date`, `date_purchased`, `bought_date`
- **Retailer**: `retailer`, `store`, `vendor`, `seller`
- **Estimated Value**: `estimated_value`, `value`, `current_value`, `replacement_value`

#### Warranty
- **Warranty Duration**: `warranty_duration`, `warranty`, `warranty_months`

#### Images
- **Single Image URL**: `image_url`, `image`, `photo_url`, `photo`, `picture_url`, `picture`
- **Multiple Image URLs**: `image_urls`, `images`, `photos`, `pictures`

## CSV Format Examples

### Minimal Example

```csv
name
TV
Couch
Dining Table
```

### Basic Example with Common Fields

```csv
name,location,brand,purchase_price
TV,Living Room,Samsung,899.99
Couch,Living Room,IKEA,599.00
Dining Table,Kitchen,West Elm,1200.00
```

### Full Example with All Fields

```csv
name,location,brand,model,serial,description,purchase_price,purchase_date,retailer,estimated_value,upc,warranty_duration,image_url
Samsung 4K TV,Living Room,Samsung,UN55RU7100,ABC123456789,55-inch 4K Smart TV,899.99,2023-01-15,Best Buy,850.00,887276342986,12 months,https://example.com/tv.jpg
IKEA Couch,Living Room,IKEA,EKTORP,XYZ987654,Three-seat sofa in gray,599.00,2022-06-20,IKEA,550.00,,24 months,https://example.com/couch.jpg
```

### Example with Multiple Image URLs

You can provide multiple image URLs for a single item by using the `image_urls` column and separating URLs with semicolons (`;`) or pipes (`|`):

```csv
name,location,image_urls
Antique Vase,Living Room,https://example.com/vase1.jpg;https://example.com/vase2.jpg;https://example.com/vase3.jpg
Leather Chair,Office,https://example.com/chair-front.jpg|https://example.com/chair-side.jpg
```

## Data Format Guidelines

### Dates
Dates can be provided in any of the following formats:
- `YYYY-MM-DD` (e.g., 2023-01-15)
- `MM/DD/YYYY` (e.g., 01/15/2023)
- `MM/DD/YY` (e.g., 01/15/23)
- `DD/MM/YYYY` (e.g., 15/01/2023)
- `DD/MM/YY` (e.g., 15/01/23)
- `Mon DD, YYYY` (e.g., Jan 15, 2023)
- `Month DD, YYYY` (e.g., January 15, 2023)

### Currency Values
Currency values can include symbols and formatting:
- With dollar sign: `$899.99`
- With commas: `1,200.00`
- Plain numbers: `599.99`

The import process automatically removes currency symbols and commas.

### Warranty Duration
Warranty duration can be specified as:
- Months: `12` or `12 months`
- Years: `2 years` (automatically converted to 24 months)

### Image URLs
- Images are downloaded automatically during import
- Supported formats: JPG, JPEG, PNG, GIF, WebP
- URLs should be publicly accessible (no authentication required)
- For multiple images, separate URLs with semicolons (`;`) or pipes (`|`)
- The first successfully downloaded image becomes the primary photo

## Import Options

When importing a CSV file, you can configure the following options:

### Automatically Create Locations
- **Enabled (default)**: Locations specified in the CSV that don't exist will be created automatically
- **Disabled**: Only existing locations will be used; items with non-existent locations won't be assigned a location

### Parent Location
- Optionally select an existing location to serve as the parent for all newly created locations
- Useful for organizing imports under a specific property or area

## Best Practices

1. **Test with a small file first**: Before importing hundreds of items, test with a CSV containing 5-10 items to verify the format
2. **Use descriptive location names**: Location names like "Living Room" or "Master Bedroom" are clearer than "Room1" or "Area A"
3. **Include image URLs when available**: Images greatly improve item identification and documentation
4. **Keep URLs publicly accessible**: Ensure image URLs don't require authentication or special access
5. **Use consistent date formats**: Pick one date format and use it throughout your CSV file
6. **Review after import**: Check the import log to see which items were created and if any images failed to download

## Troubleshooting

### Images Not Downloading
- Verify the URLs are publicly accessible
- Check that URLs point directly to image files (not HTML pages)
- Ensure the image format is supported (JPG, PNG, GIF, or WebP)
- Check the import log for specific error messages

### Locations Not Created
- Ensure "Automatically create locations" is enabled
- Verify location names in the CSV don't have leading/trailing spaces
- Check that the column is named correctly (e.g., `location`, `room`, `place`)

### Items Missing After Import
- Check that each row has a valid name/item column value
- Review the import log for error messages
- Verify the CSV file uses commas as delimiters (not tabs or other separators)

### Date/Currency Values Not Parsing
- Check that values follow one of the supported formats
- Remove any unusual characters or formatting
- Use standard formats (YYYY-MM-DD for dates, plain numbers for currency)

## Example CSV Template

You can use this template as a starting point:

```csv
name,location,brand,model,serial,description,purchase_price,purchase_date,retailer,estimated_value,image_url
Item Name,Location Name,Brand,Model #,Serial #,Description,999.99,2023-01-01,Store Name,950.00,https://example.com/image.jpg
```

Save this as a `.csv` file and replace the sample data with your actual inventory items.

## Limitations

- Image download timeout: 30 seconds per image
- Maximum file size: Depends on server configuration (typically 100MB)
- Encoding: CSV files should be UTF-8 encoded (with or without BOM)

## Support

For issues or questions about CSV import:
- Check the import log for detailed error messages
- Review this documentation
- File an issue on the [GitHub repository](https://github.com/tokendad/Nestarr/issues)
